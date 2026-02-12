// IPC 事件处理器
// 处理来自渲染进程的请求

import { ipcMain } from 'electron';
import { AudioCaptureService } from '../services/AudioCaptureService';
import { TranslationService } from '../services/TranslationService';
import { WindowManager } from '../services/WindowManager';
import { AudioSource } from '../types/audio';
import { TranslationMode } from '../types/translation';
import { AppStatus } from '../../../shared/types';

export function setupIpcHandlers(
  audioService: AudioCaptureService,
  translationService: TranslationService,
  windowManager: WindowManager
) {
  let currentStatus: AppStatus = AppStatus.IDLE;

  // 开始翻译
  ipcMain.handle('app:start', async () => {
    try {
      console.log('Starting translation via IPC...');

      // 创建字幕窗口（如果未创建）
      if (!windowManager.getSubtitleWindow()) {
        windowManager.createSubtitleWindow();
      }

      // 启动音频捕获
      await audioService.start();

      // 启动翻译流
      await translationService.startStreaming();

      currentStatus = AppStatus.RUNNING;
      windowManager.sendToControlWindow('app:stateChanged', {
        status: currentStatus,
      });

      console.log('✓ Translation started via IPC');
      return { success: true };
    } catch (error) {
      console.error('Failed to start translation:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 停止翻译
  ipcMain.handle('app:stop', async () => {
    try {
      console.log('Stopping translation via IPC...');

      await translationService.stop();
      await audioService.stop();

      currentStatus = AppStatus.IDLE;
      windowManager.sendToControlWindow('app:stateChanged', {
        status: currentStatus,
      });

      console.log('✓ Translation stopped via IPC');
      return { success: true };
    } catch (error) {
      console.error('Failed to stop translation:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取应用状态
  ipcMain.handle('app:getState', () => {
    return {
      status: currentStatus,
      audioSource: audioService.getCurrentSource(),
      translationMode: translationService.getConfig().mode,
      sourceLanguage: translationService.getConfig().sourceLanguage,
      targetLanguage: translationService.getConfig().targetLanguage,
    };
  });

  // 检查设备可用性
  ipcMain.handle('app:checkDevices', () => {
    return {
      microphone: audioService.isSourceAvailable(AudioSource.MICROPHONE),
      systemAudio: audioService.isSourceAvailable(AudioSource.SYSTEM_AUDIO),
    };
  });

  // 切换音频源
  ipcMain.handle('audio:setSource', async (_event, source: AudioSource) => {
    try {
      await audioService.switchSource(source);
      return { success: true };
    } catch (error) {
      console.error('Failed to set audio source:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 切换翻译模式
  ipcMain.handle('translation:setMode', async (_event, mode: TranslationMode) => {
    try {
      await translationService.switchMode(mode);
      return { success: true };
    } catch (error) {
      console.error('Failed to set translation mode:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 切换语言
  ipcMain.handle('translation:setLanguages', async (_event, sourceLanguage: string, targetLanguage: string) => {
    try {
      await translationService.switchLanguages(sourceLanguage, targetLanguage);
      return { success: true };
    } catch (error) {
      console.error('Failed to set languages:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  console.log('✓ IPC handlers registered');
}
