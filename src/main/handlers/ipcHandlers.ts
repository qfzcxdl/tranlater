// IPC 消息处理器
// 连接渲染进程与主进程各服务

import { ipcMain, desktopCapturer, session } from 'electron'
import {
  AppStatus,
  AudioSource,
  Language,
  IPC_CHANNELS,
} from '../../shared/types'
import type { AppState, DeviceAvailability } from '../../shared/types'
import { WindowManager } from '../services/WindowManager'
import { GoogleSpeechService, SpeechResult } from '../services/GoogleSpeechService'
import { checkMicrophonePermission, checkScreenRecordingPermission, checkGoogleCloudCredentials } from '../utils/permissions'
import { AppError, ErrorCode, createCredentialsError, createPermissionError } from '../utils/errors'

/** 应用核心状态 */
let appState: AppState = {
  status: AppStatus.IDLE,
  audioSources: [AudioSource.MICROPHONE],
  sourceLanguage: Language.CHINESE,
  targetLanguage: Language.ENGLISH,
}

let speechService: GoogleSpeechService | null = null
let windowManager: WindowManager

/** 注册所有 IPC 处理器 */
export function registerIpcHandlers(wm: WindowManager): void {
  windowManager = wm

  // 注册系统音频捕获的 display media handler
  registerDisplayMediaHandler()

  // === 应用控制 ===

  ipcMain.handle(IPC_CHANNELS.APP_GET_STATE, () => {
    return appState
  })

  ipcMain.handle(IPC_CHANNELS.APP_CHECK_DEVICES, async (): Promise<DeviceAvailability> => {
    const micAvailable = await checkMicrophonePermission()
    const screenAvailable = checkScreenRecordingPermission()

    return {
      microphone: micAvailable,
      systemAudio: screenAvailable,
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_START, async () => {
    return startTranslation()
  })

  ipcMain.handle(IPC_CHANNELS.APP_STOP, () => {
    return stopTranslation()
  })

  // === 音频控制 ===

  ipcMain.handle(IPC_CHANNELS.AUDIO_SET_SOURCES, (_event, sources: AudioSource[]) => {
    if (appState.status === AppStatus.RUNNING) {
      throw new AppError(ErrorCode.CONFIG_ERROR, '请先停止翻译再切换音频源')
    }
    appState.audioSources = sources
    broadcastState()
    return true
  })

  // 接收来自渲染进程的音频数据
  ipcMain.on(IPC_CHANNELS.AUDIO_DATA, (_event, audioBuffer: ArrayBuffer) => {
    if (speechService && appState.status === AppStatus.RUNNING) {
      speechService.writeAudio(Buffer.from(audioBuffer))
    }
  })

  // === 翻译/语言控制 ===

  ipcMain.handle(IPC_CHANNELS.TRANSLATION_SET_LANGUAGES, (_event, source: Language, target: Language) => {
    appState.sourceLanguage = source
    appState.targetLanguage = target

    // 如果正在运行，更新语音服务的语言配置
    if (speechService) {
      speechService.setLanguages(source, target)
    }

    broadcastState()
    return true
  })

  console.log('[IPC] 所有处理器已注册')
}

/** 注册 display media handler 以支持系统音频捕获 */
function registerDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length > 0) {
        // 提供屏幕源并启用音频回环
        callback({ video: sources[0], audio: 'loopback' })
      } else {
        callback({})
      }
    }).catch(() => {
      callback({})
    })
  })
  console.log('[IPC] Display media handler 已注册（系统音频捕获）')
}

/** 开始翻译 */
async function startTranslation(): Promise<boolean> {
  if (appState.status === AppStatus.RUNNING) {
    console.warn('[IPC] 翻译已在运行中')
    return false
  }

  // 检查 Google Cloud 凭证
  const credentials = checkGoogleCloudCredentials()
  if (!credentials.valid) {
    const error = createCredentialsError()
    updateState({ status: AppStatus.ERROR, error: error.toJSON() })
    throw error
  }

  // 检查音频源权限
  if (appState.audioSources.includes(AudioSource.MICROPHONE)) {
    const micOk = await checkMicrophonePermission()
    if (!micOk) {
      const error = createPermissionError('microphone')
      updateState({ status: AppStatus.ERROR, error: error.toJSON() })
      throw error
    }
  }

  if (appState.audioSources.includes(AudioSource.SYSTEM_AUDIO)) {
    const screenOk = checkScreenRecordingPermission()
    if (!screenOk) {
      const error = createPermissionError('screen')
      updateState({ status: AppStatus.ERROR, error: error.toJSON() })
      throw error
    }
  }

  try {
    // 创建语音服务
    speechService = new GoogleSpeechService({
      projectId: credentials.projectId!,
      sourceLanguage: appState.sourceLanguage,
      targetLanguage: appState.targetLanguage,
      location: 'us-central1',
    })

    // 监听翻译结果
    speechService.on('result', (result: SpeechResult) => {
      const translationResult = {
        ...result,
        timestamp: Date.now(),
      }
      windowManager.sendToSubtitle(IPC_CHANNELS.TRANSLATION_RESULT, translationResult)
      windowManager.sendToControl(IPC_CHANNELS.TRANSLATION_RESULT, translationResult)
    })

    speechService.on('interim', (result: SpeechResult) => {
      const translationResult = {
        ...result,
        timestamp: Date.now(),
      }
      windowManager.sendToSubtitle(IPC_CHANNELS.TRANSLATION_INTERIM, translationResult)
    })

    speechService.on('error', (error: AppError) => {
      console.error('[IPC] 语音服务错误:', error.message)
      windowManager.broadcast(IPC_CHANNELS.APP_ERROR, error.toJSON())

      if (!error.recoverable) {
        stopTranslation()
      }
    })

    // 启动流式识别
    speechService.startStreaming()

    // 显示字幕窗口
    windowManager.showSubtitle()

    updateState({ status: AppStatus.RUNNING, error: undefined })
    console.log('[IPC] 翻译已启动')
    return true
  } catch (err) {
    const error = err instanceof AppError
      ? err
      : new AppError(ErrorCode.UNKNOWN_ERROR, `启动失败: ${(err as Error).message}`)

    updateState({ status: AppStatus.ERROR, error: error.toJSON() })
    throw error
  }
}

/** 停止翻译 */
function stopTranslation(): boolean {
  if (speechService) {
    speechService.destroy()
    speechService = null
  }

  windowManager.hideSubtitle()
  updateState({ status: AppStatus.IDLE, error: undefined })
  console.log('[IPC] 翻译已停止')
  return true
}

/** 更新状态并广播 */
function updateState(partial: Partial<AppState>): void {
  appState = { ...appState, ...partial }
  broadcastState()
}

/** 广播状态到所有窗口 */
function broadcastState(): void {
  windowManager.broadcast(IPC_CHANNELS.APP_STATE_CHANGED, appState)
}
