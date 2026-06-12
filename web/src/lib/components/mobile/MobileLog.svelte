<script>
  // Mobile Log pane — the two click-to-expand logger tiles (cash + trade),
  // full-width, with the shared searchable activity lists underneath
  // (ActivityLog — same component the desktop /trades page renders). Tiles
  // stay near the top so the iOS keyboard never covers their rising panels.
  import { onMount } from 'svelte';
  import CashGoalCard from '../CashGoalCard.svelte';
  import TradeTicket from '../TradeTicket.svelte';
  import ActivityLog from '../ActivityLog.svelte';
  import { api } from '$lib/api.js';

  let { d, refresh } = $props();

  let trades = $state([]);
  let txns = $state([]);
  async function loadActivity() {
    try {
      [trades, txns] = await Promise.all([api.trades(), api.transactions()]);
    } catch { /* lists stay as-is */ }
  }
  onMount(loadActivity);

  // refresh the dashboard payload AND this pane's activity lists after a save
  async function onSaved() {
    await refresh?.();
    loadActivity();
  }
</script>

<div class="ml-tiles">
  <CashGoalCard cash={d.kpis.cash} portfolioValue={d.kpis.portfolio_value}
    goalLabel="monthly goal" goalCurrent={d.goal.current} goalTarget={d.goal.target}
    {onSaved} />
  <TradeTicket {onSaved} />
</div>

<ActivityLog {trades} {txns} />

<style>
  .ml-tiles { display: flex; flex-direction: column; gap: 12px;
    padding-top: calc(12px + env(safe-area-inset-top)); }
  /* give the tiles enough body for their 60%-rise entry panels */
  .ml-tiles > :global(.glass-card) { min-height: 190px; padding: 14px 16px; }
</style>
