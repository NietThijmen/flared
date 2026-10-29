import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BinaryManager } from '../src/main/binaries'
import { Engine } from '../src/main/engine/ytdlp'
import type { DownloadOptions } from '../src/shared/types'

// Hits the network and downloads real binaries: opt in with FLARED_INTEGRATION=1.
const run = process.env.FLARED_INTEGRATION ? describe : describe.skip

const options: DownloadOptions = {
  mode: 'video',
  maxHeight: 360,
  videoContainer: 'mp4',
  audioFormat: 'mp3',
  embedMetadata: true,
  subtitles: false,
  sponsorblock: false
}

run('integration', () => {
  const dirs: string[] = []
  afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))))

  it('installs binaries, probes and downloads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'flared-it-'))
    dirs.push(root)
    const bins = new BinaryManager(join(root, 'bin'))
    const status = await bins.ensure()
    expect(status.ytdlp.installed && status.ffmpeg.installed).toBe(true)

    const engine = new Engine(() => bins.ytdlpPath)
    const ctx = {
      outputDir: join(root, 'out'),
      filenameTemplate: '%(title)s.%(ext)s',
      ffmpegDir: bins.ffmpegDir,
      cookiesFromBrowser: null
    }
    const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
    const info = await engine.probe(url, ctx)
    expect(info.ok).toBe(true)

    const seen: number[] = []
    const res = await engine.download(url, options, ctx, (p) => {
      if (p.percent !== null) seen.push(p.percent)
    }).done
    expect(res.ok).toBe(true)
    expect(seen.length).toBeGreaterThan(0)
    expect((await readdir(ctx.outputDir)).some((f) => f.endsWith('.mp4'))).toBe(true)
  }, 300_000)
})
