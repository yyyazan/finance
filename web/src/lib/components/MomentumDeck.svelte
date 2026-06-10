<script>
  // Momentum deck + peek. Takes the dashboard `cards` payload, polls /api/momentum
  // for live intraday moves, and renders the fan (sorted by biggest move) beside a
  // sticky peek. Click a card to inspect it; click again (or nothing selected) →
  // peek defaults to the biggest mover.
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  // `chart` is an optional snippet rendered in the empty cols 4–6 of the deck row
  // (the space the 1×2 peek freed) — the dashboard passes the portfolio chart there.
  let { cards = [], chart, aboveDeck, belowDeck, belowDeck2, onOpenStock } = $props();

  let moveWin = $state('day');   // 'day' | 'wk'
  let hovered = $state(null);    // index of card under cursor (geometry-driven, not :hover)
  let moves = $state({});        // live /api/momentum overlay

  const SUIT_SYMBOL = { sp: '♠', ht: '♥', dm: '♦', cl: '♣', jk: '★' };
  const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

  const holdings = $derived(
    (cards ?? []).filter((c) => c && !c.is_joker).map((c) => ({
      t: c.ticker, name: c.company_name, suit: c.suit,
      pct: c.position_pct, day: c.day_pct, wk: c.week_pct, ret: c.voo_delta_pp ?? 0,
      value: c.market_value, last: c.current_price, shares: c.shares, basis: c.cost_basis,
      hold: c.hold_days, domain: c.domain,
    }))
  );

  // live move (fresh /api/momentum) with frozen-payload fallback for first paint
  const moveOf = (h, win) => {
    const live = moves[h.t];
    const v = live ? (win === 'day' ? live.day_pct : live.week_pct) : (win === 'day' ? h.day : h.wk);
    return v ?? 0;
  };

  // rank by weight: heaviest = A
  const rankOf = $derived.by(() => {
    const m = {};
    [...holdings].sort((a, b) => (b?.pct ?? 0) - (a?.pct ?? 0)).forEach((h, i) => { m[h.t] = RANKS[i] ?? '2'; });
    return m;
  });

  // ascending |move| → biggest mover renders last (face-up at the right)
  const movers = $derived([...holdings].sort((a, b) => Math.abs(moveOf(a, moveWin)) - Math.abs(moveOf(b, moveWin))));
  const maxMove = $derived(Math.max(1, ...holdings.map((h) => Math.abs(moveOf(h, moveWin)))));

  // felt shows the top MAX_CARDS movers (last of the ascending-|move| sort, so the
  // biggest mover is rightmost / face-up); the ribbon below covers every holding,
  // so capping the fan loses nothing.
  const MAX_CARDS = 9;
  const visibleMovers = $derived(movers.slice(-MAX_CARDS));
  // ribbon: every holding, heaviest → lightest, so width reads as concentration.
  const byWeight = $derived([...holdings].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)));

  const CARD_W = 132;       // .mcard width; keep in sync with CSS
  const SLIVER = 31;        // fixed snug peek per card
  let fanW = $state(0);     // measured inner width of the fan track (the 2×1 felt)
  // snug fixed fan: every card advances by exactly SLIVER (the visible sliver), the
  // last card fully shown. Cards do NOT stretch to fill — they sit left-aligned.
  // Only shrink below SLIVER as a safety if the capped fan still overflows the felt.
  const fanStep = $derived.by(() => {
    const n = visibleMovers.length;
    if (n <= 1) return CARD_W;
    if (!fanW) return SLIVER;
    return Math.min(SLIVER, (fanW - CARD_W) / (n - 1));
  });

  // x (from the felt's left edge) of the fan's right edge + a small gap — so the
  // 1d/1wk toggle tracks the fan as it re-flows on resize (fanStep shrinks on a
  // narrow felt). 14 = felt padding-left; fan width = CARD_W + (n-1)·fanStep.
  const toggleAnchor = $derived(14 + CARD_W + Math.max(0, visibleMovers.length - 1) * fanStep + 11);

  // Which card is "hovered" is a pure function of cursor-X over the fixed fan
  // geometry (each card advances by `fanStep`) — NOT per-card :hover. A popped
  // card covers its right neighbours, so :hover would get stuck on it and skip
  // ~5 cards when scrubbing left→right. Geometry can't be fooled by what's
  // painted on top, so both scrub directions flip through cards smoothly.
  function onFanMove(e) {
    if (!fanStep) return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    hovered = Math.max(0, Math.min(Math.floor(x / fanStep), visibleMovers.length - 1));
  }

  // featured peek = today's biggest mover. Clicking any holding (card / ribbon / peek)
  // opens its full detail; `enrich` adds the derived position fields the detail needs.
  const peekH = $derived(movers[movers.length - 1] || null);
  function enrich(h) {
    if (!h) return null;
    // `basis` is the per-share weighted avg cost (total invested = basis × shares).
    const invested = h.basis != null && h.shares ? h.basis * h.shares : null;
    return {
      ...h,
      avg: h.basis ?? null,
      retPct: invested ? (h.value / invested - 1) * 100 : null,
      gain: invested != null ? h.value - invested : null,
      dayMove: moveOf(h, 'day'),
      weekMove: moveOf(h, 'wk'),
    };
  }
  const peek = $derived(enrich(peekH));
  function openStock(h) { const e = enrich(h); if (e) onOpenStock?.(e); }

  const f = (n) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctS = (n) => ((n ?? 0) > 0 ? '+' : '') + (n ?? 0).toFixed(1) + '%';   // 0 → "0.0%"
  const usd = (n) => ((n ?? 0) >= 0 ? '+$' : '−$') + f(Math.abs(n ?? 0));

  async function loadMomentum() {
    try { const m = await api.momentum(); moves = m.moves ?? {}; } catch { /* keep last */ }
  }
  onMount(() => {
    loadMomentum();
    const t = setInterval(loadMomentum, 60_000);
    return () => clearInterval(t);
  });

  let peekW = $state(0);     // measured peek width → the spine matches it exactly
</script>

<div class="deck-peek">
  <div class="deck-col">
    {#if aboveDeck}<div class="deck-kpis">{@render aboveDeck()}</div>{/if}
    <div class="felt">
    <div class="winbar" style="left: calc({toggleAnchor}px + var(--toggle-x))">
      <button class:on={moveWin === 'day'} onclick={() => (moveWin = 'day')}>1d</button>
      <button class:on={moveWin === 'wk'} onclick={() => (moveWin = 'wk')}>1wk</button>
    </div>
    <div class="mfan" role="group" bind:clientWidth={fanW} onpointermove={onFanMove} onpointerleave={() => (hovered = null)}>
      {#each visibleMovers as h, i (h.t)}
        {@const mv = moveOf(h, moveWin)}
        <button class="mcard suit-{h.suit}" class:hovered={hovered === i}
                style="margin-left:{i === 0 ? 0 : fanStep - CARD_W}px; --sliver:{fanStep}px"
                onclick={() => openStock(h)}>
          <div class="mstrip {mv >= 0 ? 'up' : 'down'}">
            <span class="mstrip-fill" style="height:{Math.max(3, Math.abs(mv) / maxMove * 50).toFixed(1)}%"></span>
          </div>
          <div class="mpct {mv >= 0 ? 'up' : 'down'}">{pctS(mv)}</div>
          <div class="mindex tl">
            <span class="mi-rank">{rankOf[h.t]}</span>
            <span class="mi-suit">{SUIT_SYMBOL[h.suit]}</span>
            <span class="mi-tkr">{h.t}</span>
          </div>
          <div class="mindex br">
            <span class="mi-rank">{rankOf[h.t]}</span>
            <span class="mi-suit">{SUIT_SYMBOL[h.suit]}</span>
            <span class="mi-tkr">{h.t}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>

    <!-- 2 small widgets (Cash + Goal) directly under the deck -->
    <div class="deck-slot" class:filled={belowDeck}>
      {#if belowDeck}
        {@render belowDeck()}
      {:else}
        <span aria-hidden="true">reserved · 2×1</span>
      {/if}
    </div>

    <!-- second row under cash/wraith: two 1×1 future-use widgets -->
    <div class="deck-slot2">
      {#if belowDeck2}
        {@render belowDeck2()}
      {:else}
        <div class="deck-ph" aria-hidden="true">＋</div>
        <div class="deck-ph" aria-hidden="true">＋</div>
      {/if}
    </div>
  </div>

  {#if peek}
    <aside class="peek" bind:clientWidth={peekW} style={peekW ? `--pw:${peekW}px` : ''}>
      <!-- the ink shadow is its own layer so it can outpace the white body on hover -->
      <div class="peek-shadow"></div>
      <div class="peek-card glass-card">

        <!-- the featured (biggest-mover) glance; the whole spine is the button that
             opens the full stock detail -->
        <div class="peek-left" role="button" tabindex="0"
             aria-label={`Open ${peek.t} detail`}
             onclick={() => onOpenStock?.(peek)}
             onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenStock?.(peek); } }}>
          <!-- identity band: ticker + name + price + today's move -->
          <div class="pk-top">
            <div class="pk-head">
              <div class="pk-id">
                <div class="pk-tkr">{peek.t}</div>
                <div class="pk-name">{peek.name}</div>
              </div>
              <span class="pk-go" aria-hidden="true">→</span>
            </div>
            <div class="pk-price">
              <span class="pk-px">${f(peek.last)}</span>
              <span class="pk-day {peek.dayMove >= 0 ? 'up' : 'down'}">{peek.dayMove >= 0 ? '▲' : '▼'} {pctS(peek.dayMove)}</span>
            </div>
          </div>

          <!-- your-return hero: % over $ -->
          <div class="pk-return">
            <div class="pk-sub">your return</div>
            {#if peek.retPct != null}
              <div class="pk-hero {peek.retPct >= 0 ? 'up' : 'down'}">
                <span class="pk-ret">{pctS(peek.retPct)}</span>
                <span class="pk-ret-abs">{usd(peek.gain)}</span>
              </div>
            {:else}
              <div class="pk-hero"><span class="pk-ret">—</span></div>
            {/if}
          </div>

          <!-- full position ledger (pinned to the bottom; fills the rail) -->
          <div class="pk-pos">
            <div class="pk-pos-h">position</div>
            <div class="pr"><span>shares</span><b>{f(peek.shares)}</b></div>
            <div class="pr"><span>avg cost</span><b>${f(peek.avg)}</b></div>
            <div class="pr"><span>value</span><b>${f(peek.value)}</b></div>
            <div class="pr"><span>weight</span><b>{peek.pct}%</b></div>
          </div>
        </div>

      </div>
    </aside>
  {/if}

  {#if chart}
    <div class="deck-chart">{@render chart()}</div>
  {/if}
</div>

<!-- allocation ribbon: the finder. width = weight, floored at ticker width. -->
<div class="alloc-wrap">
  <div class="alloc-cap"><b>Allocation</b><span>by weight · click to inspect</span></div>
  <div class="alloc-ribbon" role="group" aria-label="all holdings — click to inspect">
    {#each byWeight as h (h.t)}
      <button class="ribbon-seg" style="flex-grow:{h.pct}"
              title="{h.name} · {h.pct}% of portfolio · ${f(h.value)}"
              onclick={() => openStock(h)}>
        <span class="seg-tkr">{h.t}</span>
        <span class="seg-pct">{h.pct}%</span>
      </button>
    {/each}
  </div>
</div>

<style>
  /* same 6-col system as the KPI strip above; head over felt+peek, cols 5–6 breathe */
  /* minmax(0,1fr): tracks stay equal even when a peek's name/number is long, so
     the peek is ALWAYS exactly one column wide (never resizes per ticker) */
  /* one shared unit (--u, set on .content). rows are all --u tall; widgets span:
     deck = 2×2, slot = 2×1 (below deck), peek = 1×3, chart = 3×3. left column
     (deck 2 rows + gap + slot 1 row) = exactly the 3 rows peek/chart span. */
  /* single auto row: the left column (deck-col) drives the height; the peek and
     chart STRETCH to match it, so all three bottoms align however tall the packed
     left column gets. No fixed row count to keep in sync. */
  .deck-peek { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 16px; align-items: stretch;
    margin-top: 20px; /* clear the hero above */ }
  /* 1d / 1wk — black radio; tucked into the deck's top-right corner.
     temporarily hidden to free vertical room in the 2×1 slot — delete `display:none` to restore. */
  /* 1d/1wk — compact control floated in the deck's top-right corner (over the
     face-up card's empty white area), same convention as the chart's toggle */
  /* `left` is set inline from `toggleAnchor` (the fan's right edge, measured in JS) so
     it tracks the cards on resize instead of drifting. --toggle-x nudges it. */
  .winbar { --toggle-x: 10px; position: absolute; top: 82%; right: auto;
    transform: translate(-50%, calc(-50% - 5px)); z-index: 3;
    display: inline-flex; flex-direction: column;
    border: var(--bw) solid var(--ink); border-radius: var(--r); overflow: hidden; }
  .winbar button { font-family: var(--mono); font-size: 9px; font-weight: 700; cursor: pointer; padding: 4px 2px;
    background: var(--surface); color: var(--ink); border: 0; border-bottom: var(--bw) solid var(--ink); }
  .winbar button:last-child { border-bottom: 0; }
  .winbar button.on { background: var(--ink); color: var(--surface); }

  /* suit palette — pink ♥, yellow ♦, purple ♠, blue ♣ (glyphs get an ink outline) */
  .suit-sp { --suit: #8a63d2; }  /* spade   = purple */
  .suit-ht { --suit: #e8689b; }  /* heart   = pink   */
  .suit-dm { --suit: #ecb22e; }  /* diamond = yellow */
  .suit-cl { --suit: #4f86d6; }  /* club    = blue   */
  .suit-jk { --suit: #6f7a63; }

  /* padding-top matches the peek's inset so the cards' top lines up with the peek's top */
  /* deck spans 2 units; cards rest ~36% up the felt (between 1/3 and half) with the
     green felt filling below them — flex-end + a tall bottom pad lifts the fan, and
     the tray (::after) fills that pad so the cards sit ON the felt (no float). */
  /* left column = one 2-unit stack (deck on top, the 2 small Cash/Goal widgets at the
     bottom) so its bottom matches the peek's 2-unit height exactly. */
  /* left column, top→bottom: 2 KPIs · deck · cash+wraith · 2 future widgets.
     Every section is its natural height (no flex-grow), so nothing leaves empty
     space — the column is exactly as tall as its packed contents. */
  .deck-col { grid-column: 1 / 3; display: flex; flex-direction: column; gap: 16px; }
  /* 2 headline KPIs (Portfolio Value · Total P&L) at the top of the left column.
     The cards come from the page's aboveDeck snippet, so reach them with :global. */
  .deck-kpis { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  :global(.deck-kpis .glass-card) { padding: 12px 14px; }
  :global(.deck-kpis .kpi-label) { margin-bottom: 2px; }
  :global(.deck-kpis .kpi-value) { font-size: 20px; }
  :global(.deck-kpis .kpi-subtitle) { margin-top: 2px; }
  /* felt is sized to the fan (no flex-grow) so the cards have no empty green above them */
  .felt { --deck: #6f7a63; flex: 0 0 auto; min-height: 0; position: relative; z-index: 1;
    display: flex; flex-direction: column; justify-content: flex-end;
    border-radius: var(--r); padding: 16px 22px calc(var(--u) * 0.05) 14px; }
  /* Cash + Goal — 2 small widgets directly under the deck (their content height). */
  .deck-slot { flex: none;
    display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(0, 1fr); gap: 16px; }
  .deck-slot:not(.filled) { grid-template-columns: 1fr; place-items: center;
    border: var(--bw) dashed var(--muted); border-radius: var(--r);
    color: var(--muted); font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
  /* second slot: two 1×1 future-use widgets directly under cash + wraith */
  .deck-slot2 { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .deck-ph { display: grid; place-items: center; min-height: var(--u);
    border: var(--bw) dashed var(--muted); border-radius: var(--r);
    color: var(--muted); font-family: var(--mono); font-size: 22px; font-weight: 700; }
  .felt::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--u) * 0.375);
    background: var(--deck); border: var(--bw) solid var(--ink); border-radius: var(--r);
    box-shadow: 0 4px 0 0 var(--ink); z-index: 0; }

  .mfan { position: relative; z-index: 1; display: flex; align-items: flex-end; height: 196px; padding-bottom: 0; }
  .mcard { position: relative; flex: 0 0 auto; width: 132px; height: 168px;
    background: var(--surface); border: var(--bw) solid var(--ink); border-radius: 10px; box-shadow: var(--sh);
    cursor: pointer; overflow: hidden; padding: 0; font: inherit; color: inherit; text-align: left;
    /* riffle: quick rise that overshoots then settles, so each card flicks up
       + bounces as you scrub the fan, like riffling a deck (not a flat slide) */
    transition: transform .22s cubic-bezier(.34, 1.7, .42, 1), box-shadow .18s ease; }
  /* flat diagonal "shine" swipe — same treatment as the /design deck cards */
  .mcard::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
    background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,.55) 50%, transparent 60%);
    transform: translateX(-120%); transition: transform .5s ease; }
  .mcard.hovered::after { transform: translateX(120%); }
  /* .hovered (not :hover) — set by onFanMove from cursor-X, so a popped card
     covering its neighbours never traps the hover. See onFanMove for why. */
  .mcard.hovered { z-index: 999; transform: translateY(-20px); box-shadow: var(--sh-pop); }
  /* clicked card lifts + ink ring; no sibling spread (the peek carries the detail,
     and spreading pushed cards out over the peek) */

  /* width tracks the exposed sliver so the strip + its border sit flush with the
     next card's edge — no part of the strip is ever hidden underneath it */
  .mstrip { position: absolute; top: 0; left: 0; bottom: 0; width: var(--sliver, 34px); background: var(--paper);
    border-right: 2px solid var(--ink); overflow: hidden; }
  .mstrip-fill { position: absolute; left: 0; right: 0; bottom: 0; }


  .mstrip.up .mstrip-fill { background: var(--gain); }
  .mstrip.down .mstrip-fill { background: var(--loss); }

  .mindex { position: absolute; display: flex; flex-direction: column; align-items: center; line-height: .9; }
  /* tl is centred on the visible sliver's midpoint → equal margins left/right */
  .mindex.tl { top: 8px; left: calc(var(--sliver, 34px) / 2); transform: translateX(-50%); }
  .mindex.br { bottom: 8px; right: 8px; transform: rotate(180deg); }
  .mi-rank { font-family: var(--sans); font-weight: 700; font-size: 11px; color: var(--ink); line-height: .82; }
  .mi-suit { font-size: 23px; color: var(--suit); line-height: 1; margin-top: 1px; }
  /* ticker rotated 90° (vertical) so it runs DOWN its own sliver, never bleeding
     into neighbours — also keeps the index column narrow so it centres cleanly */
  .mi-tkr { font-family: var(--mono); font-weight: 700; font-size: 12px; color: var(--ink); margin-top: 4px;
    writing-mode: vertical-rl; letter-spacing: -.02em; }

  /* the move %, small but bold — the card's one striking element. centred a touch
     left of the white body's middle (55% of the card) so the left strip's visual
     weight balances it; dead-white-centre sits too near the right ticker. only
     readable face-up / hovered (slivers hide the body). red down, green up. */
  .mpct { position: absolute; top: 50%; left: 55%; transform: translate(-50%, -50%);
    font-family: var(--mono); font-weight: 700; font-size: 14px; letter-spacing: -.02em; white-space: nowrap; }

  /* ── peek (1×3 inspector — investor-first: leads with your return) ── */
  /* z-index above the felt's stacking layer → a lifted card can never cover it */
  .peek { grid-column: 3 / 4; position: relative; z-index: 2; }

  /* portfolio chart — fills the cols the peek freed; stretches to the packed left column */
  .deck-chart { grid-column: 4 / 7; }
  /* ── click-to-expand deep panel — animation focus ─────────────────────────
     The card grows 1→4 cols (400% + 3×16px gaps), sliding over the chart slot.
     The ink shadow is a SEPARATE layer so it can outpace the white body + bounce.
     Easing is cubic ease-in-out both ways; the bounce is a gentle shadow-offset
     kick (small, so EXPAND never overshoots outward → no scrollbar). */
  .peek-card { position: absolute; top: 0; left: 0; bottom: 0; width: 100%;
    display: flex; align-items: stretch; padding: 0; overflow: hidden; cursor: default;
    color: inherit; text-decoration: none; box-shadow: none; z-index: 2;
    transition: width .29s cubic-bezier(.65, 0, .35, 1); }
  .deck-peek:not(.expanded) .peek-card { transition-timing-function: cubic-bezier(.5, 0, .3, 1.03); }

  /* the hard ink shadow on its own layer — a shorter duration than the body so the
     black outpaces the white; its offset eases back to a normal 4px on expand */
  .peek-shadow { position: absolute; top: 0; left: 0; bottom: 0; width: 100%; z-index: 1;
    background: var(--ink); border-radius: var(--r); pointer-events: none;
    transform: translate(4px, 4px);
    transition: width .2s cubic-bezier(.65, 0, .35, 1), transform .18s cubic-bezier(.5, 0, .3, 1.06); }
  .deck-peek:not(.expanded) .peek-shadow { transition-timing-function: cubic-bezier(.65, 0, .35, 1), cubic-bezier(.5, 0, .3, 1.06); }
  /* hovering the left spine (the button) slides the shadow out — in BOTH modes */
  .peek:has(.peek-left:hover) .peek-shadow { transform: translate(12px, 7px); }

  /* the position rail fills the whole peek card; space-between distributes its three
     bands (identity · return · ledger) so it fills its full height — no dead block. */
  .peek-left { box-sizing: border-box; padding: 18px 18px 16px; display: flex; flex-direction: column;
    justify-content: space-between; gap: 18px; min-width: 0; width: 100%; flex: 1 1 auto; cursor: pointer; }
  .peek-left:focus-visible { outline: 2.5px solid var(--brand); outline-offset: -3px; border-radius: var(--r); }

  @media (prefers-reduced-motion: reduce) {
    .peek-card, .peek-shadow, .deck-chart { transition: none; }
  }
  /* ── identity band: ticker/name + price, grouped at the top ── */
  .pk-top { display: flex; flex-direction: column; gap: 13px; }
  .pk-head { display: flex; align-items: flex-start; gap: 10px; }
  .pk-id { min-width: 0; flex: 1; }
  .pk-tkr { font-size: 20px; font-weight: 700; letter-spacing: -.01em; line-height: 1; }
  .pk-name { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pk-go { flex: 0 0 auto; font-family: var(--sans); font-size: 20px; font-weight: 700; line-height: 1; color: var(--muted);
    transition: color .1s ease, transform .24s cubic-bezier(.5, 0, .3, 1.12); }
  /* the whole left spine is the button — emphasise the arrow while it's hovered */
  .peek:has(.peek-left:hover) .pk-go { color: var(--ink); }
  .peek:has(.peek-left:hover) .pk-go { transform: translateX(3px); }
  .pk-price { display: flex; align-items: baseline; gap: 8px; }
  .pk-px { font-family: var(--mono); font-size: 26px; font-weight: 700; line-height: 1; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  .pk-day { font-family: var(--mono); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* ── your-return hero: the emotional headline, centre band ── */
  .pk-return { display: flex; flex-direction: column; }
  .pk-sub { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; color: var(--ink);
    opacity: .5; margin-bottom: 6px; }
  /* stacked (% over $) so the hero is always two lines → height never shifts */
  .pk-hero { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
  .pk-ret { font-family: var(--mono); font-size: 30px; font-weight: 700; line-height: .95; letter-spacing: -.02em;
    white-space: nowrap; }
  .pk-ret-abs { font-family: var(--mono); font-size: 14px; font-weight: 700; opacity: .8; }

  /* ── position ledger: the cold facts, pinned to the bottom band ── */
  .pk-pos { display: flex; flex-direction: column; gap: 8px; padding-top: 13px;
    border-top: 1.5px solid color-mix(in srgb, var(--ink) 14%, transparent); }
  .pk-pos-h { font-family: var(--sans); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em;
    color: var(--ink); opacity: .5; margin-bottom: 1px; }
  .pr { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .pr span { font-family: var(--sans); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
  .pr b { font-family: var(--mono); font-weight: 700; font-size: 14px; font-variant-numeric: tabular-nums; }

  .up { color: var(--gain); }
  .down { color: var(--loss); }

  /* ── allocation ribbon — every holding, width = weight, floored at ticker width ── */
  .alloc-wrap { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; }
  .alloc-cap { display: flex; align-items: baseline; gap: 10px; }
  .alloc-cap b { font-size: 16px; font-weight: 700; }
  .alloc-cap span { font-size: 12px; color: var(--muted); }
  .alloc-ribbon { display: flex; align-items: stretch; height: 76px; width: 100%; overflow: hidden;
    background: var(--surface); border: var(--bw) solid var(--ink); border-radius: var(--r); box-shadow: var(--sh); }
  .ribbon-seg { flex: 0 1 0; min-width: max-content; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    padding: 0 11px; border: 0; border-right: 2px solid var(--ink); background: var(--surface); color: var(--ink);
    cursor: pointer; font: inherit; transition: background .12s ease; }
  .ribbon-seg:last-child { border-right: 0; }
  .ribbon-seg:hover { background: var(--brand); }
  .seg-tkr { font-family: var(--mono); font-weight: 700; font-size: 13px; letter-spacing: -.02em; white-space: nowrap; }
  .seg-pct { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 11px; color: var(--muted); white-space: nowrap; }

  @media (max-width: 1100px) {
    .deck-peek { grid-template-columns: 1fr; }
    .deck-col, .peek, .deck-chart { grid-column: 1; grid-row: auto; }
    .deck-chart { min-height: 320px; }
    /* stacked column: no sideways room — keep the mini peek, drop the shadow layer */
    .peek-shadow { display: none; }
    .peek-card { position: relative; width: 100% !important; height: auto; box-shadow: var(--sh); }
    .deck-peek .peek-left { width: 100%; flex: 1 1 auto; border-right: 0 !important; }
  }
</style>
