<script>
  import { onMount, onDestroy } from 'svelte';
  let { positions, period } = $props();

  // initGarden returns its own teardown fn; we hold it for onDestroy so SPA
  // navigation doesn't leak the rAF loop / orphan the canvas. Dynamic import
  // keeps three.js out of the initial bundle and ensures browser-only execution.
  let teardown;

  onMount(async () => {
    const { initGarden } = await import('$lib/three/garden/index.js');
    teardown = initGarden({ positions, period });
  });

  onDestroy(() => teardown?.());
</script>

<div class="garden-canvas-root" id="garden-root"></div>
