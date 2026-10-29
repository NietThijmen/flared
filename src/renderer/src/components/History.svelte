<script lang="ts">
  import { app } from '../lib/state.svelte'
  import JobRow from './JobRow.svelte'

  const api = window.api
</script>

<section class="flex flex-col gap-3">
  {#if app.history.length === 0}
    <p class="py-10 text-center text-muted">Finished downloads will show up here.</p>
  {:else}
    <div class="flex gap-2">
      <button class="btn" onclick={() => api['shell:openFolder']()}>Open folder</button>
      <button class="btn" onclick={() => api['history:clear']()}>Clear all</button>
    </div>
    <div class="flex flex-col gap-2">
      {#each app.history as job (job.id)}<JobRow {job} />{/each}
    </div>
  {/if}
</section>
