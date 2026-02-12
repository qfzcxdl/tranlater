// 渲染进程全局类型声明

import type { AppState, AudioSource, DeviceAvailability, Language, TranslationResult } from '../../shared/types'

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

      // 语言控制
      setLanguages: (source: Language, target: Language) => Promise<boolean>

      // 事件监听
      onStateChanged: (cb: (state: AppState) => void) => () => void
      onTranslationResult: (cb: (result: TranslationResult) => void) => () => void
      onTranslationInterim: (cb: (result: TranslationResult) => void) => () => void
      onError: (cb: (error: { code: string; message: string }) => void) => () => void
    }
  }
}

export {}
