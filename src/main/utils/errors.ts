// 错误定义和错误处理工具

export enum ErrorCode {
  // 权限错误
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  MICROPHONE_ACCESS_DENIED = 'MICROPHONE_ACCESS_DENIED',

  // 设备错误
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  BLACKHOLE_NOT_INSTALLED = 'BLACKHOLE_NOT_INSTALLED',
  AUDIO_STREAM_ERROR = 'AUDIO_STREAM_ERROR',

  // API 错误
  GOOGLE_API_ERROR = 'GOOGLE_API_ERROR',
  GOOGLE_API_TIMEOUT = 'GOOGLE_API_TIMEOUT',
  GOOGLE_AUTH_ERROR = 'GOOGLE_AUTH_ERROR',

  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',

  // 配置错误
  CONFIG_ERROR = 'CONFIG_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 创建麦克风权限错误
 */
export function createMicrophonePermissionError(): AppError {
  return new AppError(
    ErrorCode.MICROPHONE_ACCESS_DENIED,
    'Microphone access denied. Please grant permission in System Preferences.',
    false
  );
}

/**
 * 创建设备未找到错误
 */
export function createDeviceNotFoundError(deviceName: string): AppError {
  return new AppError(
    ErrorCode.DEVICE_NOT_FOUND,
    `Audio device "${deviceName}" not found.`,
    true
  );
}

/**
 * 创建 BlackHole 未安装错误
 */
export function createBlackHoleNotInstalledError(): AppError {
  return new AppError(
    ErrorCode.BLACKHOLE_NOT_INSTALLED,
    'BlackHole virtual audio device not installed. Please install from https://existential.audio/blackhole/',
    true
  );
}
