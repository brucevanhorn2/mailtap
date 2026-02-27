import { ipcMain } from 'electron'
import { imapSyncService } from '../services/ImapSyncService'

export function registerSyncIpc(): void {
  ipcMain.handle('sync:start', async (_event, accountId: string) => {
    try {
      await imapSyncService.start(accountId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('sync:stop', async (_event, accountId: string) => {
    try {
      await imapSyncService.stop(accountId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('sync:status', async () => {
    return imapSyncService.getStatus()
  })
}
