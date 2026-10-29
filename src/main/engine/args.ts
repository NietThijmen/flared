import type { DownloadOptions, ErrorKind, MediaEntry, MediaInfo } from '../../shared/types'

export class InvalidUrlError extends Error {}

/** Only http(s) URLs are accepted, so a "URL" can never be parsed as a yt-dlp flag or local path. */
export function assertUrl(raw: string): string {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    throw new InvalidUrlError('Not a valid URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    throw new InvalidUrlError('Only http(s) links are supported')
  return u.toString()
}

export interface ArgContext {
  outputDir: string
  filenameTemplate: string
  ffmpegDir: string | null
  cookiesFromBrowser: string | null
}

const BROWSERS = [
  'brave',
  'chrome',
  'chromium',
  'edge',
  'firefox',
  'opera',
  'safari',
  'vivaldi',
  'whale'
]

function common(ctx: ArgContext): string[] {
  const args = ['--no-warnings', '--ignore-config']
  if (ctx.ffmpegDir) args.push('--ffmpeg-location', ctx.ffmpegDir)
  if (ctx.cookiesFromBrowser) {
    if (!BROWSERS.includes(ctx.cookiesFromBrowser))
      throw new Error('Unsupported browser for cookies')
    args.push('--cookies-from-browser', ctx.cookiesFromBrowser)
  }
  return args
}

export function probeArgs(url: string, ctx: ArgContext): string[] {
  return [...common(ctx), '--dump-single-json', '--flat-playlist', '--', assertUrl(url)]
}

export const PROGRESS_PREFIX = '[fl]'
export const PATH_PREFIX = '[fp]'

export function downloadArgs(url: string, o: DownloadOptions, ctx: ArgContext): string[] {
  const args = [...common(ctx), '--newline', '--no-playlist', '--no-simulate']
  args.push(
    '--progress-template',
    `download:${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress._speed_str)s|%(progress._eta_str)s`,
    '--print',
    `after_move:${PATH_PREFIX}%(filepath)s`,
    '-o',
    `${ctx.outputDir}/${ctx.filenameTemplate}`
  )

  const h = o.maxHeight ? `[height<=${Math.floor(o.maxHeight)}]` : ''
  if (o.mode === 'audio') {
    args.push('-f', 'ba/b', '-x', '--audio-format', o.audioFormat, '--audio-quality', '0')
  } else if (o.mode === 'mute') {
    args.push('-f', `bv*${h}/b${h}`, '--remux-video', o.videoContainer)
  } else {
    args.push('-f', `bv*${h}+ba/b${h}`, '--merge-output-format', o.videoContainer)
    if (o.videoContainer === 'mp4') args.push('-S', 'vcodec:h264,res,acodec:aac')
  }

  if (o.embedMetadata) {
    args.push('--embed-metadata')
    const thumbOk = o.mode === 'audio' ? o.audioFormat !== 'wav' : o.videoContainer !== 'webm'
    if (thumbOk) args.push('--embed-thumbnail', '--convert-thumbnails', 'jpg')
  }
  if (o.subtitles && o.mode === 'video') args.push('--write-subs', '--embed-subs')
  if (o.sponsorblock && o.mode !== 'audio') args.push('--sponsorblock-remove', 'sponsor')

  args.push('--', assertUrl(url))
  return args
}

export interface Progress {
  percent: number | null
  speed: string | null
  eta: string | null
}

const num = (s: string): number | null => {
  const n = Number(s)
  return s !== '' && s !== 'NA' && s !== 'None' && Number.isFinite(n) ? n : null
}
const text = (s: string): string | null => {
  const t = s.trim()
  return t && t !== 'NA' && t !== 'None' && !t.startsWith('Unknown') ? t : null
}

export function parseProgressLine(line: string): Progress | null {
  if (!line.startsWith(PROGRESS_PREFIX)) return null
  const [done, total, estimate, speed, eta] = line.slice(PROGRESS_PREFIX.length).split('|')
  const d = num(done ?? '')
  const t = num(total ?? '') ?? num(estimate ?? '')
  return {
    percent: d !== null && t ? Math.min(100, (d / t) * 100) : null,
    speed: text(speed ?? ''),
    eta: text(eta ?? '')
  }
}

export function parsePathLine(line: string): string | null {
  return line.startsWith(PATH_PREFIX) ? line.slice(PATH_PREFIX.length).trim() : null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseProbe(json: any, requestedUrl: string): MediaInfo {
  const isPlaylist = json._type === 'playlist'
  const entries: MediaEntry[] = isPlaylist
    ? (json.entries ?? [])
        .filter((e: any) => e && (e.url || e.webpage_url))
        .map((e: any) => ({
          id: String(e.id ?? e.url),
          url: e.webpage_url ?? e.url,
          title: e.title ?? e.url,
          duration: typeof e.duration === 'number' ? e.duration : null,
          thumbnail: e.thumbnails?.at(-1)?.url ?? e.thumbnail ?? null
        }))
    : []
  const heights: number[] = [
    ...new Set<number>(
      (json.formats ?? [])
        .filter((f: any) => f.vcodec && f.vcodec !== 'none' && typeof f.height === 'number')
        .map((f: any) => f.height as number)
    )
  ].sort((a, b) => b - a)
  return {
    url: json.webpage_url ?? requestedUrl,
    title: json.title ?? requestedUrl,
    uploader: json.uploader ?? json.channel ?? null,
    duration: typeof json.duration === 'number' ? json.duration : null,
    thumbnail: json.thumbnail ?? json.thumbnails?.at(-1)?.url ?? null,
    extractor: json.extractor_key ?? json.extractor ?? 'generic',
    heights,
    isPlaylist,
    entries
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ERROR_RULES: [RegExp, ErrorKind][] = [
  [/not available in your country|geo.?restrict|geo.?block/i, 'geo-blocked'],
  [
    /sign in|log ?in|login required|private video|members.only|age.restricted|confirm your age/i,
    'login-required'
  ],
  [/HTTP Error 429|too many requests|rate.?limit/i, 'rate-limited'],
  [/unsupported url/i, 'unsupported'],
  [
    /video unavailable|has been removed|does not exist|HTTP Error 404|no longer available/i,
    'unavailable'
  ],
  [
    /unable to download|timed out|connection|getaddrinfo|network is unreachable|temporary failure/i,
    'network'
  ]
]

export function classifyError(stderr: string): { kind: ErrorKind; message: string } {
  const lines = stderr.split('\n').filter((l) => l.startsWith('ERROR:'))
  const message = (lines.at(-1) ?? stderr.trim().split('\n').at(-1) ?? 'Unknown error').replace(
    /^ERROR:\s*/,
    ''
  )
  for (const [re, kind] of ERROR_RULES) if (re.test(stderr)) return { kind, message }
  return { kind: 'unknown', message }
}
