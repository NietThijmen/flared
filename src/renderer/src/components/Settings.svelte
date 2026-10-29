<script lang="ts">
  import type { AudioFormat, DownloadMode, VideoContainer } from '../../../shared/types'
  import { app } from '../lib/state.svelte'

  const api = window.api
  const BROWSERS = ['brave', 'chrome', 'chromium', 'edge', 'firefox', 'opera', 'safari', 'vivaldi']

  let template = $state('')
  let updating = $state(false)

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
  <section class="settings">
    <h2>Downloads</h2>
    <div class="card grid">
      <span>Save to</span>
      <div class="inline">
        <code>{s.outputDir}</code>
        <button onclick={pickDir}>Change…</button>
      </div>

      <label for="tpl">Filename</label>
      <div>
        <input
          id="tpl"
          type="text"
          bind:value={template}
          onchange={() => app.saveSettings({ filenameTemplate: template })}
        />
        <p class="muted hint">
          yt-dlp output template. Must be relative (no <code>..</code>); reverts if invalid.
        </p>
      </div>

      <label for="conc">Simultaneous downloads</label>
      <input
        id="conc"
        type="number"
        min="1"
        max="6"
        value={s.concurrency}
        onchange={(e) => app.saveSettings({ concurrency: e.currentTarget.valueAsNumber })}
      />
    </div>

    <h2>Defaults</h2>
    <div class="card grid">
      <label for="mode">Type</label>
      <select
        id="mode"
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

      <label for="vc">Video format</label>
      <select
        id="vc"
        value={s.defaults.videoContainer}
        onchange={(e) =>
          app.saveSettings({
            defaults: { ...s.defaults, videoContainer: e.currentTarget.value as VideoContainer }
          })}
      >
        {#each ['mp4', 'webm', 'mkv'] as f (f)}<option value={f}>{f}</option>{/each}
      </select>

      <label for="af">Audio format</label>
      <select
        id="af"
        value={s.defaults.audioFormat}
        onchange={(e) =>
          app.saveSettings({
            defaults: { ...s.defaults, audioFormat: e.currentTarget.value as AudioFormat }
          })}
      >
        {#each ['mp3', 'opus', 'm4a', 'flac', 'wav'] as f (f)}<option value={f}>{f}</option>{/each}
      </select>

      <label for="h">Max quality</label>
      <select
        id="h"
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

      <span>Options</span>
      <div class="checks">
        <label>
          <input
            type="checkbox"
            checked={s.defaults.embedMetadata}
            onchange={(e) =>
              app.saveSettings({
                defaults: { ...s.defaults, embedMetadata: e.currentTarget.checked }
              })}
          />
          Embed tags &amp; cover
        </label>
        <label>
          <input
            type="checkbox"
            checked={s.defaults.subtitles}
            onchange={(e) =>
              app.saveSettings({ defaults: { ...s.defaults, subtitles: e.currentTarget.checked } })}
          />
          Embed subtitles
        </label>
        <label>
          <input
            type="checkbox"
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

    <h2>App</h2>
    <div class="card grid">
      <span>Behaviour</span>
      <div class="checks">
        <label>
          <input
            type="checkbox"
            checked={s.watchClipboard}
            onchange={(e) => app.saveSettings({ watchClipboard: e.currentTarget.checked })}
          />
          Offer links copied to the clipboard
        </label>
        <label>
          <input
            type="checkbox"
            checked={s.notifications}
            onchange={(e) => app.saveSettings({ notifications: e.currentTarget.checked })}
          />
          Notify when downloads finish
        </label>
      </div>

      <label for="cookies">Browser cookies</label>
      <div>
        <select
          id="cookies"
          value={s.cookiesFromBrowser ?? ''}
          onchange={(e) => app.saveSettings({ cookiesFromBrowser: e.currentTarget.value || null })}
        >
          <option value="">Don't use</option>
          {#each BROWSERS as b (b)}<option value={b}>{b}</option>{/each}
        </select>
        <p class="muted hint">
          For age-restricted or private media. Read locally by yt-dlp, never sent anywhere else.
        </p>
      </div>
    </div>

    <h2>Tools</h2>
    <div class="card grid">
      <span>yt-dlp</span>
      <span>{app.binaries?.ytdlp.version ?? 'not installed'}</span>
      <span>ffmpeg</span>
      <span>{app.binaries?.ffmpeg.version ?? 'not installed'}</span>
      <span>Auto-update</span>
      <label class="checks">
        <input
          type="checkbox"
          checked={s.autoUpdateBinaries}
          onchange={(e) => app.saveSettings({ autoUpdateBinaries: e.currentTarget.checked })}
        />
        Check GitHub for a newer yt-dlp on launch
      </label>
      <span></span>
      <div>
        <button onclick={update} disabled={updating || app.binaries?.busy}>
          {updating || app.binaries?.busy ? 'Working…' : 'Check for updates'}
        </button>
      </div>
    </div>
    <p class="muted hint">
      Flared contacts nothing except the sites you download from, plus GitHub when installing or
      updating the tools above.
    </p>
  </section>
{/if}

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .grid {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 12px 16px;
    align-items: center;
  }
  .grid input[type='text'] {
    width: 100%;
  }
  .inline {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }
  .inline code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .checks {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hint {
    margin: 4px 0 0;
    font-size: 12px;
  }
  code {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
  }
</style>
