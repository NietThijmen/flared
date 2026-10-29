import { describe, expect, it, vi } from 'vitest'
import { createDownloaders } from '../src/main/downloaders'
import { isSoundCloudUrl } from '../src/main/downloaders/soundcloud'
import { isTwitchUrl } from '../src/main/downloaders/twitch'
import { isBandcampUrl } from '../src/main/downloaders/bandcamp'
import { isInstagramUrl } from '../src/main/downloaders/instagram'
import { isKickUrl } from '../src/main/downloaders/kick'
import { isMixcloudUrl } from '../src/main/downloaders/mixcloud'
import { isRedditUrl } from '../src/main/downloaders/reddit'
import { isTikTokUrl } from '../src/main/downloaders/tiktok'
import { isTwitterUrl } from '../src/main/downloaders/twitter'
import { isVimeoUrl } from '../src/main/downloaders/vimeo'
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

const sites: [string, (u: string) => boolean, string[], string[]][] = [
  [
    'bandcamp',
    isBandcampUrl,
    [
      'https://artist.bandcamp.com/track/song',
      'http://benprunty.bandcamp.com/album/ftl',
      'https://bandcamp.com/track/x'
    ],
    [
      'https://artist.bandcamp.com/',
      'https://artist.bandcamp.com/music',
      'https://bandcamp.com.evil.io/track/x'
    ]
  ],
  [
    'mixcloud',
    isMixcloudUrl,
    ['https://www.mixcloud.com/dj/some-mix/'],
    [
      'https://www.mixcloud.com/dj/',
      'https://www.mixcloud.com/discover/house',
      'https://www.mixcloud.com/dj/playlists/x'
    ]
  ],
  [
    'tiktok',
    isTikTokUrl,
    [
      'https://www.tiktok.com/@user/video/7123456789',
      'https://vm.tiktok.com/ZMabc123/',
      'https://www.tiktok.com/t/ZTabc/'
    ],
    [
      'https://www.tiktok.com/@user',
      'https://www.tiktok.com/@user/photo/7123456789',
      'https://tiktok.com.evil.io/@u/video/1'
    ]
  ],
  [
    'twitter',
    isTwitterUrl,
    [
      'https://x.com/user/status/1790000000000000000',
      'https://twitter.com/user/status/123?s=20',
      'https://x.com/i/status/123'
    ],
    ['https://x.com/user', 'https://x.com/user/status/abc', 'https://nottwitter.com/u/status/1']
  ],
  [
    'instagram',
    isInstagramUrl,
    [
      'https://www.instagram.com/reel/C1abc/',
      'https://www.instagram.com/p/C1abc/',
      'https://www.instagram.com/user/reel/C1abc/'
    ],
    [
      'https://www.instagram.com/user/',
      'https://www.instagram.com/reel/',
      'https://instagram.evil.io/p/x'
    ]
  ],
  [
    'reddit',
    isRedditUrl,
    [
      'https://www.reddit.com/r/videos/comments/abc123/title/',
      'https://old.reddit.com/r/videos/comments/abc123',
      'https://redd.it/abc123',
      'https://v.redd.it/abc123',
      'https://www.reddit.com/r/videos/s/AbCdEf'
    ],
    [
      'https://www.reddit.com/r/videos/',
      'https://www.reddit.com/',
      'https://reddit.com.evil.io/r/a/comments/b'
    ]
  ],
  [
    'vimeo',
    isVimeoUrl,
    [
      'https://vimeo.com/123456789',
      'https://vimeo.com/channels/staffpicks/123456',
      'https://player.vimeo.com/video/123456'
    ],
    ['https://vimeo.com/', 'https://vimeo.com/someuser', 'https://player.vimeo.com/video/abc']
  ],
  [
    'kick',
    isKickUrl,
    [
      'https://kick.com/video/abc-123',
      'https://kick.com/channel/clips/clip_01ABC',
      'https://kick.com/channel?clip=clip_01ABC'
    ],
    ['https://kick.com/channel', 'https://kick.com/', 'https://kick.com.evil.io/video/1']
  ]
]

describe.each(sites)('%s URLs', (_name, isValid, good, bad) => {
  it.each(good)('accepts %s', (u) => expect(isValid(u)).toBe(true))
  it.each(bad)('rejects %s', (u) => expect(isValid(u)).toBe(false))
})

describe('DownloaderRegistry', () => {
  const engine = { probe: vi.fn(), download: vi.fn(() => ({ cancel: vi.fn(), done: null })) }
  const reg = createDownloaders(engine as unknown as Engine, () => ctx)

  it('routes links to the most specific downloader', () => {
    expect(reg.resolve('https://soundcloud.com/a/b')?.id).toBe('soundcloud')
    expect(reg.resolve('https://clips.twitch.tv/x')?.id).toBe('twitch')
    expect(reg.resolve('https://www.youtube.com/watch?v=x')?.id).toBe('generic')
    expect(reg.resolve('https://www.twitch.tv/somechannel')?.id).toBe('generic')
    expect(reg.resolve('https://a.bandcamp.com/track/x')?.id).toBe('bandcamp')
    expect(reg.resolve('https://www.mixcloud.com/a/b/')?.id).toBe('mixcloud')
    expect(reg.resolve('https://www.tiktok.com/@a/video/1')?.id).toBe('tiktok')
    expect(reg.resolve('https://x.com/a/status/1')?.id).toBe('twitter')
    expect(reg.resolve('https://www.instagram.com/reel/x/')?.id).toBe('instagram')
    expect(reg.resolve('https://www.reddit.com/r/a/comments/b')?.id).toBe('reddit')
    expect(reg.resolve('https://vimeo.com/123')?.id).toBe('vimeo')
    expect(reg.resolve('https://kick.com/video/1')?.id).toBe('kick')
    expect(reg.resolve('https://www.tiktok.com/@a')?.id).toBe('generic')
  })

  it('rejects non-http(s) input', async () => {
    expect(reg.resolve('file:///etc/passwd')).toBeNull()
    expect(reg.resolve('not a url')).toBeNull()
    const res = await reg.download('not a url', options, () => undefined).done
    expect(res.ok).toBe(false)
  })

  it('forces audio on audio-only sites and tags Bandcamp tracks by name', () => {
    reg.download('https://a.bandcamp.com/track/x', options, () => undefined)
    expect(engine.download).toHaveBeenLastCalledWith(
      'https://a.bandcamp.com/track/x',
      expect.objectContaining({ mode: 'audio', subtitles: false, sponsorblock: false }),
      ctx,
      expect.any(Function),
      ['--parse-metadata', '%(track)s:%(meta_title)s']
    )
    reg.download('https://www.mixcloud.com/a/b/', options, () => undefined)
    expect(engine.download).toHaveBeenLastCalledWith(
      'https://www.mixcloud.com/a/b/',
      expect.objectContaining({ mode: 'audio' }),
      ctx,
      expect.any(Function),
      undefined
    )
  })

  it('keeps subtitles on Vimeo but not sponsor removal', () => {
    reg.download('https://vimeo.com/123', options, () => undefined)
    expect(engine.download).toHaveBeenLastCalledWith(
      'https://vimeo.com/123',
      expect.objectContaining({ mode: 'video', subtitles: true, sponsorblock: false }),
      ctx,
      expect.any(Function),
      undefined
    )
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
