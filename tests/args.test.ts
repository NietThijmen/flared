import { describe, expect, it } from 'vitest'
import {
  assertUrl,
  classifyError,
  downloadArgs,
  parsePathLine,
  parseProbe,
  parseProgressLine,
  type ArgContext
} from '../src/main/engine/args'
import type { DownloadOptions } from '../src/shared/types'

const ctx: ArgContext = {
  outputDir: '/out',
  filenameTemplate: '%(title)s.%(ext)s',
  ffmpegDir: '/ff',
  cookiesFromBrowser: null
}
const base: DownloadOptions = {
  mode: 'video',
  maxHeight: 1080,
  videoContainer: 'mp4',
  audioFormat: 'mp3',
  embedMetadata: true,
  subtitles: false,
  sponsorblock: false
}

describe('assertUrl', () => {
  it('accepts http(s)', () => expect(assertUrl('https://youtu.be/x')).toBe('https://youtu.be/x'))
  it.each(['--exec evil', 'file:///etc/passwd', 'javascript:alert(1)', 'nope'])(
    'rejects %s',
    (u) => {
      expect(() => assertUrl(u)).toThrow()
    }
  )
})

describe('downloadArgs', () => {
  it('limits height and merges to container', () => {
    const a = downloadArgs('https://a.b/v', base, ctx)
    expect(a).toContain('bv*[height<=1080]+ba/b[height<=1080]')
    expect(a).toContain('--merge-output-format')
  })
  it('extracts audio', () => {
    const a = downloadArgs('https://a.b/v', { ...base, mode: 'audio', audioFormat: 'flac' }, ctx)
    expect(a).toEqual(expect.arrayContaining(['-x', '--audio-format', 'flac']))
  })
  it('skips thumbnail embedding for webm', () => {
    const a = downloadArgs('https://a.b/v', { ...base, videoContainer: 'webm' }, ctx)
    expect(a).not.toContain('--embed-thumbnail')
  })
  it('puts the URL after -- so it is never parsed as a flag', () => {
    const a = downloadArgs('https://a.b/v', base, ctx)
    expect(a.at(-2)).toBe('--')
  })
  it('rejects unknown browsers for cookies', () => {
    expect(() =>
      downloadArgs('https://a.b/v', base, { ...ctx, cookiesFromBrowser: 'x; rm' })
    ).toThrow()
  })
})

describe('output parsing', () => {
  it('parses progress', () => {
    expect(parseProgressLine('[fl]500|1000|NA|1.2MiB/s|00:05')).toEqual({
      percent: 50,
      speed: '1.2MiB/s',
      eta: '00:05'
    })
  })
  it('falls back to estimated total', () => {
    expect(parseProgressLine('[fl]250|NA|1000|NA|Unknown')?.percent).toBe(25)
  })
  it('ignores other lines', () => expect(parseProgressLine('[download] foo')).toBeNull())
  it('parses final path', () => expect(parsePathLine('[fp]/out/a b.mp4')).toBe('/out/a b.mp4'))
})

describe('parseProbe', () => {
  it('reads a single video', () => {
    const info = parseProbe(
      {
        title: 'T',
        webpage_url: 'https://x/y',
        extractor_key: 'Youtube',
        formats: [
          { vcodec: 'avc1', height: 720 },
          { vcodec: 'avc1', height: 1080 },
          { vcodec: 'none', height: null }
        ]
      },
      'https://x/y'
    )
    expect(info.heights).toEqual([1080, 720])
    expect(info.isPlaylist).toBe(false)
  })
  it('reads a playlist', () => {
    const info = parseProbe(
      {
        _type: 'playlist',
        title: 'P',
        entries: [{ id: '1', url: 'https://x/1', title: 'a' }, null]
      },
      'u'
    )
    expect(info.entries).toHaveLength(1)
  })
})

describe('classifyError', () => {
  it.each([
    ['ERROR: Video unavailable', 'unavailable'],
    ['ERROR: Sign in to confirm your age', 'login-required'],
    ['ERROR: HTTP Error 429: Too Many Requests', 'rate-limited'],
    ['ERROR: Unsupported URL: https://x', 'unsupported'],
    ['ERROR: not available in your country', 'geo-blocked'],
    ['ERROR: weird', 'unknown']
  ])('%s -> %s', (stderr, kind) => expect(classifyError(stderr).kind).toBe(kind))
})
