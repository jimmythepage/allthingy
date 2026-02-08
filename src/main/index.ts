import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/file-system'
import { registerGitHubHandlers } from './ipc/github-api'
import { registerGitHandlers } from './ipc/git-operations'
import { registerSharingHandlers } from './ipc/github-sharing'

// Log crashes in production so we can debug
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})
process.on('uncaughtRejection', (reason, promise) => {
  console.error('Uncaught rejection:', reason)
})

function createWindow(): void {
  // In packaged app, use app.getAppPath() so paths resolve correctly from inside .asar
  const outDir = app.isPackaged ? join(app.getAppPath(), 'out') : join(__dirname, '..')
  const preloadPath = join(outDir, 'preload', 'index.js')
  const rendererPath = join(outDir, 'renderer', 'index.html')

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'AllThingy',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: preloadPath,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(rendererPath)
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  registerGitHubHandlers()
  registerGitHandlers()
  registerSharingHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
