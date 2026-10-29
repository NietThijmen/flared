import { hostIs, parseHttp, plainVideo, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

/** Posts on x.com / twitter.com: /<user>/status/<id> (also /i/status/<id>, /i/web/status/<id>). */
export function isTwitterUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u || !hostIs(u, 'x.com', 'twitter.com')) return false
  const segs = segments(u)
  const i = segs.indexOf('status')
  return i >= 1 && /^\d+$/.test(segs[i + 1] ?? '')
}

export const twitter: YtDlpSite = {
  id: 'twitter',
  name: 'X / Twitter',
  isValid: isTwitterUrl,
  adapt: plainVideo
}
