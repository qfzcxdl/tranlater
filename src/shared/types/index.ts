// 共享类型定义 - 主进程和渲染进程通用

/** 应用运行状态 */
export enum AppStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
}

/** 音频来源类型 */
export enum AudioSource {
  MICROPHONE = 'microphone',
  SYSTEM_AUDIO = 'system_audio',
}

/** 支持的语言 */
export enum Language {
  CHINESE = 'cmn-Hans-CN',
  ENGLISH = 'en-US',
}

/** 语言显示名称映射 */
export const LanguageLabels: Record<Language, string> = {
  [Language.CHINESE]: '中文',
  [Language.ENGLISH]: 'English',
}

/** 翻译模式 */
export enum TranslationMode {
  /** 精确模式：先转写再调用 Translate API 翻译，高准确度 */
  ACCURATE = 'accurate',
  /** 流式模式：使用 chirp_2 内置翻译，低延迟 */
  STREAMING = 'streaming',
}

export const TranslationModeLabels: Record<TranslationMode, string> = {
  [TranslationMode.ACCURATE]: '精确（高准确度）',
  [TranslationMode.STREAMING]: '流式（低延迟）',
}

/** 应用全局状态 */
export interface AppState {
  status: AppStatus
  audioSources: AudioSource[]
  sourceLanguage: Language
  targetLanguage: Language
  translationMode: TranslationMode
  error?: {
    code: string
    message: string
  }
}

/** 音频设备可用性 */
export interface DeviceAvailability {
  microphone: boolean
  systemAudio: boolean
}

/** 翻译结果（从主进程发送到渲染进程） */
export interface TranslationResult {
  original: string
  translated: string
  sourceLanguage: Language
  targetLanguage: Language
  isFinal: boolean
  timestamp: number
  confidence?: number
}

/** 字幕显示条目 */
export interface SubtitleItem {
  id: string
  original: string
  translated: string
  timestamp: number
  isFinal: boolean
}

/** IPC 通道名称常量 */
export const IPC_CHANNELS = {
  // 应用控制
  APP_START: 'app:start',
  APP_STOP: 'app:stop',
  APP_GET_STATE: 'app:getState',
  APP_CHECK_DEVICES: 'app:checkDevices',
  APP_STATE_CHANGED: 'app:stateChanged',
  APP_ERROR: 'app:error',

  // 音频控制
  AUDIO_SET_SOURCES: 'audio:setSources',
  AUDIO_DATA: 'audio:data',
  AUDIO_GET_DEVICES: 'audio:getDevices',

  // 翻译控制
  TRANSLATION_SET_LANGUAGES: 'translation:setLanguages',
  TRANSLATION_SET_MODE: 'translation:setMode',
  TRANSLATION_RESULT: 'translation:result',
  TRANSLATION_INTERIM: 'translation:interim',

  // 窗口控制
  WINDOW_MOVE_SUBTITLE: 'window:moveSubtitle',
  WINDOW_RESIZE_SUBTITLE: 'window:resizeSubtitle',
  WINDOW_GET_SUBTITLE_BOUNDS: 'window:getSubtitleBounds',
  WINDOW_RESET_SUBTITLE_POSITION: 'window:resetSubtitlePosition',
} as const
