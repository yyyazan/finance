<script>
  import { onMount, tick } from 'svelte';
  import { api } from '$lib/api.js';
  import GardenView from '$lib/components/GardenView.svelte';

  let garden = $state(null);
  let error = $state(null);
  let period = $state('afternoon');
  // Constrain the stage to the dashboard band's proportions to preview framing.
  let bandRatio = $state(false);

  const PERIODS = ['morning', 'afternoon', 'evening', 'night'];

  // Toggle the stage size, then nudge a resize so the garden recomputes its
  // camera aspect / renderer size from the new box (keeps the camera in place).
  async function toggleBandRatio() {
    bandRatio = !bandRatio;
    await tick();
    window.dispatchEvent(new Event('resize'));
  }

  onMount(async () => {
    try {
      garden = await api.garden();
      if (garden?.period) period = garden.period;
    } catch (e) {
      error = String(e);
    }
  });
</script>

<div class="garden-debug">
  {#if error}
    <p class="garden-debug__msg garden-debug__msg--err">Failed to load: {error}</p>
  {:else if garden}
    <!-- Re-key on period so switching time-of-day cleanly remounts the scene
         (teardown + fresh initGarden); the VOX cache makes the remount instant. -->
    <div class="garden-stage" class:garden-stage--band={bandRatio}>
      {#key period}
        <GardenView debug positions={garden.positions} period={period} />
      {/key}
    </div>

    <!-- Debug HUD -->
    <div class="garden-debug__bar">
      <span class="garden-debug__title">garden · debug</span>
      <div class="garden-debug__periods">
        {#each PERIODS as p (p)}
          <button
            class="garden-debug__btn"
            class:is-active={p === period}
            onclick={() => (period = p)}
          >{p}</button>
        {/each}
      </div>
      <button
        class="garden-debug__btn"
        class:is-active={bandRatio}
        onclick={toggleBandRatio}
      >dashboard ratio</button>
      <span class="garden-debug__hint">
        WASD move (⇧ fast) · left-drag rotate · right-drag pan · scroll zoom · click plant + G/E/R gizmo
      </span>
    </div>
  {:else}
    <p class="garden-debug__msg">Loading…</p>
  {/if}
</div>

<style>
  /* Fixed full-viewport so the debug scene escapes the app layout entirely. */
  .garden-debug {
    position: fixed;
    inset: 0;
    background: var(--bg, #f7f6f5);
    overflow: hidden;
  }

  /* The garden lives in a stage so we can swap full-viewport ↔ dashboard band. */
  .garden-stage { position: absolute; inset: 0; }
  /* Match the dashboard band: full width × clamp(180,23vw,230) tall, centered,
     with a hairline so the band edges are visible against the page bg. */
  .garden-stage--band {
    inset: auto 0 auto 0;
    top: 50%;
    height: clamp(180px, 23vw, 230px);
    transform: translateY(-50%);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
  }

  .garden-debug__msg {
    padding: 24px;
    color: var(--muted, #888);
    font-family: var(--sans, sans-serif);
  }
  .garden-debug__msg--err { color: var(--loss, #c0392b); }

  .garden-debug__bar {
    position: absolute;
    bottom: 12px; /* bottom — lil-gui editor panel owns the top-right */
    left: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 10px;
    font-family: var(--sans, sans-serif);
    font-size: 12px;
    pointer-events: auto;
  }
  .garden-debug__title { font-weight: 700; letter-spacing: -0.02em; }
  .garden-debug__periods { display: flex; gap: 4px; }
  .garden-debug__btn {
    padding: 4px 10px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 999px;
    background: transparent;
    font: inherit;
    text-transform: lowercase;
    cursor: pointer;
  }
  .garden-debug__btn:hover { background: rgba(0, 0, 0, 0.05); }
  .garden-debug__btn.is-active {
    background: #2b2b2b;
    color: #fff;
    border-color: #2b2b2b;
  }
  .garden-debug__hint { margin-left: auto; color: var(--muted, #888); }
</style>
