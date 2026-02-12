// 主进程入口文件
// 初始化 Electron 应用、加载环境变量、创建窗口

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { config as loadEnv } from 'dotenv'
import { WindowManager } from './services/WindowManager'
import { registerIpcHandlers } from './handlers/ipcHandlers'

// 加载 .env 环境变量
loadEnv({ path: join(app.getAppPath(), '.env') })

// 窗口管理器实例
const windowManager = new WindowManager()

// Electron 应用就绪
app.whenReady().then(() => {
  console.log('[应用] Tranlater 正在启动...')
  console.log(`[应用] 平台: ${process.platform}, Electron: ${process.versions.electron}`)
  console.log(`[应用] Node.js: ${process.versions.node}`)

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
