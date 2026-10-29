import { hostIs, audioOnly, parseHttp, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

/** Track and album pages on bandcamp.com or an artist subdomain (custom domains are not detected). */
export function isBandcampUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u || !hostIs(u, 'bandcamp.com')) return false
  const [kind, slug] = segments(u)
  return (kind === 'track' || kind === 'album') && Boolean(slug)
}

export const bandcamp: YtDlpSite = {
  id: 'bandcamp',
  name: 'Bandcamp',
  isValid: isBandcampUrl,
  adapt: audioOnly,
  // yt-dlp's title is "Artist - Track"; tag the real track name (artist, album and track
  // number are already separate fields).
  extraArgs: ['--parse-metadata', '%(track)s:%(meta_title)s']
}
