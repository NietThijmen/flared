import type { ArgContext } from '../engine/args'
import { assertUrl } from '../engine/args'
import type { Engine } from '../engine/ytdlp'
import { DownloaderRegistry } from './registry'
import { soundcloud } from './soundcloud'
import { twitch } from './twitch'
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

export function createDownloaders(engine: Engine, context: () => ArgContext): DownloaderRegistry {
  return new DownloaderRegistry(
    [twitch, soundcloud, generic].map((site) => new YtDlpDownloader(site, engine, context))
  )
}
