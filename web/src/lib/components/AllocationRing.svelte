<script>
  // Allocation Ring — the Dividend Wraith's sibling: a borderless 1×1 donut of
  // portfolio weights (the allocation strip's job, shrunk to a glance). Top six
  // positions get a segment each, the tail folds into "other". Hover a segment
  // → the core swaps to that holding; click → the stock view.
  import { openStock, cardToHolding } from '$lib/stores.js';

  let { holdings = [] } = $props();   // dashboard cards (non-joker)

  const CX = 60, CY = 60, R = 47, SW = 10;
  const C = 2 * Math.PI * R;
  const GAP = 2.2;                    // ring units between segments
  const MAX_SEGS = 6;

  // suit palette from the design page, then gray for the folded tail
  const COLORS = ['#5fb3c4', '#e08a6a', '#0fb39a', '#d8b878', '#9bbf8a', '#c994e8'];
  const OTHER_C = '#b4b2a9';

  const segs = $derived.by(() => {
    const rows = [...holdings]
      .filter((c) => (c.position_pct ?? 0) > 0)
      .sort((a, b) => (b.position_pct ?? 0) - (a.position_pct ?? 0));
    const top = rows.slice(0, MAX_SEGS);
    const tailPct = rows.slice(MAX_SEGS).reduce((s, c) => s + (c.position_pct ?? 0), 0);
    const items = top.map((c, i) => ({
      key: c.ticker, label: c.ticker, pct: c.position_pct ?? 0, color: COLORS[i % COLORS.length], card: c,
    }));
    if (tailPct > 0.05) items.push({ key: '·other', label: 'other', pct: tailPct, color: OTHER_C, card: null });
    // normalise to 100 so rounding never overflows the ring
    const total = items.reduce((s, x) => s + x.pct, 0) || 1;
    let acc = 0;
    return items.map((x) => {
      const len = (x.pct / total) * C;
      const seg = { ...x, len: Math.max(0, len - GAP), offset: -acc };
      acc += len;
      return seg;
    });
  });

  let hovered = $state(null);
  const focus = $derived(hovered ?? segs[0] ?? null);

  function pick(s) {
    if (!s?.card) return;
    openStock({ ticker: s.card.ticker, name: s.card.company_name, holding: cardToHolding(s.card) });
  }
</script>

<div class="ring" role="img" aria-label="Allocation by weight">
  <div class="rg-stage">
    <svg class="rg-svg" viewBox="0 0 120 120">
      <g transform="rotate(-90 {CX} {CY})">
        {#each segs as s (s.key)}
          <circle
            cx={CX} cy={CY} r={R} fill="none"
            stroke={s.color} stroke-width={hovered?.key === s.key ? SW + 2 : SW}
            stroke-dasharray="{s.len} {C - s.len}" stroke-dashoffset={s.offset}
            class="rg-seg" class:clickable={!!s.card}
            role={s.card ? 'button' : undefined}
            onmouseenter={() => (hovered = s)} onmouseleave={() => (hovered = null)}
            onclick={() => pick(s)} />
        {/each}
      </g>
    </svg>
    <div class="rg-core">
      <span class="rg-label">allocation</span>
      {#if focus}
        <span class="rg-hero">{focus.pct.toFixed(1)}<small>%</small></span>
        <span class="rg-sub" style="color:{focus.color}">
          <span class="rg-dot" style="background:{focus.color}"></span>{focus.label}
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
  .ring { display: grid; place-items: center; height: 100%; min-height: 132px; padding: 2px; min-width: 0; }
  .rg-stage { position: relative; height: 100%; aspect-ratio: 1 / 1; max-height: 168px; }
  .rg-svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .rg-seg { transition: stroke-width .15s ease; }
  .rg-seg.clickable { cursor: pointer; }

  .rg-core { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 2px; pointer-events: none; text-align: center; }
  .rg-label { font-family: var(--sans); font-size: 8.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .14em; color: var(--muted); }
  .rg-hero { font-family: var(--mono); font-size: 26px; font-weight: 700; line-height: 1; color: var(--ink);
    font-variant-numeric: tabular-nums; }
  .rg-hero small { font-size: 14px; }
  .rg-sub { display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 11px;
    font-weight: 700; }
  .rg-dot { width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid var(--ink); }
</style>
