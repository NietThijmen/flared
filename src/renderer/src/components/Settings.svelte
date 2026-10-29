<script lang="ts">
  import type { AudioFormat, DownloadMode, VideoContainer } from '../../../shared/types'
  import { app } from '../lib/state.svelte'

  const api = window.api
  const BROWSERS = ['brave', 'chrome', 'chromium', 'edge', 'firefox', 'opera', 'safari', 'vivaldi']

  let template = $state('')
  let updating = $state(false)
  let logText = $state('')

  async function loadLogs(): Promise<void> {
    logText = await api['logs:get']()
  }

  $effect(() => {
    if (app.settings) template = app.settings.filenameTemplate
  })

  async function pickDir(): Promise<void> {
    const dir = await api['settings:pickDir']()
    if (dir) await app.saveSettings({ outputDir: dir })
  }

  async function update(): Promise<void> {
    updating = true
    try {
      await api['binaries:update']()
    } finally {
      updating = false
    }
  }
</script>

{#if app.settings}
  {@const s = app.settings}
  <section>
    <h3 class="set-title">Downloads</h3>
    <div class="set-card">
      <div class="set-row">
        <span>Save to</span>
        <div class="flex min-w-0 items-center gap-2">
          <code class="truncate font-mono text-xs">{s.outputDir}</code>
          <button class="btn flex-none" onclick={pickDir}>Change…</button>
        </div>
      </div>
      <div class="set-row">
        <label for="tpl">Filename</label>
        <div>
          <input
            id="tpl"
            type="text"
            class="field w-full"
            bind:value={template}
            onchange={() => app.saveSettings({ filenameTemplate: template })}
          />
          <p class="mt-1 text-xs text-muted">
            yt-dlp output template. Must be relative (no <code class="font-mono">..</code>); reverts
            if invalid.
          </p>
        </div>
      </div>
      <div class="set-row">
        <label for="conc">Simultaneous downloads</label>
        <input
          id="conc"
          type="number"
          min="1"
          max="6"
          class="field w-24"
          value={s.concurrency}
          onchange={(e) => app.saveSettings({ concurrency: e.currentTarget.valueAsNumber })}
        />
      </div>
    </div>

    <h3 class="set-title">Defaults</h3>
    <div class="set-card">
      <div class="set-row">
        <label for="mode">Type</label>
        <select
          id="mode"
          class="field w-fit"
          value={s.defaults.mode}
          onchange={(e) =>
            app.saveSettings({
              defaults: { ...s.defaults, mode: e.currentTarget.value as DownloadMode }
            })}
        >
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="mute">Muted video</option>
        </select>
      </div>
      <div class="set-row">
        <label for="vc">Video format</label>
        <select
          id="vc"
          class="field w-fit"
          value={s.defaults.videoContainer}
          onchange={(e) =>
            app.saveSettings({
              defaults: { ...s.defaults, videoContainer: e.currentTarget.value as VideoContainer }
            })}
        >
          {#each ['mp4', 'webm', 'mkv'] as f (f)}<option value={f}>{f}</option>{/each}
        </select>
      </div>
      <div class="set-row">
        <label for="af">Audio format</label>
        <select
          id="af"
          class="field w-fit"
          value={s.defaults.audioFormat}
          onchange={(e) =>
            app.saveSettings({
              defaults: { ...s.defaults, audioFormat: e.currentTarget.value as AudioFormat }
            })}
        >
          {#each ['mp3', 'opus', 'm4a', 'flac', 'wav'] as f (f)}<option value={f}>{f}</option
            >{/each}
        </select>
      </div>
      <div class="set-row">
        <label for="h">Max quality</label>
        <select
          id="h"
          class="field w-fit"
          value={s.defaults.maxHeight ?? ''}
          onchange={(e) =>
            app.saveSettings({
              defaults: {
                ...s.defaults,
                maxHeight: e.currentTarget.value ? Number(e.currentTarget.value) : null
              }
            })}
        >
          <option value="">Best</option>
          {#each [2160, 1440, 1080, 720, 480, 360] as h (h)}<option value={h}>{h}p</option>{/each}
        </select>
      </div>
      <div class="set-row">
        <span>Options</span>
        <div class="flex flex-col gap-1.5">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="accent-accent"
              checked={s.defaults.embedMetadata}
              onchange={(e) =>
                app.saveSettings({
                  defaults: { ...s.defaults, embedMetadata: e.currentTarget.checked }
                })}
            />
            Embed tags &amp; cover
          </label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="accent-accent"
              checked={s.defaults.subtitles}
              onchange={(e) =>
                app.saveSettings({
                  defaults: { ...s.defaults, subtitles: e.currentTarget.checked }
                })}
            />
            Embed subtitles
          </label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="accent-accent"
              checked={s.defaults.sponsorblock}
              onchange={(e) =>
                app.saveSettings({
                  defaults: { ...s.defaults, sponsorblock: e.currentTarget.checked }
                })}
            />
            Remove sponsor segments
          </label>
        </div>
      </div>
    </div>

    <h3 class="set-title">App</h3>
    <div class="set-card">
      <div class="set-row">
        <span>Behaviour</span>
        <div class="flex flex-col gap-1.5">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="accent-accent"
              checked={s.watchClipboard}
              onchange={(e) => app.saveSettings({ watchClipboard: e.currentTarget.checked })}
            />
            Notify when a link is copied
          </label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="accent-accent"
              checked={s.clipboardAutoDownload}
              disabled={!s.watchClipboard}
              onchange={(e) => app.saveSettings({ clipboardAutoDownload: e.currentTarget.checked })}
            />
            Download copied links automatically (uses your defaults)
          </label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="accent-accent"
              checked={s.notifications}
              onchange={(e) => app.saveSettings({ notifications: e.currentTarget.checked })}
            />
            Notify when downloads finish
          </label>
        </div>
      </div>
      <div class="set-row">
        <label for="cookies">Browser cookies</label>
        <div>
          <select
            id="cookies"
            class="field w-fit"
            value={s.cookiesFromBrowser ?? ''}
            onchange={(e) =>
              app.saveSettings({ cookiesFromBrowser: e.currentTarget.value || null })}
          >
            <option value="">Don't use</option>
            {#each BROWSERS as b (b)}<option value={b}>{b}</option>{/each}
          </select>
          <p class="mt-1 text-xs text-muted">
            For age-restricted or private media. Read locally by yt-dlp, never sent anywhere else.
          </p>
        </div>
      </div>
    </div>

    <h3 class="set-title">Tools</h3>
    <div class="set-card">
      <div class="set-row">
        <span>yt-dlp</span>
        <span class="text-muted">{app.binaries?.ytdlp.version ?? 'not installed'}</span>
      </div>
      <div class="set-row">
        <span>ffmpeg</span>
        <span class="text-muted">{app.binaries?.ffmpeg.version ?? 'not installed'}</span>
      </div>
      <div class="set-row">
        <span>Auto-update</span>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            class="accent-accent"
            checked={s.autoUpdateBinaries}
            onchange={(e) => app.saveSettings({ autoUpdateBinaries: e.currentTarget.checked })}
          />
          Check GitHub for a newer yt-dlp on launch
        </label>
      </div>
      <div class="set-row">
        <span></span>
        <button class="btn w-fit" onclick={update} disabled={updating || app.binaries?.busy}>
          {updating || app.binaries?.busy ? 'Working…' : 'Check for updates'}
        </button>
      </div>
    </div>

    <h3 class="set-title">Diagnostics</h3>
    <details
      class="rounded-2xl border border-line px-4 py-3"
      ontoggle={(e) => e.currentTarget.open && loadLogs()}
    >
      <summary class="cursor-pointer">yt-dlp log</summary>
      <pre
        class="my-3 max-h-56 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] whitespace-pre-wrap select-text">{logText ||
          'Nothing logged yet.'}</pre>
      <div class="flex gap-2">
        <button class="btn" onclick={loadLogs}>Refresh</button>
        <button
          class="btn"
          onclick={async () => {
            await api['logs:clear']()
            logText = ''
          }}>Clear</button
        >
      </div>
    </details>
    <p class="mt-4 text-xs text-muted">
      Flared contacts nothing except the sites you download from, plus GitHub when installing or
      updating the tools above.
    </p>
  </section>
{/if}
