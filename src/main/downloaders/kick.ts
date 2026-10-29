import { hostIs, parseHttp, plainVideo, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

/** VODs (/video/<id>) and clips (/<channel>/clips/<id>, /<channel>?clip=<id>). Live channels are out. */
export function isKickUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u || !hostIs(u, 'kick.com')) return false
  const segs = segments(u)
  if (segs[0] === 'video') return Boolean(segs[1])
  if (segs[1] === 'clips') return Boolean(segs[2])
  return segs.length === 1 && u.searchParams.has('clip')
}

export const kick: YtDlpSite = {
  id: 'kick',
  name: 'Kick',
  isValid: isKickUrl,
  adapt: plainVideo
}
