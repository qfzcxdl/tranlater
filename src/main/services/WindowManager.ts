// 窗口管理服务
// 负责创建和管理控制窗口和字幕窗口

import { BrowserWindow, screen } from 'electron';
import path from 'path';

export class WindowManager {
  private controlWindow: BrowserWindow | null = null;
  private subtitleWindow: BrowserWindow | null = null;

  /**
   * 创建控制窗口
   */
  createControlWindow(): BrowserWindow {
    console.log('Creating control window...');

    this.controlWindow = new BrowserWindow({
      width: 500,
      height: 400,
      resizable: true,
      frame: true,
      alwaysOnTop: false,
      transparent: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      title: 'Tranlater - Control',
    });

    // 加载控制窗口页面
    if (process.env.NODE_ENV === 'development') {
      this.controlWindow.loadURL('http://localhost:5173/control.html');
      this.controlWindow.webContents.openDevTools();
    } else {
      this.controlWindow.loadFile(
        path.join(__dirname, '../renderer/control.html')
      );
    }

    this.controlWindow.on('closed', () => {
      console.log('Control window closed');
      this.controlWindow = null;
      // 控制窗口关闭时，关闭字幕窗口
      this.closeSubtitleWindow();
    });

    console.log('✓ Control window created');
    return this.controlWindow;
  }

  /**
   * 创建字幕窗口
   * 置顶、穿透、透明背景
   */
  createSubtitleWindow(): BrowserWindow {
    console.log('Creating subtitle window...');

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const subtitleHeight = 200;
    const subtitleWidth = width;

    this.subtitleWindow = new BrowserWindow({
      width: subtitleWidth,
      height: subtitleHeight,
      x: 0,
      y: height - subtitleHeight,
      alwaysOnTop: true,
      transparent: true,
      frame: false,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      // macOS 特定配置
      hasShadow: false,
      vibrancy: 'under-window', // 毛玻璃效果
      visualEffectState: 'active',
      // 点击穿透
      focusable: false,
      skipTaskbar: true,
    });

    // 设置窗口忽略鼠标事件（穿透）
    this.subtitleWindow.setIgnoreMouseEvents(true, { forward: true });

    // 加载字幕窗口页面
    if (process.env.NODE_ENV === 'development') {
      this.subtitleWindow.loadURL('http://localhost:5173/subtitle.html');
    } else {
      this.subtitleWindow.loadFile(
        path.join(__dirname, '../renderer/subtitle.html')
      );
    }

    this.subtitleWindow.on('closed', () => {
      console.log('Subtitle window closed');
      this.subtitleWindow = null;
    });

    console.log('✓ Subtitle window created');
    return this.subtitleWindow;
  }

  /**
   * 关闭字幕窗口
   */
  closeSubtitleWindow(): void {
    if (this.subtitleWindow) {
      this.subtitleWindow.close();
      this.subtitleWindow = null;
    }
  }

  /**
   * 获取窗口实例
   */
  getControlWindow(): BrowserWindow | null {
    return this.controlWindow;
  }

  getSubtitleWindow(): BrowserWindow | null {
    return this.subtitleWindow;
  }

  /**
   * 向字幕窗口发送消息
   */
  sendToSubtitleWindow(channel: string, ...args: any[]): void {
    if (this.subtitleWindow && !this.subtitleWindow.isDestroyed()) {
      this.subtitleWindow.webContents.send(channel, ...args);
    }
  }

  /**
   * 向控制窗口发送消息
   */
  sendToControlWindow(channel: string, ...args: any[]): void {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send(channel, ...args);
    }
  }

  /**
   * 显示字幕窗口
   */
  showSubtitleWindow(): void {
    if (this.subtitleWindow) {
      this.subtitleWindow.show();
    }
  }

  /**
   * 隐藏字幕窗口
   */
  hideSubtitleWindow(): void {
    if (this.subtitleWindow) {
      this.subtitleWindow.hide();
    }
  }
}
