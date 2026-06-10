<script>
  import '../app.css';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import StockDetail from '$lib/components/StockDetail.svelte';
  import StockSearch from '$lib/components/StockSearch.svelte';
  import { detail, searchOpen, holdings, openSearchResult, closeStock, openSearch, closeSearch } from '$lib/stores.js';
  let { children } = $props();

  // The dashboard renders stock view + search INSIDE its main stage widget;
  // every other route falls back to the full-screen overlays.
  const onDashboard = $derived($page.url.pathname === '/');

  // ⌘K / Ctrl-K opens search from anywhere.
  function onKey(e) {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openSearch(); }
  }
  $effect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="app-root">
  <Sidebar />
  {@render children()}
</div>

{#if $detail && !onDashboard}
  <StockDetail ticker={$detail.ticker} name={$detail.name} holding={$detail.holding} onClose={() => closeStock()} />
{/if}
{#if $searchOpen && !onDashboard}
  <StockSearch onClose={() => closeSearch()} onPick={openSearchResult}
    holdings={($holdings ?? []).map((c) => ({ symbol: c.ticker, name: c.company_name, type: 'Holding' }))} />
{/if}
