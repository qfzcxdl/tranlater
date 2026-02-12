// 音频捕获服务
// 负责管理麦克风和系统音频（BlackHole）的捕获

import portAudio from 'naudiodon';
import { AudioSource, AudioConfig, AudioChunk, AudioDeviceInfo } from '../types/audio';
import { AppError, createDeviceNotFoundError, createBlackHoleNotInstalledError } from '../utils/errors';

export class AudioCaptureService {
  private activeStream: any = null;
  private currentSource: AudioSource = AudioSource.MICROPHONE;
  private devices: Map<AudioSource, number> = new Map();
  private onAudioDataCallback?: (chunk: AudioChunk) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor() {
    this.detectDevices();
  }

  /**
   * 检测可用音频设备
   * 自动查找 BlackHole 设备
   */
  private detectDevices(): void {
    const devices = portAudio.getDevices() as AudioDeviceInfo[];

    console.log('Available audio devices:', devices.map(d => ({
      id: d.id,
      name: d.name,
      inputs: d.maxInputChannels,
      outputs: d.maxOutputChannels
    })));

    // 查找默认麦克风
    const defaultInputDevice = portAudio.getDefaultInputDevice();
    if (defaultInputDevice !== undefined) {
      this.devices.set(AudioSource.MICROPHONE, defaultInputDevice);
      console.log(`✓ Default microphone found: device ${defaultInputDevice}`);
    }

    // 查找 BlackHole (系统音频)
    const blackHoleIndex = devices.findIndex(d =>
      d.name.toLowerCase().includes('blackhole') && d.maxInputChannels > 0
    );

    if (blackHoleIndex !== -1) {
      this.devices.set(AudioSource.SYSTEM_AUDIO, devices[blackHoleIndex].id);
      console.log(`✓ BlackHole found: device ${devices[blackHoleIndex].id} (${devices[blackHoleIndex].name})`);
    } else {
      console.warn('⚠ BlackHole not found. System audio capture will be unavailable.');
    }
  }

  /**
   * 切换音频源
   * 重启音频流以应用新设备
   */
  async switchSource(source: AudioSource): Promise<void> {
    if (!this.devices.has(source)) {
      if (source === AudioSource.SYSTEM_AUDIO) {
        throw createBlackHoleNotInstalledError();
      }
      throw createDeviceNotFoundError(source);
    }

    const wasCapturing = this.activeStream !== null;

    if (wasCapturing) {
      await this.stop();
    }

    this.currentSource = source;
    console.log(`Audio source switched to: ${source}`);

    if (wasCapturing) {
      await this.start();
    }
  }

  /**
   * 开始捕获音频
   * 配置低延迟缓冲区（framesPerBuffer: 512 = ~32ms）
   */
  async start(): Promise<void> {
    const deviceId = this.devices.get(this.currentSource);
    if (deviceId === undefined) {
      throw createDeviceNotFoundError(this.currentSource);
    }

    const config: AudioConfig = {
      sampleRate: 16000,        // Google API 要求
      channels: 1,              // 单声道
      framesPerBuffer: 512,     // ~32ms 延迟
      deviceId,
    };

    console.log(`Starting audio capture from device ${deviceId} (${this.currentSource})...`);
    console.log('Audio config:', config);

    try {
      // 创建音频输入流
      this.activeStream = new portAudio.AudioIO({
        inOptions: {
          channelCount: config.channels,
          sampleFormat: portAudio.SampleFormat16Bit,
          sampleRate: config.sampleRate,
          deviceId: config.deviceId,
          closeOnError: false,
        }
      });

      // 监听音频数据
      this.activeStream.on('data', (buffer: Buffer) => {
        if (this.onAudioDataCallback) {
          this.onAudioDataCallback({
            buffer,
            timestamp: Date.now(),
          });
        }
      });

      // 监听错误
      this.activeStream.on('error', (error: Error) => {
        console.error('Audio stream error:', error);
        this.handleStreamError(error);
      });

      // 启动音频流
      this.activeStream.start();
      console.log('✓ Audio capture started successfully');

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  /**
   * 停止音频捕获
   */
  async stop(): Promise<void> {
    if (this.activeStream) {
      try {
        this.activeStream.quit();
        this.activeStream = null;
        console.log('✓ Audio capture stopped');
      } catch (error) {
        console.error('Error stopping audio stream:', error);
        throw error;
      }
    }
  }

  /**
   * 设置音频数据回调
   */
  onAudioData(callback: (chunk: AudioChunk) => void): void {
    this.onAudioDataCallback = callback;
  }

  /**
   * 设置错误回调
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * 获取当前音频源
   */
  getCurrentSource(): AudioSource {
    return this.currentSource;
  }

  /**
   * 检查音频源是否可用
   */
  isSourceAvailable(source: AudioSource): boolean {
    return this.devices.has(source);
  }

  /**
   * 获取所有可用设备信息
   */
  getAvailableDevices(): AudioDeviceInfo[] {
    return portAudio.getDevices() as AudioDeviceInfo[];
  }

  /**
   * 处理流错误
   */
  private handleStreamError(error: Error): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }

    // 尝试重启流
    console.log('Attempting to restart audio stream...');
    this.stop().then(() => {
      setTimeout(() => {
        this.start().catch(err => {
          console.error('Failed to restart audio stream:', err);
        });
      }, 1000);
    });
  }

  /**
   * 获取音频流状态
   */
  isCapturing(): boolean {
    return this.activeStream !== null;
  }
}
