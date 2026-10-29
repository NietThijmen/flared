import { describe, expect, it } from 'vitest'
import { ffmpegSource, parseChecksums, ytdlpAssetName } from '../src/main/binaries'

describe('binaries', () => {
  it('picks yt-dlp assets', () => {
    expect(ytdlpAssetName({ platform: 'darwin', arch: 'arm64' })).toBe('yt-dlp_macos')
    expect(ytdlpAssetName({ platform: 'win32', arch: 'x64' })).toBe('yt-dlp.exe')
    expect(ytdlpAssetName({ platform: 'linux', arch: 'arm64' })).toBe('yt-dlp_linux_aarch64')
  })
  it('picks ffmpeg archives', () => {
    expect(ffmpegSource({ platform: 'darwin', arch: 'x64' }).archives).toHaveLength(2)
    expect(ffmpegSource({ platform: 'linux', arch: 'x64' }).archives[0].name).toContain('linux64')
  })
  it('parses checksum files', () => {
    const h = 'a'.repeat(64)
    expect(parseChecksums(`${h}  yt-dlp\n${h} *x.zip\nbad`).get('x.zip')).toBe(h)
  })
})
