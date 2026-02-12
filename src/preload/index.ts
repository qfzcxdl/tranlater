// Preload 脚本
// 通过 contextBridge 安全地将 IPC API 暴露给渲染进程

import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type { AudioSource, Language, TranslationMode } from '../shared/types'

const electronAPI = {
  // === 应用控制 ===

  /** 开始实时翻译 */
  startTranslation: () => ipcRenderer.invoke(IPC_CHANNELS.APP_START),

  /** 停止实时翻译 */
  stopTranslation: () => ipcRenderer.invoke(IPC_CHANNELS.APP_STOP),

  /** 获取当前应用状态 */
  getAppState: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_STATE),

  /** 检查音频设备可用性 */
  checkDevices: () => ipcRenderer.invoke(IPC_CHANNELS.APP_CHECK_DEVICES),

  // === 音频控制 ===

  /** 设置音频来源（支持多选） */
  setAudioSources: (sources: AudioSource[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUDIO_SET_SOURCES, sources),

  /** 发送音频数据到主进程（高频调用，使用 send 而非 invoke） */
  sendAudioData: (audioBuffer: ArrayBuffer) =>
    ipcRenderer.send(IPC_CHANNELS.AUDIO_DATA, audioBuffer),

  // === 语言控制 ===

  /** 设置翻译语言对 */
  setLanguages: (source: Language, target: Language) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSLATION_SET_LANGUAGES, source, target),

  /** 设置翻译模式 */
  setTranslationMode: (mode: TranslationMode) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSLATION_SET_MODE, mode),

  // === 窗口控制 ===

  /** 移动字幕窗口（增量移动） */
  moveSubtitleWindow: (deltaX: number, deltaY: number) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW_MOVE_SUBTITLE, deltaX, deltaY),

  /** 调整字幕窗口大小 */
  resizeSubtitleWindow: (width: number, height: number) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW_RESIZE_SUBTITLE, width, height),

  /** 获取字幕窗口当前位置和大小 */
  getSubtitleBounds: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_SUBTITLE_BOUNDS),

  /** 重置字幕窗口到默认位置 */
  resetSubtitlePosition: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_RESET_SUBTITLE_POSITION),

  // === 事件监听 ===

  /** 监听应用状态变化 */
  onStateChanged: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on(IPC_CHANNELS.APP_STATE_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_STATE_CHANGED, listener)
  },

  /** 监听最终翻译结果 */
  onTranslationResult: (callback: (result: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: unknown) => callback(result)
    ipcRenderer.on(IPC_CHANNELS.TRANSLATION_RESULT, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSLATION_RESULT, listener)
  },

  /** 监听中间翻译结果（实时更新） */
  onTranslationInterim: (callback: (result: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: unknown) => callback(result)
    ipcRenderer.on(IPC_CHANNELS.TRANSLATION_INTERIM, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSLATION_INTERIM, listener)
  },

  /** 监听应用错误 */
  onError: (callback: (error: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error: unknown) => callback(error)
    ipcRenderer.on(IPC_CHANNELS.APP_ERROR, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_ERROR, listener)
  },
}

// 将 API 暴露到渲染进程的 window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 导出类型供 TypeScript 使用
export type ElectronAPI = typeof electronAPI
