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
  class="quick"
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
  />

  <div class="row">
    <div class="seg" role="radiogroup" aria-label="Download type">
      {#each MODES as m (m.id)}
        <button
          type="button"
          class:active={mode === m.id}
          role="radio"
          aria-checked={mode === m.id}
          onclick={() => (mode = m.id)}>{m.label}</button
        >
      {/each}
    </div>
    <button class="primary" disabled={busy || !url.trim()}>{busy ? 'Looking…' : 'Download'}</button>
  </div>

  <div class="status" aria-live="polite">
    {#if status.kind === 'queued'}
      <span class="ok"
        >{status.duplicate ? 'Already downloading' : 'Downloading'}: {status.title}</span
      >
    {:else if status.kind === 'playlist'}
      <span>Playlist, {status.count} items.</span>
      <button type="button" class="ghost" onclick={openInApp}>Choose in Flared</button>
    {:else if status.kind === 'error'}
      <span class="error">{status.message}</span>
    {/if}
  </div>
</form>

<style>
  .quick {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    height: 100vh;
  }
  input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .seg {
    display: inline-flex;
    gap: 4px;
  }
  .seg .active {
    background: var(--accent);
    color: var(--accent-text);
    border-color: transparent;
  }
  .status {
    font-size: 12px;
    min-height: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }
  .status span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ok {
    color: var(--ok);
  }
</style>
