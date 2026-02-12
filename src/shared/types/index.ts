// 共享类型定义 - 主进程和渲染进程都会使用

export enum AppStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
}

export enum AudioSource {
  MICROPHONE = 'microphone',
  SYSTEM_AUDIO = 'system_audio',
}

export enum TranslationMode {
  END_TO_END = 'e2e',          // chirp_2 内置翻译
  STEP_BY_STEP = 'step',       // STT + Translation API
}

export interface AppState {
  status: AppStatus;
  audioSource: AudioSource;
  translationMode: TranslationMode;
  sourceLanguage: string;      // 'zh-CN' | 'en-US'
  targetLanguage: string;      // 'en' | 'zh'
  error?: {
    code: string;
    message: string;
  };
}

export interface DeviceAvailability {
  microphone: boolean;
  systemAudio: boolean;
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  isFinal: boolean;
  timestamp: number;
}

export interface SubtitleItem {
  id: string;
  original: string;
  translated: string;
  timestamp: number;
  isFinal: boolean;
}
