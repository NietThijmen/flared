import { describe, expect, it, vi } from 'vitest'
import { createDownloaders } from '../src/main/downloaders'
import { isSoundCloudUrl } from '../src/main/downloaders/soundcloud'
import { isTwitchUrl } from '../src/main/downloaders/twitch'
import type { Engine } from '../src/main/engine/ytdlp'
import type { DownloadOptions } from '../src/shared/types'

const options: DownloadOptions = {
  mode: 'video',
  maxHeight: null,
  videoContainer: 'mp4',
  audioFormat: 'mp3',
  embedMetadata: false,
  subtitles: true,
  sponsorblock: true
}
const ctx = { outputDir: '/o', filenameTemplate: 't', ffmpegDir: null, cookiesFromBrowser: null }

describe('isSoundCloudUrl', () => {
  it.each([
    'https://soundcloud.com/artist/track',
    'https://soundcloud.com/artist/sets/album',
    'https://m.soundcloud.com/artist/track',
    'https://on.soundcloud.com/AbC123'
  ])('accepts %s', (u) => expect(isSoundCloudUrl(u)).toBe(true))
  it.each([
    'https://soundcloud.com/',
    'https://on.soundcloud.com/a/b',
    'https://notsoundcloud.com/a/b',
    'https://soundcloud.com.evil.io/a/b'
  ])('rejects %s', (u) => expect(isSoundCloudUrl(u)).toBe(false))
})

describe('isTwitchUrl', () => {
  it.each([
    'https://www.twitch.tv/videos/123456789',
    'https://twitch.tv/somechannel/clip/FunnySlug-abc',
    'https://clips.twitch.tv/FunnySlug-abc',
    'https://clips.twitch.tv/embed?clip=FunnySlug-abc&parent=x.io',
    'https://m.twitch.tv/videos/42'
  ])('accepts %s', (u) => expect(isTwitchUrl(u)).toBe(true))
  it.each([
    'https://www.twitch.tv/somechannel',
    'https://www.twitch.tv/videos/abc',
    'https://www.twitch.tv/somechannel/clip',
    'https://clips.twitch.tv/',
    'https://twitch.tv.evil.io/videos/1'
  ])('rejects %s', (u) => expect(isTwitchUrl(u)).toBe(false))
})

describe('DownloaderRegistry', () => {
  const engine = { probe: vi.fn(), download: vi.fn(() => ({ cancel: vi.fn(), done: null })) }
  const reg = createDownloaders(engine as unknown as Engine, () => ctx)

  it('routes links to the most specific downloader', () => {
    expect(reg.resolve('https://soundcloud.com/a/b')?.id).toBe('soundcloud')
    expect(reg.resolve('https://clips.twitch.tv/x')?.id).toBe('twitch')
    expect(reg.resolve('https://www.youtube.com/watch?v=x')?.id).toBe('generic')
    expect(reg.resolve('https://www.twitch.tv/somechannel')?.id).toBe('generic')
  })

  it('rejects non-http(s) input', async () => {
    expect(reg.resolve('file:///etc/passwd')).toBeNull()
    expect(reg.resolve('not a url')).toBeNull()
    const res = await reg.download('not a url', options, () => undefined).done
    expect(res.ok).toBe(false)
  })

  it('adapts options per site', () => {
    reg.download('https://soundcloud.com/a/b', options, () => undefined)
    expect(engine.download).toHaveBeenLastCalledWith(
      'https://soundcloud.com/a/b',
      expect.objectContaining({ mode: 'audio', subtitles: false, sponsorblock: false }),
      ctx,
      expect.any(Function),
      expect.arrayContaining(['--parse-metadata'])
    )
    reg.download('https://www.twitch.tv/videos/1', options, () => undefined)
    expect(engine.download).toHaveBeenLastCalledWith(
      'https://www.twitch.tv/videos/1',
      expect.objectContaining({ mode: 'video', subtitles: false, sponsorblock: false }),
      ctx,
      expect.any(Function),
      undefined
    )
  })
})
