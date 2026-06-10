<script>
  import { onMount, onDestroy } from 'svelte';
  // debug → full-viewport inspect mode (OrbitControls + grid/axes + editor),
  // used by the /garden page. Omitted on the dashboard band (idle-sway orbit).
  let { positions, period, debug = false } = $props();

  // initGarden returns its own teardown fn; we hold it for onDestroy so SPA
  // navigation doesn't leak the rAF loop / orphan the canvas. Dynamic import
  // keeps three.js out of the initial bundle and ensures browser-only execution.
  let teardown;

  onMount(async () => {
    const { initGarden } = await import('$lib/three/garden/index.js');
    teardown = initGarden({ positions, period }, { debug });
  });

  onDestroy(() => teardown?.());
</script>

<div class="garden-canvas-root" class:garden-canvas-root--fill={debug} id="garden-root"></div>
