export type DownloadMode = 'video' | 'audio' | 'mute'
export type VideoContainer = 'mp4' | 'webm' | 'mkv'
export type AudioFormat = 'mp3' | 'opus' | 'm4a' | 'flac' | 'wav'

export interface DownloadOptions {
  mode: DownloadMode
  /** Max video height in pixels; null means best available. */
  maxHeight: number | null
  videoContainer: VideoContainer
  audioFormat: AudioFormat
  embedMetadata: boolean
  subtitles: boolean
  sponsorblock: boolean
}

export interface MediaEntry {
  id: string
  url: string
  title: string
  duration: number | null
  thumbnail: string | null
}

export interface MediaInfo {
  url: string
  title: string
  uploader: string | null
  duration: number | null
  thumbnail: string | null
  extractor: string
  heights: number[]
  isPlaylist: boolean
  entries: MediaEntry[]
}

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export type ErrorKind =
  | 'geo-blocked'
  | 'login-required'
  | 'rate-limited'
  | 'unavailable'
  | 'unsupported'
  | 'network'
  | 'binary-missing'
  | 'unknown'

export interface Job {
  id: string
  url: string
  title: string
  thumbnail: string | null
  options: DownloadOptions
  status: JobStatus
  /** 0..100 */
  progress: number
  speed: string | null
  eta: string | null
  filePath: string | null
  error: { kind: ErrorKind; message: string } | null
  createdAt: number
}

export interface Settings {
  outputDir: string
  filenameTemplate: string
  concurrency: number
  autoUpdateBinaries: boolean
  watchClipboard: boolean
  notifications: boolean
  cookiesFromBrowser: string | null
  defaults: DownloadOptions
}

export interface BinaryStatus {
  ytdlp: { installed: boolean; version: string | null }
  ffmpeg: { installed: boolean; version: string | null }
  busy: boolean
}

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: { kind: ErrorKind; message: string } }
