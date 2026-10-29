<script lang="ts">
  import type { Job } from '../../../shared/types'

  let { job }: { job: Job } = $props()

  const api = window.api
  const active = $derived(job.status === 'queued' || job.status === 'running')
  const label = $derived(
    job.status === 'running'
      ? [`${job.progress}%`, job.speed, job.eta ? `ETA ${job.eta}` : null]
          .filter(Boolean)
          .join(' · ')
      : job.status === 'error'
        ? (job.error?.message ?? 'Failed')
        : job.status
  )
</script>

<div class="row card">
  {#if job.thumbnail}
    <img src={job.thumbnail} alt="" loading="lazy" referrerpolicy="no-referrer" />
  {:else}
    <div class="thumb"></div>
  {/if}
  <div class="info">
    <div class="title" title={job.title}>{job.title}</div>
    <div class="meta" class:error={job.status === 'error'}>
      <span class="badge">{job.options.mode}</span>
      {label}
    </div>
    {#if active}
      <div
        class="bar"
        role="progressbar"
        aria-valuenow={job.progress}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="fill" style:width="{job.progress}%"></div>
      </div>
    {/if}
  </div>
  <div class="actions">
    {#if active}
      <button onclick={() => api['queue:cancel'](job.id)}>Cancel</button>
    {:else}
      {#if job.status === 'done' && job.filePath}
        <button onclick={() => api['shell:reveal'](job.filePath!)}>Show</button>
      {:else}
        <button onclick={() => api['queue:retry'](job.id)}>
          {job.status === 'cancelled' ? 'Resume' : 'Retry'}
        </button>
      {/if}
      <button class="ghost" aria-label="Remove" onclick={() => api['queue:remove'](job.id)}
        >✕</button
      >
    {/if}
  </div>
</div>

<style>
  .row {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px;
  }
  img,
  .thumb {
    width: 96px;
    height: 54px;
    object-fit: cover;
    border-radius: 6px;
    background: var(--surface-2);
    flex: none;
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    color: var(--muted);
    font-size: 12px;
    margin-top: 2px;
  }
  .badge {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.04em;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 4px;
    margin-right: 4px;
  }
  .bar {
    height: 4px;
    background: var(--surface-2);
    border-radius: 2px;
    margin-top: 6px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
</style>
