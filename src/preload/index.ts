// Preload 脚本
// 使用 contextBridge 安全地暴露 IPC API 给渲染进程

import { contextBridge, ipcRenderer } from 'electron';

// 定义暴露给渲染进程的 API
const electronAPI = {
  // 应用控制
  startTranslation: () => ipcRenderer.invoke('app:start'),
  stopTranslation: () => ipcRenderer.invoke('app:stop'),
  getAppState: () => ipcRenderer.invoke('app:getState'),
  checkDevices: () => ipcRenderer.invoke('app:checkDevices'),

  // 音频源控制
  setAudioSource: (source: string) => ipcRenderer.invoke('audio:setSource', source),

  // 翻译模式控制
  setTranslationMode: (mode: string) => ipcRenderer.invoke('translation:setMode', mode),

  // 语言设置
  setLanguages: (sourceLanguage: string, targetLanguage: string) =>
    ipcRenderer.invoke('translation:setLanguages', sourceLanguage, targetLanguage),

  // 事件监听
  onStateChanged: (callback: (state: any) => void) => {
    const listener = (_event: any, state: any) => callback(state);
    ipcRenderer.on('app:stateChanged', listener);
    return () => ipcRenderer.removeListener('app:stateChanged', listener);
  },

  onTranslationResult: (callback: (result: any) => void) => {
    const listener = (_event: any, result: any) => callback(result);
    ipcRenderer.on('translation:result', listener);
    return () => ipcRenderer.removeListener('translation:result', listener);
  },

  onTranslationInterim: (callback: (result: any) => void) => {
    const listener = (_event: any, result: any) => callback(result);
    ipcRenderer.on('translation:interim', listener);
    return () => ipcRenderer.removeListener('translation:interim', listener);
  },

  onError: (callback: (error: any) => void) => {
    const listener = (_event: any, error: any) => callback(error);
    ipcRenderer.on('app:error', listener);
    return () => ipcRenderer.removeListener('app:error', listener);
  },
};

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型定义（供 TypeScript 使用）
export type ElectronAPI = typeof electronAPI;
