import { hostIs, parseHttp, plainVideo, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

/** Post links (/r/<sub>/comments/<id>, /r/<sub>/s/<code>), plus redd.it and v.redd.it short links. */
export function isRedditUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u) return false
  const segs = segments(u)
  if (hostIs(u, 'redd.it')) return segs.length === 1
  if (!hostIs(u, 'reddit.com')) return false
  const i = segs.indexOf('comments')
  if (i >= 1 && Boolean(segs[i + 1])) return true
  return segs[0] === 'r' && segs[2] === 's' && Boolean(segs[3])
}

export const reddit: YtDlpSite = {
  id: 'reddit',
  name: 'Reddit',
  isValid: isRedditUrl,
  // Reddit serves video and audio as separate streams; yt-dlp merges them.
  adapt: plainVideo
}
