// 翻译服务类型定义

export enum TranslationMode {
  END_TO_END = 'e2e',      // chirp_2 内置翻译（延迟最低）
  STEP_BY_STEP = 'step',   // STT + Translation API（质量更可控）
}

export interface TranslationConfig {
  mode: TranslationMode;
  sourceLanguage: string;   // 'zh-CN' | 'en-US'
  targetLanguage: string;   // 'en' | 'zh'
  projectId: string;
  location?: string;        // 'global' 或 'us-central1' 等
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  isFinal: boolean;
  timestamp: number;
  confidence?: number;      // 0-1 的置信度
}

export interface StreamingConfig {
  encoding: 'LINEAR16';
  sampleRateHertz: 16000;
  languageCode: string;
  model: 'chirp_2';
  enableAutomaticPunctuation: boolean;
  interimResults: boolean;
  translationConfig?: {
    targetLanguage: string;
  };
}
