import { describe, expect, it, vi } from 'vitest'
import { DownloadQueue, type QueueDeps } from '../src/main/queue'
import type { DownloadOptions, Job, Result } from '../src/shared/types'
import type { Progress } from '../src/main/engine/args'

const options: DownloadOptions = {
  mode: 'video',
  maxHeight: null,
  videoContainer: 'mp4',
  audioFormat: 'mp3',
  embedMetadata: false,
  subtitles: false,
  sponsorblock: false
}

function setup(concurrency = 1, initial: Job[] = []) {
  const pending: {
    resolve: (r: Result<string | null>) => void
    progress: (p: Progress) => void
    cancel: () => void
  }[] = []
  const deps: QueueDeps = {
    downloaders: {
      download: (_u, _o, progress) => {
        const cancel = vi.fn()
        let resolve!: (r: Result<string | null>) => void
        const done = new Promise<Result<string | null>>((r) => (resolve = r))
        pending.push({ resolve, progress, cancel })
        return { cancel, done }
      }
    },
    concurrency: () => concurrency,
    load: () => initial,
    save: vi.fn(),
    emit: vi.fn(),
    emitRemoved: vi.fn()
  }
  return { q: new DownloadQueue(deps), pending, deps }
}
const item = (n: number) => ({ url: `https://a.b/${n}`, title: `t${n}`, thumbnail: null })
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('DownloadQueue', () => {
  it('respects the concurrency limit and runs oldest first', async () => {
    const { q, pending } = setup(1)
    q.add([item(1), item(2)], options)
    expect(pending).toHaveLength(1)
    expect(
      q
        .active()
        .map((j) => j.status)
        .sort()
    ).toEqual(['queued', 'running'])
    pending[0].resolve({ ok: true, value: '/o/1.mp4' })
    await tick()
    expect(pending).toHaveLength(2)
    expect(q.history()[0]).toMatchObject({
      url: 'https://a.b/1',
      status: 'done',
      filePath: '/o/1.mp4'
    })
  })

  it('records errors and allows retry', async () => {
    const { q, pending } = setup()
    const [job] = q.add([item(1)], options)
    pending[0].resolve({ ok: false, error: { kind: 'unavailable', message: 'gone' } })
    await tick()
    expect(q.find(job.id)?.status).toBe('error')
    q.retry(job.id)
    expect(q.find(job.id)?.status).toBe('running')
    expect(pending).toHaveLength(2)
  })

  it('cancel kills the process and frees the slot', async () => {
    const { q, pending } = setup(1)
    const [a] = q.add([item(1), item(2)], options)
    q.cancel(a.id)
    expect(pending[0].cancel).toHaveBeenCalled()
    expect(q.find(a.id)?.status).toBe('cancelled')
    expect(pending).toHaveLength(2)
  })

  it('keeps progress monotonic across video+audio streams', () => {
    const { q, pending } = setup()
    const [job] = q.add([item(1)], options)
    pending[0].progress({ percent: 100, speed: null, eta: null })
    expect(q.find(job.id)?.progress).toBe(50)
    pending[0].progress({ percent: 10, speed: null, eta: null })
    expect(q.find(job.id)?.progress).toBe(55)
  })

  it('marks jobs interrupted by a restart as cancelled', () => {
    const stale = { id: 'x', status: 'running', options } as Job
    const { q } = setup(1, [stale])
    expect(q.find('x')?.status).toBe('cancelled')
  })
})
