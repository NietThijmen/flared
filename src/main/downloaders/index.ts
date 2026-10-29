import type { ArgContext } from '../engine/args'
import { assertUrl } from '../engine/args'
import type { Engine } from '../engine/ytdlp'
import { DownloaderRegistry } from './registry'
import { bandcamp } from './bandcamp'
import { instagram } from './instagram'
import { kick } from './kick'
import { mixcloud } from './mixcloud'
import { reddit } from './reddit'
import { soundcloud } from './soundcloud'
import { tiktok } from './tiktok'
import { twitch } from './twitch'
import { twitter } from './twitter'
import { vimeo } from './vimeo'
import { YtDlpDownloader, type YtDlpSite } from './ytdlp'

export type { Downloader } from './types'
export { DownloaderRegistry } from './registry'

/** Fallback for every other site yt-dlp understands. Must stay last. */
const generic: YtDlpSite = {
  id: 'generic',
  name: 'Other sites',
  isValid: (url) => {
    assertUrl(url)
    return true
  }
}

/** Specific sites first: the first one whose isValid matches wins, `generic` catches the rest. */
const SITES: YtDlpSite[] = [
  twitch,
  soundcloud,
  bandcamp,
  mixcloud,
  tiktok,
  twitter,
  instagram,
  reddit,
  vimeo,
  kick,
  generic
]

export function createDownloaders(engine: Engine, context: () => ArgContext): DownloaderRegistry {
  return new DownloaderRegistry(SITES.map((site) => new YtDlpDownloader(site, engine, context)))
}
