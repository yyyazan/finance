<script>
  // Stock view CONTENT, modelled on Google Finance's stock page: back-link
  // breadcrumb → name + watch → big quote → full-width chart → flat key-stats
  // table (hairline rows, no nested cards) → news. Chrome-less so it can live
  // in two shells: the dashboard stage (glyph '←') or the StockDetail modal ('✕').
  import { onMount } from 'svelte';
  import StockChart from './StockChart.svelte';
  import { mockStock, fmtCap, fmtVol } from '$lib/mockStock.js';
  import { api } from '$lib/api.js';
  import { watchlist, loadWatchlist, toggleWatch } from '$lib/stores.js';

  let { ticker, name = null, holding = null, onClose, glyph = '✕' } = $props();

  const owned = $derived(!!holding);

  // watch state for non-held tickers — shared store keeps the sidebar in sync
  const watched = $derived(($watchlist ?? []).some((w) => w.ticker === (ticker || '').toUpperCase()));
  let watchBusy = $state(false);
  async function onWatch() {
    if (watchBusy) return;
    watchBusy = true;
    try { await toggleWatch((ticker || '').toUpperCase(), !watched); } finally { watchBusy = false; }
  }

  let remote = $state(null);
  $effect(() => {
    const t = ticker;
    if (!t) { remote = null; return; }
    let cancelled = false;
    remote = null;
    api.stock(t).then((r) => { if (!cancelled) remote = r; }).catch(() => { if (!cancelled) remote = null; });
    return () => { cancelled = true; };
  });

  const RATING_MAP = { strong_buy: 'Strong Buy', buy: 'Buy', hold: 'Hold', underperform: 'Underperform', sell: 'Sell', strong_sell: 'Sell' };

  // base "holding-like" object so mockStock() can fill gaps for non-owned tickers too
  const base = $derived(holding ?? { t: ticker, name: name ?? ticker, last: remote?.price ?? null });

  const stock = $derived.by(() => {
    const m = mockStock(base);
    const r = remote;
    if (!r || r.ticker !== (ticker || '').toUpperCase()) return m;
    const price = r.price ?? m.price;
    const target = r.target;
    return {
      ...m,
      price, prevClose: r.prevClose, open: r.open, dayLow: r.dayLow, dayHigh: r.dayHigh,
      lo52: r.week52Low ?? m.lo52, hi52: r.week52High ?? m.hi52, volume: r.volume, avgVolume: r.avgVolume,
      marketCap: r.marketCap, eps: r.eps, divYield: r.divYield,
      pe: r.pe != null ? +Number(r.pe).toFixed(1) : null,
      beta: r.beta != null ? +Number(r.beta).toFixed(2) : null,
      sector: r.sector || m.sector,
      dayPct: r.prevClose && price ? +((price / r.prevClose - 1) * 100).toFixed(2) : m.dayPct,
      target, rating: r.rating ? (RATING_MAP[r.rating] || null) : null,
      upside: (target != null && price) ? +((target / price - 1) * 100).toFixed(1) : null,
      _mock: false,
    };
  });

  const f = (n) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctS = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%');
  const usdS = (n) => (n == null ? '—' : (n >= 0 ? '+$' : '−$') + f(Math.abs(n)));
  const money = (n) => (n == null ? '—' : '$' + f(n));
  const sUsd = (n) => (n == null ? '—' : (n < 0 ? '−$' : '$') + f(Math.abs(n)));
  const dayAbs = $derived(
    stock.prevClose && stock.price ? stock.price - stock.prevClose : null
  );
  const ratingClass = (r) => (r === 'Strong Buy' || r === 'Buy' ? 'up' : r === 'Hold' ? 'mid' : 'down');

  const news = $derived(remote?.news ?? []);
  const ago = (at) => {
    if (at == null) return '';
    const s = Date.now() / 1000 - at;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    return Math.round(s / 86400) + 'd';
  };
  const fmtEarn = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  function onKey(e) { if (e.key === 'Escape') onClose?.(); }
  onMount(() => {
    loadWatchlist();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="sp">
  <!-- breadcrumb row, Google Finance style: "← portfolio | GOOG · sector" -->
  <nav class="sp-nav">
    <button class="sp-back" onclick={() => onClose?.()}>
      <span class="sp-back-arrow" aria-hidden="true">{glyph === '←' ? '←' : '✕'}</span>
      {glyph === '←' ? 'portfolio' : 'close'}
    </button>
    <span class="sp-crumb">{ticker}{#if stock.sector && stock.sector !== '—'} · {stock.sector}{/if}</span>
  </nav>

  <header class="sp-head">
    <div class="sp-id">
      <h2 class="sp-name">{stock.name}</h2>
      <div class="sp-quote">
        <span class="sp-px">${f(stock.price)}</span>
        <span class="sp-day {stock.dayPct >= 0 ? 'up' : 'down'}">
          {stock.dayPct >= 0 ? '▲' : '▼'} {pctS(stock.dayPct)}{#if dayAbs != null} ({usdS(dayAbs)}){/if} today
        </span>
      </div>
    </div>
    {#if !owned}
      <button class="sp-watch" class:watching={watched} disabled={watchBusy} onclick={onWatch}>
        {watched ? '✓ Watching' : '+ Watch'}
      </button>
    {/if}
  </header>

  {#if owned}
    <!-- your position: one compact strip, not a rail -->
    <div class="sp-pos">
      <span class="pos-ret {(stock.plPct ?? 0) >= 0 ? 'up' : 'down'}">
        <b>{pctS(stock.plPct)}</b><small>{usdS(stock.plAbs)}</small>
      </span>
      <span class="pos-kv"><span>shares</span><b>{f(stock.shares)}</b></span>
      <span class="pos-kv"><span>avg cost</span><b>${f(stock.avgCost)}</b></span>
      <span class="pos-kv"><span>value</span><b>${f(stock.mktValue)}</b></span>
      <span class="pos-kv"><span>weight</span><b>{stock.weight != null ? stock.weight + '%' : '—'}</b></span>
    </div>
  {/if}

  <div class="sp-chart">
    {#key ticker}
      <StockChart {ticker} history={remote?.history ?? null} price={stock.price} />
    {/key}
  </div>

  <!-- flat key-stats table: three columns of hairline rows, GF style -->
  <div class="sp-stats">
    <div class="st-col">
      <div class="st-row"><span>open</span><b>{money(stock.open)}</b></div>
      <div class="st-row"><span>high</span><b>{money(stock.dayHigh)}</b></div>
      <div class="st-row"><span>low</span><b>{money(stock.dayLow)}</b></div>
      <div class="st-row"><span>prev close</span><b>{money(stock.prevClose)}</b></div>
      <div class="st-row"><span>volume</span><b>{stock.volume != null ? fmtVol(stock.volume) : '—'}</b></div>
      <div class="st-row"><span>avg volume</span><b>{stock.avgVolume != null ? fmtVol(stock.avgVolume) : '—'}</b></div>
    </div>
    <div class="st-col">
      <div class="st-row"><span>mkt cap</span><b>{stock.marketCap != null ? fmtCap(stock.marketCap) : '—'}</b></div>
      <div class="st-row"><span>p/e ratio</span><b>{stock.pe ?? '—'}</b></div>
      <div class="st-row"><span>eps</span><b>{sUsd(stock.eps)}</b></div>
      <div class="st-row"><span>div yield</span><b>{stock.divYield ? stock.divYield + '%' : '—'}</b></div>
      <div class="st-row"><span>52-wk high</span><b>{money(stock.hi52)}</b></div>
      <div class="st-row"><span>52-wk low</span><b>{money(stock.lo52)}</b></div>
    </div>
    <div class="st-col">
      <div class="st-row"><span>rating</span><b>{#if stock.rating}<span class="rchip {ratingClass(stock.rating)}">{stock.rating}</span>{:else}—{/if}</b></div>
      <div class="st-row"><span>target</span><b>{money(stock.target)}</b></div>
      <div class="st-row"><span>upside</span><b class={(stock.upside ?? 0) >= 0 ? 'up' : 'down'}>{stock.upside != null ? pctS(stock.upside) : '—'}</b></div>
      <div class="st-row"><span>earnings</span><b>{fmtEarn(remote?.earningsDate)}</b></div>
      <div class="st-row"><span>beta</span><b>{stock.beta ?? '—'}</b></div>
    </div>
  </div>

  {#if news.length}
    <div class="sp-news">
      <div class="sp-sec-h">news</div>
      {#each news as n}
        <a class="news-item" href={n.url} target="_blank" rel="noopener noreferrer">
          <span class="news-title">{n.title}</span>
          <span class="news-meta">{n.source}{#if n.at} · {ago(n.at)} ago{/if}</span>
        </a>
      {/each}
    </div>
  {/if}

  {#if stock._mock}<div class="sp-mock">demo data</div>{/if}
</div>

<style>
  .sp { position: relative; height: 100%; min-height: 0; display: flex; flex-direction: column;
    padding: 14px 20px 18px; box-sizing: border-box; overflow-y: auto; }

  /* breadcrumb */
  .sp-nav { display: flex; align-items: center; gap: 12px; padding-bottom: 10px; }
  .sp-back { display: inline-flex; align-items: center; gap: 7px; padding: 4px 10px 4px 6px; cursor: pointer;
    font-family: var(--sans); font-size: 13px; font-weight: 700; color: var(--ink);
    background: transparent; border: 0; border-radius: var(--r); }
  .sp-back:hover { background: var(--paper); }
  .sp-back-arrow { font-size: 16px; line-height: 1; }
  .sp-crumb { font-family: var(--mono); font-size: 12px; color: var(--muted);
    padding-left: 12px; border-left: 1.5px solid color-mix(in srgb, var(--ink) 18%, transparent); }

  /* name + quote + watch */
  .sp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 14px; }
  .sp-name { margin: 0 0 6px; font-family: var(--sans); font-size: 24px; font-weight: 700; letter-spacing: -.01em; line-height: 1.1; }
  .sp-quote { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .sp-px { font-family: var(--mono); font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
  .sp-day { font-family: var(--mono); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .sp-watch { flex: 0 0 auto; font-family: var(--sans); font-size: 13px; font-weight: 700; padding: 8px 14px; cursor: pointer;
    background: var(--surface); color: var(--ink); border: var(--bw) solid var(--ink); border-radius: 999px;
    box-shadow: var(--sh); transition: transform .1s ease, box-shadow .1s ease; }
  .sp-watch:hover { transform: translate(-2px, -2px); box-shadow: var(--sh-pop); }
  .sp-watch:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
  .sp-watch.watching { background: var(--ink); color: var(--surface); }
  .sp-watch:disabled { opacity: .6; cursor: progress; }

  /* your position — one compact strip */
  .sp-pos { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; padding: 11px 0;
    border-top: 1.5px solid color-mix(in srgb, var(--ink) 11%, transparent); }
  .pos-ret { display: inline-flex; align-items: baseline; gap: 8px; }
  .pos-ret b { font-family: var(--mono); font-size: 19px; font-weight: 700; line-height: 1; }
  .pos-ret small { font-family: var(--mono); font-size: 12px; font-weight: 700; opacity: .85; }
  .pos-kv { display: inline-flex; align-items: baseline; gap: 7px; }
  .pos-kv span { font-family: var(--sans); font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .05em; color: var(--muted); }
  .pos-kv b { font-family: var(--mono); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* chart — full width, flat */
  .sp-chart { flex: 0 0 auto; height: 300px; padding: 12px 0 8px;
    border-top: 1.5px solid color-mix(in srgb, var(--ink) 11%, transparent); }

  /* flat key-stats table */
  .sp-stats { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 36px; padding: 12px 0 6px;
    border-top: 1.5px solid color-mix(in srgb, var(--ink) 11%, transparent); margin-top: 10px; }
  .st-col { min-width: 0; }
  .st-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 8px 0;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 8%, transparent); }
  .st-col .st-row:last-child { border-bottom: 0; }
  .st-row span { flex: 0 0 auto; font-family: var(--sans); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .03em; color: var(--muted); white-space: nowrap; }
  .st-row b { flex: 0 1 auto; font-family: var(--mono); font-size: 15px; font-weight: 700;
    font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rchip { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; border: 1.5px solid currentColor; }
  .rchip.up { color: var(--gain); } .rchip.mid { color: var(--muted); } .rchip.down { color: var(--loss); }

  /* news — flat list rows like GF */
  .sp-news { padding: 12px 0 4px; margin-top: 6px; border-top: 1.5px solid color-mix(in srgb, var(--ink) 11%, transparent); }
  .sp-sec-h { font-family: var(--sans); font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .12em; color: var(--ink); opacity: .5; margin-bottom: 4px; }
  .news-item { display: flex; flex-direction: column; gap: 3px; min-width: 0; text-decoration: none; padding: 9px 0;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 8%, transparent); }
  .news-item:last-child { border-bottom: 0; }
  .news-title { font-family: var(--sans); font-size: 13.5px; font-weight: 600; line-height: 1.4; color: var(--ink); }
  .news-item:hover .news-title { text-decoration: underline; }
  .news-meta { font-family: var(--mono); font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

  .sp-mock { position: absolute; bottom: 8px; right: 16px; pointer-events: none;
    font-family: var(--mono); font-size: 8px; text-transform: uppercase; letter-spacing: .14em; color: var(--muted); opacity: .4; }

  .up { color: var(--gain); } .down { color: var(--loss); }

  @media (max-width: 900px) {
    .sp { height: auto; overflow: visible; }
    .sp-stats { grid-template-columns: 1fr; column-gap: 0; }
    .st-col .st-row:last-child { border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 8%, transparent); }
    .sp-chart { height: 280px; }
    .sp-pos { gap: 14px; }
  }
</style>
