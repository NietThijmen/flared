import type { DownloadOptions, MediaInfo, Result } from '../../shared/types'
import type { Progress } from '../engine/args'
import type { DownloadHandle } from '../engine/ytdlp'
import type { Downloader } from './types'

const unsupported = {
  ok: false,
  error: { kind: 'unsupported', message: 'No downloader supports this link' }
} as const

/** Routes each link to the first downloader that claims it, so list specific sites before generic ones. */
export class DownloaderRegistry {
  constructor(private readonly downloaders: Downloader[]) {}

  resolve(url: string): Downloader | null {
    return this.downloaders.find((d) => d.isValid(url)) ?? null
  }

  probe(url: string): Promise<Result<MediaInfo>> {
    const d = this.resolve(url)
    return d ? d.probe(url) : Promise.resolve(unsupported)
  }

  download(
    url: string,
    options: DownloadOptions,
    onProgress: (p: Progress) => void
  ): DownloadHandle {
    const d = this.resolve(url)
    if (!d) return { cancel: () => undefined, done: Promise.resolve(unsupported) }
    return d.download(url, options, onProgress)
  }
}
