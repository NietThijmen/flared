import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'

/**
 * Application menu. "Settings…" carries the OS-standard accelerator (Cmd+, on macOS, Ctrl+,
 * elsewhere) and asks the renderer to open its settings panel.
 */
export function installMenu(openSettings: () => BrowserWindow): void {
  const settings: MenuItemConstructorOptions = {
    label: 'Settings…',
    accelerator: 'CmdOrCtrl+,',
    click: () => {
      const win = openSettings()
      const send = (): void => win.webContents.send('app:openSettings', null)
      // A freshly created window has not subscribed to events yet.
      if (win.webContents.isLoading())
        win.webContents.once('did-finish-load', () => setTimeout(send, 300))
      else send()
    }
  }

  const first: MenuItemConstructorOptions =
    process.platform === 'darwin'
      ? {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            settings,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      : { label: 'File', submenu: [settings, { type: 'separator' }, { role: 'quit' }] }

  const template: MenuItemConstructorOptions[] = [first, { role: 'editMenu' }]
  // Reload/DevTools are for development only.
  if (is.dev) template.push({ role: 'viewMenu' })
  template.push({ role: 'windowMenu' })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
