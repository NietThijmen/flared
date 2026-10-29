<script lang="ts">
  import type { Job } from '../../../shared/types'

  let { job }: { job: Job } = $props()

  const api = window.api
  const active = $derived(job.status === 'queued' || job.status === 'running')
  const HINTS: Record<string, string> = {
    'login-required': 'Needs a login: try enabling browser cookies in Settings.',
    'geo-blocked': 'Not available in your region.',
    'rate-limited': 'The site is rate-limiting you. Wait a while and retry.',
    'binary-missing': 'yt-dlp is not installed yet.'
  }
  const label = $derived(
    job.status === 'running'
      ? [`${job.progress}%`, job.speed, job.eta ? `ETA ${job.eta}` : null]
          .filter(Boolean)
          .join(' · ')
      : job.status === 'error'
        ? ((job.error && HINTS[job.error.kind]) ?? job.error?.message ?? 'Failed')
        : job.status
  )
</script>

<div class="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
  {#if job.thumbnail}
    <img
      src={job.thumbnail}
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      class="h-[54px] w-24 flex-none rounded-lg bg-surface-2 object-cover"
    />
  {:else}
    <div class="h-[54px] w-24 flex-none rounded-lg bg-surface-2"></div>
  {/if}
  <div class="min-w-0 flex-1">
    <div class="truncate font-medium" title={job.title}>{job.title}</div>
    <div class="mt-0.5 text-xs {job.status === 'error' ? 'text-danger' : 'text-muted'}">
      <span class="mr-1 rounded border border-line px-1 text-[10px] tracking-wide uppercase"
        >{job.options.mode}</span
      >
      {label}
    </div>
    {#if active}
      <div
        class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={job.progress}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full bg-accent transition-[width] duration-200"
          style:width="{job.progress}%"
        ></div>
      </div>
    {/if}
  </div>
  <div class="flex gap-1.5">
    {#if active}
      <button class="btn" onclick={() => api['queue:cancel'](job.id)}>Cancel</button>
    {:else}
      {#if job.status === 'done' && job.filePath}
        <button class="btn" onclick={() => api['shell:reveal'](job.filePath!)}>Show</button>
      {:else}
        <button class="btn" onclick={() => api['queue:retry'](job.id)}>
          {job.status === 'cancelled' ? 'Resume' : 'Retry'}
        </button>
      {/if}
      <button
        class="btn btn-ghost size-8 !p-0"
        aria-label="Remove"
        onclick={() => api['queue:remove'](job.id)}>✕</button
      >
    {/if}
  </div>
</div>
