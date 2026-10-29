import { spawn, type ChildProcess } from 'node:child_process'
import type { DownloadOptions, ErrorKind, MediaInfo, Result } from '../../shared/types'
import {
  classifyError,
  downloadArgs,
  parsePathLine,
  parseProbe,
  parseProgressLine,
  probeArgs,
  type ArgContext,
  type Progress
} from './args'

export interface DownloadHandle {
  cancel(): void
  done: Promise<Result<string | null>>
}

export class Engine {
  constructor(
    private readonly ytdlpPath: () => string,
    private readonly onLog: (chunk: string) => void = () => undefined
  ) {}

  probe(url: string, ctx: ArgContext): Promise<Result<MediaInfo>> {
    return new Promise((resolve) => {
      let args: string[]
      try {
        args = probeArgs(url, ctx)
      } catch (e) {
        return resolve(fail('unsupported', (e as Error).message))
      }
      const p = this.spawn(args)
      let out = ''
      let err = ''
      p.stdout?.on('data', (d) => (out += d))
      p.stderr?.on('data', (d) => {
        err += d
        this.onLog(String(d))
      })
      p.on('error', (e) => resolve(spawnFailure(e)))
      p.on('close', (code) => {
        if (code !== 0) return resolve({ ok: false, error: classifyError(err) })
        try {
          resolve({ ok: true, value: parseProbe(JSON.parse(out), url) })
        } catch {
          resolve(fail('unknown', 'Could not read media information'))
        }
      })
    })
  }

  download(
    url: string,
    options: DownloadOptions,
    ctx: ArgContext,
    onProgress: (p: Progress) => void
  ): DownloadHandle {
    let args: string[]
    try {
      args = downloadArgs(url, options, ctx)
    } catch (e) {
      return {
        cancel: () => undefined,
        done: Promise.resolve(fail('unsupported', (e as Error).message))
      }
    }
    const p = this.spawn(args)
    let cancelled = false
    let err = ''
    let filePath: string | null = null
    let buf = ''
    p.stdout?.on('data', (d) => {
      buf += d
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const prog = parseProgressLine(line)
        if (prog) onProgress(prog)
        const path = parsePathLine(line)
        if (path) filePath = path
      }
    })
    p.stderr?.on('data', (d) => {
      err += d
      this.onLog(String(d))
    })
    const done = new Promise<Result<string | null>>((resolve) => {
      p.on('error', (e) => resolve(spawnFailure(e)))
      p.on('close', (code) => {
        if (cancelled) return resolve(fail('unknown', 'Cancelled'))
        if (code === 0) return resolve({ ok: true, value: filePath })
        resolve({ ok: false, error: classifyError(err) })
      })
    })
    return {
      cancel: () => {
        cancelled = true
        p.kill('SIGTERM')
      },
      done
    }
  }

  private spawn(args: string[]): ChildProcess {
    // Arguments are passed as an array (no shell), so URLs and templates cannot inject commands.
    return spawn(this.ytdlpPath(), args, { windowsHide: true })
  }
}

function fail(kind: ErrorKind, message: string): Result<never> {
  return { ok: false, error: { kind, message } }
}

function spawnFailure(e: NodeJS.ErrnoException): Result<never> {
  return e.code === 'ENOENT'
    ? fail('binary-missing', 'yt-dlp is not installed yet')
    : fail('unknown', e.message)
}
