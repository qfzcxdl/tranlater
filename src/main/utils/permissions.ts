// macOS 权限检查工具

import { systemPreferences } from 'electron';

/**
 * 检查麦克风权限
 * @returns Promise<boolean> 是否已授权
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  const status = systemPreferences.getMediaAccessStatus('microphone');

  if (status === 'not-determined') {
    // 请求权限
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return granted;
  }

  return status === 'granted';
}

/**
 * 获取麦克风权限状态
 * @returns 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
 */
export function getMicrophonePermissionStatus(): string {
  return systemPreferences.getMediaAccessStatus('microphone');
}

/**
 * 打开系统偏好设置的隐私设置
 */
export function openPrivacySettings(): void {
  // macOS 系统偏好设置 URL
  const { shell } = require('electron');
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
}
