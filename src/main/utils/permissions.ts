// macOS 权限检查工具

import { systemPreferences } from 'electron'

export async function checkMicrophonePermission(): Promise<boolean> {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone')

    if (status === 'granted') return true

    if (status === 'not-determined') {
      return await systemPreferences.askForMediaAccess('microphone')
    }

    return false
  }
  return true
}

export function checkScreenRecordingPermission(): boolean {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('screen') === 'granted'
  }
  return true
}

export function checkGoogleCloudCredentials(): {
  valid: boolean
  credentials?: string
  projectId?: string
} {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID

  if (!credentials || !projectId) {
    return { valid: false }
  }

  return { valid: true, credentials, projectId }
}
