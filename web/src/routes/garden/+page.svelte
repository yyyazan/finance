<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import GardenView from '$lib/components/GardenView.svelte';

  let garden = $state(null);
  let error = $state(null);
  let period = $state('afternoon');

  // Frame guides: overlay both dashboard aspect ratios at once so you can compose
  // for desktop + mobile without toggling. The camera's vertical FOV is fixed, so
  // these are aspect-ratio SAFE-FRAMES (think game-dev safe zones), not literal
  // pixel crops — the real bands reveal more horizontal scene than the debug view.
  let guides = $state(false);
  const GUIDE_W = 0.78; // both frames share this fraction of the stage width
  const DESKTOP_ASPECT = 5.3; // wide, short dashboard band (≈ content-width / 230)
  const MOBILE_ASPECT = 390 / 180; // phone hero (390 × 180)

  let stageW = $state(0);
  let fw = $derived(Math.round(stageW * GUIDE_W));

  const PERIODS = ['morning', 'afternoon', 'evening', 'night'];

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
    <div class="garden-stage" bind:clientWidth={stageW}>
      {#key period}
        <GardenView debug positions={garden.positions} period={period} />
      {/key}
      {#if guides && fw}
        <!-- Taller (mobile) drawn first so the shorter desktop strip reads on top. -->
        <div class="frame-guide frame-guide--mobile" style="width:{fw}px;height:{Math.round(fw / MOBILE_ASPECT)}px">
          <span class="frame-guide__tag">mobile · 390×180</span>
        </div>
        <div class="frame-guide frame-guide--desktop" style="width:{fw}px;height:{Math.round(fw / DESKTOP_ASPECT)}px">
          <span class="frame-guide__tag">desktop band</span>
        </div>
      {/if}
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
        class:is-active={guides}
        onclick={() => (guides = !guides)}
      >frame guides</button>
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

  /* The garden fills the stage; frame guides overlay on top when toggled. */
  .garden-stage { position: absolute; inset: 0; }

  /* Aspect-ratio safe-frames — both share a width and centre, so the desktop
     band reads as a short wide strip nested inside the taller mobile box. */
  .frame-guide {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border: 2px dashed currentColor;
    border-radius: 4px;
    pointer-events: none;
    z-index: 5;
    color: rgba(20, 20, 20, 0.55);
  }
  .frame-guide--mobile { color: rgba(40, 90, 160, 0.85); }
  .frame-guide--desktop { color: rgba(190, 70, 40, 0.9); }
  .frame-guide__tag {
    position: absolute;
    top: -19px;
    left: -2px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.72);
    color: currentColor;
    font: 600 11px var(--sans, sans-serif);
    white-space: nowrap;
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
