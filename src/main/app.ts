import { app, BrowserWindow, clipboard, dialog, Notification, shell } from 'electron'
import { join } from 'node:path'
import type { EventChannel, EventMap, InvokeChannel, InvokeMap } from '../shared/ipc'
import type { Job, Settings } from '../shared/types'
import { BinaryManager } from './binaries'
import { assertUrl, type ArgContext } from './engine/args'
import { Engine } from './engine/ytdlp'
import { DownloadQueue } from './queue'
import { applyPatch, defaultSettings, sanitizeOptions } from './settings'
import { JsonStore } from './store'

import { ipcMain } from 'electron'

type Handlers = {
  [K in InvokeChannel]: (
    ...args: Parameters<InvokeMap[K]>
  ) => ReturnType<InvokeMap[K]> | Promise<ReturnType<InvokeMap[K]>>
}

export class FlaredApp {
  readonly binaries: BinaryManager
  readonly settingsStore: JsonStore<Settings>
  settings: Settings
  readonly queue: DownloadQueue
  private readonly engine: Engine
  private lastClipboard = ''
  private clipboardTimer: NodeJS.Timeout | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    const data = app.getPath('userData')
    this.settingsStore = new JsonStore(join(data, 'settings.json'), () =>
      defaultSettings(app.getPath('downloads'))
    )
    this.settings = applyPatch(defaultSettings(app.getPath('downloads')), this.settingsStore.load())
    this.binaries = new BinaryManager(join(data, 'bin'), undefined, (s) =>
      this.send('binaries:status', s)
    )
    this.engine = new Engine(() => this.binaries.ytdlpPath)
    const jobsStore = new JsonStore<Job[]>(join(data, 'jobs.json'), () => [])
    this.queue = new DownloadQueue({
      engine: this.engine,
      context: () => this.context(),
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
      console.error('Binary setup failed:', e)
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

  private applyClipboardWatch(): void {
    if (this.clipboardTimer) clearInterval(this.clipboardTimer)
    this.clipboardTimer = null
    if (!this.settings.watchClipboard) return
    this.clipboardTimer = setInterval(async () => {
      const text = (await clipboard.readText()).trim()
      if (!text || text === this.lastClipboard) return
      this.lastClipboard = text
      try {
        this.send('clipboard:url', assertUrl(text))
      } catch {
        /* not a URL */
      }
    }, 1500)
  }

  private handlers(): Handlers {
    return {
      'media:probe': (url) => this.engine.probe(url, this.context()),
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
      'clipboard:read': () => clipboard.readText()
    }
  }

  registerIpc(): void {
    const handlers = this.handlers() as Record<string, (...a: unknown[]) => unknown>
    for (const [channel, fn] of Object.entries(handlers)) {
      ipcMain.handle(channel, (_e, ...args) => fn(...args))
    }
  }
}
