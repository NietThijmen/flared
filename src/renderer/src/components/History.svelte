<script lang="ts">
  import { app } from '../lib/state.svelte'
  import JobRow from './JobRow.svelte'

  const api = window.api
</script>

<section>
  <div class="bar">
    <h2>History</h2>
    {#if app.history.length}
      <button onclick={() => api['history:clear']()}>Clear all</button>
    {/if}
  </div>
  {#if app.history.length === 0}
    <p class="muted">Finished downloads will show up here.</p>
  {:else}
    <div class="list">
      {#each app.history as job (job.id)}<JobRow {job} />{/each}
    </div>
  {/if}
</section>

<style>
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
