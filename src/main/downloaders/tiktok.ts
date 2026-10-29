import { hostIs, parseHttp, plainVideo, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

/** Videos (/@user/video/<id>) and vm./vt. and /t/ share links. Photo slideshows are not video. */
export function isTikTokUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u || !hostIs(u, 'tiktok.com')) return false
  const segs = segments(u)
  if (u.hostname === 'vm.tiktok.com' || u.hostname === 'vt.tiktok.com') return segs.length === 1
  if (segs[0] === 't') return Boolean(segs[1])
  return segs[1] === 'video' && /^\d+$/.test(segs[2] ?? '')
}

export const tiktok: YtDlpSite = {
  id: 'tiktok',
  name: 'TikTok',
  isValid: isTikTokUrl,
  adapt: plainVideo
}
