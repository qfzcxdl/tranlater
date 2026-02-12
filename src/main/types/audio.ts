// 音频捕获服务类型定义

export enum AudioSource {
  MICROPHONE = 'microphone',
  SYSTEM_AUDIO = 'system_audio', // BlackHole
}

export interface AudioConfig {
  sampleRate: number;      // 16000 (Google API 要求)
  channels: number;        // 1 (单声道)
  framesPerBuffer: number; // 512 (约 32ms 延迟)
  deviceId?: number;
}

export interface AudioChunk {
  buffer: Buffer;
  timestamp: number;
}

export interface AudioDeviceInfo {
  id: number;
  name: string;
  maxInputChannels: number;
  maxOutputChannels: number;
  defaultSampleRate: number;
}
