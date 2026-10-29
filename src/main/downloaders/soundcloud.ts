import { audioOnly } from './rules'
import type { YtDlpSite } from './ytdlp'

const HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'])
const SHORT_HOST = 'on.soundcloud.com'

/** Tracks, sets and artist pages on soundcloud.com, plus on.soundcloud.com share links. */
export function isSoundCloudUrl(raw: string): boolean {
  const u = new URL(raw.trim())
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const segments = u.pathname.split('/').filter(Boolean)
  if (u.hostname === SHORT_HOST) return segments.length === 1
  return HOSTS.has(u.hostname) && segments.length > 0
}

export const soundcloud: YtDlpSite = {
  id: 'soundcloud',
  name: 'SoundCloud',
  isValid: isSoundCloudUrl,
  // SoundCloud only serves audio, so a video/mute request is downloaded as audio.
  adapt: audioOnly,
  // The uploader is often a label or fan account, while the real artist is in the title as
  // "Artist - Song". Tag from that when present (meta_* only touches tags, not the filename).
  extraArgs: ['--parse-metadata', 'title:(?P<meta_artist>.+?) - (?P<meta_title>.+)']
}
