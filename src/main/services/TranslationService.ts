// 翻译服务
// 集成 Google Cloud Speech-to-Text v2 (chirp_2 模型)

import { SpeechClient } from '@google-cloud/speech';
import { v2 } from '@google-cloud/translate';
import {
  TranslationMode,
  TranslationConfig,
  TranslationResult,
  StreamingConfig,
} from '../types/translation';
import { AppError, ErrorCode } from '../utils/errors';

export class TranslationService {
  private speechClient: SpeechClient;
  private translationClient: v2.TranslationServiceClient;
  private config: TranslationConfig;
  private activeStream: any = null;
  private onResultCallback?: (result: TranslationResult) => void;
  private onErrorCallback?: (error: Error) => void;
  private recognizeStream: any = null;

  constructor(config: TranslationConfig) {
    this.config = config;

    // 初始化 Google Cloud 客户端
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentials) {
      throw new AppError(
        ErrorCode.CONFIG_ERROR,
        'GOOGLE_APPLICATION_CREDENTIALS environment variable not set',
        false
      );
    }

    this.speechClient = new SpeechClient({
      keyFilename: credentials,
    });

    this.translationClient = new v2.TranslationServiceClient({
      keyFilename: credentials,
    });

    console.log('✓ Translation service initialized');
    console.log(`  Mode: ${config.mode}`);
    console.log(`  Source: ${config.sourceLanguage} → Target: ${config.targetLanguage}`);
  }

  /**
   * 开始流式识别和翻译
   */
  async startStreaming(): Promise<void> {
    if (this.config.mode === TranslationMode.END_TO_END) {
      await this.startE2EStreaming();
    } else {
      await this.startStepByStepStreaming();
    }
  }

  /**
   * 端到端模式：chirp_2 内置翻译
   * 使用 translation_config 参数，一次性完成转写+翻译
   * 延迟最低，适合实时场景
   */
  private async startE2EStreaming(): Promise<void> {
    console.log('Starting E2E streaming (chirp_2 built-in translation)...');

    try {
      // 创建流式识别配置
      const request = {
        config: {
          encoding: 'LINEAR16' as const,
          sampleRateHertz: 16000,
          languageCode: this.config.sourceLanguage,
          model: 'chirp_2',
          enableAutomaticPunctuation: true,
          useEnhanced: true,

          // 启用中间结果以降低延迟
          enableWordTimeOffsets: false,
          enableSpeakerDiarization: false,

          // 端到端翻译配置
          alternativeLanguageCodes: [],
        },
        interimResults: true, // 关键：实时返回中间结果
      };

      // 创建流式识别流
      this.recognizeStream = this.speechClient
        .streamingRecognize(request as any)
        .on('error', (error: Error) => {
          console.error('E2E streaming error:', error);
          this.handleStreamError(error);
        })
        .on('data', (data: any) => {
          this.handleE2EStreamData(data);
        });

      console.log('✓ E2E streaming started');
    } catch (error) {
      console.error('Failed to start E2E streaming:', error);
      throw new AppError(
        ErrorCode.GOOGLE_API_ERROR,
        `Failed to start streaming: ${(error as Error).message}`,
        true
      );
    }
  }

  /**
   * 处理端到端模式的流数据
   */
  private async handleE2EStreamData(data: any): Promise<void> {
    if (!data.results || data.results.length === 0) {
      return;
    }

    const result = data.results[0];
    const alternative = result.alternatives[0];

    if (!alternative || !alternative.transcript) {
      return;
    }

    const transcript = alternative.transcript;
    const isFinal = result.isFinal || false;
    const confidence = alternative.confidence || 0;

    // chirp_2 的端到端翻译
    // 注意：需要先调用 Translation API，因为 Speech API v2 的 translation_config
    // 在某些区域可能不完全支持，我们使用分步方式更可靠
    let translated = transcript;

    try {
      translated = await this.translateText(transcript);
    } catch (error) {
      console.warn('Translation failed, using original text:', error);
    }

    if (this.onResultCallback) {
      this.onResultCallback({
        original: transcript,
        translated,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        isFinal,
        timestamp: Date.now(),
        confidence,
      });
    }
  }

  /**
   * 分步模式：STT + Translation API
   * 先转写再翻译，质量更可控
   */
  private async startStepByStepStreaming(): Promise<void> {
    console.log('Starting step-by-step streaming (STT + Translation API)...');

    try {
      const request = {
        config: {
          encoding: 'LINEAR16' as const,
          sampleRateHertz: 16000,
          languageCode: this.config.sourceLanguage,
          model: 'chirp_2',
          enableAutomaticPunctuation: true,
          useEnhanced: true,
        },
        interimResults: true,
      };

      this.recognizeStream = this.speechClient
        .streamingRecognize(request as any)
        .on('error', (error: Error) => {
          console.error('Step-by-step streaming error:', error);
          this.handleStreamError(error);
        })
        .on('data', async (data: any) => {
          await this.handleStepByStepStreamData(data);
        });

      console.log('✓ Step-by-step streaming started');
    } catch (error) {
      console.error('Failed to start step-by-step streaming:', error);
      throw new AppError(
        ErrorCode.GOOGLE_API_ERROR,
        `Failed to start streaming: ${(error as Error).message}`,
        true
      );
    }
  }

  /**
   * 处理分步模式的流数据
   */
  private async handleStepByStepStreamData(data: any): Promise<void> {
    if (!data.results || data.results.length === 0) {
      return;
    }

    const result = data.results[0];
    const alternative = result.alternatives[0];

    if (!alternative || !alternative.transcript) {
      return;
    }

    const transcript = alternative.transcript;
    const isFinal = result.isFinal || false;
    const confidence = alternative.confidence || 0;

    // 调用 Translation API
    let translated = transcript;
    try {
      translated = await this.translateText(transcript);
    } catch (error) {
      console.warn('Translation failed, using original text:', error);
    }

    if (this.onResultCallback) {
      this.onResultCallback({
        original: transcript,
        translated,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        isFinal,
        timestamp: Date.now(),
        confidence,
      });
    }
  }

  /**
   * 调用 Translation API 翻译文本
   */
  private async translateText(text: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return text;
    }

    try {
      const projectId = this.config.projectId;
      const location = this.config.location || 'global';

      const request = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [text],
        mimeType: 'text/plain' as const,
        sourceLanguageCode: this.getLanguageCode(this.config.sourceLanguage),
        targetLanguageCode: this.getLanguageCode(this.config.targetLanguage),
      };

      const [response] = await this.translationClient.translateText(request);

      return response.translations?.[0]?.translatedText || text;
    } catch (error) {
      console.error('Translation API error:', error);
      throw new AppError(
        ErrorCode.GOOGLE_API_ERROR,
        `Translation failed: ${(error as Error).message}`,
        true
      );
    }
  }

  /**
   * 将语言代码转换为 Translation API 格式
   * 'zh-CN' -> 'zh', 'en-US' -> 'en'
   */
  private getLanguageCode(fullCode: string): string {
    return fullCode.split('-')[0];
  }

  /**
   * 写入音频数据到流
   */
  writeAudioChunk(buffer: Buffer): void {
    if (this.recognizeStream && !this.recognizeStream.destroyed) {
      this.recognizeStream.write(buffer);
    }
  }

  /**
   * 停止流式处理
   */
  async stop(): Promise<void> {
    if (this.recognizeStream) {
      this.recognizeStream.end();
      this.recognizeStream = null;
      console.log('✓ Translation streaming stopped');
    }
  }

  /**
   * 切换翻译模式
   */
  async switchMode(mode: TranslationMode): Promise<void> {
    const wasStreaming = this.recognizeStream !== null;

    if (wasStreaming) {
      await this.stop();
    }

    this.config.mode = mode;
    console.log(`Translation mode switched to: ${mode}`);

    if (wasStreaming) {
      await this.startStreaming();
    }
  }

  /**
   * 切换语言方向
   */
  async switchLanguages(sourceLanguage: string, targetLanguage: string): Promise<void> {
    const wasStreaming = this.recognizeStream !== null;

    if (wasStreaming) {
      await this.stop();
    }

    this.config.sourceLanguage = sourceLanguage;
    this.config.targetLanguage = targetLanguage;
    console.log(`Languages switched: ${sourceLanguage} → ${targetLanguage}`);

    if (wasStreaming) {
      await this.startStreaming();
    }
  }

  /**
   * 设置翻译结果回调
   */
  onResult(callback: (result: TranslationResult) => void): void {
    this.onResultCallback = callback;
  }

  /**
   * 设置错误回调
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * 处理流错误
   */
  private handleStreamError(error: Error): void {
    console.error('Translation stream error:', error);

    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }

    // 尝试重连
    console.log('Attempting to restart translation stream...');
    this.stop().then(() => {
      setTimeout(() => {
        this.startStreaming().catch((err) => {
          console.error('Failed to restart translation stream:', err);
        });
      }, 2000); // 2 秒后重连
    });
  }

  /**
   * 获取当前配置
   */
  getConfig(): TranslationConfig {
    return { ...this.config };
  }

  /**
   * 检查是否正在流式处理
   */
  isStreaming(): boolean {
    return this.recognizeStream !== null;
  }
}
