import type { DownloadOptions, MediaInfo, Result } from '../../shared/types'
import type { Progress } from '../engine/args'
import type { DownloadHandle } from '../engine/ytdlp'

/** A source Flared can download from. Output location and tooling come from the app context. */
export interface Downloader {
  readonly id: string
  readonly name: string
  /** True when this downloader knows how to handle the link. Must be cheap and never throw. */
  isValid(url: string): boolean
  probe(url: string): Promise<Result<MediaInfo>>
  download(url: string, options: DownloadOptions, onProgress: (p: Progress) => void): DownloadHandle
}
