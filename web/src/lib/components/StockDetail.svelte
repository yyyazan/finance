<script>
  // Full-screen stock detail. Opens for ANY ticker — a holding (from the deck) or a
  // searched symbol you don't own. Three distinct widgets: a SIDE rail (your position
  // + a 52-week range gauge), the GRAPH, and the market STATS. Market fields come from
  // /api/stock/{ticker}; a deterministic mock backfills anything yfinance omits.
  import { onMount } from 'svelte';
  import StockChart from './StockChart.svelte';
  import { mockStock, fmtCap, fmtVol } from '$lib/mockStock.js';
  import { api } from '$lib/api.js';

  let { ticker, name = null, holding = null, onClose } = $props();

  const owned = $derived(!!holding);

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
  const f0 = (n) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const pctS = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%');
  const usdS = (n) => (n == null ? '—' : (n >= 0 ? '+$' : '−$') + f(Math.abs(n)));
  const money = (n) => (n == null ? '—' : '$' + f(n));
  const sUsd = (n) => (n == null ? '—' : (n < 0 ? '−$' : '$') + f(Math.abs(n)));
  const ratingClass = (r) => (r === 'Strong Buy' || r === 'Buy' ? 'up' : r === 'Hold' ? 'mid' : 'down');

  // where today's price sits in the 52-week band → the gauge marker (0–100%)
  const pos52 = $derived.by(() => {
    const lo = stock.lo52, hi = stock.hi52, p = stock.price;
    if (lo == null || hi == null || hi <= lo || p == null) return 50;
    return Math.max(0, Math.min(100, ((p - lo) / (hi - lo)) * 100));
  });

  function onKey(e) { if (e.key === 'Escape') onClose?.(); }
  onMount(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
</script>

<div class="sd-scrim" role="presentation" onclick={() => onClose?.()}>
  <div class="sd" role="dialog" aria-modal="true" aria-label="{ticker} detail" onclick={(e) => e.stopPropagation()}>

    <header class="sd-head">
      <div class="sd-id">
        <h2 class="sd-tkr">{ticker}</h2>
        <span class="sd-name">{stock.name}{#if stock.sector && stock.sector !== '—'} · {stock.sector}{/if}</span>
      </div>
      <div class="sd-quote">
        <span class="sd-px">${f(stock.price)}</span>
        <span class="sd-day {stock.dayPct >= 0 ? 'up' : 'down'}">{stock.dayPct >= 0 ? '▲' : '▼'} {pctS(stock.dayPct)}</span>
      </div>
      <button class="sd-close" aria-label="Close" onclick={() => onClose?.()}>✕</button>
    </header>

    <div class="sd-grid">
      <!-- SIDE widget: your position + 52-week range gauge -->
      <section class="glass-card sd-side">
        {#if owned}
          <div class="side-sec">
            <div class="side-h">your return</div>
            <div class="side-hero {(stock.plPct ?? 0) >= 0 ? 'up' : 'down'}">
              <span class="side-big">{pctS(stock.plPct)}</span>
              <span class="side-sub">{usdS(stock.plAbs)}</span>
            </div>
          </div>
          <div class="side-sec">
            <div class="side-h">position</div>
            <div class="kv"><span>shares</span><b>{f(stock.shares)}</b></div>
            <div class="kv"><span>avg cost</span><b>${f(stock.avgCost)}</b></div>
            <div class="kv"><span>value</span><b>${f(stock.mktValue)}</b></div>
            <div class="kv"><span>weight</span><b>{stock.weight != null ? stock.weight + '%' : '—'}</b></div>
          </div>
        {:else}
          <div class="side-sec side-empty">
            <div class="side-h">your position</div>
            <p class="side-none">You don't hold {ticker}.</p>
            <button class="side-add" disabled title="coming soon">+ Add to portfolio</button>
          </div>
        {/if}

        <div class="side-sec side-gauge-sec">
          <div class="side-h">52-week range</div>
          <div class="gauge">
            <div class="gauge-bar"><div class="gauge-mark" style="left:{pos52}%"></div></div>
            <div class="gauge-ends"><span>${f(stock.lo52)}</span><span class="gauge-now">${f(stock.price)}</span><span>${f(stock.hi52)}</span></div>
          </div>
        </div>
      </section>

      <!-- GRAPH widget -->
      <section class="glass-card sd-graph">
        <div class="sd-card-h">price <span class="sd-card-sub">{owned ? 'your holding' : 'market'}</span></div>
        <div class="sd-graph-body">
          {#key ticker}
            <StockChart {ticker} history={remote?.history ?? null} price={stock.price} />
          {/key}
        </div>
      </section>

      <!-- STATS widget: market data, three labelled groups -->
      <section class="glass-card sd-stats">
        <div class="col">
          <div class="col-h">today</div>
          <div class="row"><span>open</span><b>{money(stock.open)}</b></div>
          <div class="row"><span>prev cl</span><b>{money(stock.prevClose)}</b></div>
          <div class="row"><span>day lo</span><b>{money(stock.dayLow)}</b></div>
          <div class="row"><span>day hi</span><b>{money(stock.dayHigh)}</b></div>
          <div class="row"><span>vol</span><b>{stock.volume != null ? fmtVol(stock.volume) : '—'}</b></div>
        </div>
        <div class="col">
          <div class="col-h">valuation</div>
          <div class="row"><span>mkt cap</span><b>{stock.marketCap != null ? fmtCap(stock.marketCap) : '—'}</b></div>
          <div class="row"><span>p/e</span><b>{stock.pe ?? '—'}</b></div>
          <div class="row"><span>eps</span><b>{sUsd(stock.eps)}</b></div>
          <div class="row"><span>div yld</span><b>{stock.divYield ? stock.divYield + '%' : '—'}</b></div>
          <div class="row"><span>beta</span><b>{stock.beta ?? '—'}</b></div>
        </div>
        <div class="col">
          <div class="col-h">outlook</div>
          <div class="row"><span>rating</span><b>{#if stock.rating}<span class="rchip {ratingClass(stock.rating)}">{stock.rating}</span>{:else}—{/if}</b></div>
          <div class="row"><span>target</span><b>{money(stock.target)}</b></div>
          <div class="row"><span>upside</span><b class={(stock.upside ?? 0) >= 0 ? 'up' : 'down'}>{stock.upside != null ? pctS(stock.upside) : '—'}</b></div>
          <div class="row"><span>avg vol</span><b>{stock.avgVolume != null ? fmtVol(stock.avgVolume) : '—'}</b></div>
        </div>
      </section>
    </div>

    {#if stock._mock}<div class="sd-mock">demo data</div>{/if}
  </div>
</div>

<style>
  .sd-scrim { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 28px;
    background: color-mix(in srgb, var(--ink) 38%, transparent); backdrop-filter: blur(3px);
    animation: sd-fade .16s ease; }
  @keyframes sd-fade { from { opacity: 0; } to { opacity: 1; } }
  .sd { width: min(1180px, 95vw); height: min(820px, 92vh); display: flex; flex-direction: column; gap: 14px;
    background: var(--paper); border: var(--bw) solid var(--ink); border-radius: calc(var(--r) + 4px);
    box-shadow: 8px 8px 0 var(--ink); padding: 18px 20px 20px; box-sizing: border-box;
    animation: sd-rise .2s cubic-bezier(.34, 1.4, .5, 1); }
  @keyframes sd-rise { from { transform: translateY(14px) scale(.985); opacity: 0; } to { transform: none; opacity: 1; } }

  /* header */
  .sd-head { display: flex; align-items: center; gap: 18px; flex: 0 0 auto; }
  .sd-id { min-width: 0; }
  .sd-tkr { margin: 0; font-family: var(--sans); font-size: 26px; font-weight: 700; letter-spacing: -.01em; line-height: 1; }
  .sd-name { font-family: var(--mono); font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sd-quote { margin-left: auto; display: flex; align-items: baseline; gap: 10px; }
  .sd-px { font-family: var(--mono); font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
  .sd-day { font-family: var(--mono); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .sd-close { flex: 0 0 auto; width: 36px; height: 36px; cursor: pointer; font-size: 15px; font-weight: 700;
    background: var(--surface); color: var(--ink); border: var(--bw) solid var(--ink); border-radius: var(--r);
    box-shadow: var(--sh); transition: transform .1s ease, box-shadow .1s ease; }
  .sd-close:hover { transform: translate(-2px, -2px); box-shadow: var(--sh-pop); }
  .sd-close:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }

  /* three widgets: side rail (tall, left) · graph (top-right) · stats (full-width bottom) */
  .sd-grid { flex: 1 1 auto; min-height: 0; display: grid; gap: 14px;
    grid-template-columns: 280px 1fr; grid-template-rows: 1fr auto; }
  .sd-side  { grid-column: 1; grid-row: 1 / span 2; }
  .sd-graph { grid-column: 2; grid-row: 1; min-height: 0; }
  .sd-stats { grid-column: 1 / 3; grid-row: 2; }
  .glass-card { background: var(--surface); border: var(--bw) solid var(--ink); border-radius: var(--r); box-shadow: var(--sh); }

  .sd-card-h { font-family: var(--sans); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em;
    color: var(--ink); opacity: .5; }
  .sd-card-sub { margin-left: 6px; opacity: .8; font-weight: 700; }

  /* SIDE */
  .sd-side { display: flex; flex-direction: column; gap: 0; justify-content: space-between; padding: 18px; overflow: hidden; }
  .side-sec + .side-sec { border-top: 1.5px solid color-mix(in srgb, var(--ink) 13%, transparent); padding-top: 15px; margin-top: 15px; }
  .side-h { font-family: var(--sans); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: var(--ink); opacity: .5; margin-bottom: 9px; }
  .side-hero { display: flex; flex-direction: column; gap: 3px; }
  .side-big { font-family: var(--mono); font-size: 32px; font-weight: 700; line-height: .95; letter-spacing: -.02em; }
  .side-sub { font-family: var(--mono); font-size: 14px; font-weight: 700; opacity: .8; }
  .kv { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 4px 0; }
  .kv span { font-family: var(--sans); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
  .kv b { font-family: var(--mono); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .side-none { font-family: var(--mono); font-size: 12px; color: var(--muted); margin: 0 0 12px; }
  .side-add { font-family: var(--sans); font-size: 12px; font-weight: 700; padding: 8px 12px; width: 100%; cursor: not-allowed;
    background: var(--surface); color: var(--muted); border: var(--bw) dashed var(--muted); border-radius: var(--r); opacity: .8; }
  .side-gauge-sec { margin-top: auto; }
  .gauge { display: flex; flex-direction: column; gap: 7px; }
  .gauge-bar { position: relative; height: 8px; border-radius: 5px; border: 1.5px solid var(--ink);
    background: linear-gradient(90deg, color-mix(in srgb, var(--loss) 55%, var(--surface)), color-mix(in srgb, var(--brand) 55%, var(--surface)), color-mix(in srgb, var(--gain) 55%, var(--surface))); }
  .gauge-mark { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: var(--ink);
    border: 2px solid var(--surface); transform: translate(-50%, -50%); box-shadow: 0 0 0 1.5px var(--ink); }
  .gauge-ends { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--muted); }
  .gauge-now { color: var(--ink); }

  /* GRAPH */
  .sd-graph { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; min-width: 0; }
  .sd-graph-body { flex: 1 1 auto; min-height: 0; }

  /* STATS — three labelled market columns */
  .sd-stats { display: grid; grid-template-columns: repeat(3, 1fr); align-items: start; padding: 16px 18px; }
  .col { min-width: 0; padding: 0 18px; border-left: 1.5px solid color-mix(in srgb, var(--ink) 11%, transparent); }
  .col:first-child { border-left: 0; padding-left: 0; }
  .col:last-child { padding-right: 0; }
  .col-h { font-family: var(--sans); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em;
    color: var(--ink); opacity: .5; padding-bottom: 6px; margin-bottom: 6px;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 13%, transparent); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; min-width: 0; padding: 5px 0; }
  .row span { flex: 0 0 auto; font-family: var(--sans); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); white-space: nowrap; }
  .row b { flex: 0 1 auto; font-family: var(--mono); font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rchip { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 3px; border: 1.5px solid currentColor; }
  .rchip.up { color: var(--gain); } .rchip.mid { color: var(--muted); } .rchip.down { color: var(--loss); }

  .sd-mock { position: absolute; bottom: 10px; right: 16px; pointer-events: none;
    font-family: var(--mono); font-size: 8px; text-transform: uppercase; letter-spacing: .14em; color: var(--muted); opacity: .4; }

  .up { color: var(--gain); } .down { color: var(--loss); }

  @media (max-width: 900px) {
    .sd { height: auto; max-height: 92vh; overflow: auto; }
    .sd-grid { grid-template-columns: 1fr; grid-template-rows: none; }
    .sd-side, .sd-graph, .sd-stats { grid-column: 1; grid-row: auto; }
    .sd-graph { min-height: 340px; }
  }
</style>
