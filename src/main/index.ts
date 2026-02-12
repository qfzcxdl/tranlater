// 主进程入口文件
// 集成音频捕获和翻译服务

import { app, BrowserWindow } from 'electron';
import { AudioCaptureService } from './services/AudioCaptureService';
import { TranslationService } from './services/TranslationService';
import { checkMicrophonePermission } from './utils/permissions';
import { AudioSource } from './types/audio';
import { TranslationMode } from './types/translation';

let audioService: AudioCaptureService;
let translationService: TranslationService;

async function initialize() {
  console.log('🚀 Initializing Tranlater...');
  console.log('');

  // 1. 检查麦克风权限
  console.log('1️⃣ Checking microphone permission...');
  const hasPermission = await checkMicrophonePermission();
  if (!hasPermission) {
    console.error('❌ Microphone permission denied');
    console.log('Please grant microphone access in System Preferences > Security & Privacy > Microphone');
    app.quit();
    return;
  }
  console.log('✓ Microphone permission granted');
  console.log('');

  // 2. 检查 Google Cloud 凭证
  console.log('2️⃣ Checking Google Cloud credentials...');
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  if (!credentials || !projectId) {
    console.error('❌ Google Cloud credentials not configured');
    console.log('Please set environment variables:');
    console.log('  GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json');
    console.log('  GOOGLE_CLOUD_PROJECT_ID=your-project-id');
    app.quit();
    return;
  }
  console.log('✓ Google Cloud credentials found');
  console.log(`  Project ID: ${projectId}`);
  console.log('');

  // 3. 创建音频捕获服务
  console.log('3️⃣ Initializing audio capture service...');
  audioService = new AudioCaptureService();

  const micAvailable = audioService.isSourceAvailable(AudioSource.MICROPHONE);
  const sysAudioAvailable = audioService.isSourceAvailable(AudioSource.SYSTEM_AUDIO);

  console.log(`  Microphone: ${micAvailable ? '✓ Available' : '✗ Not found'}`);
  console.log(`  System Audio (BlackHole): ${sysAudioAvailable ? '✓ Available' : '✗ Not installed'}`);

  if (!micAvailable) {
    console.error('❌ No microphone found');
    app.quit();
    return;
  }
  console.log('');

  // 4. 创建翻译服务
  console.log('4️⃣ Initializing translation service...');
  translationService = new TranslationService({
    mode: TranslationMode.STEP_BY_STEP, // 使用分步模式（更可靠）
    sourceLanguage: 'zh-CN',
    targetLanguage: 'en',
    projectId: projectId!,
    location: 'global',
  });
  console.log('');

  // 5. 连接音频捕获和翻译服务
  console.log('5️⃣ Connecting audio capture to translation service...');

  // 音频数据流向翻译服务
  audioService.onAudioData((chunk) => {
    translationService.writeAudioChunk(chunk.buffer);
  });

  // 翻译结果回调
  translationService.onResult((result) => {
    if (result.isFinal) {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📝 Translation Result (Final):');
      console.log(`  Original (${result.sourceLanguage}): ${result.original}`);
      console.log(`  Translated (${result.targetLanguage}): ${result.translated}`);
      if (result.confidence) {
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    } else {
      // 中间结果（实时显示，不换行）
      process.stdout.write(`\r💬 ${result.original} → ${result.translated}`);
    }
  });

  console.log('✓ Services connected');
  console.log('');

  // 6. 启动音频捕获
  console.log('6️⃣ Starting audio capture...');
  try {
    await audioService.start();
    console.log('✓ Audio capture started');
  } catch (error) {
    console.error('❌ Failed to start audio capture:', error);
    app.quit();
    return;
  }
  console.log('');

  // 7. 启动翻译流
  console.log('7️⃣ Starting translation streaming...');
  try {
    await translationService.startStreaming();
    console.log('✓ Translation streaming started');
  } catch (error) {
    console.error('❌ Failed to start translation streaming:', error);
    app.quit();
    return;
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎤 READY! Speak into the microphone...');
  console.log('   (Press Ctrl+C to stop)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

// Electron 应用生命周期
app.whenReady().then(() => {
  initialize();

  // 创建一个隐藏窗口保持应用运行
  const win = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  console.log('');
  console.log('🛑 Shutting down...');

  if (translationService) {
    await translationService.stop();
    console.log('✓ Translation service stopped');
  }

  if (audioService) {
    await audioService.stop();
    console.log('✓ Audio capture stopped');
  }

  console.log('👋 Goodbye!');
});
