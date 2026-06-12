<script>
  // Floating dock — iOS stock-dock geometry (64px inset capsule, glass blur,
  // near-full-height active bubble) in the neo-brutalist language: 1px ink
  // border, solid-ink pill, paper text, mono labels.
  //
  // Interactions:
  //  · tap a tab — pill slides over on a hard spring (overshoot, no blur-morph)
  //  · HOLD + SLIDE anywhere on the dock — the pill rides the finger 1:1
  //    (no easing while live, brutalist-direct), the tab under it activates in
  //    real time, and on release the pill snaps onto the column.
  let { tab = $bindable('home') } = $props();

  const TABS = [
    { key: 'home', glyph: '', label: 'home' },     // home renders an inline sprout SVG
    { key: 'search', glyph: '⌕', label: 'search' },
    { key: 'holdings', glyph: '☰', label: 'holdings' },
    { key: 'log', glyph: '⊞', label: 'log' },
  ];
  const idx = $derived(Math.max(0, TABS.findIndex((t) => t.key === tab)));

  const PAD = 4;            // capsule inner padding = pill inset
  const SLOP = 6;           // px of travel before a press becomes a slide

  let navEl;
  let pressed = false;
  let pressX = 0;
  let dragging = $state(false);
  let dragX = $state(0);    // pill offset in px while sliding

  function slideTo(clientX) {
    const r = navEl.getBoundingClientRect();
    const inner = r.width - PAD * 2;
    const col = inner / TABS.length;
    dragX = Math.min(Math.max(clientX - r.left - PAD - col / 2, 0), inner - col);
    // live activation: the tab under the pill switches as you slide
    const i = Math.min(TABS.length - 1, Math.max(0, Math.round(dragX / col)));
    if (TABS[i].key !== tab) tab = TABS[i].key;
  }

  function onDown(e) {
    pressed = true;
    pressX = e.clientX;
    navEl.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    if (!pressed) return;
    if (!dragging && Math.abs(e.clientX - pressX) < SLOP) return;
    dragging = true;
    slideTo(e.clientX);
  }
  function onUp() {
    pressed = false;
    dragging = false;   // pill snaps from dragX onto the column (spring)
  }
</script>

<nav class="m-dock" aria-label="dashboard sections" bind:this={navEl}
  onpointerdown={onDown} onpointermove={onMove} onpointerup={onUp} onpointercancel={onUp}>
  <!-- active bubble: column-snapped at rest, finger-locked while sliding -->
  <span class="m-dock-pill" class:live={dragging} aria-hidden="true"
    style={dragging ? `transform: translateX(${dragX}px) scale(1.04)` : `transform: translateX(${idx * 100}%)`}></span>
  {#each TABS as t (t.key)}
    <button class="m-tab" class:on={tab === t.key} onclick={() => (tab = t.key)}
      aria-current={tab === t.key ? 'page' : undefined}>
      {#if t.key === 'home'}
        <!-- home = a little sprout (currentColor so it inverts to paper when active) -->
        <svg class="m-tab-glyph m-tab-sprout" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21 V11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          <path d="M12 13 C 8.5 13, 6 10.8, 5.6 6.8 C 9.6 7, 11.7 9.4, 12 13 Z" fill="currentColor" />
          <path d="M12 11 C 15.5 11, 18 8.8, 18.4 4.8 C 14.4 5, 12.3 7.4, 12 11 Z" fill="currentColor" />
        </svg>
      {:else}
        <span class="m-tab-glyph" aria-hidden="true">{t.glyph}</span>
      {/if}
      <span class="m-tab-label">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  /* Mirrors Apple's floating tab bar (iOS Music/News). Geometry from the HIG +
     measured system metrics:
       · 49pt bar region → 56px capsule with the floating body
       · capsule = true pill, radius = height/2 (999px clamps to that)
       · 16px side margins = the system default content margin
       · floats just above the 34pt home-indicator zone (8px gap)
       · 4px pill inset → 48px active bubble (clears Apple's 44pt min target) */
  .m-dock { position: fixed; left: 16px; right: 16px; bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 100; box-sizing: border-box; height: 56px; padding: 4px;
    display: grid; grid-template-columns: repeat(4, 1fr); align-items: stretch;
    /* iOS glass under a brutalist ink line: translucent paper + blur, 1px border */
    background: color-mix(in srgb, var(--paper) 72%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    backdrop-filter: blur(16px) saturate(1.4);
    border: var(--bw) solid var(--ink); border-radius: 999px;
    /* the dock owns its gestures — no page scroll / back-swipe from here */
    touch-action: none; -webkit-user-select: none; user-select: none; }

  .m-dock-pill { position: absolute; top: 4px; bottom: 4px; left: 4px;
    width: calc((100% - 8px) / 4);
    background: var(--ink); border-radius: 999px;
    transition: transform .38s cubic-bezier(.34, 1.56, .5, 1); }
  /* live slide: zero easing — the pill is bolted to the finger */
  .m-dock-pill.live { transition: none; }

  .m-tab { position: relative; z-index: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px;
    padding: 0; border: 0; background: transparent; cursor: pointer;
    color: var(--muted); font: inherit; -webkit-user-select: none; user-select: none;
    -webkit-touch-callout: none;
    transition: color .18s ease, transform .12s ease; }
  .m-tab:active { transform: scale(.94); }
  .m-tab.on { color: var(--paper); }

  /* ≈ Apple's 28pt SF Symbol optical size, dialed for our unicode glyphs */
  .m-tab-glyph { font-size: 24px; line-height: 1; }
  .m-tab-sprout { width: 23px; height: 23px; display: block; }
  .m-tab.on .m-tab-glyph { animation: m-dock-pop .38s cubic-bezier(.34, 1.56, .5, 1); }
  @keyframes m-dock-pop {
    0% { transform: scale(1); }
    45% { transform: scale(1.22) translateY(-1.5px); }
    100% { transform: scale(1); }
  }

  /* Apple tab labels are 10pt SF; ours keep the brutalist mono-caps treatment */
  .m-tab-label { font-family: var(--sans); font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .06em; }

  @media (prefers-reduced-motion: reduce) {
    .m-dock-pill, .m-tab { transition: none; }
    .m-tab.on .m-tab-glyph { animation: none; }
  }
</style>
