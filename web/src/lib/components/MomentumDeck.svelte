<script>
  // Momentum deck + peek. Takes the dashboard `cards` payload, polls /api/momentum
  // for live intraday moves, and renders the fan (sorted by biggest move) beside a
  // sticky peek. Click a card to inspect it; click again (or nothing selected) →
  // peek defaults to the biggest mover.
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  // `chart` is an optional snippet rendered in the empty cols 4–6 of the deck row
  // (the space the 1×2 peek freed) — the dashboard passes the portfolio chart there.
  let { cards = [], chart, belowDeck } = $props();

  let moveWin = $state('day');   // 'day' | 'wk'
  let selected = $state(null);   // ticker; null = biggest mover
  let hovered = $state(null);    // index of card under cursor (geometry-driven, not :hover)
  let moves = $state({});        // live /api/momentum overlay

  const SUIT_SYMBOL = { sp: '♠', ht: '♥', dm: '♦', cl: '♣', jk: '★' };
  const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

  const holdings = $derived(
    (cards ?? []).filter((c) => c && !c.is_joker).map((c) => ({
      t: c.ticker, name: c.company_name, suit: c.suit,
      pct: c.position_pct, day: c.day_pct, wk: c.week_pct, ret: c.voo_delta_pp ?? 0,
      value: c.market_value, last: c.current_price, shares: c.shares, basis: c.cost_basis,
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

  const peekH = $derived((selected && holdings.find((h) => h.t === selected)) || movers[movers.length - 1] || null);
  const peek = $derived.by(() => {
    const h = peekH;
    if (!h) return null;
    // `basis` is the per-share weighted avg cost (API: total_invested = basis × shares),
    // so total invested = basis × shares. Don't divide basis by shares again.
    const invested = h.basis != null && h.shares ? h.basis * h.shares : null;
    return {
      ...h,
      avg: h.basis ?? null,
      retPct: invested ? (h.value / invested - 1) * 100 : null,
      gain: invested != null ? h.value - invested : null,
      dayMove: moveOf(h, 'day'),
      weekMove: moveOf(h, 'wk'),
    };
  });

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
</script>

<div class="deck-peek">
  <div class="deck-col">
    <div class="felt">
    <div class="winbar" style="left: calc({toggleAnchor}px + var(--toggle-x))">
      <button class:on={moveWin === 'day'} onclick={() => (moveWin = 'day')}>1d</button>
      <button class:on={moveWin === 'wk'} onclick={() => (moveWin = 'wk')}>1wk</button>
    </div>
    <div class="mfan" role="group" bind:clientWidth={fanW} onpointermove={onFanMove} onpointerleave={() => (hovered = null)}>
      {#each visibleMovers as h, i (h.t)}
        {@const mv = moveOf(h, moveWin)}
        <button class="mcard suit-{h.suit}" class:selected={selected === h.t} class:hovered={hovered === i}
                style="margin-left:{i === 0 ? 0 : fanStep - CARD_W}px; --sliver:{fanStep}px"
                onclick={() => (selected = selected === h.t ? null : h.t)}>
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
  </div>

  {#if peek}
    <aside class="peek">
      <a class="glass-card peek-card" href="/investments/{peek.t}" aria-label="Full analysis: {peek.t}">
        <div class="peek-top">
          <div class="peek-badge suit-{peek.suit}">{rankOf[peek.t]}<span class="badge-suit">{SUIT_SYMBOL[peek.suit]}</span></div>
          <div class="peek-id">
            <div class="peek-tkr">{peek.t}</div>
            <div class="peek-name">{peek.name}</div>
          </div>
          <span class="peek-go" aria-hidden="true">→</span>
        </div>

        <div class="peek-sub">your return</div>
        {#if peek.retPct != null}
          <div class="peek-hero {peek.retPct >= 0 ? 'up' : 'down'}">
            <span class="peek-ret">{pctS(peek.retPct)}</span>
            <span class="peek-ret-abs">{usd(peek.gain)}</span>
          </div>
        {:else}
          <div class="peek-hero"><span class="peek-ret">—</span></div>
        {/if}

        <div class="peek-rows">
          <div class="pr"><span>value</span><b>${f(peek.value)}</b></div>
          <div class="pr"><span>weight</span><b>{peek.pct}%</b></div>
          <div class="pr"><span>today</span><b class={peek.dayMove >= 0 ? 'up' : 'down'}>{pctS(peek.dayMove)}</b></div>
          <div class="pr"><span>this week</span><b class={peek.weekMove >= 0 ? 'up' : 'down'}>{pctS(peek.weekMove)}</b></div>
          <div class="pr"><span>avg cost</span><b>{peek.avg != null ? `$${f(peek.avg)}` : '—'}</b></div>
          <div class="pr"><span>last</span><b>${f(peek.last)}</b></div>
        </div>

      </a>
    </aside>
  {/if}

  {#if chart}
    <div class="deck-chart">{@render chart()}</div>
  {/if}
</div>

<!-- allocation ribbon: the finder. width = weight, floored at ticker width. -->
<div class="alloc-ribbon" role="group" aria-label="all holdings — click to inspect">
  {#each byWeight as h (h.t)}
    <button class="ribbon-seg" class:selected={selected === h.t} style="flex-grow:{h.pct}"
            title="{h.name} · {h.pct}% of portfolio · ${f(h.value)}"
            onclick={() => (selected = selected === h.t ? null : h.t)}>
      <span class="seg-tkr">{h.t}</span>
    </button>
  {/each}
</div>

<style>
  /* same 6-col system as the KPI strip above; head over felt+peek, cols 5–6 breathe */
  /* minmax(0,1fr): tracks stay equal even when a peek's name/number is long, so
     the peek is ALWAYS exactly one column wide (never resizes per ticker) */
  /* one shared unit (--u, set on .content). rows are all --u tall; widgets span:
     deck = 2×2, slot = 2×1 (below deck), peek = 1×3, chart = 3×3. left column
     (deck 2 rows + gap + slot 1 row) = exactly the 3 rows peek/chart span. */
  .deck-peek { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-auto-rows: var(--u); gap: 16px; align-items: stretch; }
  /* 1d / 1wk — black radio; tucked into the deck's top-right corner.
     temporarily hidden to free vertical room in the 2×1 slot — delete `display:none` to restore. */
  /* 1d/1wk — compact control floated in the deck's top-right corner (over the
     face-up card's empty white area), same convention as the chart's toggle */
  /* `left` is set inline from `toggleAnchor` (the fan's right edge, measured in JS) so
     it tracks the cards on resize instead of drifting. --toggle-x nudges it. */
  .winbar { --toggle-x: 10px; position: absolute; top: 82%; right: auto;
    transform: translate(-50%, -50%); z-index: 3;
    display: inline-flex; flex-direction: column;
    border: var(--bw) solid var(--ink); border-radius: var(--r); overflow: hidden; box-shadow: var(--sh); }
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
  .deck-col { grid-column: 1 / 3; grid-row: 1 / span 2; display: flex; flex-direction: column; gap: 16px; }
  /* deck grows to fill the column above the widgets; cards sit low on the felt with
     the green tray (::after) beneath them. */
  .felt { --deck: #6f7a63; flex: 1; min-height: 0; position: relative; z-index: 1;
    display: flex; flex-direction: column; justify-content: flex-end;
    border-radius: var(--r); padding: 16px 22px calc(var(--u) * 0.05) 14px; }
  /* Cash + Goal — 2 small widgets directly under the deck (their content height). */
  .deck-slot { flex: none;
    display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(0, 1fr); gap: 16px; }
  .deck-slot:not(.filled) { grid-template-columns: 1fr; place-items: center;
    border: var(--bw) dashed var(--muted); border-radius: var(--r);
    color: var(--muted); font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
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
  .mcard.selected { z-index: 998; transform: translateY(-20px); box-shadow: var(--sh-pop); outline: 3px solid var(--brand); outline-offset: -3px; }

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

  /* ── peek (1×2 inspector — investor-first: leads with your return) ── */
  /* z-index above the felt's stacking layer → a lifted card can never cover it */
  .peek { grid-column: 3 / 4; grid-row: 1 / span 2; position: relative; z-index: 2; }

  /* portfolio chart — fills the cols the 1×2 peek freed, same row & height as the peek */
  .deck-chart { grid-column: 4 / 7; grid-row: 1 / span 2; }
  /* the whole card is the link to full analysis — a corner arrow is the only cue,
     no bulky button. hover gives the standard brutalist lift. */
  .peek-card { height: 100%; padding: 16px; display: flex; flex-direction: column; color: inherit; text-decoration: none;
    transition: transform .12s ease, box-shadow .12s ease; }
  /* hover slides the ink shadow 5px further right (12px vs the popped 7px) */
  .peek-card:hover { transform: translate(-2px, -2px); box-shadow: 12px 7px 0 var(--ink); }
  .peek-top { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .peek-badge { width: 40px; height: 40px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px; background: var(--suit, var(--brand)); border: var(--bw) solid var(--ink); border-radius: 8px; }
  .badge-suit { font-size: 10px; -webkit-text-stroke: .75px var(--ink); paint-order: stroke fill; }
  .peek-id { min-width: 0; flex: 1; }
  .peek-tkr { font-size: 18px; font-weight: 700; }
  .peek-name { font-family: var(--mono); font-size: 11px; color: var(--muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .peek-go { flex: 0 0 auto; font-family: var(--sans); font-size: 20px; font-weight: 700; color: var(--muted);
    transition: color .12s ease, transform .12s ease; }
  .peek-card:hover .peek-go { color: var(--ink); transform: translateX(3px); }
  .peek-sub { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; color: var(--ink);
    opacity: .55; margin-bottom: 3px; }
  /* stacked (% over $) so the hero is always two lines → peek height never shifts */
  .peek-hero { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin-bottom: 16px; }
  .peek-ret { font-family: var(--mono); font-size: 28px; font-weight: 700; line-height: 1; }
  .peek-ret-abs { font-family: var(--mono); font-size: 14px; font-weight: 700; opacity: .8; }
  .peek-rows { display: flex; flex-direction: column; gap: 7px; }
  .pr { display: flex; align-items: baseline; justify-content: space-between; font-size: 12px; }
  .pr span { color: var(--muted); }
  .pr b { font-family: var(--mono); font-weight: 700; font-size: 13px; }

  .up { color: var(--gain); }
  .down { color: var(--loss); }

  /* ── allocation ribbon — every holding, width = weight, floored at ticker width ── */
  .alloc-ribbon { display: flex; align-items: stretch; height: 42px; width: 100%; overflow: hidden;
    background: var(--surface); border: var(--bw) solid var(--ink); border-radius: var(--r); box-shadow: var(--sh); }
  .ribbon-seg { flex: 0 1 0; min-width: max-content; display: flex; align-items: center; justify-content: center;
    padding: 0 11px; border: 0; border-right: 2px solid var(--ink); background: var(--surface); color: var(--ink);
    cursor: pointer; font: inherit; transition: background .12s ease; }
  .ribbon-seg:last-child { border-right: 0; }
  .ribbon-seg:hover { background: var(--paper); }
  .ribbon-seg.selected { background: var(--brand); }
  .seg-tkr { font-family: var(--mono); font-weight: 700; font-size: 12px; letter-spacing: -.02em; white-space: nowrap; }

  @media (max-width: 1100px) {
    .deck-peek { grid-template-columns: 1fr; grid-auto-rows: auto; }
    .felt, .deck-slot, .peek, .deck-chart { grid-column: 1; grid-row: auto; }
    .deck-chart { min-height: 320px; }
  }
</style>
