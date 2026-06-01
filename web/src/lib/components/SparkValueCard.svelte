<script>
  // Jade hero card: a single dollar figure with an ambient area sparkline bleeding
  // edge-to-edge behind it. No axes, no labels — the card's left/right ARE the
  // chart's start/end; the peak reaches ~80% of the card height. Pure context.
  let { label = 'Portfolio Value', value, series = [], subtitle = null } = $props();

  const VW = 300, VH = 100, PEAK = 0.8;   // viewBox units; peak = 80% of height

  const display = $derived('$' + Math.round(value ?? 0).toLocaleString('en-US'));

  const spark = $derived.by(() => {
    const ys = (series ?? []).filter((v) => v != null);
    if (ys.length < 2) return null;
    const min = Math.min(...ys), max = Math.max(...ys);
    const span = max - min || 1;
    const pts = ys.map((v, i) => {
      const x = (i / (ys.length - 1)) * VW;
      const y = VH - ((v - min) / span) * PEAK * VH;   // trough→baseline, peak→0.2·VH
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const line = 'M' + pts.join(' L');
    return { line, area: `${line} L${VW},${VH} L0,${VH} Z` };
  });
</script>

<div class="glass-card kpi-card spark-card" style="--fill:var(--brand)">
  {#if spark}
    <svg class="spark-bg" viewBox="0 0 {VW} {VH}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop class="spark-stop-top" offset="100%" />
          <stop class="spark-stop-bot" offset="100%" />
        </linearGradient>
      </defs>
      <path class="spark-area" d={spark.area} fill="url(#sparkGrad)" />
    </svg>
  {/if}
  <div class="spark-content">
    <div class="kpi-label">{label}</div>
    <div class="kpi-value">{display}</div>
    {#if subtitle}<div class="kpi-subtitle">{subtitle}</div>{/if}
  </div>
</div>
