// 窗口管理服务
// 负责创建和管理控制面板窗口与悬浮字幕窗口

import { BrowserWindow, shell, screen } from 'electron'
import { join } from 'path'

export class WindowManager {
  private controlWindow: BrowserWindow | null = null
  private subtitleWindow: BrowserWindow | null = null

  /** 获取控制面板窗口 */
  getControlWindow(): BrowserWindow | null {
    return this.controlWindow
  }

  /** 获取字幕窗口 */
  getSubtitleWindow(): BrowserWindow | null {
    return this.subtitleWindow
  }

  /** 创建控制面板窗口 */
  createControlWindow(): BrowserWindow {
    this.controlWindow = new BrowserWindow({
      width: 420,
      height: 660,
      minWidth: 380,
      minHeight: 600,
      title: 'Tranlater',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 15 },
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    // 窗口准备好后显示，避免白屏闪烁
    this.controlWindow.on('ready-to-show', () => {
      this.controlWindow?.show()
    })

    // 在外部浏览器中打开链接
    this.controlWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    this.controlWindow.on('closed', () => {
      this.controlWindow = null
    })

    // 加载控制面板页面
    if (process.env.ELECTRON_RENDERER_URL) {
      this.controlWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/control.html`)
    } else {
      this.controlWindow.loadFile(join(__dirname, '../renderer/control.html'))
    }

    return this.controlWindow
  }

  /** 创建悬浮字幕窗口 */
  createSubtitleWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    // 字幕窗口默认宽度和位置：屏幕底部居中
    const windowWidth = Math.min(1000, screenWidth * 0.7)
    const windowHeight = 240
    const x = Math.round((screenWidth - windowWidth) / 2)
    const y = screenHeight - windowHeight - 60

    this.subtitleWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x,
      y,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      hasShadow: false,
      skipTaskbar: true,
      resizable: true,
      movable: true,
      // 不使用 type: 'panel'，某些 Electron 版本不支持 nonactivating panel
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    // 设置窗口层级为悬浮窗
    this.subtitleWindow.setAlwaysOnTop(true, 'floating')
    // 在所有工作区可见
    this.subtitleWindow.setVisibleOnAllWorkspaces(true)

    // 防止字幕窗口抢占焦点：获得焦点后立即归还
    this.subtitleWindow.on('focus', () => {
      // 短暂延迟后 blur，允许拖拽操作完成
      setTimeout(() => {
        if (this.subtitleWindow && !this.subtitleWindow.isDestroyed()) {
          this.subtitleWindow.blur()
        }
      }, 100)
    })

    this.subtitleWindow.on('closed', () => {
      this.subtitleWindow = null
    })

    // 加载字幕页面
    if (process.env.ELECTRON_RENDERER_URL) {
      this.subtitleWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/subtitle.html`)
    } else {
      this.subtitleWindow.loadFile(join(__dirname, '../renderer/subtitle.html'))
    }

    return this.subtitleWindow
  }

  /** 显示字幕窗口 */
  showSubtitle(): void {
    if (!this.subtitleWindow) {
      const win = this.createSubtitleWindow()
      win.webContents.once('did-finish-load', () => {
        if (!win.isDestroyed()) win.show()
      })
    } else {
      this.subtitleWindow.show()
    }
  }

  /** 隐藏字幕窗口 */
  hideSubtitle(): void {
    this.subtitleWindow?.hide()
  }

  /** 重置字幕窗口到屏幕底部居中 */
  resetSubtitlePosition(): void {
    if (!this.subtitleWindow || this.subtitleWindow.isDestroyed()) return
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    const windowWidth = Math.min(1000, screenWidth * 0.7)
    const windowHeight = 240
    const x = Math.round((screenWidth - windowWidth) / 2)
    const y = screenHeight - windowHeight - 60
    this.subtitleWindow.setBounds({ x, y, width: windowWidth, height: windowHeight })
  }

  /** 向控制面板发送消息 */
  sendToControl(channel: string, ...args: unknown[]): void {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send(channel, ...args)
    }
  }

  /** 向字幕窗口发送消息 */
  sendToSubtitle(channel: string, ...args: unknown[]): void {
    if (this.subtitleWindow && !this.subtitleWindow.isDestroyed()) {
      if (this.subtitleWindow.webContents.isLoading()) {
        this.subtitleWindow.webContents.once('did-finish-load', () => {
          if (this.subtitleWindow && !this.subtitleWindow.isDestroyed()) {
            this.subtitleWindow.webContents.send(channel, ...args)
          }
        })
      } else {
        this.subtitleWindow.webContents.send(channel, ...args)
      }
    }
  }

  /** 向所有窗口广播消息 */
  broadcast(channel: string, ...args: unknown[]): void {
    this.sendToControl(channel, ...args)
    this.sendToSubtitle(channel, ...args)
  }

  /** 关闭所有窗口 */
  closeAll(): void {
    this.controlWindow?.close()
    this.subtitleWindow?.close()
  }
}
