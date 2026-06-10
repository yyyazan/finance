<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { holdings, moves, loadHoldings, startMomentum, openStock, openSearch, cardToHolding } from '$lib/stores.js';

  const NAV = [
    { label: 'home', path: '/', glyph: '❖' },
    { label: 'log', path: '/trades', glyph: '⊞' }
  ];
  function isActive(pathname, path) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path);
  }
  // Each hover paints the nav link's hard shadow a fresh random accent.
  const ACCENTS = ['#ff90e8', '#ffc900', '#23a094', '#5b8def', '#c994e8', '#ff6e5e'];
  function randAccent(e) {
    e.currentTarget.style.setProperty('--hovsh', ACCENTS[Math.floor(Math.random() * ACCENTS.length)]);
  }

  onMount(() => { loadHoldings(); startMomentum(); });

  let win = $state('day');   // 'day' | 'wk' — which move window the strips encode

  // Rail rows: every holding, heaviest position first (stable order so live
  // updates don't make rows jump around).
  const rows = $derived(
    [...($holdings ?? [])].sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))
  );

  // live move (fresh /api/momentum) with the frozen dashboard payload as fallback
  const moveOf = (c, w) => {
    const live = $moves[c.ticker];
    const v = live ? (w === 'day' ? live.day_pct : live.week_pct) : (w === 'day' ? c.day_pct : c.week_pct);
    return v ?? 0;
  };
  // biggest |move| in the window → its strip is full-height, the rest proportional
  const maxMove = $derived(Math.max(1, ...rows.map((c) => Math.abs(moveOf(c, win)))));

  const pct = (n) => (n >= 0 ? '+' : '−') + Math.abs(n ?? 0).toFixed(2) + '%';
  const wt = (n) => (n ?? 0).toFixed(1) + '%';
  const usd = (n) => {
    if (n == null) return '—';
    const a = Math.abs(n);
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
    return '$' + Math.round(n);
  };

  function open(c) {
    openStock({ ticker: c.ticker, name: c.company_name, holding: cardToHolding(c) });
  }
</script>

<aside class="sidebar">
  <div class="brand"><span class="brand-title">sprout</span></div>

  <nav class="nav">
    {#each NAV as item}
      <a href={item.path} class="nav-link" class:active={isActive($page.url.pathname, item.path)} onmouseenter={randAccent}>
        <div class="nav-item">
          <span class="nav-icon">{item.glyph}</span>
          <span class="nav-label">{item.label}</span>
        </div>
      </a>
    {/each}
  </nav>

  <button class="rail-search" onclick={() => openSearch()}>
    <span class="rs-icon" aria-hidden="true">⌕</span>
    <span class="rs-label">Search stocks</span>
    <kbd>⌘K</kbd>
  </button>

  <div class="rail-head">
    <span class="rh-title">Holdings</span>
    <div class="rh-win" role="group" aria-label="move window">
      <button class:on={win === 'day'} onclick={() => (win = 'day')}>D</button>
      <button class:on={win === 'wk'} onclick={() => (win = 'wk')}>W</button>
    </div>
  </div>

  <div class="rail">
    {#if $holdings === null}
      <div class="rail-empty">Loading…</div>
    {:else if rows.length === 0}
      <div class="rail-empty">No holdings yet.</div>
    {:else}
      {#each rows as c, i (c.ticker)}
        {@const mv = moveOf(c, win)}
        <button class="row" style="--i:{Math.min(i, 16)}" onclick={() => open(c)}>
          <span class="strip {mv >= 0 ? 'up' : 'down'}">
            <span class="strip-fill" style="height:{Math.max(5, Math.abs(mv) / maxMove * 100).toFixed(0)}%"></span>
          </span>
          <span class="r-main">
            <span class="r-line">
              <b class="r-sym">{c.ticker}</b>
              <span class="r-day {mv >= 0 ? 'up' : 'down'}">{pct(mv)}</span>
            </span>
            <span class="r-line r-sub">
              <span class="r-val">{usd(c.market_value)}</span>
              <span class="r-wt">{wt(c.position_pct)}</span>
            </span>
          </span>
        </button>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .rail-search { display: flex; align-items: center; gap: 8px; margin: 12px 0 4px; padding: 9px 11px;
    background: var(--paper); border: var(--bw) solid var(--ink); border-radius: var(--r); cursor: pointer;
    font-family: var(--sans); font-size: 13px; font-weight: 600; color: var(--ink);
    box-shadow: var(--sh); transition: transform .1s ease, box-shadow .1s ease; }
  .rail-search:hover { transform: translate(-2px, -2px); box-shadow: var(--sh-pop); }
  .rail-search .rs-icon { font-size: 14px; color: var(--muted); }
  .rail-search .rs-label { flex: 1; text-align: left; }
  .rail-search kbd { font-family: var(--mono); font-size: 9.5px; color: var(--muted);
    border: 1.5px solid var(--muted); border-radius: 4px; padding: 1px 4px; }

  /* ── rail header: title + D/W move-window toggle ── */
  .rail-head { display: flex; align-items: center; justify-content: space-between; margin: 14px 4px 7px; }
  .rh-title { font-family: var(--sans); font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
  .rh-win { display: inline-flex; border: 1.5px solid var(--ink); border-radius: 5px; overflow: hidden; }
  .rh-win button { font-family: var(--mono); font-size: 9px; font-weight: 700; cursor: pointer; padding: 2px 7px;
    background: var(--surface); color: var(--ink); border: 0; border-left: 1.5px solid var(--ink); line-height: 1.3; }
  .rh-win button:first-child { border-left: 0; }
  .rh-win button.on { background: var(--ink); color: var(--surface); }

  .rail { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; }
  .rail-empty { padding: 10px 6px; font-family: var(--mono); font-size: 11px; color: var(--muted); }

  /* ── a holding row: growth strip · two stat lines ── */
  .row { display: flex; align-items: stretch; gap: 10px; padding: 9px 8px; border: 0; border-radius: var(--r);
    background: transparent; cursor: pointer; text-align: left; font: inherit; position: relative; overflow: hidden;
    transition: background .12s ease;
    animation: rise .42s cubic-bezier(.2, .8, .3, 1) backwards; animation-delay: calc(var(--i) * 26ms); }
  .row:hover { background: var(--paper); }
  /* diagonal shine sweep on hover — the one bit of card flair we keep */
  .row::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
    background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,.5) 50%, transparent 58%);
    transform: translateX(-130%); transition: transform .6s ease; }
  .row:hover::after { transform: translateX(130%); }

  /* the mover strip — framed like a deck card column: cream track, solid
     flat-topped fill rising from the bottom = magnitude. Own column, never text. */
  .strip { flex: 0 0 13px; box-sizing: border-box; align-self: stretch; min-height: 38px; position: relative;
    border: 1.5px solid var(--ink); border-radius: 3px; background: var(--paper); overflow: hidden; }
  .strip-fill { position: absolute; left: 0; right: 0; bottom: 0;
    transform-origin: bottom; transition: height .5s cubic-bezier(.4, 0, .2, 1);
    animation: grow .55s cubic-bezier(.2, .8, .3, 1) backwards; animation-delay: calc(var(--i) * 26ms + 90ms); }
  .strip.up .strip-fill { background: var(--gain); }
  .strip.down .strip-fill { background: var(--loss); }
  .row:hover .strip-fill { filter: brightness(1.06) saturate(1.08); }

  .r-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
  .r-line { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .r-sym { font-family: var(--mono); font-weight: 700; font-size: 13px; color: var(--ink); }
  .r-day { font-family: var(--mono); font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums; }
  .r-sub { opacity: .92; }
  .r-val { font-family: var(--mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .r-wt { font-family: var(--mono); font-size: 10px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .up { color: var(--gain); }
  .down { color: var(--loss); }

  @keyframes rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
  @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) {
    .row, .strip-fill { animation: none; }
    .row::after { transition: none; }
  }

  /* On mobile the sidebar collapses to a top nav bar — the rail would be huge there. */
  @media (max-width: 700px) {
    .rail, .rail-head, .rail-search { display: none; }
  }
</style>
