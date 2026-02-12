// macOS 权限检查工具

import { systemPreferences } from 'electron'

/**
 * 检查并请求麦克风权限
 * macOS 会自动弹出权限请求对话框
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  // macOS 特有的权限检查
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    console.log(`[权限] 麦克风权限状态: ${status}`)

    if (status === 'granted') {
      return true
    }

    if (status === 'not-determined') {
      // 首次请求，系统会弹出授权对话框
      const granted = await systemPreferences.askForMediaAccess('microphone')
      console.log(`[权限] 麦克风授权结果: ${granted}`)
      return granted
    }

    // 'denied' 或 'restricted'
    return false
  }

  // 非 macOS 平台默认返回 true
  return true
}

/**
 * 检查屏幕录制权限（用于系统音频捕获）
 * macOS 无法通过 API 主动请求屏幕录制权限，需要用户手动在系统设置中开启
 */
export function checkScreenRecordingPermission(): boolean {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen')
    console.log(`[权限] 屏幕录制权限状态: ${status}`)
    return status === 'granted'
  }
  return true
}

/**
 * 检查 Google Cloud 凭证配置
 */
export function checkGoogleCloudCredentials(): {
  valid: boolean
  credentials?: string
  projectId?: string
} {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID

  if (!credentials || !projectId) {
    console.error('[配置] Google Cloud 凭证未配置')
    return { valid: false }
  }

  console.log(`[配置] Google Cloud 项目: ${projectId}`)
  console.log(`[配置] 凭证文件: ${credentials}`)

  return { valid: true, credentials, projectId }
}
