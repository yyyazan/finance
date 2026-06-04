<script>
  // Dividend Wraith — a borderless 1x1 gauge for monthly dividend income. An
  // open-bottom ring (a "wraith" / horseshoe, not a closed donut) whose
  // multicolour bars are this month's payers, each sized by how much it
  // contributes. The hero $/mo rides in the ring's core; the open mouth at the
  // bottom carries the annual + yield. Hover a bar -> the core swaps to that
  // single stock.
  //
  // Each bar is a FILLED annular sector with a small, tunable corner radius (CR) —
  // not a round-capped stroke, whose rounding is locked to half the bar thickness.
  //
  // DATA IS MOCKED (mockDividends -> divYieldOf): real positions x a deterministic
  // mock yield. SWAP POINT: a real /api/dividends keeps the same {items,...} shape.
  import { mockDividends } from '$lib/mockStock.js';

  let { holdings = [], data = null } = $props();

  // ── gauge geometry (viewBox 0..120) ───────────────────────────────────────
  const CX = 60, CY = 60, R = 47, SW = 10;       // centreline radius + bar thickness
  const RI = R - SW / 2, RO = R + SW / 2;        // inner / outer edge radii
  const CR = 2.5;                                 // bar corner radius (small ratio)
  const GAP_DEG = 96;                             // open mouth at the bottom (6 o'clock)
  const ARC_START = 180 + GAP_DEG / 2;            // 228deg, clockwise from 12 o'clock
  const ARC_SWEEP = 360 - GAP_DEG;               // 264deg of visible ring

  const RAD = Math.PI / 180;
  // point on a circle, angle measured clockwise from 12 o'clock -> "x,y"
  const P = (ang, r) => `${(CX + r * Math.sin(ang * RAD)).toFixed(2)},${(CY - r * Math.cos(ang * RAD)).toFixed(2)}`;

  // one bar as a filled annular sector with rounded corners. CR is clamped to the
  // thickness and the arc length so tiny payers stay tidy. The corners are quadratic
  // curves through the sharp corner; sweep 1 = clockwise outer arc, 0 = inner arc back.
  const barPath = (a0, a1) => {
    const arcLen = (a1 - a0) * RAD * RO;
    const cr = Math.max(0.1, Math.min(CR, (SW / 2) * 0.9, (arcLen / 2) * 0.9));
    const aO = cr / RO / RAD;   // corner inset along the arcs, in degrees
    const aI = cr / RI / RAD;
    const big = a1 - a0 > 180 ? 1 : 0;
    return [
      'M', P(a0 + aO, RO),
      'A', RO, RO, 0, big, 1, P(a1 - aO, RO),
      'Q', P(a1, RO), P(a1, RO - cr),
      'L', P(a1, RI + cr),
      'Q', P(a1, RI), P(a1 - aI, RI),
      'A', RI, RI, 0, big, 0, P(a0 + aI, RI),
      'Q', P(a0, RI), P(a0, RI + cr),
      'L', P(a0, RO - cr),
      'Q', P(a0, RO), P(a0 + aO, RO),
      'Z',
    ].join(' ');
  };
  const trackPath = barPath(ARC_START, ARC_START + ARC_SWEEP);

  // multicolour accent deck (jade -> pink -> yellow -> blue -> purple -> coral);
  // the bucketed tail wears muted ink.
  const COLORS = ['#0fb39a', '#ff90e8', '#ffc900', '#5b8def', '#c994e8', '#ff6e5e'];
  const OTHER = '#8a8478';
  const MAX = 6; // top (MAX-1) payers + one "others" wedge

  const div = $derived(data ?? mockDividends(holdings));

  // top payers + an "others" bucket, laid along the arc with small gaps.
  const segs = $derived.by(() => {
    let list = div.items;
    if (list.length > MAX) {
      const head = list.slice(0, MAX - 1);
      const tail = list.slice(MAX - 1);
      list = [...head, {
        t: 'OTHER', name: `${tail.length} more`, other: true, yieldPct: null,
        monthly: tail.reduce((s, d) => s + d.monthly, 0),
        value: tail.reduce((s, d) => s + d.value, 0),
      }];
    }
    const total = div.monthlyTotal || 1;
    const n = list.length;
    const gap = n > 1 ? 3 : 0;
    const usable = ARC_SWEEP - gap * (n - 1);
    let a = ARC_START;
    return list.map((d, i) => {
      const span = (d.monthly / total) * usable;
      const seg = { ...d, color: d.other ? OTHER : COLORS[i % COLORS.length], d: barPath(a, a + span), i };
      a += span + gap;
      return seg;
    });
  });

  let hovered = $state(null); // ticker, or null
  const active = $derived(hovered ? segs.find((s) => s.t === hovered) : null);
  const has = $derived(div.monthlyTotal > 0);

  const m0 = (v) => '$' + Math.round(v ?? 0).toLocaleString('en-US');
</script>

<div class="wraith" role="img"
  aria-label={has ? `Dividends - about ${m0(div.monthlyTotal)} a month, ${m0(div.annualTotal)} a year` : 'No dividends yet'}>
  <div class="wr-stage" onpointerleave={() => (hovered = null)}>
    <svg viewBox="0 0 120 120" class="wr-svg">
      <!-- faint rail so the ring shape always reads -->
      <path d={trackPath} class="wr-track" />
      {#each segs as s (s.t)}
        <path d={s.d} fill={s.color} class="wr-seg" class:dim={hovered && hovered !== s.t}
          style="--i:{s.i}" onpointerenter={() => (hovered = s.t)}>
          <title>{s.name} - {m0(s.monthly)}/mo</title>
        </path>
      {/each}
    </svg>

    <div class="wr-core">
      {#if active}
        <div class="wr-tag"><span class="wr-dot" style="background:{active.color}"></span>{active.t}</div>
        <div class="wr-hero">{m0(active.monthly)}<span class="wr-per">/mo</span></div>
        <div class="wr-sub">{active.other ? active.name : `${active.yieldPct != null ? active.yieldPct.toFixed(1) : '-'}% yld`}</div>
      {:else if has}
        <div class="wr-tag">dividends</div>
        <div class="wr-hero">{m0(div.monthlyTotal)}<span class="wr-per">/mo</span></div>
        <div class="wr-sub">{m0(div.annualTotal)}/yr &middot; {div.yieldOnValue.toFixed(1)}%</div>
      {:else}
        <div class="wr-tag">dividends</div>
        <div class="wr-hero">$0<span class="wr-per">/mo</span></div>
        <div class="wr-sub">none yet</div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* borderless: no card frame - the colour ring carries the weight, floating on
     paper beside the bordered Cash-Goal tile. */
  .wraith { display: grid; place-items: center; height: 100%; min-height: 132px; padding: 2px; min-width: 0; }
  .wr-stage { position: relative; height: 100%; aspect-ratio: 1 / 1; max-height: 168px; }
  .wr-svg { display: block; width: 100%; height: 100%; overflow: visible; }

  .wr-track { fill: color-mix(in srgb, var(--ink) 9%, transparent); }
  .wr-seg { cursor: pointer; transition: filter .16s ease; }
  /* dim via filter (not the opacity property) so it never fights the load reveal */
  .wr-seg.dim { filter: opacity(.26); }

  /* staggered fade-in on load */
  .wr-seg { opacity: 0; animation: wr-in .5s ease forwards; animation-delay: calc(var(--i) * .07s); }
  @keyframes wr-in { to { opacity: 1; } }

  /* core: centred over the ring; never steals the bars' pointer hover */
  .wr-core { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px; text-align: center; pointer-events: none; }
  .wr-tag { display: flex; align-items: center; gap: 5px; font-family: var(--sans); font-size: 9px;
    font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: var(--muted);
    max-width: 92px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wr-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; }
  .wr-hero { font-family: var(--mono); font-size: 30px; font-weight: 700; line-height: 1; color: var(--ink);
    font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
  .wr-per { font-size: 12px; font-weight: 700; color: var(--muted); margin-left: 1px; }
  .wr-sub { font-family: var(--mono); font-size: 9.5px; font-weight: 700; color: var(--muted);
    font-variant-numeric: tabular-nums; white-space: nowrap; margin-top: 2px; }

  @media (prefers-reduced-motion: reduce) {
    .wr-seg { animation: none; opacity: 1; }
  }
</style>
