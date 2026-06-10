<script>
  // Price chart + range/type controls, extracted so it can stand alone as its own
  // widget. Real daily closes (sliced to the range) when `history` is supplied,
  // else a deterministic mock series. Crosshair shows price+date; click-drag on the
  // chart measures the move over a span (shaded like an integral under the line).
  import { onMount } from 'svelte';
  import { createChart, AreaSeries, CandlestickSeries, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
  import { priceSeries, RANGES } from '$lib/mockStock.js';
  import { api } from '$lib/api.js';

  let { ticker = '—', history = null, price = 100 } = $props();

  let range = $state('1D');
  let chartType = $state('area');   // 'area' | 'candles'

  // Real intraday bars for 1D/1W (5m/30m from /api/stock/{t}/intraday). Daily
  // ranges keep slicing `history`. Mock fallback covers fetch failures.
  let intra = $state(null);
  $effect(() => {
    const t = ticker, rg = range;
    if (!t || t === '—' || (rg !== '1D' && rg !== '1W')) { intra = null; return; }
    let cancelled = false;
    api.intraday(t, rg.toLowerCase())
      .then((r) => { if (!cancelled && r?.points?.length > 1) intra = { ...r, forRange: rg }; })
      .catch(() => {});
    return () => { cancelled = true; };
  });

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
    if ((range === '1D' || range === '1W') && intra?.forRange === range && intra.ticker === (ticker || '').toUpperCase()) {
      const pts = intra.points.filter((p) => p.c != null);
      const area = pts.map((p) => ({ time: p.t, value: p.c }));
      const candles = pts.map((p, i) => {
        const o = i ? pts[i - 1].c : (intra.prevClose ?? p.c);
        return { time: p.t, open: o, high: Math.max(o, p.c), low: Math.min(o, p.c), close: p.c };
      });
      return { area, candles, prevClose: range === '1D' ? intra.prevClose : null };
    }
    const real = history?.length ? realSeries(history, range) : null;
    return real ?? priceSeries(ticker, range, price ?? 100);
  });

  const f = (n) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctS = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%');
  const usdS = (n) => (n == null ? '—' : (n >= 0 ? '+$' : '−$') + f(Math.abs(n)));
  function fmtDate(t) {
    if (t == null) return '';
    let d;
    if (typeof t === 'number') {
      d = new Date(t * 1000);
      return isNaN(d)
        ? ''
        : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    if (typeof t === 'string') d = new Date(t + 'T00:00:00');
    else if (typeof t === 'object' && t.year) d = new Date(t.year, (t.month || 1) - 1, t.day || 1);
    else return '';
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const BRAND = '#0fb39a', INK = '#1a1a1a', GAIN = '#00c060', LOSS = '#ff4d4d', GRID = '#e4e0d6', MUTED = '#8a8478';
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

  let host = $state();
  let chart = $state(null);
  let series = null;
  let highlight = null;
  let hover = $state(null);
  let drag = $state(null);
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
      const px = d ? (d.value ?? d.close) : null;
      hover = px == null ? null : { x: param.point.x, y: param.point.y, price: px, time: param.time };
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
        lineColor: BRAND, lineWidth: 2, topColor: hexA(BRAND, 0.16), bottomColor: hexA(BRAND, 0),
        priceLineVisible: false, lastValueVisible: false,
      });
      series.setData(d.area);
    }
    // 1D: dotted previous-close reference, the "am I up today?" line
    if (d.prevClose != null) {
      series.createPriceLine({
        price: d.prevClose, color: MUTED, lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: 'prev',
      });
    }
    chart.timeScale().fitContent();
  });

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

<div class="sc">
  <div class="sc-chartwrap" onpointerdown={startDrag}>
    <div class="sc-chart" bind:this={host}></div>
    {#if drag}<div class="sc-anchor" style="left:{drag.x}px"></div>{/if}
    {#if hover}
      {#if drag && drag.price != null}
        {@const d$ = hover.price - drag.price}
        {@const dp = (hover.price / drag.price - 1) * 100}
        {@const moved = Math.abs(hover.x - drag.x)}
        {@const fromT = drag.x <= hover.x ? drag.time : hover.time}
        {@const toT = drag.x <= hover.x ? hover.time : drag.time}
        <div class="sc-tip {moved > 8 ? (d$ >= 0 ? 'pos' : 'neg') : ''}" class:below={hover.y < 48} style="left:{hover.x}px; top:{hover.y}px">
          <span class="sc-tip-v">{usdS(d$)} · {pctS(dp)}</span>
          <span class="sc-tip-d">{fmtDate(fromT)} → {fmtDate(toT)}</span>
        </div>
      {:else}
        <div class="sc-tip" class:below={hover.y < 48} style="left:{hover.x}px; top:{hover.y}px">
          <span class="sc-tip-v">${f(hover.price)}</span>
          <span class="sc-tip-d">{fmtDate(hover.time)}</span>
        </div>
      {/if}
    {/if}
  </div>

  <div class="sc-controls">
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
</div>

<style>
  .sc { height: 100%; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .sc-chartwrap { flex: 1 1 auto; min-height: 200px; position: relative; user-select: none; touch-action: none; }
  .sc-chart { position: absolute; inset: 0; overflow: hidden; }
  .sc-anchor { position: absolute; top: 0; bottom: 0; width: 0; z-index: 4; pointer-events: none; border-left: 1px dashed var(--muted); }
  .sc-tip { position: absolute; z-index: 5; pointer-events: none; white-space: nowrap;
    transform: translate(-50%, calc(-100% - 12px));
    display: flex; flex-direction: column; align-items: center; line-height: 1.2;
    font-family: var(--mono); font-variant-numeric: tabular-nums;
    padding: 3px 7px; background: var(--ink); color: #fff !important; border-radius: 4px; }
  .sc-tip-v { font-size: 11px; font-weight: 700; }
  .sc-tip-d { font-size: 9px; font-weight: 400; }
  .sc-tip.pos { background: var(--gain); }
  .sc-tip.neg { background: var(--loss); }
  .sc-tip.below { transform: translate(-50%, 12px); }

  .sc-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .seg { display: inline-flex; border: var(--bw) solid var(--ink); border-radius: var(--r); overflow: hidden; }
  .seg button { font-family: var(--mono); font-size: 11px; font-weight: 700; cursor: pointer; padding: 4px 9px;
    border: 0; border-right: 2px solid var(--ink); background: var(--surface); color: var(--ink); }
  .seg button:last-child { border-right: 0; }
  .seg button.on { background: var(--ink); color: var(--surface); }
  .seg.ranges button { padding: 4px 8px; }
</style>
