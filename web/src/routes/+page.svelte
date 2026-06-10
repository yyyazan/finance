<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import CashGoalCard from '$lib/components/CashGoalCard.svelte';
  import DividendWraith from '$lib/components/DividendWraith.svelte';
  import AllocationRing from '$lib/components/AllocationRing.svelte';
  import DashboardStage from '$lib/components/DashboardStage.svelte';
  import MarketPulse from '$lib/components/MarketPulse.svelte';
  import GardenView from '$lib/components/GardenView.svelte';
  import { primeHoldings } from '$lib/stores.js';

  let d = $state(null);
  let garden = $state(null);
  let error = $state(null);

  onMount(async () => {
    try {
      [d, garden] = await Promise.all([api.dashboard(), api.garden()]);
      primeHoldings(d.cards);          // share holdings with the sidebar rail
    } catch (e) {
      error = String(e);
    }
  });

  // Re-pull the dashboard after a transaction is saved from the cash tile, so cash updates.
  async function refresh() {
    try {
      d = await api.dashboard();
      primeHoldings(d.cards);
    } catch (e) {
      error = String(e);
    }
  }
</script>

{#if error}
  <div class="content"><p style="color:var(--loss)">Failed to load: {error}</p></div>
{:else if d && garden}
  <div class="content content-has-hero">
    <div class="page-hero">
      <GardenView positions={garden.positions} period={garden.period} />
      <div class="page-header-overlay">
        <div class="greeting-title">{d.greeting}</div>
      </div>
    </div>

    <!-- stage (big, leftmost) · widget rail (right) -->
    <div class="dash">
      <DashboardStage equity={d.equity_curve} spy={d.spy_curve} twr={d.twr} />

      <aside class="dash-rail">
        <div class="rail-duo">
          <KpiCard label="Portfolio Value" value={d.kpis.portfolio_value} kind="money" size="mini" subtitle="stocks + cash" />
          <KpiCard label="Total P&L" value={d.kpis.total_pnl} kind="money_compact" size="mini" subtitle="unrealized + realized"
            tone={d.kpis.total_pnl >= 0 ? 'gain' : 'loss'} />
        </div>
        <CashGoalCard cash={d.kpis.cash} portfolioValue={d.kpis.portfolio_value}
          goalLabel="monthly goal" goalCurrent={d.goal.current} goalTarget={d.goal.target}
          onSaved={refresh} />
        <div class="rail-duo rail-bare">
          <DividendWraith data={d.dividends} holdings={d.cards} />
          <AllocationRing holdings={d.cards.filter((c) => !c.is_joker)} />
        </div>
        <MarketPulse />
      </aside>
    </div>
  </div>
{:else}
  <div class="content"><p style="color:var(--muted)">Loading…</p></div>
{/if}

<style>
  /* main stage gets the lion's share; the rail is a fixed comfortable column */
  /* main stage : rail = 3 : 1 */
  .dash { display: grid; grid-template-columns: minmax(0, 3fr) minmax(300px, 1fr); gap: 16px; align-items: start; }
  .dash > :global(.stage) { min-height: 520px; }

  .dash-rail { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .rail-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .rail-duo > :global(.glass-card) { padding: 12px 14px; }
  /* dividends + allocation: intentionally chrome-less, side by side */
  .rail-bare { align-items: center; }

  @media (max-width: 1100px) {
    .dash { grid-template-columns: 1fr; }
    .dash > :global(.stage) { min-height: 480px; }
  }
  @media (max-width: 700px) {
    .rail-duo { gap: 12px; }
  }
</style>
