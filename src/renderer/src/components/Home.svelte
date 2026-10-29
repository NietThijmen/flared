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

  function useClipboard(): void {
    if (!app.clipboardUrl) return
    url = app.clipboardUrl
    app.clipboardUrl = null
    void probe()
  }
</script>

<section class="home">
  {#if !binariesReady}
    <div class="card notice">
      {app.binaries?.busy
        ? 'Setting up yt-dlp and ffmpeg…'
        : 'Waiting for yt-dlp and ffmpeg to be installed.'}
    </div>
  {/if}

  {#if app.clipboardUrl}
    <button class="card clip" onclick={useClipboard}>Link in clipboard: {app.clipboardUrl}</button>
  {/if}

  <form
    class="paste"
    onsubmit={(e) => {
      e.preventDefault()
      void probe()
    }}
  >
    <input
      type="url"
      placeholder="Paste a link: YouTube, SoundCloud, and 1000+ more"
      bind:value={url}
      onpaste={() => setTimeout(probe, 0)}
      aria-label="Media link"
    />
    <button class="primary" disabled={busy || !url.trim() || !binariesReady}>
      {busy ? 'Looking…' : 'Fetch'}
    </button>
  </form>

  {#if error}<p class="error">{error}</p>{/if}

  {#if info}
    <div class="card preview">
      <div class="head">
        {#if info.thumbnail}
          <img src={info.thumbnail} alt="" referrerpolicy="no-referrer" />
        {/if}
        <div>
          <h2>{info.title}</h2>
          <p class="muted">
            {[info.uploader, formatDuration(info.duration), info.extractor]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div class="seg" role="radiogroup" aria-label="Download type">
        {#each ['video', 'audio', 'mute'] as const as m (m)}
          <button
            class:active={mode === m}
            role="radio"
            aria-checked={mode === m}
            onclick={() => (mode = m)}
          >
            {m === 'mute' ? 'Muted video' : m[0].toUpperCase() + m.slice(1)}
          </button>
        {/each}
      </div>

      <div class="opts">
        {#if mode !== 'audio'}
          <label>
            Quality
            <select bind:value={maxHeight}>
              <option value={null}>Best</option>
              {#each info.heights as h (h)}<option value={h}>{h}p</option>{/each}
            </select>
          </label>
          <label>
            Format
            <select bind:value={container}>
              <option value="mp4">mp4</option>
              <option value="webm">webm</option>
              <option value="mkv">mkv</option>
            </select>
          </label>
        {:else}
          <label>
            Format
            <select bind:value={audioFormat}>
              {#each ['mp3', 'opus', 'm4a', 'flac', 'wav'] as f (f)}<option value={f}>{f}</option
                >{/each}
            </select>
          </label>
        {/if}
        <label class="check"
          ><input type="checkbox" bind:checked={embedMetadata} /> Tags &amp; cover</label
        >
        {#if mode === 'video'}
          <label class="check"><input type="checkbox" bind:checked={subtitles} /> Subtitles</label>
        {/if}
        {#if mode !== 'audio'}
          <label class="check"
            ><input type="checkbox" bind:checked={sponsorblock} /> Skip sponsors</label
          >
        {/if}
      </div>

      {#if info.isPlaylist}
        <div class="entries">
          <div class="muted">{selected.size} of {info.entries.length} selected</div>
          {#each info.entries as e (e.id)}
            <label class="entry">
              <input type="checkbox" checked={selected.has(e.id)} onchange={() => toggle(e.id)} />
              <span class="t">{e.title}</span>
              <span class="muted">{formatDuration(e.duration)}</span>
            </label>
          {/each}
        </div>
      {/if}

      <button class="primary" onclick={download} disabled={info.isPlaylist && selected.size === 0}>
        {info.isPlaylist ? `Download ${selected.size} items` : 'Download'}
      </button>
    </div>
  {/if}

  {#if queued.length}
    <h3>Downloading</h3>
    <div class="list">
      {#each queued as job (job.id)}<JobRow {job} />{/each}
    </div>
  {/if}
</section>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .paste {
    display: flex;
    gap: 8px;
  }
  .paste input {
    flex: 1;
    padding: 12px 14px;
    font-size: 15px;
  }
  .notice {
    color: var(--muted);
  }
  .clip {
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .head {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }
  .head img {
    width: 160px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 4px;
  }
  h3 {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  p {
    margin: 0;
  }
  .seg {
    display: inline-flex;
    gap: 4px;
    margin-bottom: 12px;
  }
  .seg .active {
    background: var(--accent);
    color: var(--accent-text);
    border-color: transparent;
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;
    margin-bottom: 12px;
  }
  .opts label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .opts label.check {
    flex-direction: row;
    align-items: center;
    color: var(--text);
    font-size: 13px;
  }
  .entries {
    max-height: 240px;
    overflow: auto;
    margin-bottom: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
  }
  .entry {
    display: flex;
    gap: 8px;
    padding: 3px 0;
  }
  .entry .t {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
