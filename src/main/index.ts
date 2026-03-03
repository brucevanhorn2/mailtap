import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpc } from './ipc'
import { buildMenu } from './menu'
import { settingsService } from './services/SettingsService'
import { storageService } from './services/StorageService'
import { imapSyncService } from './services/ImapSyncService'
import { initLogger, logger } from './utils/logger'

// Linux compatibility: disable GPU acceleration and Chromium sandbox.
// The GPU process and zygote both fail on many Linux setups (VMs, certain
// drivers, Wayland-only sessions). Software rendering + no-sandbox fixes it.
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-dev-shm-usage')

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
    frame: false,
    titleBarStyle: 'hidden',
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

  // Allow external images to load inside the sandboxed email HTML iframe.
  // Some image servers send `Cross-Origin-Resource-Policy: same-origin` which
  // Chromium/Electron enforces by blocking the load — even for plain <img> tags.
  // Removing that header lets the email viewer's "Show images" feature work.
  // Use a case-insensitive loop to guard against mixed-case header names, and
  // short-circuit when responseHeaders is absent (non-HTTP responses).
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    if (!details.responseHeaders) {
      callback({})
      return
    }
    const responseHeaders: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(details.responseHeaders)) {
      if (key.toLowerCase() !== 'cross-origin-resource-policy') {
        responseHeaders[key] = value
      }
    }
    callback({ responseHeaders })
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

  const win = createWindow()
  registerAllIpc(win)

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
