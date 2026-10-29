<script lang="ts">
  import { onMount } from 'svelte'
  import type { DownloadMode } from '../../../shared/types'

  const api = window.api

  type Status =
    | { kind: 'idle' }
    | { kind: 'busy' }
    | { kind: 'queued'; title: string; duplicate: boolean }
    | { kind: 'playlist'; title: string; count: number }
    | { kind: 'error'; message: string }

  const MODES: { id: DownloadMode; label: string }[] = [
    { id: 'video', label: 'Video' },
    { id: 'audio', label: 'Audio' },
    { id: 'mute', label: 'Muted' }
  ]

  let input = $state<HTMLInputElement>()
  let url = $state('')
  let mode = $state<DownloadMode>('video')
  let status = $state<Status>({ kind: 'idle' })

  const busy = $derived(status.kind === 'busy')

  /** Prefill from the clipboard when the popover opens, so copy → click → Enter is enough. */
  async function onFocus(): Promise<void> {
    input?.focus()
    if (url.trim() || status.kind !== 'idle') return
    const text = (await api['clipboard:read']()).trim()
    if (/^https?:\/\/\S+$/i.test(text)) {
      url = text
      input?.select()
    }
  }

  async function submit(): Promise<void> {
    const value = url.trim()
    if (!value || busy) return
    status = { kind: 'busy' }
    const res = await api['quick:submit'](value, mode)
    if (!res.ok) {
      status = { kind: 'error', message: res.error.message }
      return
    }
    status = { kind: res.value.status, ...res.value } as Status
    if (res.value.status === 'queued') {
      setTimeout(() => {
        void api['quick:hide']()
        url = ''
        status = { kind: 'idle' }
      }, 1300)
    }
  }

  async function openInApp(): Promise<void> {
    await api['quick:openInApp'](url.trim())
    await api['quick:hide']()
    url = ''
    status = { kind: 'idle' }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') void api['quick:hide']()
  }

  onMount(() => {
    document.documentElement.classList.add('quick')
    void api['settings:get']().then((s) => (mode = s.defaults.mode))
    void onFocus()
  })
</script>

<svelte:window onfocus={onFocus} onkeydown={onKeydown} />

<form
  class="flex h-screen flex-col gap-2.5 p-4"
  onsubmit={(e) => {
    e.preventDefault()
    void submit()
  }}
>
  <input
    bind:this={input}
    type="url"
    placeholder="Paste a link and press Enter"
    aria-label="Media link"
    bind:value={url}
    oninput={() => status.kind === 'error' && (status = { kind: 'idle' })}
    class="field h-11 w-full rounded-full px-4 text-sm"
  />

  <div class="flex items-center justify-between gap-2">
    <div
      class="inline-flex gap-0.5 rounded-full bg-surface-2 p-1"
      role="radiogroup"
      aria-label="Download type"
    >
      {#each MODES as m (m.id)}
        <button
          type="button"
          role="radio"
          aria-checked={mode === m.id}
          onclick={() => (mode = m.id)}
          class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {mode === m.id
            ? 'bg-accent text-accent-ink'
            : 'text-muted hover:text-ink'}">{m.label}</button
        >
      {/each}
    </div>
    <button class="btn btn-primary" disabled={busy || !url.trim()}
      >{busy ? 'Looking…' : 'Download'}</button
    >
  </div>

  <div class="flex min-h-[18px] items-center gap-2 overflow-hidden text-xs" aria-live="polite">
    {#if status.kind === 'queued'}
      <span class="truncate text-ok"
        >{status.duplicate ? 'Already downloading' : 'Downloading'}: {status.title}</span
      >
    {:else if status.kind === 'playlist'}
      <span class="truncate">Playlist, {status.count} items.</span>
      <button type="button" class="btn btn-ghost !px-2 !py-0.5 text-xs" onclick={openInApp}
        >Choose in Flared</button
      >
    {:else if status.kind === 'error'}
      <span class="truncate text-danger">{status.message}</span>
    {/if}
  </div>
</form>
