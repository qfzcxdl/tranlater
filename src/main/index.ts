// 主进程入口文件

import { app, BrowserWindow, systemPreferences } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { config as loadEnv } from 'dotenv'
import { WindowManager } from './services/WindowManager'
import { registerIpcHandlers } from './handlers/ipcHandlers'

// 加载 .env 环境变量
const appPath = app.getAppPath()
const envPath = join(appPath, '.env')
const rootEnvPath = join(appPath, '../../.env')

if (existsSync(envPath)) {
  loadEnv({ path: envPath })
} else if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath })
} else {
  loadEnv()
}

const windowManager = new WindowManager()

app.whenReady().then(async () => {
  // macOS: 应用启动时请求麦克风权限
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone')
    if (micStatus === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone')
    }
  }

  registerIpcHandlers(windowManager)
  windowManager.createControlWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createControlWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  windowManager.closeAll()
})
