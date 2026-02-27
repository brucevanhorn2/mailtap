import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpc } from './ipc'
import { buildMenu } from './menu'
import { settingsService } from './services/SettingsService'
import { storageService } from './services/StorageService'
import { imapSyncService } from './services/ImapSyncService'
import { initLogger, logger } from './utils/logger'

function createWindow(): BrowserWindow {
  const settings = settingsService.load()
  const bounds = settings.windowBounds

  const win = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 820,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#141414',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const saveBounds = () => {
    const b = win.getBounds()
    settingsService.saveWindowBounds(b)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  buildMenu(win)

  return win
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.mailtap.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const settings = settingsService.load()
  initLogger(settings.enableLogging)

  // Initialize storage
  try {
    storageService.initialize()
    logger.info('Storage initialized')
  } catch (err) {
    logger.error('Failed to initialize storage:', err)
  }

  registerAllIpc()
  const win = createWindow()

  // Start IMAP sync
  imapSyncService.setWindow(win)
  if (settings.syncOnStartup) {
    imapSyncService.startAll().catch((err) => logger.error('Failed to start sync:', err))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', async () => {
  await imapSyncService.stopAll()
  storageService.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
