import { plainVideo } from './rules'
import type { YtDlpSite } from './ytdlp'

const HOSTS = new Set(['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'])
const CLIPS_HOST = 'clips.twitch.tv'

/** Clips (clips.twitch.tv/<slug>, /<channel>/clip/<slug>) and VODs (/videos/<id>). Live streams are out. */
export function isTwitchUrl(raw: string): boolean {
  const u = new URL(raw.trim())
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const [first, second, third] = u.pathname.split('/').filter(Boolean)
  if (u.hostname === CLIPS_HOST) {
    return first === 'embed' ? u.searchParams.has('clip') : Boolean(first)
  }
  if (!HOSTS.has(u.hostname)) return false
  if (first === 'videos') return /^\d+$/.test(second ?? '')
  if (second === 'clip') return Boolean(third)
  if (second === 'v' || second === 'video') return /^\d+$/.test(third ?? '')
  return false
}

export const twitch: YtDlpSite = {
  id: 'twitch',
  name: 'Twitch',
  isValid: isTwitchUrl,
  // Twitch has no subtitle tracks and no SponsorBlock data.
  adapt: plainVideo
}
