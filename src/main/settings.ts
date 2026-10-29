import type { DownloadOptions, Settings } from '../shared/types'

export const DEFAULT_OPTIONS: DownloadOptions = {
  mode: 'video',
  maxHeight: null,
  videoContainer: 'mp4',
  audioFormat: 'mp3',
  embedMetadata: true,
  subtitles: false,
  sponsorblock: false
}

export function defaultSettings(downloadsDir: string): Settings {
  return {
    outputDir: downloadsDir,
    filenameTemplate: '%(title).150B [%(id)s].%(ext)s',
    concurrency: 2,
    autoUpdateBinaries: true,
    watchClipboard: false,
    notifications: true,
    cookiesFromBrowser: null,
    defaults: DEFAULT_OPTIONS
  }
}

/** A template must stay inside the output dir: no absolute paths, no `..` segments. */
export function isSafeTemplate(t: string): boolean {
  if (!t.trim() || /^([a-zA-Z]:)?[\\/]/.test(t)) return false
  return !t.split(/[\\/]/).includes('..')
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

export function sanitizeOptions(
  o: Partial<DownloadOptions> | undefined,
  base: DownloadOptions
): DownloadOptions {
  const h = o?.maxHeight
  return {
    mode: pick(o?.mode, ['video', 'audio', 'mute'], base.mode),
    maxHeight:
      h === null
        ? null
        : typeof h === 'number' && h > 0 && h <= 8640
          ? Math.floor(h)
          : base.maxHeight,
    videoContainer: pick(o?.videoContainer, ['mp4', 'webm', 'mkv'], base.videoContainer),
    audioFormat: pick(o?.audioFormat, ['mp3', 'opus', 'm4a', 'flac', 'wav'], base.audioFormat),
    embedMetadata: typeof o?.embedMetadata === 'boolean' ? o.embedMetadata : base.embedMetadata,
    subtitles: typeof o?.subtitles === 'boolean' ? o.subtitles : base.subtitles,
    sponsorblock: typeof o?.sponsorblock === 'boolean' ? o.sponsorblock : base.sponsorblock
  }
}

/** Merges an untrusted patch (from the renderer) into the current settings. */
export function applyPatch(current: Settings, patch: Partial<Settings>): Settings {
  const next = { ...current }
  if (typeof patch.outputDir === 'string' && patch.outputDir) next.outputDir = patch.outputDir
  if (typeof patch.filenameTemplate === 'string' && isSafeTemplate(patch.filenameTemplate))
    next.filenameTemplate = patch.filenameTemplate
  if (typeof patch.concurrency === 'number')
    next.concurrency = Math.min(6, Math.max(1, Math.floor(patch.concurrency)))
  for (const k of ['autoUpdateBinaries', 'watchClipboard', 'notifications'] as const)
    if (typeof patch[k] === 'boolean') next[k] = patch[k]
  if (patch.cookiesFromBrowser !== undefined)
    next.cookiesFromBrowser =
      typeof patch.cookiesFromBrowser === 'string' && patch.cookiesFromBrowser
        ? patch.cookiesFromBrowser
        : null
  if (patch.defaults) next.defaults = sanitizeOptions(patch.defaults, current.defaults)
  return next
}
