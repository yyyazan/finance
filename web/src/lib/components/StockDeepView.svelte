<script>
  // In-depth single-stock view in the expanded peek's deep panel.
  //   chart (borderless, big) → its controls right beneath it → a clean data table of
  //   four LABELLED column-groups so it scans at a glance: POSITION · TODAY ·
  //   VALUATION · OUTLOOK. Day/52w highs+lows are plain rows (no range bars).
  // DATA IS MOCKED for now (see $lib/mockStock.js): real position fields are real;
  // market fundamentals + the price series are deterministic placeholders.
  import { onMount } from 'svelte';
  import { createChart, AreaSeries, CandlestickSeries, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
  import { mockStock, priceSeries, RANGES, fmtCap, fmtVol } from '$lib/mockStock.js';
  import { api } from '$lib/api.js';

  let { holding } = $props();

  let range = $state('3M');
  let chartType = $state('area');   // 'area' | 'candles'

  // real market data from /api/stock/{ticker}; null until it lands (then we fall
  // back to the deterministic mock so the view always renders).
  let remote = $state(null);
  $effect(() => {
    const t = holding?.t;
    if (!t) { remote = null; return; }
    let cancelled = false;
    remote = null;
    api.stock(t).then((r) => { if (!cancelled) remote = r; }).catch(() => { if (!cancelled) remote = null; });
    return () => { cancelled = true; };
  });

  const RATING_MAP = { strong_buy: 'Strong Buy', buy: 'Buy', hold: 'Hold', underperform: 'Underperform', sell: 'Sell', strong_sell: 'Sell' };
  // merge: real MARKET fields from `remote` over the mock; POSITION fields (shares,
  // cost, value, P&L, weight) come from the holding via mockStock and stay real.
  const stock = $derived.by(() => {
    const m = mockStock(holding);
    const r = remote;
    if (!r || r.ticker !== (holding?.t || '').toUpperCase()) return m;
    const price = r.price ?? m.price;
    const target = r.target;
    return {
      ...m,
      price, prevClose: r.prevClose, open: r.open, dayLow: r.dayLow, dayHigh: r.dayHigh,
      lo52: r.week52Low, hi52: r.week52High, volume: r.volume, avgVolume: r.avgVolume,
      marketCap: r.marketCap, eps: r.eps, divYield: r.divYield,
      pe: r.pe != null ? +Number(r.pe).toFixed(1) : null,
      beta: r.beta != null ? +Number(r.beta).toFixed(2) : null,
      sector: r.sector || '—',
      target, rating: r.rating ? (RATING_MAP[r.rating] || null) : null,
      upside: (target != null && price) ? +((target / price - 1) * 100).toFixed(1) : null,
      _mock: false,
    };
  });

  // chart series: real daily closes (sliced to the range) when available, else synth
  const RANGE_DAYS = { '1D': 3, '1W': 9, '1M': 33, '3M': 95, '1Y': 370, '5Y': 1850 };
  function isoMinusDays(iso, days) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); }
  function realSeries(hist, rng) {
    if (!hist || hist.length < 2) return null;
    const cutoff = isoMinusDays(hist[hist.length - 1].t, RANGE_DAYS[rng] ?? 95);
    let win = hist.filter((p) => p.t >= cutoff);
    if (win.length < 2) win = hist.slice(-2);
    const area = win.map((p) => ({ time: p.t, value: p.c }));
    const candles = win.map((p, i) => { const o = i ? win[i - 1].c : p.c; return { time: p.t, open: o, high: Math.max(o, p.c), low: Math.min(o, p.c), close: p.c }; });
    return { area, candles };
  }
  const data = $derived.by(() => {
    const real = remote?.history?.length ? realSeries(remote.history, range) : null;
    return real ?? priceSeries(stock.t, range, stock.price);
  });

  const f = (n) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctS = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%');
  const usdS = (n) => (n == null ? '—' : (n >= 0 ? '+$' : '−$') + f(Math.abs(n)));
  const money = (n) => (n == null ? '—' : '$' + f(n));
  const sUsd = (n) => (n == null ? '—' : (n < 0 ? '−$' : '$') + f(Math.abs(n)));
  function fmtDate(t) {
    if (t == null) return '';
    let d;
    if (typeof t === 'number') d = new Date(t * 1000);
    else if (typeof t === 'string') d = new Date(t + 'T00:00:00');
    else if (typeof t === 'object' && t.year) d = new Date(t.year, (t.month || 1) - 1, t.day || 1);
    else return '';
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const ratingClass = (r) => (r === 'Strong Buy' || r === 'Buy' ? 'up' : r === 'Hold' ? 'mid' : 'down');

  const BRAND = '#0fb39a', INK = '#1a1a1a', GAIN = '#00c060', LOSS = '#ff4d4d', GRID = '#e4e0d6', MUTED = '#8a8478';
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

  let host = $state();
  let chart = $state(null);
  let series = null;
  let highlight = null;   // fill-only area series: shades the dragged span under the line
  let hover = $state(null);   // {x, y, price} under the crosshair
  let drag = $state(null);    // {x, price} anchor while holding & dragging
  function startDrag() { if (hover?.price != null) { drag = { x: hover.x, price: hover.price, time: hover.time }; updateHighlight(); } }

  onMount(() => {
    chart = createChart(host, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' }, textColor: MUTED, fontFamily: 'Space Mono, ui-monospace, monospace', fontSize: 10, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: GRID } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: INK, width: 1, style: LineStyle.Solid, labelVisible: false },
        horzLine: { color: GRID, width: 1, style: LineStyle.Dotted, labelVisible: false },
      },
      handleScroll: false, handleScale: false,
    });
    highlight = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(0,0,0,0)', lineWidth: 1, topColor: hexA(INK, 0.08), bottomColor: hexA(INK, 0.08),
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    });
    highlight.setData([]);
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || param.point.x < 0) { hover = null; updateHighlight(); return; }
      const d = series ? param.seriesData.get(series) : null;
      const price = d ? (d.value ?? d.close) : null;
      hover = price == null ? null : { x: param.point.x, y: param.point.y, price, time: param.time };
      updateHighlight();
    });
    const endDrag = () => { drag = null; updateHighlight(); };
    window.addEventListener('pointerup', endDrag);
    return () => { window.removeEventListener('pointerup', endDrag); chart?.remove(); chart = null; };
  });

  $effect(() => {
    if (!chart) return;
    const d = data, type = chartType;
    if (series) { chart.removeSeries(series); series = null; }
    if (type === 'candles') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: GAIN, downColor: LOSS, borderUpColor: INK, borderDownColor: INK,
        wickUpColor: INK, wickDownColor: INK, priceLineVisible: false, lastValueVisible: false,
      });
      series.setData(d.candles);
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: BRAND, lineWidth: 2, topColor: hexA(BRAND, 0), bottomColor: hexA(BRAND, 0),
        priceLineVisible: false, lastValueVisible: false,
      });
      series.setData(d.area);
    }
    chart.timeScale().fitContent();
  });

  // shade the dragged span as the area UNDER the line (like an integral). Imperative
  // (not a $effect) + a re-entrancy guard, because setData re-fires the crosshair —
  // a reactive effect reading `hover` would loop and crash the page.
  let updatingHl = false;
  function updateHighlight() {
    if (updatingHl || !chart || !highlight) return;
    updatingHl = true;
    try {
      const a = data?.area;
      if (!drag || !hover || !a || a.length < 2) { highlight.setData([]); return; }
      const ts = chart.timeScale();
      const c0 = ts.coordinateToLogical(Math.min(drag.x, hover.x));
      const c1 = ts.coordinateToLogical(Math.max(drag.x, hover.x));
      if (c0 == null || c1 == null) { highlight.setData([]); return; }
      const i0 = Math.max(0, Math.floor(Math.min(c0, c1)));
      const i1 = Math.min(a.length - 1, Math.ceil(Math.max(c0, c1)));
      const slice = i1 > i0 ? a.slice(i0, i1 + 1) : [];
      const moved = Math.abs(hover.x - drag.x);
      const col = moved <= 8 ? hexA(INK, 0.08) : (hover.price - drag.price >= 0 ? hexA(GAIN, 0.18) : hexA(LOSS, 0.18));
      highlight.applyOptions({ topColor: col, bottomColor: col });
      highlight.setData(slice);
    } catch (e) {
      try { highlight.setData([]); } catch (_) {}
    } finally {
      updatingHl = false;
    }
  }
</script>

<div class="sdv">
  <div class="sdv-chartwrap" onpointerdown={startDrag}>
    <div class="sdv-chart" bind:this={host}></div>
    {#if drag}<div class="sdv-anchor" style="left:{drag.x}px"></div>{/if}
    {#if hover}
      {#if drag && drag.price != null}
        {@const d$ = hover.price - drag.price}
        {@const dp = (hover.price / drag.price - 1) * 100}
        {@const moved = Math.abs(hover.x - drag.x)}
        {@const fromT = drag.x <= hover.x ? drag.time : hover.time}
        {@const toT = drag.x <= hover.x ? hover.time : drag.time}
        <div class="sdv-tip {moved > 8 ? (d$ >= 0 ? 'pos' : 'neg') : ''}" class:below={hover.y < 48} style="left:{hover.x}px; top:{hover.y}px">
          <span class="sdv-tip-v">{usdS(d$)} · {pctS(dp)}</span>
          <span class="sdv-tip-d">{fmtDate(fromT)} → {fmtDate(toT)}</span>
        </div>
      {:else}
        <div class="sdv-tip" class:below={hover.y < 48} style="left:{hover.x}px; top:{hover.y}px">
          <span class="sdv-tip-v">${f(hover.price)}</span>
          <span class="sdv-tip-d">{fmtDate(hover.time)}</span>
        </div>
      {/if}
    {/if}
  </div>

  <!-- controls live right under the chart they drive -->
  <div class="sdv-controls">
    <div class="seg ranges" role="group" aria-label="range">
      {#each RANGES as rg}
        <button class:on={range === rg} onclick={() => (range = rg)}>{rg}</button>
      {/each}
    </div>
    <div class="seg" role="group" aria-label="chart type">
      <button class:on={chartType === 'area'} onclick={() => (chartType = 'area')}>Area</button>
      <button class:on={chartType === 'candles'} onclick={() => (chartType = 'candles')}>Candles</button>
    </div>
  </div>

  <!-- four labelled column-groups -->
  <div class="sdv-table">
    <div class="col">
      <div class="col-h">position</div>
      <div class="row"><span>shares</span><b>{f(stock.shares)}</b></div>
      <div class="row"><span>avg cost</span><b>${f(stock.avgCost)}</b></div>
      <div class="row"><span>value</span><b>${f(stock.mktValue)}</b></div>
      <div class="row"><span>p/l</span><b class={(stock.plAbs ?? 0) >= 0 ? 'up' : 'down'}>{usdS(stock.plAbs)}</b></div>
      <div class="row"><span>weight</span><b>{stock.weight != null ? stock.weight + '%' : '—'}</b></div>
    </div>

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
      <div class="row"><span>52w lo</span><b>{money(stock.lo52)}</b></div>
      <div class="row"><span>52w hi</span><b>{money(stock.hi52)}</b></div>
      <div class="row"><span>rating</span><b>{#if stock.rating}<span class="rchip {ratingClass(stock.rating)}">{stock.rating}</span>{:else}—{/if}</b></div>
      <div class="row"><span>target</span><b>{money(stock.target)}</b></div>
      <div class="row"><span>upside</span><b class={(stock.upside ?? 0) >= 0 ? 'up' : 'down'}>{stock.upside != null ? pctS(stock.upside) : '—'}</b></div>
    </div>
  </div>

  {#if stock._mock}<div class="sdv-mock">demo</div>{/if}
</div>

<style>
  .sdv { height: 100%; box-sizing: border-box; position: relative; display: flex; flex-direction: column; gap: 7px;
    padding: 9px 14px; min-width: 0; }

  /* chart — no box; it blends straight into the panel and keeps its (good) size */
  .sdv-chartwrap { flex: 1 1 auto; min-height: 150px; position: relative; user-select: none; touch-action: none; }
  .sdv-chart { position: absolute; inset: 0; overflow: hidden; }
  .sdv-anchor { position: absolute; top: 0; bottom: 0; width: 0; z-index: 4; pointer-events: none;
    border-left: 1px dashed var(--muted); }
  .sdv-tip { position: absolute; z-index: 5; pointer-events: none; white-space: nowrap;
    transform: translate(-50%, calc(-100% - 12px));
    display: flex; flex-direction: column; align-items: center; line-height: 1.2;
    font-family: var(--mono); font-variant-numeric: tabular-nums;
    padding: 3px 7px; background: var(--ink); color: #fff !important; border-radius: 4px; }
  .sdv-tip-v { font-size: 11px; font-weight: 700; }
  .sdv-tip-d { font-size: 9px; font-weight: 400; }
  .sdv-tip.pos { background: var(--gain); }
  .sdv-tip.neg { background: var(--loss); }
  .sdv-tip.below { transform: translate(-50%, 12px); }

  /* controls, directly under the chart: ranges left, type right */
  .sdv-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .seg { display: inline-flex; border: var(--bw) solid var(--ink); border-radius: var(--r); overflow: hidden; }
  .seg button { font-family: var(--mono); font-size: 10px; font-weight: 700; cursor: pointer; padding: 3px 8px;
    border: 0; border-right: 2px solid var(--ink); background: var(--surface); color: var(--ink); }
  .seg button:last-child { border-right: 0; }
  .seg button.on { background: var(--ink); color: var(--surface); }
  .seg.ranges button { padding: 3px 7px; }

  /* the table — four labelled columns, divided, values right-aligned within each */
  .sdv-table { display: grid; grid-template-columns: repeat(4, 1fr); align-items: start; }
  .col { min-width: 0; padding: 0 11px; border-left: 1.5px solid color-mix(in srgb, var(--ink) 13%, transparent); }
  .col:first-child { border-left: 0; padding-left: 0; }
  .col:last-child { padding-right: 0; }
  .col-h { font-family: var(--sans); font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em;
    color: var(--ink); opacity: .5; padding-bottom: 3px; margin-bottom: 2px;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 13%, transparent); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; min-width: 0; padding: 1px 0; }
  .row span { flex: 0 0 auto; font-family: var(--sans); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; color: var(--muted); white-space: nowrap; }
  .row b { flex: 0 1 auto; font-family: var(--mono); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rchip { font-size: 10px; font-weight: 700; padding: 0 5px; border-radius: 3px; border: 1.5px solid currentColor; }
  .rchip.up { color: var(--gain); } .rchip.mid { color: var(--muted); } .rchip.down { color: var(--loss); }

  .sdv-mock { position: absolute; top: 8px; right: 14px; pointer-events: none;
    font-family: var(--mono); font-size: 8px; text-transform: uppercase; letter-spacing: .14em; color: var(--muted); opacity: .35; }
  .up { color: var(--gain); } .down { color: var(--loss); }
</style>
