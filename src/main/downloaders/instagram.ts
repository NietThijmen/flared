import { hostIs, parseHttp, plainVideo, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

const KINDS = new Set(['p', 'tv', 'reel'])

/** Reels, IGTV and posts: /reel/<code>, /p/<code>, /tv/<code>, /<user>/reel/<code>. */
export function isInstagramUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u || !hostIs(u, 'instagram.com')) return false
  const segs = segments(u)
  const i = KINDS.has(segs[0] ?? '') ? 0 : KINDS.has(segs[1] ?? '') ? 1 : -1
  return i >= 0 && Boolean(segs[i + 1])
}

export const instagram: YtDlpSite = {
  id: 'instagram',
  name: 'Instagram',
  isValid: isInstagramUrl,
  adapt: plainVideo
}
