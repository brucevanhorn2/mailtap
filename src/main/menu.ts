import { Menu, BrowserWindow, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

export function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Accounts',
      submenu: [
        {
          label: 'Add Account...',
          accelerator: 'CmdOrCtrl+N',
          click: () => win.webContents.send('menu:add-account')
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Sync',
      submenu: [
        {
          label: 'Sync All Accounts',
          accelerator: 'CmdOrCtrl+R',
          click: () => win.webContents.send('menu:sync-all')
        },
        {
          label: 'Stop Sync',
          click: () => win.webContents.send('menu:sync-stop')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+K',
          click: () => win.webContents.send('menu:search')
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => win.webContents.send('menu:toggle-sidebar')
        },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Rebuild Search Index',
          click: () => win.webContents.send('menu:rebuild-index')
        },
        { type: 'separator' },
        {
          label: 'Learn More',
          click: () => shell.openExternal('https://github.com/brucevanhorn2/mailtap')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
