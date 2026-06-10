<script>
  // Market pulse — the "how's the market" ambient widget (Google Finance /
  // Apple Stocks inspo): index quotes up top, a few market headlines below.
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { openStock } from '$lib/stores.js';

  let m = $state(null);
  onMount(async () => {
    try { m = await api.market(); } catch { m = { indices: [], news: [] }; }
  });

  const pct = (n) => (n == null ? '—' : (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%');
  const px = (n) => (n == null ? '—' : n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2));
  const ago = (at) => {
    if (at == null) return '';
    const s = Date.now() / 1000 - at;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    return Math.round(s / 86400) + 'd';
  };
</script>

<div class="glass-card pulse">
  <div class="pulse-h">market</div>
  {#if m === null}
    <div class="pulse-empty">Loading…</div>
  {:else}
    <div class="idx-row">
      {#each m.indices as ix (ix.symbol)}
        <button class="idx" onclick={() => openStock({ ticker: ix.symbol, name: ix.label, holding: null })}>
          <span class="idx-label">{ix.label}</span>
          <span class="idx-pct {(ix.dayPct ?? 0) >= 0 ? 'up' : 'down'}">{pct(ix.dayPct)}</span>
          <span class="idx-px">{px(ix.price)}</span>
        </button>
      {/each}
    </div>
    {#if m.news?.length}
      <div class="pulse-news">
        {#each m.news as n}
          <a class="pn-item" href={n.url} target="_blank" rel="noopener noreferrer">
            <span class="pn-title">{n.title}</span>
            <span class="pn-meta">{n.source}{#if n.at} · {ago(n.at)} ago{/if}</span>
          </a>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .pulse { display: flex; flex-direction: column; gap: 10px; padding: 13px 15px 14px; }
  .pulse-h { font-family: var(--sans); font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .12em; color: var(--ink); opacity: .5; }
  .pulse-empty { font-family: var(--mono); font-size: 11px; color: var(--muted); }

  .idx-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .idx { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; min-width: 0; cursor: pointer;
    padding: 8px 10px; font: inherit; text-align: left; color: var(--ink);
    background: var(--paper); border: 1.5px solid var(--ink); border-radius: var(--r);
    transition: transform .1s ease, box-shadow .1s ease; }
  .idx:hover { transform: translate(-1px, -1px); box-shadow: 2px 2px 0 var(--ink); }
  .idx-label { font-family: var(--sans); font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .05em; color: var(--muted); white-space: nowrap; }
  .idx-pct { font-family: var(--mono); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .idx-px { font-family: var(--mono); font-size: 10px; color: var(--muted); font-variant-numeric: tabular-nums; }

  .pulse-news { display: flex; flex-direction: column; }
  .pn-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; text-decoration: none; padding: 7px 0;
    border-top: 1.5px solid color-mix(in srgb, var(--ink) 11%, transparent); }
  .pn-item:last-child { padding-bottom: 0; }
  .pn-title { font-family: var(--sans); font-size: 11.5px; font-weight: 600; line-height: 1.35; color: var(--ink);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .pn-item:hover .pn-title { text-decoration: underline; }
  .pn-meta { font-family: var(--mono); font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

  .up { color: var(--gain); } .down { color: var(--loss); }
</style>
