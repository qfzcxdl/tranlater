// 主进程入口文件
// 初始化 Electron 应用、加载环境变量、创建窗口

import { app, BrowserWindow, systemPreferences } from 'electron'
import { join } from 'path'
import { config as loadEnv } from 'dotenv'
import { WindowManager } from './services/WindowManager'
import { registerIpcHandlers } from './handlers/ipcHandlers'

// 加载 .env 环境变量
// 在开发模式下 app.getAppPath() 可能指向 out/main，需要回退到项目根目录
const appPath = app.getAppPath()
const envPath = join(appPath, '.env')
const rootEnvPath = join(appPath, '../../.env')
const { existsSync } = require('fs')

if (existsSync(envPath)) {
  loadEnv({ path: envPath })
} else if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath })
} else {
  // 尝试从 cwd 加载
  loadEnv()
}

// 窗口管理器实例
const windowManager = new WindowManager()

// Electron 应用就绪
app.whenReady().then(async () => {
  console.log('[应用] Tranlater 正在启动...')
  console.log(`[应用] 平台: ${process.platform}, Electron: ${process.versions.electron}`)
  console.log(`[应用] Node.js: ${process.versions.node}`)

  // macOS: 应用启动时请求麦克风权限
  // 这会触发系统权限弹窗（如果是首次请求）
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone')
    console.log(`[权限] 当前麦克风权限状态: ${micStatus}`)

    if (micStatus === 'not-determined') {
      console.log('[权限] 首次请求麦克风权限...')
      const granted = await systemPreferences.askForMediaAccess('microphone')
      console.log(`[权限] 麦克风权限: ${granted ? '已授予' : '已拒绝'}`)
    } else if (micStatus === 'denied') {
      console.log('[权限] 麦克风权限已被拒绝，请在系统设置 > 隐私与安全性 > 麦克风中授权 Electron 应用')
    }

    const screenStatus = systemPreferences.getMediaAccessStatus('screen')
    console.log(`[权限] 屏幕录制权限状态: ${screenStatus}`)
  }

  // 注册 IPC 处理器
  registerIpcHandlers(windowManager)

  // 创建控制面板窗口
  windowManager.createControlWindow()

  console.log('[应用] 启动完成')

  // macOS: 点击 Dock 图标时重新打开窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createControlWindow()
    }
  })
})

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  app.quit()
})

// 应用退出前清理
app.on('before-quit', () => {
  console.log('[应用] 正在退出...')
  windowManager.closeAll()
})
