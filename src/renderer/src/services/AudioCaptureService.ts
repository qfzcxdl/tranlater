// 渲染进程音频捕获服务
// 使用 Web Audio API 捕获麦克风和系统音频，转换为 LINEAR16 PCM 发送到主进程

import { AudioSource } from '../../../shared/types'

const TARGET_SAMPLE_RATE = 16000
const CHANNELS = 1
// 减小缓冲区以降低延迟：1024 samples @ 44100Hz ≈ 23ms
const BUFFER_SIZE = 1024

interface CaptureContext {
  stream: MediaStream
  source: MediaStreamAudioSourceNode
}

export class AudioCaptureService {
  private audioContext: AudioContext | null = null
  private captures: Map<AudioSource, CaptureContext> = new Map()
  private processorNode: ScriptProcessorNode | null = null
  private isCapturing = false

  async startCapture(sources: AudioSource[]): Promise<void> {
    if (this.isCapturing) {
      await this.stopCapture()
    }

    this.audioContext = new AudioContext()

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    for (const source of sources) {
      const stream = await this.getMediaStream(source)
      const audioSource = this.audioContext!.createMediaStreamSource(stream)
      this.captures.set(source, { stream, source: audioSource })
    }

    if (this.captures.size === 0) {
      throw new Error('没有可用的音频源')
    }

    this.setupProcessingPipeline()
    this.isCapturing = true
  }

  async stopCapture(): Promise<void> {
    this.isCapturing = false

    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode.onaudioprocess = null
      this.processorNode = null
    }

    for (const [, ctx] of this.captures) {
      ctx.source.disconnect()
      ctx.stream.getTracks().forEach(track => track.stop())
    }
    this.captures.clear()

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
      this.audioContext = null
    }
  }

  private async getMediaStream(source: AudioSource): Promise<MediaStream> {
    if (source === AudioSource.MICROPHONE) {
      return this.getMicrophoneStream()
    } else {
      return this.getSystemAudioStream()
    }
  }

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

  private async getSystemAudioStream(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        width: 1,
        height: 1,
        frameRate: 1,
      },
    })

    stream.getVideoTracks().forEach(track => {
      track.stop()
      stream.removeTrack(track)
    })

    return stream
  }

  private setupProcessingPipeline(): void {
    if (!this.audioContext) return

    const nativeSampleRate = this.audioContext.sampleRate

    this.processorNode = this.audioContext.createScriptProcessor(BUFFER_SIZE, CHANNELS, CHANNELS)

    this.processorNode.onaudioprocess = (event) => {
      if (!this.isCapturing) return

      const inputData = event.inputBuffer.getChannelData(0)

      let samples: Float32Array
      if (nativeSampleRate !== TARGET_SAMPLE_RATE) {
        samples = downsample(inputData, nativeSampleRate, TARGET_SAMPLE_RATE)
      } else {
        samples = inputData
      }

      const pcmBuffer = float32ToLinear16(samples)
      const bufferCopy = new ArrayBuffer(pcmBuffer.byteLength)
      new Uint8Array(bufferCopy).set(new Uint8Array(pcmBuffer.buffer as ArrayBuffer))

      window.electronAPI.sendAudioData(bufferCopy)
    }

    if (this.captures.size === 1) {
      const ctx = this.captures.values().next().value!
      ctx.source.connect(this.processorNode)
    } else {
      const gainNode = this.audioContext.createGain()
      gainNode.gain.value = 1.0 / this.captures.size

      for (const ctx of this.captures.values()) {
        ctx.source.connect(gainNode)
      }
      gainNode.connect(this.processorNode)
    }

    this.processorNode.connect(this.audioContext.destination)
  }

  getIsCapturing(): boolean {
    return this.isCapturing
  }

  getActiveSources(): AudioSource[] {
    return Array.from(this.captures.keys())
  }
}

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

function float32ToLinear16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16Array
}
