// 渲染进程音频捕获服务
// 使用 Web Audio API 捕获麦克风和系统音频，转换为 LINEAR16 PCM 发送到主进程

import { AudioSource } from '../../../shared/types'

declare global {
  interface Window {
    electronAPI: {
      sendAudioData: (buffer: ArrayBuffer) => void
      [key: string]: unknown
    }
  }
}

/** PCM 音频参数（Google Speech V2 要求） */
const SAMPLE_RATE = 16000
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
  private mergerNode: ChannelMergerNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private isCapturing = false

  /** 开始捕获指定音频源 */
  async startCapture(sources: AudioSource[]): Promise<void> {
    if (this.isCapturing) {
      await this.stopCapture()
    }

    // 创建音频上下文（目标采样率 16kHz）
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })

    // 根据选择的音频源获取媒体流
    const capturePromises = sources.map(async (source) => {
      try {
        const stream = await this.getMediaStream(source)
        const audioSource = this.audioContext!.createMediaStreamSource(stream)
        this.captures.set(source, { stream, source: audioSource })
        console.log(`[音频捕获] ${source} 已连接`)
      } catch (err) {
        console.error(`[音频捕获] 无法获取 ${source}:`, err)
        throw err
      }
    })

    await Promise.all(capturePromises)

    if (this.captures.size === 0) {
      throw new Error('没有可用的音频源')
    }

    // 创建处理节点：将所有源混合并转换为 PCM
    this.setupProcessingPipeline()

    this.isCapturing = true
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

    if (this.mergerNode) {
      this.mergerNode.disconnect()
      this.mergerNode = null
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

    console.log('[音频捕获] 已停止')
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
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
  }

  /** 获取系统音频媒体流（通过 Electron 的 display media handler） */
  private async getSystemAudioStream(): Promise<MediaStream> {
    // 这会触发 main process 中注册的 setDisplayMediaRequestHandler
    // 在 macOS 上需要屏幕录制权限
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        // 需要提供 video 约束，但我们只需要音频
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

  /** 设置音频处理管道：混音 → PCM 转换 → 发送到主进程 */
  private setupProcessingPipeline(): void {
    if (!this.audioContext) return

    // 使用 ScriptProcessorNode 处理音频
    // （AudioWorklet 在 Electron 的 renderer 中可能有兼容性问题）
    this.processorNode = this.audioContext.createScriptProcessor(BUFFER_SIZE, CHANNELS, CHANNELS)

    this.processorNode.onaudioprocess = (event) => {
      if (!this.isCapturing) return

      const inputData = event.inputBuffer.getChannelData(0)

      // 将 Float32 转换为 LINEAR16 (Int16)
      const pcmBuffer = float32ToLinear16(inputData)

      // 发送到主进程
      window.electronAPI.sendAudioData(pcmBuffer.buffer)
    }

    // 如果有多个源，通过 GainNode 混合
    if (this.captures.size === 1) {
      // 单个源直接连接
      const ctx = this.captures.values().next().value!
      ctx.source.connect(this.processorNode)
    } else {
      // 多个源通过 GainNode 混合
      const gainNode = this.audioContext.createGain()
      gainNode.gain.value = 1.0 / this.captures.size // 避免混合后削波

      for (const ctx of this.captures.values()) {
        ctx.source.connect(gainNode)
      }

      gainNode.connect(this.processorNode)
    }

    // 连接到 destination（ScriptProcessorNode 需要连接输出才能工作）
    this.processorNode.connect(this.audioContext.destination)
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
 * 将 Float32Array 音频数据转换为 LINEAR16 (Int16) PCM
 * Google Speech API 要求 LINEAR16 编码
 */
function float32ToLinear16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    // 钳位到 [-1, 1] 范围
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    // 转换为 16 位整数
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16Array
}
