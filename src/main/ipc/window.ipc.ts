import { ipcMain, BrowserWindow } from 'electron'

export function registerWindowIpc(win: BrowserWindow): void {
  ipcMain.handle('window:minimize', () => {
    win.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    win.close()
  })

  ipcMain.handle('app:zoom-in', () => {
    const factor = win.webContents.getZoomFactor()
    win.webContents.setZoomFactor(Math.min(factor + 0.1, 2))
  })

  ipcMain.handle('app:zoom-out', () => {
    const factor = win.webContents.getZoomFactor()
    win.webContents.setZoomFactor(Math.max(factor - 0.1, 0.5))
  })

  ipcMain.handle('app:reset-zoom', () => {
    win.webContents.setZoomFactor(1)
  })

  ipcMain.handle('app:open-url', (_, url: string) => {
    const { shell } = require('electron')
    shell.openExternal(url)
  })
}
