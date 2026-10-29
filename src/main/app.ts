import { app, BrowserWindow, clipboard, dialog, Notification, shell } from 'electron'
import { join } from 'node:path'
import type { EventChannel, EventMap, InvokeChannel, InvokeMap } from '../shared/ipc'
import type { DownloadOptions, Job, QuickResult, Result, Settings } from '../shared/types'
import { BinaryManager } from './binaries'
import { assertUrl, type ArgContext } from './engine/args'
import { Engine } from './engine/ytdlp'
import { createDownloaders, type DownloaderRegistry } from './downloaders'
import { DownloadQueue } from './queue'
import { applyPatch, defaultSettings, sanitizeOptions } from './settings'
import { LogBuffer } from './logs'
import { JsonStore } from './store'

import { ipcMain } from 'electron'

type Handlers = {
  [K in InvokeChannel]: (
    ...args: Parameters<InvokeMap[K]>
  ) => ReturnType<InvokeMap[K]> | Promise<ReturnType<InvokeMap[K]>>
}

export interface AppHooks {
  /** Shows the main window, creating it if it was closed. */
  showMainWindow(): BrowserWindow
  hideQuick(): void
}

export class FlaredApp {
  readonly binaries: BinaryManager
  readonly settingsStore: JsonStore<Settings>
  settings: Settings
  readonly queue: DownloadQueue
  private readonly downloaders: DownloaderRegistry
  readonly logs = new LogBuffer()
  private lastClipboard = ''
  private clipboardTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly hooks: AppHooks
  ) {
    const data = app.getPath('userData')
    this.settingsStore = new JsonStore(join(data, 'settings.json'), () =>
      defaultSettings(app.getPath('downloads'))
    )
    this.settings = applyPatch(defaultSettings(app.getPath('downloads')), this.settingsStore.load())
    this.binaries = new BinaryManager(join(data, 'bin'), undefined, (s) =>
      this.send('binaries:status', s)
    )
    const engine = new Engine(
      () => this.binaries.ytdlpPath,
      (chunk) => this.logs.push('yt-dlp', chunk)
    )
    this.downloaders = createDownloaders(engine, () => this.context())
    const jobsStore = new JsonStore<Job[]>(join(data, 'jobs.json'), () => [])
    this.queue = new DownloadQueue({
      downloaders: this.downloaders,
      concurrency: () => this.settings.concurrency,
      load: () => jobsStore.load(),
      save: (jobs) => void jobsStore.save(jobs),
      emit: (job) => {
        this.send('queue:update', job)
        this.updateProgressBar()
      },
      emitRemoved: (id) => this.send('queue:removed', id),
      onFinished: (job) => this.notify(job)
    })
    this.applyClipboardWatch()
  }

  send<K extends EventChannel>(channel: K, payload: EventMap[K]): void {
    this.getWindow()?.webContents.send(channel, payload)
  }

  context(): ArgContext {
    return {
      outputDir: this.settings.outputDir,
      filenameTemplate: this.settings.filenameTemplate,
      ffmpegDir: this.binaries.ffmpegDir,
      cookiesFromBrowser: this.settings.cookiesFromBrowser
    }
  }

  /** Installs missing binaries, then (optionally) checks for a newer yt-dlp. Never throws. */
  async bootstrapBinaries(): Promise<void> {
    try {
      await this.binaries.ensure()
      if (this.settings.autoUpdateBinaries) await this.binaries.update()
    } catch (e) {
      this.logs.push('setup', `Binary setup failed: ${(e as Error).message}`)
    }
  }

  /** Mirrors overall progress on the dock/taskbar icon. */
  private updateProgressBar(): void {
    const active = this.queue.active()
    const total = active.reduce((sum, j) => sum + j.progress, 0)
    this.getWindow()?.setProgressBar(active.length ? total / active.length / 100 : -1)
  }

  private notify(job: Job): void {
    if (!this.settings.notifications || !Notification.isSupported()) return
    if (job.status !== 'done' && job.status !== 'error') return
    new Notification({
      title: job.status === 'done' ? 'Download finished' : 'Download failed',
      body: job.status === 'done' ? job.title : (job.error?.message ?? job.title)
    }).show()
  }

  private toast(title: string, body: string, onClick?: () => void): void {
    if (!this.settings.notifications || !Notification.isSupported()) return
    const n = new Notification({ title, body })
    if (onClick) n.on('click', onClick)
    n.show()
  }

  private applyClipboardWatch(): void {
    if (this.clipboardTimer) clearInterval(this.clipboardTimer)
    this.clipboardTimer = null
    if (!this.settings.watchClipboard) return
    // Whatever is on the clipboard right now was not "newly copied".
    void Promise.resolve(clipboard.readText()).then((t) => (this.lastClipboard = t.trim()))
    this.clipboardTimer = setInterval(async () => {
      const text = (await clipboard.readText()).trim()
      if (!text || text === this.lastClipboard) return
      this.lastClipboard = text
      let url: string
      try {
        url = assertUrl(text)
      } catch {
        return // not a URL
      }
      await this.onClipboardUrl(url)
    }, 1500)
  }

  /** Looks a link up with yt-dlp and queues it if it is a single piece of media. */
  private async lookupAndQueue(
    url: string,
    options: DownloadOptions
  ): Promise<Result<QuickResult>> {
    const res = await this.downloaders.probe(url)
    if (!res.ok) return res
    const info = res.value
    if (info.isPlaylist) {
      return {
        ok: true,
        value: { status: 'playlist', title: info.title, count: info.entries.length }
      }
    }
    const duplicate = this.queue.active().some((j) => j.url === url || j.url === info.url)
    if (!duplicate) {
      this.queue.add([{ url: info.url, title: info.title, thumbnail: info.thumbnail }], options)
    }
    return { ok: true, value: { status: 'queued', title: info.title, duplicate } }
  }

  private async onClipboardUrl(url: string): Promise<void> {
    this.send('clipboard:url', url)
    const open = (): void => void this.hooks.showMainWindow()
    if (!this.settings.clipboardAutoDownload) {
      this.toast('Link copied', new URL(url).hostname, open)
      return
    }
    // Auto-download: look the link up first, so only media Flared understands is queued.
    const res = await this.lookupAndQueue(url, this.settings.defaults)
    if (!res.ok) return
    if (res.value.status === 'playlist') {
      this.toast('Playlist copied', `${res.value.title}: open Flared to choose items`, open)
    } else if (!res.value.duplicate) {
      this.toast('Download started', res.value.title, open)
    }
  }

  /** Quick bar entry point: same flow as clipboard auto-download, but the user chose the mode. */
  private async quickSubmit(
    raw: string,
    mode: DownloadOptions['mode']
  ): Promise<Result<QuickResult>> {
    let url: string
    try {
      url = assertUrl(raw)
    } catch (e) {
      return { ok: false, error: { kind: 'unsupported', message: (e as Error).message } }
    }
    return this.lookupAndQueue(
      url,
      sanitizeOptions({ ...this.settings.defaults, mode }, this.settings.defaults)
    )
  }

  private openInApp(raw: string): void {
    let url: string
    try {
      url = assertUrl(raw)
    } catch {
      return
    }
    const win = this.hooks.showMainWindow()
    const send = (): void => win.webContents.send('clipboard:url', url)
    // A freshly created window has not subscribed to events yet.
    if (win.webContents.isLoading())
      win.webContents.once('did-finish-load', () => setTimeout(send, 300))
    else send()
  }

  private handlers(): Handlers {
    return {
      'media:probe': (url) => this.downloaders.probe(url),
      'queue:add': (items, options) => {
        const clean = items.flatMap((i) => {
          try {
            return [
              {
                url: assertUrl(i.url),
                title: String(i.title ?? i.url),
                thumbnail: i.thumbnail ?? null
              }
            ]
          } catch {
            return []
          }
        })
        return this.queue.add(clean, sanitizeOptions(options, this.settings.defaults))
      },
      'queue:list': () => this.queue.active(),
      'queue:cancel': (id) => this.queue.cancel(id),
      'queue:retry': (id) => this.queue.retry(id),
      'queue:remove': (id) => this.queue.remove(id),
      'history:list': () => this.queue.history(),
      'history:clear': () => this.queue.clearHistory(),
      'settings:get': () => this.settings,
      'settings:set': (patch) => {
        this.settings = applyPatch(this.settings, patch)
        void this.settingsStore.save(this.settings)
        this.applyClipboardWatch()
        return this.settings
      },
      'settings:pickDir': async () => {
        const win = this.getWindow()
        const opts = {
          properties: ['openDirectory', 'createDirectory'] as (
            'openDirectory' | 'createDirectory'
          )[]
        }
        const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
        return res.canceled ? null : (res.filePaths[0] ?? null)
      },
      'binaries:status': () => this.binaries.status(),
      'binaries:update': async () => {
        await this.bootstrapBinaries()
        return this.binaries.status()
      },
      'shell:reveal': (path) => {
        // Only files Flared itself produced can be revealed.
        const known = [...this.queue.active(), ...this.queue.history()].some(
          (j) => j.filePath === path
        )
        if (known) shell.showItemInFolder(path)
      },
      'shell:openExternal': (url) => {
        try {
          void shell.openExternal(assertUrl(url))
        } catch {
          /* ignore non-http(s) */
        }
      },
      'shell:openFolder': () => void shell.openPath(this.settings.outputDir),
      'clipboard:read': () => clipboard.readText(),
      'quick:submit': (url, mode) => this.quickSubmit(url, mode),
      'quick:openInApp': (url) => this.openInApp(url),
      'quick:hide': () => this.hooks.hideQuick(),
      'logs:get': () => this.logs.text(),
      'logs:clear': () => this.logs.clear()
    }
  }

  registerIpc(): void {
    const handlers = this.handlers() as Record<string, (...a: unknown[]) => unknown>
    for (const [channel, fn] of Object.entries(handlers)) {
      ipcMain.handle(channel, (_e, ...args) => fn(...args))
    }
  }
}
