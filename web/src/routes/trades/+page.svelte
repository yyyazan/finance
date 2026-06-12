<script>
  // Desktop Log — read-only activity lists on the shared ActivityLog component
  // (the same searchable rows the mobile Log pane uses), plus the realized FIFO
  // lots. ENTRY LIVES ON THE DASHBOARD (cash tile + trade ticket); this page
  // deliberately has no forms.
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import ActivityLog from '$lib/components/ActivityLog.svelte';

  let trades = $state([]);
  let txns = $state([]);
  let realized = $state([]);
  let error = $state(null);

  onMount(async () => {
    try {
      [trades, txns, realized] = await Promise.all([
        api.trades(),
        api.transactions(),
        api.realized()
      ]);
    } catch (e) {
      error = String(e);
    }
  });
</script>

<div class="content">
  <div class="page-title">Log</div>
  {#if error}
    <p style="color:var(--loss)">Failed to load: {error}</p>
  {:else}
    <div class="log-wrap">
      <ActivityLog {trades} {txns} {realized} />
    </div>
  {/if}
</div>

<style>
  /* keep the list rows readable — don't stretch them across the full 1400px shell */
  .log-wrap { max-width: 980px; }
</style>
