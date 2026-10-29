import { hostIs, audioOnly, parseHttp, segments } from './rules'
import type { YtDlpSite } from './ytdlp'

const NOT_USERS = new Set(['discover', 'tag', 'search', 'categories', 'select', 'live', 'upload'])

/** A single mix: mixcloud.com/<user>/<mix>/. */
export function isMixcloudUrl(raw: string): boolean {
  const u = parseHttp(raw)
  if (!u || !hostIs(u, 'mixcloud.com')) return false
  const segs = segments(u)
  return segs.length === 2 && !NOT_USERS.has(segs[0])
}

export const mixcloud: YtDlpSite = {
  id: 'mixcloud',
  name: 'Mixcloud',
  isValid: isMixcloudUrl,
  adapt: audioOnly
}
