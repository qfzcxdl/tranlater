// 应用错误定义

/** 错误码枚举 */
export enum ErrorCode {
  // 权限相关
  MICROPHONE_DENIED = 'MICROPHONE_DENIED',
  SCREEN_RECORDING_DENIED = 'SCREEN_RECORDING_DENIED',

  // 配置相关
  CONFIG_ERROR = 'CONFIG_ERROR',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',

  // 音频相关
  AUDIO_CAPTURE_ERROR = 'AUDIO_CAPTURE_ERROR',
  NO_AUDIO_DEVICE = 'NO_AUDIO_DEVICE',

  // 翻译相关
  SPEECH_API_ERROR = 'SPEECH_API_ERROR',
  STREAM_ERROR = 'STREAM_ERROR',
  TRANSLATION_ERROR = 'TRANSLATION_ERROR',

  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/** 应用自定义错误类 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public recoverable: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
  }

  /** 序列化为可通过 IPC 传输的对象 */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
    }
  }
}

/** 创建权限错误的工厂方法 */
export function createPermissionError(type: 'microphone' | 'screen'): AppError {
  if (type === 'microphone') {
    return new AppError(
      ErrorCode.MICROPHONE_DENIED,
      '麦克风权限被拒绝，请在系统设置 > 隐私与安全性 > 麦克风中授权',
      false
    )
  }
  return new AppError(
    ErrorCode.SCREEN_RECORDING_DENIED,
    '屏幕录制权限未授权，请在系统设置 > 隐私与安全性 > 屏幕录制中授权（用于捕获系统音频）',
    false
  )
}

/** 创建凭证错误 */
export function createCredentialsError(): AppError {
  return new AppError(
    ErrorCode.MISSING_CREDENTIALS,
    '未配置 Google Cloud 凭证，请检查 .env 文件中的 GOOGLE_APPLICATION_CREDENTIALS 和 GOOGLE_CLOUD_PROJECT_ID',
    false
  )
}
