// Google Cloud Speech-to-Text V2 流式识别服务
// 使用 chirp_2 模型实现实时语音转写
// 翻译使用 Google Cloud Translation API 对最终结果进行翻译

import * as speech from '@google-cloud/speech'
import { EventEmitter } from 'events'
import * as https from 'https'
import { Language } from '../../shared/types'
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
  private client: InstanceType<typeof speech.v2.SpeechClient>
  private config: SpeechServiceConfig
  private recognizeStream: ReturnType<InstanceType<typeof speech.v2.SpeechClient>['_streamingRecognize']> | null = null
  private isStreaming = false
  private streamStartTime = 0
  private restartTimer: NodeJS.Timeout | null = null
  private retryCount = 0
  private pendingAudioChunks: Buffer[] = []
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

  startStreaming(): void {
    if (this.isStreaming) return
    this.retryCount = 0
    this.createStream()
  }

  stopStreaming(): void {
    this.isStreaming = false
    this.clearRestartTimer()
    this.destroyStream()
    this.pendingAudioChunks = []
  }

  writeAudio(audioData: Buffer): void {
    if (!this.isStreaming) return

    if (this.recognizeStream) {
      try {
        this.recognizeStream.write({ audio: audioData })
      } catch {
        this.pendingAudioChunks.push(audioData)
        if (this.pendingAudioChunks.length > 100) {
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

  private createStream(): void {
    this.destroyStream()

    const location = this.config.location || 'us-central1'
    const sourceLanguage = LANGUAGE_MAP[this.config.sourceLanguage]

    try {
      this.recognizeStream = this.client._streamingRecognize()

      const configRequest = {
        recognizer: `projects/${this.config.projectId}/locations/${location}/recognizers/_`,
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
          },
        },
      }

      this.recognizeStream.write(configRequest)

      this.recognizeStream.on('data', (response: Record<string, unknown>) => {
        this.handleResponse(response)
      })

      this.recognizeStream.on('error', (err: Error) => {
        this.handleStreamError(err)
      })

      this.recognizeStream.on('end', () => {
        if (this.isStreaming) this.scheduleRestart()
      })

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

  private handleResponse(response: Record<string, unknown>): void {
    const results = response.results as Array<Record<string, unknown>> | undefined
    if (!results || results.length === 0) return

    for (const result of results) {
      const alternatives = result.alternatives as Array<Record<string, unknown>> | undefined
      if (!alternatives || alternatives.length === 0) continue

      const alternative = alternatives[0]
      const isFinal = result.isFinal === true
      const original = (alternative.transcript as string) || ''
      if (!original.trim()) continue

      const confidence = (alternative.confidence as number) ?? undefined

      if (isFinal) {
        this.translateAndEmit(original, confidence)
      } else {
        const speechResult: SpeechResult = {
          original,
          translated: '',
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage: this.config.targetLanguage,
          isFinal: false,
          confidence,
        }
        this.emit('interim', speechResult)
      }
    }
  }

  private async translateAndEmit(originalText: string, confidence?: number): Promise<void> {
    try {
      const translated = await this.translateText(originalText)

      const speechResult: SpeechResult = {
        original: originalText,
        translated,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        isFinal: true,
        confidence,
      }
      this.emit('result', speechResult)
    } catch {
      const speechResult: SpeechResult = {
        original: originalText,
        translated: originalText,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        isFinal: true,
        confidence,
      }
      this.emit('result', speechResult)
    }
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

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(postData)),
    }

    let path = '/language/translate/v2'

    if (apiKey) {
      path += `?key=${apiKey}`
    } else {
      // 使用服务账号 access token（带缓存）
      const token = await this.getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    return new Promise((resolve) => {
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
            resolve(parsed.data?.translations?.[0]?.translatedText || text)
          } catch {
            resolve(text)
          }
        })
      })

      req.on('error', () => resolve(text))
      req.write(postData)
      req.end()
    })
  }

  /** 获取 access token（带缓存，token 有效期内不重复获取） */
  private async getAccessToken(): Promise<string | null> {
    // token 在过期前 60 秒刷新
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
      // access token 通常有效期为 1 小时
      this.tokenExpiry = Date.now() + 3500 * 1000
      return this.cachedAccessToken
    } catch {
      return null
    }
  }

  private handleStreamError(err: Error): void {
    if (!this.isStreaming) return

    console.error(`[语音服务] 流错误: ${err.message}`)
    this.destroyStream()

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
    setTimeout(() => { if (this.isStreaming) this.createStream() }, delay)
  }

  private destroyStream(): void {
    if (this.recognizeStream) {
      try { this.recognizeStream.end() } catch {}
      this.recognizeStream = null
    }
  }

  private flushPendingAudio(): void {
    if (this.pendingAudioChunks.length === 0 || !this.recognizeStream) return
    for (const chunk of this.pendingAudioChunks) {
      try { this.recognizeStream.write({ audio: chunk }) } catch { break }
    }
    this.pendingAudioChunks = []
  }

  private scheduleAutoRestart(): void {
    this.clearRestartTimer()
    this.restartTimer = setTimeout(() => {
      if (!this.isStreaming) return
      this.destroyStream()
      this.createStream()
    }, MAX_STREAM_DURATION_MS)
  }

  private scheduleRestart(): void {
    const elapsed = Date.now() - this.streamStartTime
    const delay = Math.max(MIN_RESTART_INTERVAL_MS - elapsed, 0)
    setTimeout(() => { if (this.isStreaming) this.createStream() }, delay)
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
