import type { DownloadOptions } from '../../shared/types'

/** Parses an http(s) link; null for anything else, so validators never throw. */
export function parseHttp(raw: string): URL | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}

/** True for the domain itself or any subdomain (never a lookalike such as `example.com.evil.io`). */
export function hostIs(u: URL, ...domains: string[]): boolean {
  return domains.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
}

export const segments = (u: URL): string[] => u.pathname.split('/').filter(Boolean)

/** For sites that only serve audio: any request is downloaded as audio. */
export const audioOnly = (o: DownloadOptions): DownloadOptions => ({
  ...o,
  mode: 'audio',
  subtitles: false,
  sponsorblock: false
})

/** For video sites without subtitle tracks or SponsorBlock data. */
export const plainVideo = (o: DownloadOptions): DownloadOptions => ({
  ...o,
  subtitles: false,
  sponsorblock: false
})

/** SponsorBlock only has data for YouTube. */
export const noSponsorBlock = (o: DownloadOptions): DownloadOptions => ({
  ...o,
  sponsorblock: false
})
