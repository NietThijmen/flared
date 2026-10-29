import { hostIs, noSponsorBlock, parseHttp, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

/** Videos: vimeo.com/<id>, /<user>/<id>, /channels/<name>/<id>, player.vimeo.com/video/<id>. */
export function isVimeoUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u || !hostIs(u, 'vimeo.com')) return false
  const segs = segments(u)
  if (u.hostname === 'player.vimeo.com') return segs[0] === 'video' && /^\d+$/.test(segs[1] ?? '')
  return segs.some((s) => /^\d+$/.test(s))
}

export const vimeo: YtDlpSite = {
  id: 'vimeo',
  name: 'Vimeo',
  isValid: isVimeoUrl,
  // Vimeo has subtitle tracks, so only SponsorBlock is switched off.
  adapt: noSponsorBlock
}
