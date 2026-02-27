import { ipcMain } from 'electron'
import { indexRebuildService } from '../services/IndexRebuildService'

export function registerRebuildIpc(): void {
  ipcMain.handle('rebuild:trigger', async () => {
    await indexRebuildService.rebuild()
  })
}
