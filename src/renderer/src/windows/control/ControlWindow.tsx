// 控制面板窗口组件
// 提供语言选择、音频源选择、开始/停止翻译等功能

import React, { useState, useEffect, useCallback } from 'react'
import {
  AppStatus,
  AudioSource,
  Language,
  LanguageLabels,
  TranslationMode,
  TranslationModeLabels,
} from '../../../../shared/types'
import type { AppState, DeviceAvailability } from '../../../../shared/types'
import { AudioCaptureService } from '../../services/AudioCaptureService'
import './control.css'

// 音频捕获服务单例
const audioCaptureService = new AudioCaptureService()

export const ControlWindow: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE)
  const [sourceLanguage, setSourceLanguage] = useState<Language>(Language.CHINESE)
  const [targetLanguage, setTargetLanguage] = useState<Language>(Language.ENGLISH)
  const [audioSources, setAudioSources] = useState<AudioSource[]>([AudioSource.MICROPHONE])
  const [translationMode, setTranslationMode] = useState<TranslationMode>(TranslationMode.STREAMING)
  const [devices, setDevices] = useState<DeviceAvailability>({ microphone: true, systemAudio: false })
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)

  // 初始化：获取应用状态和设备信息
  useEffect(() => {
    const init = async () => {
      try {
        const [state, deviceInfo] = await Promise.all([
          window.electronAPI.getAppState(),
          window.electronAPI.checkDevices(),
        ])
        setStatus(state.status)
        setSourceLanguage(state.sourceLanguage)
        setTargetLanguage(state.targetLanguage)
        setAudioSources(state.audioSources)
        setTranslationMode(state.translationMode)
        setDevices(deviceInfo)

        // 检查字幕窗口可见状态
        const visible = await window.electronAPI.getSubtitleVisible()
        setSubtitleVisible(visible)
      } catch (err) {
        console.error('初始化失败:', err)
      }
    }
    init()

    // 监听状态变化
    const unsubState = window.electronAPI.onStateChanged((state: AppState) => {
      setStatus(state.status)
      setAudioSources(state.audioSources)
      setSourceLanguage(state.sourceLanguage)
      setTargetLanguage(state.targetLanguage)
      setTranslationMode(state.translationMode)
      if (state.error) {
        setErrorMessage(state.error.message)
      } else {
        setErrorMessage('')
      }
    })

    // 监听错误
    const unsubError = window.electronAPI.onError((error) => {
      setErrorMessage(error.message)
      setIsLoading(false)
    })

    return () => {
      unsubState()
      unsubError()
    }
  }, [])

  // 切换翻译状态
  const handleToggle = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      if (status === AppStatus.RUNNING) {
        // 停止：先停止音频捕获，再停止翻译
        await audioCaptureService.stopCapture()
        await window.electronAPI.stopTranslation()
      } else {
        // 启动：先启动翻译服务，再开始音频捕获
        await window.electronAPI.startTranslation()
        await audioCaptureService.startCapture(audioSources)
        setSubtitleVisible(true)
      }
    } catch (err) {
      let message = err instanceof Error ? err.message : '操作失败'
      // 用户友好的权限错误提示
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        message = '麦克风权限被拒绝。请在系统设置 > 隐私与安全性 > 麦克风中，为当前应用开启权限后重试。'
      }
      setErrorMessage(message)
      // 确保出错时停止音频捕获和翻译服务
      await audioCaptureService.stopCapture().catch(() => {})
      await window.electronAPI.stopTranslation().catch(() => {})
    } finally {
      setIsLoading(false)
    }
  }, [status, audioSources])

  // 切换音频源
  const handleAudioSourceToggle = useCallback(async (source: AudioSource) => {
    if (status === AppStatus.RUNNING) return

    const newSources = audioSources.includes(source)
      ? audioSources.filter(s => s !== source)
      : [...audioSources, source]

    // 至少保留一个音频源
    if (newSources.length === 0) return

    try {
      await window.electronAPI.setAudioSources(newSources)
      setAudioSources(newSources)
    } catch (err) {
      console.error('切换音频源失败:', err)
    }
  }, [status, audioSources])

  // 交换语言方向
  const handleSwapLanguages = useCallback(async () => {
    if (status === AppStatus.RUNNING) return

    const newSource = targetLanguage
    const newTarget = sourceLanguage

    try {
      await window.electronAPI.setLanguages(newSource, newTarget)
      setSourceLanguage(newSource)
      setTargetLanguage(newTarget)
    } catch (err) {
      console.error('切换语言失败:', err)
    }
  }, [status, sourceLanguage, targetLanguage])

  // 设置源语言
  const handleSourceLanguageChange = useCallback(async (lang: Language) => {
    if (status === AppStatus.RUNNING) return
    // 如果源和目标相同，自动交换
    const newTarget = lang === targetLanguage
      ? (lang === Language.CHINESE ? Language.ENGLISH : Language.CHINESE)
      : targetLanguage

    try {
      await window.electronAPI.setLanguages(lang, newTarget)
      setSourceLanguage(lang)
      setTargetLanguage(newTarget)
    } catch (err) {
      console.error('设置语言失败:', err)
    }
  }, [status, targetLanguage])

  // 设置目标语言
  const handleTargetLanguageChange = useCallback(async (lang: Language) => {
    if (status === AppStatus.RUNNING) return
    const newSource = lang === sourceLanguage
      ? (lang === Language.CHINESE ? Language.ENGLISH : Language.CHINESE)
      : sourceLanguage

    try {
      await window.electronAPI.setLanguages(newSource, lang)
      setSourceLanguage(newSource)
      setTargetLanguage(lang)
    } catch (err) {
      console.error('设置语言失败:', err)
    }
  }, [status, sourceLanguage])

  // 切换翻译模式
  const handleModeChange = useCallback(async (mode: TranslationMode) => {
    try {
      await window.electronAPI.setTranslationMode(mode)
      setTranslationMode(mode)
    } catch (err) {
      console.error('切换翻译模式失败:', err)
    }
  }, [])

  // 字幕窗口大小控制
  const handleSubtitleSize = useCallback(async (size: 'small' | 'medium' | 'large') => {
    const sizeMap = {
      small: { width: 500, height: 120 },
      medium: { width: 800, height: 180 },
      large: { width: 1000, height: 260 },
    }
    const { width, height } = sizeMap[size]
    window.electronAPI.resizeSubtitleWindow(width, height)
  }, [])

  // 切换字幕窗口显示/隐藏
  const handleToggleSubtitle = useCallback(async () => {
    try {
      const newVisible = !subtitleVisible
      await window.electronAPI.toggleSubtitle(newVisible)
      setSubtitleVisible(newVisible)
    } catch (err) {
      console.error('切换字幕显示失败:', err)
    }
  }, [subtitleVisible])

  // 重置字幕窗口位置
  const handleResetSubtitlePosition = useCallback(async () => {
    try {
      await window.electronAPI.resetSubtitlePosition()
    } catch (err) {
      console.error('重置字幕位置失败:', err)
    }
  }, [])

  const isRunning = status === AppStatus.RUNNING
  const languages = Object.values(Language)
  const modes = Object.values(TranslationMode)

  return (
    <div className="control-window">
      {/* 标题栏拖拽区域 */}
      <div className="titlebar-drag-region" />

      <header className="header">
        <h1 className="app-title">Tranlater</h1>
        <p className="app-subtitle">实时语音翻译</p>
      </header>

      <main className="content">
        {/* 语言选择 */}
        <section className="section">
          <h2 className="section-title">翻译方向</h2>
          <div className="language-selector">
            <div className="language-group">
              <label className="language-label">源语言</label>
              <div className="language-buttons">
                {languages.map(lang => (
                  <button
                    key={`source-${lang}`}
                    className={`btn-lang ${sourceLanguage === lang ? 'active' : ''}`}
                    onClick={() => handleSourceLanguageChange(lang)}
                    disabled={isRunning}
                  >
                    {LanguageLabels[lang]}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-swap"
              onClick={handleSwapLanguages}
              disabled={isRunning}
              title="交换语言方向"
            >
              &#x21C4;
            </button>

            <div className="language-group">
              <label className="language-label">目标语言</label>
              <div className="language-buttons">
                {languages.map(lang => (
                  <button
                    key={`target-${lang}`}
                    className={`btn-lang ${targetLanguage === lang ? 'active' : ''}`}
                    onClick={() => handleTargetLanguageChange(lang)}
                    disabled={isRunning}
                  >
                    {LanguageLabels[lang]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 音频源选择 */}
        <section className="section">
          <h2 className="section-title">音频来源</h2>
          <div className="audio-sources">
            <label className={`source-option ${!devices.microphone ? 'unavailable' : ''}`}>
              <input
                type="checkbox"
                checked={audioSources.includes(AudioSource.MICROPHONE)}
                onChange={() => handleAudioSourceToggle(AudioSource.MICROPHONE)}
                disabled={isRunning || !devices.microphone}
              />
              <span className="source-icon">&#x1F3A4;</span>
              <span className="source-text">
                麦克风
                {!devices.microphone && <span className="source-hint">（未授权）</span>}
              </span>
            </label>

            <label className="source-option">
              <input
                type="checkbox"
                checked={audioSources.includes(AudioSource.SYSTEM_AUDIO)}
                onChange={() => handleAudioSourceToggle(AudioSource.SYSTEM_AUDIO)}
                disabled={isRunning}
              />
              <span className="source-icon">&#x1F4BB;</span>
              <span className="source-text">
                系统音频
                {!devices.systemAudio && <span className="source-hint">（首次使用需授权屏幕录制）</span>}
              </span>
            </label>
          </div>
        </section>

        {/* 翻译模式 */}
        <section className="section">
          <h2 className="section-title">翻译模式</h2>
          <div className="mode-selector">
            {modes.map(mode => (
              <button
                key={mode}
                className={`btn-mode ${translationMode === mode ? 'active' : ''}`}
                onClick={() => handleModeChange(mode)}
                disabled={isRunning}
              >
                {translationMode === mode ? '✓ ' : ''}{TranslationModeLabels[mode]}
              </button>
            ))}
          </div>
        </section>

        {/* 字幕窗口控制 */}
        <section className="section">
          <h2 className="section-title">字幕窗口</h2>
          <div className="subtitle-controls">
            <button
              className={`btn-toggle-subtitle ${subtitleVisible ? 'active' : ''}`}
              onClick={handleToggleSubtitle}
            >
              {subtitleVisible ? '隐藏字幕' : '显示字幕'}
            </button>
            {subtitleVisible && (
              <>
                <div className="subtitle-size-group">
                  <button className="btn-size" onClick={() => handleSubtitleSize('small')}>小</button>
                  <button className="btn-size" onClick={() => handleSubtitleSize('medium')}>中</button>
                  <button className="btn-size" onClick={() => handleSubtitleSize('large')}>大</button>
                </div>
                <button className="btn-reset" onClick={handleResetSubtitlePosition}>
                  重置位置
                </button>
              </>
            )}
          </div>
          {subtitleVisible && (
            <p className="hint-text">拖拽字幕窗口顶部白色手柄可移动位置</p>
          )}
        </section>

        {/* 主控制按钮 */}
        <section className="section control-section">
          <button
            className={`btn-main ${isRunning ? 'stop' : 'start'} ${isLoading ? 'loading' : ''}`}
            onClick={handleToggle}
            disabled={isLoading}
          >
            {isLoading
              ? '处理中...'
              : isRunning
                ? '停止翻译'
                : '开始翻译'
            }
          </button>
        </section>

        {/* 状态指示 */}
        <section className="status-section">
          <div className={`status-indicator ${status}`}>
            <span className="status-dot" />
            <span className="status-text">
              {status === AppStatus.RUNNING && '翻译中'}
              {status === AppStatus.IDLE && '就绪'}
              {status === AppStatus.ERROR && '错误'}
            </span>
          </div>
        </section>

        {/* 错误信息 */}
        {errorMessage && (
          <div className="error-banner">
            <span className="error-icon">&#x26A0;</span>
            <span className="error-text">{errorMessage}</span>
          </div>
        )}
      </main>
    </div>
  )
}
