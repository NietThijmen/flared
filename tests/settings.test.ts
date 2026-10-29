import { describe, expect, it } from 'vitest'
import { applyPatch, defaultSettings, isSafeTemplate } from '../src/main/settings'

describe('settings', () => {
  it.each(['../x/%(title)s', '/abs/%(id)s', 'C:\\x\\%(id)s', 'a/../../b', ''])(
    'rejects template %j',
    (t) => {
      expect(isSafeTemplate(t)).toBe(false)
    }
  )
  it('accepts nested relative templates', () =>
    expect(isSafeTemplate('%(uploader)s/%(title)s.%(ext)s')).toBe(true))

  it('only accepts boolean clipboard flags', () => {
    const base = defaultSettings('/dl')
    expect(applyPatch(base, { clipboardAutoDownload: true }).clipboardAutoDownload).toBe(true)
    expect(applyPatch(base, { clipboardAutoDownload: 'yes' as never }).clipboardAutoDownload).toBe(
      false
    )
  })

  it('clamps and validates patches', () => {
    const base = defaultSettings('/dl')
    const next = applyPatch(base, {
      concurrency: 99,
      filenameTemplate: '../evil',
      cookiesFromBrowser: '',
      defaults: { ...base.defaults, mode: 'bogus' as never, maxHeight: -5 }
    })
    expect(next.concurrency).toBe(6)
    expect(next.filenameTemplate).toBe(base.filenameTemplate)
    expect(next.cookiesFromBrowser).toBeNull()
    expect(next.defaults.mode).toBe('video')
    expect(next.defaults.maxHeight).toBeNull()
  })
})
