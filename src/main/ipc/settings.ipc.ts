import { ipcMain, shell } from 'electron'
import { settingsService } from '../services/SettingsService'
import { setFileLogging } from '../utils/logger'
import { getUserDataPath } from '../utils/paths'
import type { AppSettings } from '@shared/types'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:load', async () => {
    return settingsService.load()
  })

  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    settingsService.save(settings)
    setFileLogging(settings.enableLogging)
  })

  ipcMain.handle('settings:open-log-folder', async () => {
    await shell.openPath(getUserDataPath('logs'))
  })
}
