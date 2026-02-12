// 渲染进程音频捕获服务
// 使用 Web Audio API 捕获麦克风和系统音频，转换为 LINEAR16 PCM 发送到主进程

import { AudioSource } from '../../../shared/types'

/** Google Speech V2 要求的音频参数 */
const TARGET_SAMPLE_RATE = 16000
const CHANNELS = 1
const BUFFER_SIZE = 4096

/** 单个音频源的捕获上下文 */
interface CaptureContext {
  stream: MediaStream
  source: MediaStreamAudioSourceNode
}

export class AudioCaptureService {
  private audioContext: AudioContext | null = null
  private captures: Map<AudioSource, CaptureContext> = new Map()
  private processorNode: ScriptProcessorNode | null = null
  private isCapturing = false
  private chunkCount = 0

  /** 开始捕获指定音频源 */
  async startCapture(sources: AudioSource[]): Promise<void> {
    if (this.isCapturing) {
      await this.stopCapture()
    }

    console.log(`[音频捕获] 准备启动, 源: ${sources.join(', ')}`)

    // 创建音频上下文 - 使用默认采样率，后续手动降采样
    // 注意：某些浏览器不支持非标准采样率的 AudioContext
    this.audioContext = new AudioContext()
    console.log(`[音频捕获] AudioContext 创建成功, 采样率: ${this.audioContext.sampleRate}Hz, 状态: ${this.audioContext.state}`)

    // 确保 AudioContext 已启动（某些浏览器需要用户交互后才能启动）
    if (this.audioContext.state === 'suspended') {
      console.log('[音频捕获] AudioContext 处于 suspended 状态，尝试 resume...')
      await this.audioContext.resume()
      console.log(`[音频捕获] AudioContext resume 后状态: ${this.audioContext.state}`)
    }

    // 根据选择的音频源获取媒体流
    for (const source of sources) {
      try {
        console.log(`[音频捕获] 正在获取 ${source} 媒体流...`)
        const stream = await this.getMediaStream(source)
        const tracks = stream.getAudioTracks()
        console.log(`[音频捕获] ${source} 媒体流获取成功, 音频轨道数: ${tracks.length}`)
        if (tracks.length > 0) {
          console.log(`[音频捕获] 轨道信息: ${tracks[0].label}, enabled=${tracks[0].enabled}, muted=${tracks[0].muted}`)
        }
        const audioSource = this.audioContext!.createMediaStreamSource(stream)
        this.captures.set(source, { stream, source: audioSource })
        console.log(`[音频捕获] ${source} 已连接到 AudioContext`)
      } catch (err) {
        console.error(`[音频捕获] 无法获取 ${source}:`, err)
        throw err
      }
    }

    if (this.captures.size === 0) {
      throw new Error('没有可用的音频源')
    }

    // 创建处理节点：将所有源混合并转换为 PCM
    this.setupProcessingPipeline()

    this.isCapturing = true
    this.chunkCount = 0
    console.log(`[音频捕获] 已启动，活跃源: ${Array.from(this.captures.keys()).join(', ')}`)
  }

  /** 停止捕获 */
  async stopCapture(): Promise<void> {
    this.isCapturing = false

    // 断开处理节点
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode.onaudioprocess = null
      this.processorNode = null
    }

    // 停止所有媒体流
    for (const [source, ctx] of this.captures) {
      ctx.source.disconnect()
      ctx.stream.getTracks().forEach(track => track.stop())
      console.log(`[音频捕获] ${source} 已断开`)
    }
    this.captures.clear()

    // 关闭音频上下文
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
      this.audioContext = null
    }

    console.log(`[音频捕获] 已停止, 总共发送 ${this.chunkCount} 个音频块`)
  }

  /** 获取指定源的媒体流 */
  private async getMediaStream(source: AudioSource): Promise<MediaStream> {
    if (source === AudioSource.MICROPHONE) {
      return this.getMicrophoneStream()
    } else {
      return this.getSystemAudioStream()
    }
  }

  /** 获取麦克风媒体流 */
  private async getMicrophoneStream(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: CHANNELS,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
  }

  /** 获取系统音频媒体流（通过 Electron 的 display media handler） */
  private async getSystemAudioStream(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        width: 1,
        height: 1,
        frameRate: 1,
      },
    })

    // 移除视频轨道（我们只需要音频）
    stream.getVideoTracks().forEach(track => {
      track.stop()
      stream.removeTrack(track)
    })

    return stream
  }

  /** 设置音频处理管道：混音 → 降采样 → PCM 转换 → 发送到主进程 */
  private setupProcessingPipeline(): void {
    if (!this.audioContext) return

    const nativeSampleRate = this.audioContext.sampleRate

    // 使用 ScriptProcessorNode 处理音频
    this.processorNode = this.audioContext.createScriptProcessor(BUFFER_SIZE, CHANNELS, CHANNELS)

    this.processorNode.onaudioprocess = (event) => {
      if (!this.isCapturing) return

      const inputData = event.inputBuffer.getChannelData(0)

      // 如果需要降采样（从硬件采样率降到 16kHz）
      let samples: Float32Array
      if (nativeSampleRate !== TARGET_SAMPLE_RATE) {
        samples = downsample(inputData, nativeSampleRate, TARGET_SAMPLE_RATE)
      } else {
        samples = inputData
      }

      // 将 Float32 转换为 LINEAR16 (Int16)
      const pcmBuffer = float32ToLinear16(samples)

      // 创建 ArrayBuffer 副本（原始 buffer 可能在下一帧被重用）
      const bufferCopy = pcmBuffer.buffer.slice(0)

      // 发送到主进程
      window.electronAPI.sendAudioData(bufferCopy)

      this.chunkCount++
      if (this.chunkCount % 100 === 1) {
        console.log(`[音频捕获] 已发送 ${this.chunkCount} 个音频块 (${bufferCopy.byteLength} bytes/块)`)
      }
    }

    // 连接音频源到处理器
    if (this.captures.size === 1) {
      const ctx = this.captures.values().next().value!
      ctx.source.connect(this.processorNode)
    } else {
      // 多源混合
      const gainNode = this.audioContext.createGain()
      gainNode.gain.value = 1.0 / this.captures.size

      for (const ctx of this.captures.values()) {
        ctx.source.connect(gainNode)
      }
      gainNode.connect(this.processorNode)
    }

    // 连接到 destination（ScriptProcessorNode 需要连接输出才能触发 onaudioprocess）
    this.processorNode.connect(this.audioContext.destination)

    console.log(`[音频捕获] 处理管道已建立: 原始采样率=${nativeSampleRate}Hz, 目标=${TARGET_SAMPLE_RATE}Hz`)
  }

  /** 当前是否正在捕获 */
  getIsCapturing(): boolean {
    return this.isCapturing
  }

  /** 获取活跃的音频源列表 */
  getActiveSources(): AudioSource[] {
    return Array.from(this.captures.keys())
  }
}

/**
 * 简单线性插值降采样
 */
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer

  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, buffer.length - 1)
    const frac = srcIndex - srcIndexFloor

    result[i] = buffer[srcIndexFloor] * (1 - frac) + buffer[srcIndexCeil] * frac
  }

  return result
}

/**
 * 将 Float32Array 音频数据转换为 LINEAR16 (Int16) PCM
 * Google Speech API 要求 LINEAR16 编码
 */
function float32ToLinear16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16Array
}
