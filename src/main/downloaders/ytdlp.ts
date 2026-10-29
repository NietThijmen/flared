import type { DownloadOptions, MediaInfo, Result } from '../../shared/types'
import type { ArgContext, Progress } from '../engine/args'
import type { DownloadHandle, Engine } from '../engine/ytdlp'
import type { Downloader } from './types'

export interface YtDlpSite {
  id: string
  name: string
  isValid(url: string): boolean
  /** Adjusts the requested options to what the site can actually deliver. */
  adapt?(options: DownloadOptions): DownloadOptions
  /** Extra yt-dlp flags for this site, e.g. metadata rules. */
  extraArgs?: string[]
}

/** A Downloader backed by yt-dlp, specialised for one site by its validator and option rules. */
export class YtDlpDownloader implements Downloader {
  readonly id: string
  readonly name: string

  constructor(
    private readonly site: YtDlpSite,
    private readonly engine: Engine,
    private readonly context: () => ArgContext
  ) {
    this.id = site.id
    this.name = site.name
  }

  isValid(url: string): boolean {
    try {
      return this.site.isValid(url)
    } catch {
      return false
    }
  }

  probe(url: string): Promise<Result<MediaInfo>> {
    return this.engine.probe(url, this.context())
  }

  download(
    url: string,
    options: DownloadOptions,
    onProgress: (p: Progress) => void
  ): DownloadHandle {
    return this.engine.download(
      url,
      this.site.adapt ? this.site.adapt(options) : options,
      this.context(),
      onProgress,
      this.site.extraArgs
    )
  }
}
