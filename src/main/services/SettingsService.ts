import Store from 'electron-store'
import type { AppSettings } from '@shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  sidebarWidth: 240,
  showExternalImages: false,
  syncOnStartup: true,
  enableLogging: false
}

const store = new Store<AppSettings & { windowBounds?: AppSettings['windowBounds'] }>({
  name: 'mailtap-settings',
  defaults: DEFAULT_SETTINGS
})

export class SettingsService {
  load(): AppSettings {
    return {
      windowBounds: store.get('windowBounds') as AppSettings['windowBounds'],
      sidebarWidth: store.get('sidebarWidth', 240) as number,
      showExternalImages: store.get('showExternalImages', false) as boolean,
      syncOnStartup: store.get('syncOnStartup', true) as boolean,
      enableLogging: store.get('enableLogging', false) as boolean
    }
  }

  save(settings: AppSettings): void {
    store.set('sidebarWidth', settings.sidebarWidth)
    store.set('showExternalImages', settings.showExternalImages)
    store.set('syncOnStartup', settings.syncOnStartup)
    store.set('enableLogging', settings.enableLogging)
    if (settings.windowBounds) {
      store.set('windowBounds', settings.windowBounds)
    }
  }

  saveWindowBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    store.set('windowBounds', bounds)
  }
}

export const settingsService = new SettingsService()
