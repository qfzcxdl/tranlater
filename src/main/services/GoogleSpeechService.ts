// Google Cloud Speech-to-Text V2 流式识别服务
// 使用 chirp_2 模型实现实时语音转写和翻译

import { SpeechClient } from '@google-cloud/speech'
import type { google } from '@google-cloud/speech/build/protos/protos'
import { EventEmitter } from 'events'
import { Language } from '../../shared/types'
import { AppError, ErrorCode } from '../utils/errors'

type IStreamingRecognizeResponse = google.cloud.speech.v2.IStreamingRecognizeResponse

/** 语言代码到 chirp_2 支持的 BCP-47 代码映射 */
const LANGUAGE_MAP: Record<Language, string> = {
  [Language.CHINESE]: 'cmn-Hans-CN',
  [Language.ENGLISH]: 'en-US',
}

/** chirp_2 翻译目标语言代码映射 */
const TRANSLATION_TARGET_MAP: Record<Language, string> = {
  [Language.CHINESE]: 'cmn-Hans-CN',
  [Language.ENGLISH]: 'en-US',
}

/** 流式识别最大持续时间 (4.5 分钟，留 30 秒缓冲) */
const MAX_STREAM_DURATION_MS = 4.5 * 60 * 1000

/** 流重启之间的最小间隔 */
const MIN_RESTART_INTERVAL_MS = 1000

/** 错误重试最大次数 */
const MAX_RETRIES = 5

/** 重试基础延迟 (ms) */
const BASE_RETRY_DELAY_MS = 500

export interface SpeechServiceConfig {
  projectId: string
  sourceLanguage: Language
  targetLanguage: Language
  location?: string
}

export interface SpeechResult {
  original: string
  translated: string
  sourceLanguage: Language
  targetLanguage: Language
  isFinal: boolean
  confidence?: number
}

export class GoogleSpeechService extends EventEmitter {
  private client: SpeechClient
  private config: SpeechServiceConfig
  private recognizeStream: ReturnType<SpeechClient['_streamingRecognize']> | null = null
  private isStreaming = false
  private streamStartTime = 0
  private restartTimer: NodeJS.Timeout | null = null
  private retryCount = 0
  private pendingAudioChunks: Buffer[] = []

  constructor(config: SpeechServiceConfig) {
    super()
    this.config = config

    const location = config.location || 'us-central1'

    // 初始化 V2 客户端，使用区域端点
    this.client = new SpeechClient({
      apiEndpoint: `${location}-speech.googleapis.com`,
    })

    console.log(`[语音服务] 已初始化 - 区域: ${location}, 模型: chirp_2`)
    console.log(`[语音服务] ${LANGUAGE_MAP[config.sourceLanguage]} → ${TRANSLATION_TARGET_MAP[config.targetLanguage]}`)
  }

  /** 更新语言配置 */
  setLanguages(source: Language, target: Language): void {
    const wasStreaming = this.isStreaming
    if (wasStreaming) {
      this.stopStreaming()
    }

    this.config.sourceLanguage = source
    this.config.targetLanguage = target
    console.log(`[语音服务] 语言已更新: ${LANGUAGE_MAP[source]} → ${TRANSLATION_TARGET_MAP[target]}`)

    if (wasStreaming) {
      this.startStreaming()
    }
  }

  /** 开始流式识别 */
  startStreaming(): void {
    if (this.isStreaming) {
      console.warn('[语音服务] 流已在运行中')
      return
    }

    this.retryCount = 0
    this.createStream()
  }

  /** 停止流式识别 */
  stopStreaming(): void {
    this.isStreaming = false
    this.clearRestartTimer()
    this.destroyStream()
    this.pendingAudioChunks = []
    console.log('[语音服务] 流式识别已停止')
  }

  /** 写入音频数据块 */
  writeAudio(audioData: Buffer): void {
    if (!this.isStreaming) return

    if (this.recognizeStream) {
      try {
        this.recognizeStream.write({ audio: audioData })
      } catch (err) {
        console.error('[语音服务] 写入音频数据失败:', err)
        // 缓存数据，等待流重建后发送
        this.pendingAudioChunks.push(audioData)
        if (this.pendingAudioChunks.length > 100) {
          // 防止内存溢出，丢弃旧数据
          this.pendingAudioChunks = this.pendingAudioChunks.slice(-50)
        }
      }
    } else {
      this.pendingAudioChunks.push(audioData)
      if (this.pendingAudioChunks.length > 100) {
        this.pendingAudioChunks = this.pendingAudioChunks.slice(-50)
      }
    }
  }

  /** 创建新的识别流 */
  private createStream(): void {
    this.destroyStream()

    const location = this.config.location || 'us-central1'
    const sourceLanguage = LANGUAGE_MAP[this.config.sourceLanguage]
    const targetLanguage = TRANSLATION_TARGET_MAP[this.config.targetLanguage]

    try {
      // 创建 gRPC 双向流
      this.recognizeStream = this.client._streamingRecognize()

      // 发送初始配置消息
      const configRequest = {
        recognizer: `projects/${this.config.projectId}/locations/${location}/recognizers/_`,
        streamingConfig: {
          config: {
            autoDecodingConfig: {},
            languageCodes: [sourceLanguage],
            model: 'chirp_2',
            translationConfig: {
              targetLanguage: targetLanguage,
            },
          },
          streamingFeatures: {
            interimResults: true,
          },
        },
      }

      this.recognizeStream.write(configRequest)

      // 监听识别结果
      this.recognizeStream.on('data', (response: IStreamingRecognizeResponse) => {
        this.handleResponse(response)
      })

      // 监听错误
      this.recognizeStream.on('error', (err: Error) => {
        this.handleStreamError(err)
      })

      // 监听流结束
      this.recognizeStream.on('end', () => {
        console.log('[语音服务] 识别流已结束')
        if (this.isStreaming) {
          // 如果还在运行状态，自动重启
          this.scheduleRestart()
        }
      })

      this.isStreaming = true
      this.streamStartTime = Date.now()
      this.retryCount = 0

      // 发送缓存的音频数据
      this.flushPendingAudio()

      // 设置自动重启定时器（在 gRPC 5 分钟限制之前）
      this.scheduleAutoRestart()

      console.log('[语音服务] 流式识别已启动')
    } catch (err) {
      console.error('[语音服务] 创建识别流失败:', err)
      this.handleStreamError(err as Error)
    }
  }

  /** 处理识别响应 */
  private handleResponse(response: IStreamingRecognizeResponse): void {
    if (!response.results || response.results.length === 0) return

    for (const result of response.results) {
      if (!result.alternatives || result.alternatives.length === 0) continue

      const alternative = result.alternatives[0]
      const isFinal = result.isFinal === true

      // 原始转写文本
      const original = alternative.transcript || ''
      if (!original.trim()) continue

      // 翻译文本（来自 chirp_2 内置翻译）
      let translated = ''
      if (
        result.alternatives &&
        result.alternatives.length > 0 &&
        (result.alternatives[0] as Record<string, unknown>).translation
      ) {
        translated = ((result.alternatives[0] as Record<string, unknown>).translation as string) || ''
      }

      // 如果没有内置翻译结果，使用原始文本作为占位
      if (!translated) {
        translated = original
      }

      const speechResult: SpeechResult = {
        original,
        translated,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        isFinal,
        confidence: alternative.confidence ?? undefined,
      }

      this.emit(isFinal ? 'result' : 'interim', speechResult)
    }
  }

  /** 处理流错误 */
  private handleStreamError(err: Error): void {
    console.error(`[语音服务] 流错误: ${err.message}`)

    this.destroyStream()

    if (!this.isStreaming) return

    this.retryCount++
    if (this.retryCount > MAX_RETRIES) {
      console.error(`[语音服务] 超过最大重试次数 (${MAX_RETRIES})，停止服务`)
      this.isStreaming = false
      this.emit('error', new AppError(
        ErrorCode.STREAM_ERROR,
        `语音识别流连续失败 ${MAX_RETRIES} 次: ${err.message}`,
        true
      ))
      return
    }

    // 指数退避重试
    const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1), 10000)
    console.log(`[语音服务] ${delay}ms 后重试 (第 ${this.retryCount}/${MAX_RETRIES} 次)`)

    setTimeout(() => {
      if (this.isStreaming) {
        this.createStream()
      }
    }, delay)
  }

  /** 销毁当前流 */
  private destroyStream(): void {
    if (this.recognizeStream) {
      try {
        this.recognizeStream.end()
      } catch {
        // 忽略关闭时的错误
      }
      this.recognizeStream = null
    }
  }

  /** 刷新缓存的音频数据 */
  private flushPendingAudio(): void {
    if (this.pendingAudioChunks.length === 0 || !this.recognizeStream) return

    console.log(`[语音服务] 刷新 ${this.pendingAudioChunks.length} 个缓存音频块`)
    for (const chunk of this.pendingAudioChunks) {
      try {
        this.recognizeStream.write({ audio: chunk })
      } catch {
        break
      }
    }
    this.pendingAudioChunks = []
  }

  /** 设置自动重启定时器 */
  private scheduleAutoRestart(): void {
    this.clearRestartTimer()

    this.restartTimer = setTimeout(() => {
      if (!this.isStreaming) return

      const elapsed = Date.now() - this.streamStartTime
      console.log(`[语音服务] 自动重启流 (已运行 ${Math.round(elapsed / 1000)}s)`)

      this.destroyStream()
      this.createStream()
    }, MAX_STREAM_DURATION_MS)
  }

  /** 调度延迟重启 */
  private scheduleRestart(): void {
    const elapsed = Date.now() - this.streamStartTime
    const delay = Math.max(MIN_RESTART_INTERVAL_MS - elapsed, 0)

    setTimeout(() => {
      if (this.isStreaming) {
        this.createStream()
      }
    }, delay)
  }

  /** 清除重启定时器 */
  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  /** 销毁服务，释放资源 */
  destroy(): void {
    this.stopStreaming()
    this.removeAllListeners()
    this.client.close()
    console.log('[语音服务] 已销毁')
  }
}
