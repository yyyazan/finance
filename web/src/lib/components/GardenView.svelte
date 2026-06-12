<script>
  import { onMount, onDestroy } from 'svelte';
  import { openStock, cardToHolding } from '$lib/stores.js';
  // debug → full-viewport inspect mode (OrbitControls + grid/axes + editor),
  // used by the /garden page. Omitted on the dashboard band (idle-sway orbit).
  let { positions, period, debug = false } = $props();

  // Hover/tap state, fed by the pick layer's onHover callback. Shape:
  // { card, x, y, above } | null. Cleared (null) on leave / tap-away / teardown.
  let hover = $state(null);

  // pick.js → here: track the hovered plant; open its detail on click/tap.
  function onHover(p) { hover = p; }
  function onPick(card) {
    openStock({ ticker: card.ticker, name: card.company_name, holding: cardToHolding(card) });
  }

  // initGarden returns its own teardown fn; we hold it for onDestroy so SPA
  // navigation doesn't leak the rAF loop / orphan the canvas. Dynamic import
  // keeps three.js out of the initial bundle and ensures browser-only execution.
  let teardown;

  onMount(async () => {
    const { initGarden } = await import('$lib/three/garden/index.js');
    teardown = initGarden({ positions, period }, { debug, onHover, onPick });
  });

  onDestroy(() => teardown?.());
</script>

<div class="garden-canvas-root" class:garden-canvas-root--fill={debug} id="garden-root">
  {#if hover}
    {@const c = hover.card}
    {@const d = c.day_pct == null ? null : +c.day_pct}
    <div
      class="g-tip"
      class:pos={d != null && d >= 0}
      class:neg={d != null && d < 0}
      class:below={!hover.above}
      style="left:{hover.x}px; top:{hover.y}px"
    >
      <span class="g-tip-ticker">{c.ticker}</span>
      <span class="g-tip-alloc">{(+c.position_pct).toFixed(1)}% of book</span>
      <span class="g-tip-mom">
        {#if d == null}—{:else}{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(2)}% today{/if}
      </span>
    </div>
  {/if}
</div>

<style>
  /* Tooltip mirrors the chart .sc-tip / .ts-tooltip patterns + design tokens. */
  .g-tip {
    position: absolute;
    z-index: 3;
    pointer-events: none;
    white-space: nowrap;
    transform: translate(-50%, calc(-100% - 14px));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 9px;
    background: var(--surface);
    color: var(--text);
    border: var(--bw) solid var(--ink);
    border-radius: var(--r);
    box-shadow: var(--sh-pop);
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }
  .g-tip.below { transform: translate(-50%, 14px); }
  .g-tip-ticker { font-family: var(--sans); font-weight: 700; font-size: 12px; }
  .g-tip-alloc { font-size: 11px; color: var(--muted); }
  .g-tip-mom { font-size: 10px; color: var(--muted); }
  .g-tip.pos .g-tip-mom { color: var(--gain); }
  .g-tip.neg .g-tip-mom { color: var(--loss); }
</style>
