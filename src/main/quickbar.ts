import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron'
import trayIcon from '../../resources/trayTemplate.png?asset'
import { loadRenderer, lockNavigation, webPreferences } from './renderer'

const WIDTH = 380
const HEIGHT = 168

export class QuickBar {
  private readonly tray: Tray
  private win: BrowserWindow | null = null

  constructor(private readonly showMainWindow: () => void) {
    const image = nativeImage.createFromPath(trayIcon)
    image.setTemplateImage(true)
    this.tray = new Tray(image)
    this.tray.setToolTip('Flared')
    this.tray.on('click', () => this.toggle())
    this.tray.on('right-click', () =>
      this.tray.popUpContextMenu(
        Menu.buildFromTemplate([
          { label: 'Open Flared', click: () => this.showMainWindow() },
          { type: 'separator' },
          { label: 'Quit Flared', click: () => app.quit() }
        ])
      )
    )
  }

  hide(): void {
    this.win?.hide()
  }

  private toggle(): void {
    if (this.win?.isVisible()) return this.hide()
    const win = this.ensureWindow()
    const b = this.tray.getBounds()
    const { workArea } = screen.getDisplayMatching(b)
    const x = Math.min(
      Math.max(workArea.x, Math.round(b.x + b.width / 2 - WIDTH / 2)),
      workArea.x + workArea.width - WIDTH
    )
    win.setPosition(x, Math.round(b.y + b.height + 4), false)
    win.show()
    win.focus()
  }

  private ensureWindow(): BrowserWindow {
    if (this.win) return this.win
    const win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      vibrancy: 'popover',
      visualEffectState: 'active',
      webPreferences
    })
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    lockNavigation(win)
    win.on('blur', () => win.hide())
    win.on('closed', () => (this.win = null))
    loadRenderer(win, 'quick')
    this.win = win
    return win
  }
}
