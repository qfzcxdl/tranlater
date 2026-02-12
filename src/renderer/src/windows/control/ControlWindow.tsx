// 控制窗口主组件

import React, { useState, useEffect } from 'react';
import { AppStatus, AudioSource, TranslationMode } from '../../../shared/types';

declare global {
  interface Window {
    electronAPI: any;
  }
}

export const ControlWindow: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [audioSource, setAudioSource] = useState<AudioSource>(AudioSource.MICROPHONE);
  const [translationMode, setTranslationMode] = useState<TranslationMode>(TranslationMode.STEP_BY_STEP);
  const [deviceAvailability, setDeviceAvailability] = useState({
    microphone: true,
    systemAudio: false,
  });

  // 初始化
  useEffect(() => {
    const init = async () => {
      try {
        const state = await window.electronAPI.getAppState();
        setStatus(state.status);
        setAudioSource(state.audioSource);
        setTranslationMode(state.translationMode);

        const devices = await window.electronAPI.checkDevices();
        setDeviceAvailability(devices);
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };

    init();

    // 监听状态变化
    const unsubscribe = window.electronAPI.onStateChanged((state: any) => {
      setStatus(state.status);
      setAudioSource(state.audioSource);
      setTranslationMode(state.translationMode);
    });

    return () => unsubscribe();
  }, []);

  // 开始/停止翻译
  const handleToggle = async () => {
    try {
      if (status === AppStatus.RUNNING) {
        await window.electronAPI.stopTranslation();
      } else {
        await window.electronAPI.startTranslation();
      }
    } catch (error) {
      console.error('Failed to toggle translation:', error);
    }
  };

  // 切换音频源
  const handleAudioSourceChange = async (source: AudioSource) => {
    try {
      await window.electronAPI.setAudioSource(source);
      setAudioSource(source);
    } catch (error) {
      console.error('Failed to set audio source:', error);
    }
  };

  // 切换翻译模式
  const handleModeChange = async (mode: TranslationMode) => {
    try {
      await window.electronAPI.setTranslationMode(mode);
      setTranslationMode(mode);
    } catch (error) {
      console.error('Failed to set translation mode:', error);
    }
  };

  return (
    <div className="control-window">
      <header className="header">
        <h1>🎤 Tranlater</h1>
        <p className="subtitle">实时翻译控制面板</p>
      </header>

      <main className="content">
        {/* 音频源选择 */}
        <section className="section">
          <h2>音频源</h2>
          <div className="button-group">
            <button
              className={`btn ${audioSource === AudioSource.MICROPHONE ? 'active' : ''} ${!deviceAvailability.microphone ? 'disabled' : ''}`}
              onClick={() => handleAudioSourceChange(AudioSource.MICROPHONE)}
              disabled={!deviceAvailability.microphone || status === AppStatus.RUNNING}
            >
              🎤 麦克风
              {!deviceAvailability.microphone && ' (不可用)'}
            </button>
            <button
              className={`btn ${audioSource === AudioSource.SYSTEM_AUDIO ? 'active' : ''} ${!deviceAvailability.systemAudio ? 'disabled' : ''}`}
              onClick={() => handleAudioSourceChange(AudioSource.SYSTEM_AUDIO)}
              disabled={!deviceAvailability.systemAudio || status === AppStatus.RUNNING}
            >
              💻 系统音频
              {!deviceAvailability.systemAudio && ' (需安装 BlackHole)'}
            </button>
          </div>
        </section>

        {/* 翻译模式选择 */}
        <section className="section">
          <h2>翻译模式</h2>
          <div className="button-group">
            <button
              className={`btn ${translationMode === TranslationMode.END_TO_END ? 'active' : ''}`}
              onClick={() => handleModeChange(TranslationMode.END_TO_END)}
              disabled={status === AppStatus.RUNNING}
            >
              ⚡ 端到端 (速度优先)
            </button>
            <button
              className={`btn ${translationMode === TranslationMode.STEP_BY_STEP ? 'active' : ''}`}
              onClick={() => handleModeChange(TranslationMode.STEP_BY_STEP)}
              disabled={status === AppStatus.RUNNING}
            >
              🎯 分步 (质量优先)
            </button>
          </div>
        </section>

        {/* 控制按钮 */}
        <section className="section">
          <button
            className={`btn-main ${status === AppStatus.RUNNING ? 'stop' : 'start'}`}
            onClick={handleToggle}
          >
            {status === AppStatus.RUNNING ? '⏸ 停止翻译' : '▶️ 开始翻译'}
          </button>
        </section>

        {/* 状态显示 */}
        <section className="status">
          <div className={`status-indicator ${status === AppStatus.RUNNING ? 'running' : 'idle'}`}>
            {status === AppStatus.RUNNING ? '● 运行中' : '○ 已停止'}
          </div>
        </section>
      </main>
    </div>
  );
};
