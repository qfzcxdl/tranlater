// Google Cloud Speech-to-Text V2 流式识别服务
// 支持两种翻译模式：
// - 流式模式：使用 chirp_2 translationConfig 直接返回翻译（低延迟）
// - 精确模式：先转写再调用 Translate API 翻译（高准确度）

import * as speech from '@google-cloud/speech'
import { EventEmitter } from 'events'
import * as https from 'https'
import { Language, TranslationMode } from '../../shared/types'
import { AppError, ErrorCode } from '../utils/errors'

const LANGUAGE_MAP: Record<Language, string> = {
  [Language.CHINESE]: 'cmn-Hans-CN',
  [Language.ENGLISH]: 'en-US',
}

const TRANSLATE_LANG_MAP: Record<Language, string> = {
  [Language.CHINESE]: 'zh-CN',
  [Language.ENGLISH]: 'en',
}

const MAX_STREAM_DURATION_MS = 4.5 * 60 * 1000
const MIN_RESTART_INTERVAL_MS = 1000
const MAX_RETRIES = 5
const BASE_RETRY_DELAY_MS = 500


export interface SpeechServiceConfig {
  projectId: string
  sourceLanguage: Language
  targetLanguage: Language
  translationMode: TranslationMode
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

type GrpcStream = ReturnType<InstanceType<typeof speech.v2.SpeechClient>['_streamingRecognize']>

export class GoogleSpeechService extends EventEmitter {
  private client: InstanceType<typeof speech.v2.SpeechClient>
  private config: SpeechServiceConfig

  // 转写流（始终运行）
  private transcribeStream: GrpcStream | null = null
  // 翻译流（仅流式模式下运行）
  private translateStream: GrpcStream | null = null

  // 语音活动检测：最近一次未确认的 interim 结果
  private pendingInterimOriginal = ''
  private pendingInterimConfidence: number | undefined = undefined

  // 去重/替换：最近一次发送的 final 文本
  private lastEmittedFinalText = ''
  private lastEmittedFinalTime = 0
  private isUpdateMode = false  // 当前 final 是替换上一条而非新增


  private isStreaming = false
  private streamStartTime = 0
  private restartTimer: NodeJS.Timeout | null = null
  private retryCount = 0
  private pendingAudioChunks: Buffer[] = []

  // 流式模式下的结果同步缓冲
  private latestTranscript = ''
  private latestTranslation = ''
  private latestIsFinal = false
  private latestConfidence: number | undefined = undefined
  private flushTimer: NodeJS.Timeout | null = null
  private transcriptVersion = 0
  private translationVersion = 0

  // 精确模式下的翻译缓存
  private cachedAuthClient: { getAccessToken: () => Promise<{ token?: string | null }> } | null = null
  private cachedAccessToken: string | null = null
  private tokenExpiry = 0

  constructor(config: SpeechServiceConfig) {
    super()
    this.config = config
    const location = config.location || 'us-central1'

    this.client = new speech.v2.SpeechClient({
      apiEndpoint: `${location}-speech.googleapis.com`,
    })
  }

  setLanguages(source: Language, target: Language): void {
    const wasStreaming = this.isStreaming
    if (wasStreaming) this.stopStreaming()
    this.config.sourceLanguage = source
    this.config.targetLanguage = target
    if (wasStreaming) this.startStreaming()
  }

  setMode(mode: TranslationMode): void {
    const wasStreaming = this.isStreaming
    if (wasStreaming) this.stopStreaming()
    this.config.translationMode = mode
    if (wasStreaming) this.startStreaming()
  }

  startStreaming(): void {
    if (this.isStreaming) return
    this.retryCount = 0
    this.createStreams()
  }

  stopStreaming(): void {
    this.isStreaming = false
    this.clearRestartTimer()
    this.clearFlushTimer()
    this.destroyStreams()
    this.pendingAudioChunks = []
    this.latestTranscript = ''
    this.latestTranslation = ''
    this.pendingInterimOriginal = ''
    this.pendingInterimConfidence = undefined
    this.lastEmittedFinalText = ''
    this.lastEmittedFinalTime = 0
  }

  writeAudio(audioData: Buffer): void {
    if (!this.isStreaming) return

    // 写入转写流
    this.writeToStream(this.transcribeStream, audioData)

    // 流式模式下同时写入翻译流
    if (this.config.translationMode === TranslationMode.STREAMING && this.translateStream) {
      this.writeToStream(this.translateStream, audioData)
    }
  }

  private writeToStream(stream: GrpcStream | null, audioData: Buffer): void {
    if (stream) {
      try {
        stream.write({ audio: audioData })
      } catch {
        // 忽略写入失败
      }
    }
  }

  private createStreams(): void {
    this.destroyStreams()

    const location = this.config.location || 'us-central1'
    const sourceLanguage = LANGUAGE_MAP[this.config.sourceLanguage]
    const recognizerPath = `projects/${this.config.projectId}/locations/${location}/recognizers/_`

    try {
      // 创建转写流（无翻译，获取原始语言文本）
      this.transcribeStream = this.client._streamingRecognize()
      this.transcribeStream.write({
        recognizer: recognizerPath,
        streamingConfig: {
          config: {
            explicitDecodingConfig: {
              encoding: 'LINEAR16',
              sampleRateHertz: 16000,
              audioChannelCount: 1,
            },
            languageCodes: [sourceLanguage],
            model: 'chirp_2',
          },
          streamingFeatures: {
            interimResults: true,
            enableVoiceActivityEvents: true,
          },
        },
      })

      this.transcribeStream.on('data', (response: Record<string, unknown>) => {
        this.handleTranscribeResponse(response)
      })
      this.transcribeStream.on('error', (err: Error) => this.handleStreamError(err))
      this.transcribeStream.on('end', () => {
        if (this.isStreaming) this.scheduleRestart()
      })

      // 流式模式：额外创建翻译流
      if (this.config.translationMode === TranslationMode.STREAMING) {
        const targetLanguage = LANGUAGE_MAP[this.config.targetLanguage]
        this.translateStream = this.client._streamingRecognize()
        this.translateStream.write({
          recognizer: recognizerPath,
          streamingConfig: {
            config: {
              explicitDecodingConfig: {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                audioChannelCount: 1,
              },
              languageCodes: [sourceLanguage],
              model: 'chirp_2',
              translationConfig: {
                targetLanguage: targetLanguage,
              },
            },
            streamingFeatures: {
              interimResults: true,
              enableVoiceActivityEvents: true,
            },
          },
        })

        this.translateStream.on('data', (response: Record<string, unknown>) => {
          this.handleTranslateResponse(response)
        })
        this.translateStream.on('error', () => {
          // 翻译流错误不影响主转写流
        })
        this.translateStream.on('end', () => {
          // 翻译流结束时不需要重启，跟随转写流
        })
      }

      this.isStreaming = true
      this.streamStartTime = Date.now()
      this.retryCount = 0

      this.flushPendingAudio()
      this.scheduleAutoRestart()
    } catch (err) {
      console.error('[语音服务] 创建流失败:', err)
      this.handleStreamError(err as Error)
    }
  }

  /** 处理转写流的响应 */
  private handleTranscribeResponse(response: Record<string, unknown>): void {
    // 检查语音活动事件（用于快速断句）
    const speechEventType = response.speechEventType as string | undefined
    if (speechEventType === 'SPEECH_ACTIVITY_END') {
      this.handleSpeechEnd()
      return
    }

    const results = response.results as Array<Record<string, unknown>> | undefined
    if (!results || results.length === 0) return

    for (const result of results) {
      const alternatives = result.alternatives as Array<Record<string, unknown>> | undefined
      if (!alternatives || alternatives.length === 0) continue

      const transcript = (alternatives[0].transcript as string) || ''
      if (!transcript.trim()) continue

      const isFinal = result.isFinal === true
      const confidence = (alternatives[0].confidence as number) ?? undefined

      if (isFinal) {
        // 服务端返回 final 结果
        this.pendingInterimOriginal = ''

        // 检查是否与最近发送的 final 结果高度重叠
        // 如果重叠且新文本更长，用替换模式（update）而非新增
        const isOverlap = this.isOverlappingWithLastFinal(transcript)
        if (isOverlap) {
          console.log(`[去重] 检测到重叠: isOverlap=${isOverlap}, newLen=${transcript.length}, lastLen=${this.lastEmittedFinalText.length}, 动作=${transcript.length > this.lastEmittedFinalText.length ? 'replace' : 'skip'}`)
          // 仅当新文本更长时才替换，否则跳过
          if (transcript.length <= this.lastEmittedFinalText.length) {
            continue
          }
        }

        // 立即记录 final 文本用于后续去重（必须在 async 操作之前）
        this.lastEmittedFinalText = transcript
        this.lastEmittedFinalTime = Date.now()

        if (this.config.translationMode === TranslationMode.STREAMING) {
          this.latestTranscript = transcript
          this.latestIsFinal = true
          this.latestConfidence = confidence
          this.transcriptVersion++
          this.isUpdateMode = isOverlap
          this.tryFlushStreaming()
        } else {
          this.translateAndEmit(transcript, confidence, isOverlap)
        }
      } else {
        // interim 结果
        this.pendingInterimOriginal = transcript
        this.pendingInterimConfidence = confidence

        if (this.config.translationMode === TranslationMode.STREAMING) {
          this.latestTranscript = transcript
          this.latestIsFinal = false
          this.latestConfidence = confidence
          this.transcriptVersion++
          this.tryFlushStreaming()
        } else {
          this.emit('interim', {
            original: transcript,
            translated: '',
            sourceLanguage: this.config.sourceLanguage,
            targetLanguage: this.config.targetLanguage,
            isFinal: false,
            confidence,
          } as SpeechResult)
        }
      }
    }
  }

  /** 检查新的 final 文本是否与最近发送的 final 文本高度重叠 */
  private isOverlappingWithLastFinal(newText: string): boolean {
    if (!this.lastEmittedFinalText) return false
    // 超过 8 秒的不再去重
    if (Date.now() - this.lastEmittedFinalTime > 8000) return false

    const last = this.lastEmittedFinalText.trim().toLowerCase()
    const curr = newText.trim().toLowerCase()

    // 完全相同
    if (last === curr) return true

    // 新文本以旧文本开头（服务端补全）或旧文本以新文本开头
    if (curr.startsWith(last) || last.startsWith(curr)) return true

    // 计算共同前缀比例
    const minLen = Math.min(last.length, curr.length)
    if (minLen < 10) return false // 短文本不去重
    let commonLen = 0
    for (let i = 0; i < minLen; i++) {
      if (last[i] === curr[i]) commonLen++
      else break
    }
    // 共同前缀超过短文本的 70%
    if (commonLen / minLen >= 0.7) return true

    return false
  }

  /** 语音活动结束时，强制将 pending interim 作为 final 发送 */
  private handleSpeechEnd(): void {
    if (this.pendingInterimOriginal) {
      const text = this.pendingInterimOriginal
      const conf = this.pendingInterimConfidence
      this.pendingInterimOriginal = ''
      this.pendingInterimConfidence = undefined

      if (this.config.translationMode === TranslationMode.STREAMING) {
        this.latestTranscript = text
        this.latestIsFinal = true
        this.latestConfidence = conf
        this.clearFlushTimer()
        this.emitStreamingResult()
      } else {
        this.translateAndEmit(text, conf)
      }
    } else if (this.config.translationMode === TranslationMode.STREAMING) {
      if (this.latestTranscript && !this.latestIsFinal) {
        this.latestIsFinal = true
        this.clearFlushTimer()
        this.emitStreamingResult()
      }
    }
  }


  /** 处理翻译流的响应（流式模式） */
  private handleTranslateResponse(response: Record<string, unknown>): void {
    const results = response.results as Array<Record<string, unknown>> | undefined
    if (!results || results.length === 0) return

    for (const result of results) {
      const alternatives = result.alternatives as Array<Record<string, unknown>> | undefined
      if (!alternatives || alternatives.length === 0) continue

      const translation = (alternatives[0].transcript as string) || ''
      if (!translation.trim()) continue

      const isFinal = result.isFinal === true

      this.latestTranslation = translation
      if (isFinal) this.latestIsFinal = true
      this.translationVersion++
      this.tryFlushStreaming()
    }
  }

  /** 尝试同步发送转写+翻译结果 */
  private tryFlushStreaming(): void {
    this.clearFlushTimer()

    // 如果两个流都有新结果，立即同步发送
    if (this.latestTranscript && this.latestTranslation) {
      this.emitStreamingResult()
      return
    }

    // 只有一个流有结果，等待 80ms 让另一个流追上
    this.flushTimer = setTimeout(() => {
      this.emitStreamingResult()
    }, 80)
  }

  private emitStreamingResult(): void {
    const original = this.latestTranscript
    const translated = this.latestTranslation
    if (!original && !translated) return

    const isFinal = this.latestIsFinal

    const speechResult: SpeechResult = {
      original: original || translated,
      translated: translated || '',
      sourceLanguage: this.config.sourceLanguage,
      targetLanguage: this.config.targetLanguage,
      isFinal,
      confidence: this.latestConfidence,
    }

    if (isFinal && this.isUpdateMode) {
      this.emit('update', speechResult)
    } else {
      this.emit(isFinal ? 'result' : 'interim', speechResult)
    }

    if (isFinal) {
      // 记录最近 final 文本用于去重
      this.lastEmittedFinalText = original || translated
      this.lastEmittedFinalTime = Date.now()
      this.isUpdateMode = false

      this.latestTranscript = ''
      this.latestTranslation = ''
      this.latestIsFinal = false
      this.latestConfidence = undefined
      this.transcriptVersion = 0
      this.translationVersion = 0
    }
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  // === 精确模式翻译 ===

  private async translateAndEmit(originalText: string, confidence?: number, isUpdate = false): Promise<void> {
    // 替换模式不需要发送 interim，直接翻译
    if (!isUpdate) {
      // 先立即发送一个带原文的 interim 结果，让用户看到转写内容
      this.emit('interim', {
        original: originalText,
        translated: '',
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        isFinal: false,
        confidence,
      } as SpeechResult)
    }

    let translated = originalText
    try {
      translated = await this.translateText(originalText)
    } catch (err) {
      console.error('[语音服务] 翻译失败，使用原文:', err)
    }

    // 记录最近 final 文本用于去重
    this.lastEmittedFinalText = originalText
    this.lastEmittedFinalTime = Date.now()

    const result: SpeechResult = {
      original: originalText,
      translated,
      sourceLanguage: this.config.sourceLanguage,
      targetLanguage: this.config.targetLanguage,
      isFinal: true,
      confidence,
    }

    this.emit(isUpdate ? 'update' : 'result', result)
  }

  private async translateText(text: string): Promise<string> {
    const targetLang = TRANSLATE_LANG_MAP[this.config.targetLanguage]
    const sourceLang = TRANSLATE_LANG_MAP[this.config.sourceLanguage]
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || ''

    const postData = JSON.stringify({
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(postData)),
    }

    let path = '/language/translate/v2'

    if (apiKey) {
      path += `?key=${apiKey}`
    } else {
      const token = await this.getAccessToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    }

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'translation.googleapis.com',
        path,
        method: 'POST',
        headers,
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            const translatedText = parsed.data?.translations?.[0]?.translatedText
            if (translatedText) {
              resolve(translatedText)
            } else if (parsed.error) {
              console.error('[翻译API] 错误:', parsed.error.message || JSON.stringify(parsed.error))
              reject(new Error(parsed.error.message || 'Translation API error'))
            } else {
              resolve(text)
            }
          } catch {
            resolve(text)
          }
        })
      })

      req.on('error', (err) => {
        console.error('[翻译API] 网络错误:', err.message)
        reject(err)
      })
      req.write(postData)
      req.end()
    })
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.cachedAccessToken
    }

    try {
      if (!this.cachedAuthClient) {
        const { GoogleAuth } = await import('google-auth-library')
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-translation'],
        })
        this.cachedAuthClient = await auth.getClient()
      }

      const result = await this.cachedAuthClient.getAccessToken()
      this.cachedAccessToken = result.token || null
      this.tokenExpiry = Date.now() + 3500 * 1000
      return this.cachedAccessToken
    } catch {
      return null
    }
  }

  // === 流管理 ===

  private handleStreamError(err: Error): void {
    if (!this.isStreaming) return

    console.error(`[语音服务] 流错误: ${err.message}`)
    this.destroyStreams()

    this.retryCount++
    if (this.retryCount > MAX_RETRIES) {
      this.isStreaming = false
      this.emit('error', new AppError(
        ErrorCode.STREAM_ERROR,
        `语音识别流连续失败 ${MAX_RETRIES} 次: ${err.message}`,
        true
      ))
      return
    }

    const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1), 10000)
    setTimeout(() => { if (this.isStreaming) this.createStreams() }, delay)
  }

  private destroyStreams(): void {
    if (this.transcribeStream) {
      try { this.transcribeStream.end() } catch {}
      this.transcribeStream = null
    }
    if (this.translateStream) {
      try { this.translateStream.end() } catch {}
      this.translateStream = null
    }
  }

  private flushPendingAudio(): void {
    if (this.pendingAudioChunks.length === 0) return
    for (const chunk of this.pendingAudioChunks) {
      this.writeToStream(this.transcribeStream, chunk)
      if (this.config.translationMode === TranslationMode.STREAMING) {
        this.writeToStream(this.translateStream, chunk)
      }
    }
    this.pendingAudioChunks = []
  }

  private scheduleAutoRestart(): void {
    this.clearRestartTimer()
    this.restartTimer = setTimeout(() => {
      if (!this.isStreaming) return
      this.destroyStreams()
      this.createStreams()
    }, MAX_STREAM_DURATION_MS)
  }

  private scheduleRestart(): void {
    const elapsed = Date.now() - this.streamStartTime
    const delay = Math.max(MIN_RESTART_INTERVAL_MS - elapsed, 0)
    setTimeout(() => { if (this.isStreaming) this.createStreams() }, delay)
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  destroy(): void {
    this.stopStreaming()
    this.removeAllListeners()
    this.client.close()
  }
}
