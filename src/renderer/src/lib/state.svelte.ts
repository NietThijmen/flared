import type { BinaryStatus, Job, Settings } from '../../../shared/types'

const isActive = (j: Job): boolean => j.status === 'queued' || j.status === 'running'

class AppState {
  jobs = $state<Job[]>([])
  history = $state<Job[]>([])
  settings = $state<Settings | null>(null)
  binaries = $state<BinaryStatus | null>(null)
  clipboardUrl = $state<string | null>(null)

  async init(): Promise<void> {
    const api = window.api
    ;[this.jobs, this.history, this.settings, this.binaries] = await Promise.all([
      api['queue:list'](),
      api['history:list'](),
      api['settings:get'](),
      api['binaries:status']()
    ])
    api.on('queue:update', (job) => this.upsert(job))
    api.on('queue:removed', (id) => {
      this.jobs = this.jobs.filter((j) => j.id !== id)
      this.history = this.history.filter((j) => j.id !== id)
    })
    api.on('binaries:status', (s) => (this.binaries = s))
    api.on('clipboard:url', (url) => (this.clipboardUrl = url))
  }

  /** A job lives in `jobs` while active and moves to the top of `history` once finished. */
  private upsert(job: Job): void {
    const replace = (list: Job[]): Job[] => list.map((j) => (j.id === job.id ? job : j))
    const has = (list: Job[]): boolean => list.some((j) => j.id === job.id)
    if (isActive(job)) {
      this.history = this.history.filter((j) => j.id !== job.id)
      this.jobs = has(this.jobs) ? replace(this.jobs) : [job, ...this.jobs]
    } else {
      this.jobs = this.jobs.filter((j) => j.id !== job.id)
      this.history = has(this.history) ? replace(this.history) : [job, ...this.history]
    }
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = await window.api['settings:set'](patch)
  }
}

export const app = new AppState()
