import { app, session, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { FlaredApp } from './app'
import { QuickBar } from './quickbar'
import { loadRenderer, lockNavigation, webPreferences } from './renderer'

let mainWindow: BrowserWindow | null = null
let quickBar: QuickBar | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences
  })

  mainWindow = win
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => (mainWindow = null))
  lockNavigation(win)
  loadRenderer(win)
  return win
}

function showMainWindow(): BrowserWindow {
  const win = mainWindow ?? createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('app.flared')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Flared never needs camera, mic, geolocation, etc.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  const flared = new FlaredApp(() => mainWindow, {
    showMainWindow,
    hideQuick: () => quickBar?.hide()
  })
  flared.registerIpc()
  createWindow()
  // Menu bar item for pasting a link and downloading without opening the main window.
  if (process.platform === 'darwin') quickBar = new QuickBar(showMainWindow)
  void flared.bootstrapBinaries()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!mainWindow) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
