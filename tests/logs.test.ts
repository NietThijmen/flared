import { describe, expect, it } from 'vitest'
import { LogBuffer } from '../src/main/logs'

describe('LogBuffer', () => {
  it('keeps only the newest lines and skips blanks', () => {
    const log = new LogBuffer(3)
    log.push('yt-dlp', 'a\n\nb\r\nc\nd')
    const lines = log.text().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('[yt-dlp] b')
    expect(lines[2]).toContain('[yt-dlp] d')
  })
  it('clears', () => {
    const log = new LogBuffer()
    log.push('x', 'y')
    log.clear()
    expect(log.text()).toBe('')
  })
})
