import { randomUUID } from 'node:crypto'
import type { DownloadOptions, Job } from '../shared/types'
import type { Progress } from './engine/args'
import type { DownloadHandle } from './engine/ytdlp'

export interface QueueDeps {
  downloaders: {
    download(url: string, o: DownloadOptions, cb: (p: Progress) => void): DownloadHandle
  }
  concurrency(): number
  load(): Job[]
  save(jobs: Job[]): void
  emit(job: Job): void
  emitRemoved(id: string): void
  onFinished?(job: Job): void
}

const MAX_HISTORY = 500
const isActive = (j: Job): boolean => j.status === 'queued' || j.status === 'running'

/** Video downloads fetch separate video + audio streams; progress is spread across them. */
const streamCount = (o: DownloadOptions): number => (o.mode === 'video' ? 2 : 1)

export class DownloadQueue {
  private jobs: Job[]
  private handles = new Map<string, DownloadHandle>()
  private streams = new Map<string, { idx: number; last: number }>()

  constructor(private readonly deps: QueueDeps) {
    // Anything that was in flight when the app last exited can be resumed with retry.
    this.jobs = deps
      .load()
      .map((j) => (isActive(j) ? { ...j, status: 'cancelled', speed: null, eta: null } : j))
  }

  active(): Job[] {
    return this.jobs.filter(isActive)
  }

  history(): Job[] {
    return this.jobs.filter((j) => !isActive(j))
  }

  find(id: string): Job | undefined {
    return this.jobs.find((j) => j.id === id)
  }

  add(
    items: { url: string; title: string; thumbnail: string | null }[],
    options: DownloadOptions
  ): Job[] {
    const now = Date.now()
    const created = items.map<Job>((i, n) => ({
      id: randomUUID(),
      url: i.url,
      title: i.title,
      thumbnail: i.thumbnail,
      options,
      status: 'queued',
      progress: 0,
      speed: null,
      eta: null,
      filePath: null,
      error: null,
      createdAt: now + n
    }))
    this.jobs.unshift(...created)
    created.forEach((j) => this.deps.emit(j))
    this.persist()
    this.pump()
    return created
  }

  cancel(id: string): void {
    const job = this.find(id)
    if (!job || !isActive(job)) return
    job.status = 'cancelled'
    job.speed = job.eta = null
    this.handles.get(id)?.cancel()
    this.update(job)
    this.pump()
  }

  retry(id: string): void {
    const job = this.find(id)
    if (!job || isActive(job)) return
    Object.assign(job, { status: 'queued', error: null, progress: 0, speed: null, eta: null })
    this.update(job)
    this.pump()
  }

  remove(id: string): void {
    this.cancel(id)
    this.jobs = this.jobs.filter((j) => j.id !== id)
    this.deps.emitRemoved(id)
    this.persist()
  }

  clearHistory(): void {
    for (const j of this.history()) this.deps.emitRemoved(j.id)
    this.jobs = this.active()
    this.persist()
  }

  private pump(): void {
    let running = this.jobs.filter((j) => j.status === 'running').length
    const waiting = this.jobs
      .filter((j) => j.status === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt)
    for (const job of waiting) {
      if (running >= this.deps.concurrency()) break
      running++
      this.start(job)
    }
  }

  private start(job: Job): void {
    job.status = 'running'
    this.streams.set(job.id, { idx: 0, last: 0 })
    this.update(job)
    const handle = this.deps.downloaders.download(job.url, job.options, (p) => {
      if (job.status !== 'running' || p.percent === null) return
      const s = this.streams.get(job.id)!
      if (p.percent + 1 < s.last) s.idx++
      s.last = p.percent
      const n = streamCount(job.options)
      const overall = ((Math.min(s.idx, n - 1) * 100 + p.percent) / n) | 0
      job.progress = Math.max(job.progress, overall)
      job.speed = p.speed
      job.eta = p.eta
      this.deps.emit({ ...job })
    })
    this.handles.set(job.id, handle)
    void handle.done.then((res) => {
      this.handles.delete(job.id)
      this.streams.delete(job.id)
      if (job.status === 'cancelled') return
      job.speed = job.eta = null
      if (res.ok) {
        job.status = 'done'
        job.progress = 100
        job.filePath = res.value
      } else {
        job.status = 'error'
        job.error = res.error
      }
      this.update(job)
      this.deps.onFinished?.(job)
      this.pump()
    })
  }

  private update(job: Job): void {
    this.deps.emit({ ...job })
    this.persist()
  }

  private persist(): void {
    const keep = [...this.active(), ...this.history().slice(0, MAX_HISTORY)]
    this.deps.save(keep)
  }
}
