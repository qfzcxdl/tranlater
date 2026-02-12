// 渲染进程全局类型声明

import type { AppState, AudioSource, DeviceAvailability, Language, TranslationMode, TranslationResult } from '../../shared/types'

declare global {
  interface Window {
    electronAPI: {
      // 应用控制
      startTranslation: () => Promise<boolean>
      stopTranslation: () => Promise<boolean>
      getAppState: () => Promise<AppState>
      checkDevices: () => Promise<DeviceAvailability>

      // 音频控制
      setAudioSources: (sources: AudioSource[]) => Promise<boolean>
      sendAudioData: (buffer: ArrayBuffer) => void

      // 语言和模式控制
      setLanguages: (source: Language, target: Language) => Promise<boolean>
      setTranslationMode: (mode: TranslationMode) => Promise<boolean>

      // 窗口控制
      moveSubtitleWindow: (deltaX: number, deltaY: number) => void
      resizeSubtitleWindow: (width: number, height: number) => void
      getSubtitleBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      resetSubtitlePosition: () => Promise<boolean>

      // 事件监听
      onStateChanged: (cb: (state: AppState) => void) => () => void
      onTranslationResult: (cb: (result: TranslationResult) => void) => () => void
      onTranslationInterim: (cb: (result: TranslationResult) => void) => () => void
      onError: (cb: (error: { code: string; message: string }) => void) => () => void
    }
  }
}

export {}
