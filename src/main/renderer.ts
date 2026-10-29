import { shell, type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'node:path'

export const webPreferences: BrowserWindowConstructorOptions['webPreferences'] = {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true
}

const openHttp = (url: string): void => {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
}

/** Keeps the window on our own UI: external links open in the browser instead. */
export function lockNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler((details) => {
    openHttp(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
      openHttp(url)
    }
  })
}

/** Loads the Svelte renderer; `hash` selects the view ('' = main app, 'quick' = menu bar popover). */
export function loadRenderer(win: BrowserWindow, hash = ''): void {
  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${hash ? `#${hash}` : ''}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}
