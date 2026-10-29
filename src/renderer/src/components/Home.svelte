<script lang="ts">
  import type {
    AudioFormat,
    DownloadMode,
    DownloadOptions,
    MediaInfo,
    VideoContainer
  } from '../../../shared/types'
  import { SvelteSet } from 'svelte/reactivity'
  import { formatDuration } from '../lib/format'
  import { app } from '../lib/state.svelte'
  import JobRow from './JobRow.svelte'

  const api = window.api

  let url = $state('')
  let busy = $state(false)
  let error = $state<string | null>(null)
  let info = $state<MediaInfo | null>(null)
  const selected = new SvelteSet<string>()

  let mode = $state<DownloadMode>('video')
  let maxHeight = $state<number | null>(null)
  let container = $state<VideoContainer>('mp4')
  let audioFormat = $state<AudioFormat>('mp3')
  let embedMetadata = $state(true)
  let subtitles = $state(false)
  let sponsorblock = $state(false)

  $effect(() => {
    const d = app.settings?.defaults
    if (!d) return
    mode = d.mode
    maxHeight = d.maxHeight
    container = d.videoContainer
    audioFormat = d.audioFormat
    embedMetadata = d.embedMetadata
    subtitles = d.subtitles
    sponsorblock = d.sponsorblock
  })

  const binariesReady = $derived(app.binaries?.ytdlp.installed && app.binaries?.ffmpeg.installed)
  const queued = $derived([...app.jobs].sort((a, b) => a.createdAt - b.createdAt))

  async function probe(): Promise<void> {
    const value = url.trim()
    if (!value || busy) return
    busy = true
    error = null
    info = null
    const res = await api['media:probe'](value)
    busy = false
    if (!res.ok) {
      error = res.error.message
      return
    }
    info = res.value
    selected.clear()
    res.value.entries.forEach((e) => selected.add(e.id))
  }

  async function download(): Promise<void> {
    if (!info) return
    const options: DownloadOptions = {
      mode,
      maxHeight,
      videoContainer: container,
      audioFormat,
      embedMetadata,
      subtitles,
      sponsorblock
    }
    const items = info.isPlaylist
      ? info.entries
          .filter((e) => selected.has(e.id))
          .map((e) => ({ url: e.url, title: e.title, thumbnail: e.thumbnail }))
      : [{ url: info.url, title: info.title, thumbnail: info.thumbnail }]
    if (!items.length) return
    await api['queue:add'](items, options)
    info = null
    url = ''
  }

  function toggle(id: string): void {
    if (selected.has(id)) selected.delete(id)
    else selected.add(id)
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault()
    const text = (
      e.dataTransfer?.getData('text/uri-list') ||
      e.dataTransfer?.getData('text/plain') ||
      ''
    )
      .split('\n')
      .find((l) => /^https?:\/\//i.test(l.trim()))
    if (!text) return
    url = text.trim()
    void probe()
  }

  function useClipboard(): void {
    if (!app.clipboardUrl) return
    url = app.clipboardUrl
    app.clipboardUrl = null
    void probe()
  }
</script>

<svelte:window ondragover={(e) => e.preventDefault()} ondrop={onDrop} />

<section class="flex w-full max-w-2xl flex-col items-stretch gap-5">
  <h1 class="text-center text-6xl font-semibold tracking-tight select-none">Flared</h1>

  <form
    class="group relative"
    onsubmit={(e) => {
      e.preventDefault()
      void probe()
    }}
  >
    <svg
      viewBox="0 0 24 24"
      class="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      ><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path
        d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
      /></svg
    >
    <input
      type="url"
      placeholder="Paste a link"
      bind:value={url}
      onpaste={() => setTimeout(probe, 0)}
      aria-label="Media link"
      class="h-14 w-full rounded-full border border-line bg-surface pr-14 pl-13 text-base shadow-sm transition-shadow outline-none placeholder:text-muted hover:shadow-md focus:border-transparent focus:shadow-lg focus:ring-2 focus:ring-accent/40"
    />
    <button
      class="btn btn-primary absolute top-1/2 right-2 size-10 -translate-y-1/2 !p-0"
      disabled={busy || !url.trim() || !binariesReady}
      aria-label={busy ? 'Looking…' : 'Fetch'}
    >
      {#if busy}
        <span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        ></span>
      {:else}
        <svg
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg
        >
      {/if}
    </button>
  </form>

  {#if !binariesReady}
    <p class="text-center text-muted">
      {app.binaries?.busy
        ? 'Setting up yt-dlp and ffmpeg…'
        : 'Waiting for yt-dlp and ffmpeg to be installed.'}
    </p>
  {/if}

  {#if app.clipboardUrl}
    <button
      class="btn mx-auto max-w-full self-center"
      onclick={useClipboard}
      title={app.clipboardUrl}
    >
      <span class="text-muted">Paste from clipboard</span>
      <span class="max-w-72 truncate">{app.clipboardUrl}</span>
    </button>
  {/if}

  {#if error}<p class="text-center text-danger">{error}</p>{/if}

  {#if info}
    <div class="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <div class="flex gap-4">
        {#if info.thumbnail}
          <img
            src={info.thumbnail}
            alt=""
            referrerpolicy="no-referrer"
            class="aspect-video w-40 flex-none rounded-xl object-cover"
          />
        {/if}
        <div class="min-w-0">
          <h2 class="line-clamp-2 text-base leading-snug font-medium">{info.title}</h2>
          <p class="mt-1 truncate text-muted">
            {[info.uploader, formatDuration(info.duration), info.extractor]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div
        class="inline-flex w-fit gap-0.5 rounded-full bg-surface-2 p-1"
        role="radiogroup"
        aria-label="Download type"
      >
        {#each ['video', 'audio', 'mute'] as const as m (m)}
          <button
            role="radio"
            aria-checked={mode === m}
            onclick={() => (mode = m)}
            class="rounded-full px-4 py-1 text-sm font-medium transition-colors {mode === m
              ? 'bg-accent text-accent-ink'
              : 'text-muted hover:text-ink'}"
          >
            {m === 'mute' ? 'Muted video' : m[0].toUpperCase() + m.slice(1)}
          </button>
        {/each}
      </div>

      <div class="flex flex-wrap items-end gap-4">
        {#if mode !== 'audio'}
          <label class="flex flex-col gap-1 text-xs text-muted">
            Quality
            <select bind:value={maxHeight} class="field text-ink">
              <option value={null}>Best</option>
              {#each info.heights as h (h)}<option value={h}>{h}p</option>{/each}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs text-muted">
            Format
            <select bind:value={container} class="field text-ink">
              <option value="mp4">mp4</option>
              <option value="webm">webm</option>
              <option value="mkv">mkv</option>
            </select>
          </label>
        {:else}
          <label class="flex flex-col gap-1 text-xs text-muted">
            Format
            <select bind:value={audioFormat} class="field text-ink">
              {#each ['mp3', 'opus', 'm4a', 'flac', 'wav'] as f (f)}<option value={f}>{f}</option
                >{/each}
            </select>
          </label>
        {/if}
        <label class="flex items-center gap-2 pb-2"
          ><input type="checkbox" class="accent-accent" bind:checked={embedMetadata} /> Tags &amp; cover</label
        >
        {#if mode === 'video'}
          <label class="flex items-center gap-2 pb-2"
            ><input type="checkbox" class="accent-accent" bind:checked={subtitles} /> Subtitles</label
          >
        {/if}
        {#if mode !== 'audio'}
          <label class="flex items-center gap-2 pb-2"
            ><input type="checkbox" class="accent-accent" bind:checked={sponsorblock} /> Skip sponsors</label
          >
        {/if}
      </div>

      {#if info.isPlaylist}
        <div class="max-h-60 overflow-auto rounded-xl border border-line px-3 py-2">
          <div class="pb-1 text-muted">{selected.size} of {info.entries.length} selected</div>
          {#each info.entries as e (e.id)}
            <label class="flex gap-2 py-1">
              <input
                type="checkbox"
                class="accent-accent"
                checked={selected.has(e.id)}
                onchange={() => toggle(e.id)}
              />
              <span class="flex-1 truncate">{e.title}</span>
              <span class="text-muted">{formatDuration(e.duration)}</span>
            </label>
          {/each}
        </div>
      {/if}

      <button
        class="btn btn-primary h-11 w-fit px-6"
        onclick={download}
        disabled={info.isPlaylist && selected.size === 0}
      >
        {info.isPlaylist ? `Download ${selected.size} items` : 'Download'}
      </button>
    </div>
  {/if}

  {#if queued.length}
    <div class="mt-2 flex flex-col gap-2">
      <h3 class="px-1 text-xs font-medium tracking-wider text-muted uppercase">Downloading</h3>
      {#each queued as job (job.id)}<JobRow {job} />{/each}
    </div>
  {/if}
</section>
