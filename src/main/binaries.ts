import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { chmod, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { BinaryStatus } from '../shared/types'

const YTDLP_BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'
const FFBUILDS_BASE = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download'
const MAC_FFMPEG_BASE = 'https://ffmpeg.martin-riedl.de/redirect/latest/macos'

export interface Target {
  platform: NodeJS.Platform
  arch: string
}

export interface FfmpegSource {
  /** Archives to fetch; each is extracted and ffmpeg/ffprobe are collected from it. */
  archives: { url: string; sha256From: string | null; name: string }[]
}

export function ytdlpAssetName({ platform, arch }: Target): string {
  if (platform === 'darwin') return 'yt-dlp_macos'
  if (platform === 'win32') return arch === 'arm64' ? 'yt-dlp_arm64.exe' : 'yt-dlp.exe'
  return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
}

export function ffmpegSource({ platform, arch }: Target): FfmpegSource {
  if (platform === 'darwin') {
    const a = arch === 'arm64' ? 'arm64' : 'amd64'
    // martin-riedl.de publishes no checksum next to the redirect URL, so these are unverified.
    return {
      archives: ['ffmpeg', 'ffprobe'].map((n) => ({
        url: `${MAC_FFMPEG_BASE}/${a}/snapshot/${n}.zip`,
        sha256From: null,
        name: `${n}.zip`
      }))
    }
  }
  const name =
    platform === 'win32'
      ? 'ffmpeg-master-latest-win64-gpl.zip'
      : arch === 'arm64'
        ? 'ffmpeg-master-latest-linuxarm64-gpl.tar.xz'
        : 'ffmpeg-master-latest-linux64-gpl.tar.xz'
  return {
    archives: [
      { url: `${FFBUILDS_BASE}/${name}`, sha256From: `${FFBUILDS_BASE}/checksums.sha256`, name }
    ]
  }
}

/** Parses `<hash>  <file>` lines (sha256sum format) into a map. */
export function parseChecksums(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line)
    if (m) map.set(m[2], m[1].toLowerCase())
  }
  return map
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${url}`)
  return res
}

async function downloadTo(url: string, dest: string): Promise<string> {
  const res = await fetchOk(url)
  const hash = createHash('sha256')
  const out = createWriteStream(dest)
  const body = Readable.fromWeb(res.body as never)
  body.on('data', (c: Buffer) => hash.update(c))
  await pipeline(body, out)
  return hash.digest('hex')
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true })
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`))))
  })
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function findFile(dir: string, names: string[]): Promise<string | null> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = await findFile(full, names)
      if (found) return found
    } else if (names.includes(entry.name)) return full
  }
  return null
}

export class BinaryManager {
  private busy = false

  constructor(
    private readonly dir: string,
    private readonly target: Target = { platform: process.platform, arch: process.arch },
    private readonly onStatus: (s: BinaryStatus) => void = () => {}
  ) {}

  private get exe(): string {
    return this.target.platform === 'win32' ? '.exe' : ''
  }
  get ytdlpPath(): string {
    return join(this.dir, `yt-dlp${this.exe}`)
  }
  get ffmpegDir(): string {
    return join(this.dir, 'ffmpeg')
  }

  async status(): Promise<BinaryStatus> {
    const ytdlp = await exists(this.ytdlpPath)
    const ffmpeg = await exists(join(this.ffmpegDir, `ffmpeg${this.exe}`))
    return {
      ytdlp: {
        installed: ytdlp,
        version: ytdlp ? await this.version(this.ytdlpPath, ['--version']) : null
      },
      ffmpeg: {
        installed: ffmpeg,
        version: ffmpeg
          ? ((await this.version(join(this.ffmpegDir, `ffmpeg${this.exe}`), ['-version'])) ?? '')
              .split('\n')[0]
              ?.replace(/^ffmpeg version\s+/, '')
              .split(' ')[0] || null
          : null
      },
      busy: this.busy
    }
  }

  private async version(bin: string, args: string[]): Promise<string | null> {
    try {
      return (await run(bin, args)).trim()
    } catch {
      return null
    }
  }

  private async emit(): Promise<void> {
    this.onStatus(await this.status())
  }

  /** Installs whatever is missing. */
  async ensure(): Promise<BinaryStatus> {
    const s = await this.status()
    if (!s.ytdlp.installed) await this.installYtdlp()
    if (!s.ffmpeg.installed) await this.installFfmpeg()
    return this.status()
  }

  /** Re-downloads yt-dlp only when the published checksum differs from what is installed. */
  async update(): Promise<BinaryStatus> {
    if (!(await exists(this.ytdlpPath))) return this.ensure()
    const asset = ytdlpAssetName(this.target)
    const sums = parseChecksums(await (await fetchOk(`${YTDLP_BASE}/SHA2-256SUMS`)).text())
    const latest = sums.get(asset)
    const current = createHash('sha256')
      .update(await readFile(this.ytdlpPath))
      .digest('hex')
    if (latest && latest !== current) await this.installYtdlp()
    await this.ensure()
    return this.status()
  }

  private async withBusy<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('Another binary operation is in progress')
    this.busy = true
    await this.emit()
    try {
      return await fn()
    } finally {
      this.busy = false
      await this.emit()
    }
  }

  async installYtdlp(): Promise<void> {
    await this.withBusy(async () => {
      await mkdir(this.dir, { recursive: true })
      const asset = ytdlpAssetName(this.target)
      const sums = parseChecksums(await (await fetchOk(`${YTDLP_BASE}/SHA2-256SUMS`)).text())
      const expected = sums.get(asset)
      if (!expected) throw new Error(`No checksum published for ${asset}`)
      const tmp = `${this.ytdlpPath}.download`
      const actual = await downloadTo(`${YTDLP_BASE}/${asset}`, tmp)
      if (actual !== expected) {
        await rm(tmp, { force: true })
        throw new Error('yt-dlp checksum mismatch; refusing to install')
      }
      await chmod(tmp, 0o755)
      await rename(tmp, this.ytdlpPath)
    })
  }

  async installFfmpeg(): Promise<void> {
    await this.withBusy(async () => {
      const work = join(this.dir, '.ffmpeg-work')
      await rm(work, { recursive: true, force: true })
      await mkdir(work, { recursive: true })
      await mkdir(this.ffmpegDir, { recursive: true })
      try {
        for (const a of ffmpegSource(this.target).archives) {
          const archive = join(work, a.name)
          const actual = await downloadTo(a.url, archive)
          if (a.sha256From) {
            const sums = parseChecksums(await (await fetchOk(a.sha256From)).text())
            const expected = sums.get(a.name)
            if (!expected || expected !== actual)
              throw new Error(`ffmpeg checksum mismatch for ${a.name}`)
          }
          const dest = join(work, `x-${a.name}`)
          await mkdir(dest)
          // bsdtar (macOS, Windows 10+) and GNU tar both read zip/tar.xz appropriately here.
          await run('tar', ['-xf', archive, '-C', dest])
          for (const bin of ['ffmpeg', 'ffprobe']) {
            const found = await findFile(dest, [bin, `${bin}.exe`])
            if (!found) continue
            const to = join(this.ffmpegDir, `${bin}${this.exe}`)
            await rename(found, to)
            await chmod(to, 0o755)
          }
        }
      } finally {
        await rm(work, { recursive: true, force: true })
      }
    })
  }
}
