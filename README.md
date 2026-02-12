# Tranlater - 实时翻译应用

一个基于 Electron 的 macOS 实时翻译应用，支持中英文互译，延迟小于 2 秒。

## ✨ 核心功能

- ⚡ **实时翻译**：中英文互译，延迟 < 2 秒
- 🎤 **双音频源**：支持麦克风输入和系统内部音频
- 🪟 **双窗口设计**：控制窗口 + 置顶穿透字幕窗口
- 🌐 **智能翻译**：支持端到端和分步两种翻译模式
- 📺 **流畅字幕**：双语上下排列，滚动消失显示

## 🛠️ 技术栈

- **框架**：Electron + React + TypeScript
- **构建**：electron-vite
- **音频捕获**：naudiodon
- **翻译 API**：Google Cloud Speech-to-Text v2 (chirp_2 模型)

## 📋 前置要求

### 1. 系统要求
- macOS 13+ (推荐)
- Node.js 18+
- npm 或 yarn

### 2. Google Cloud 配置

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建项目
2. 启用以下 API：
   - Cloud Speech-to-Text API
   - Cloud Translation API
3. 创建服务账号并下载 JSON 密钥文件
4. 将密钥文件路径配置到 `.env` 文件中

### 3. BlackHole（可选，用于系统音频捕获）

如果需要捕获系统内部音频（视频、会议等），需要安装 BlackHole 虚拟音频驱动：

1. 下载并安装 [BlackHole](https://existential.audio/blackhole/)
2. 在"音频 MIDI 设置"中创建"多输出设备"
3. 同时勾选"内置扬声器"和"BlackHole"

## 🚀 快速开始

### 1. 安装依赖

```bash
make install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置 Google Cloud 凭证
```

### 3. 启动开发环境

```bash
make dev
```

### 4. 构建和打包

```bash
# 构建项目
make build

# 打包 macOS 应用
make package
```

## 📖 使用说明

### 控制窗口

- **音频源选择**：选择麦克风或系统音频
- **翻译模式选择**：端到端（速度优先）或分步（质量优先）
- **开始/停止按钮**：控制翻译的启动和停止

### 字幕窗口

- 置顶显示，鼠标可穿透
- 显示最新 2-3 条双语字幕
- 每条字幕 10 秒后自动消失

## 🔧 开发指南

### 项目结构

```
tranlater/
├── src/
│   ├── main/              # 主进程（音频捕获、API 通信）
│   ├── preload/           # 预加载脚本（IPC 桥接）
│   ├── renderer/          # 渲染进程（React UI）
│   └── shared/            # 共享类型定义
├── resources/             # 资源文件
└── Makefile              # 构建命令
```

### 可用命令

```bash
make install    # 安装依赖
make dev        # 开发模式
make build      # 构建项目
make package    # 打包应用
make clean      # 清理构建产物
make typecheck  # 类型检查
make lint       # 代码检查
make release    # 完整发布流程
```

### 调试

使用 VSCode，按 F5 启动调试，可同时调试主进程和渲染进程。

## 📝 待办事项

- [ ] 实现 AudioCaptureService（音频捕获）
- [ ] 实现 TranslationService（翻译服务）
- [ ] 实现 WindowManager（窗口管理）
- [ ] 实现控制窗口 UI
- [ ] 实现字幕窗口 UI
- [ ] 端到端测试
- [ ] 性能优化

## 📄 许可证

MIT License

## 🙏 鸣谢

- [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text)
- [BlackHole](https://existential.audio/blackhole/)
- [electron-vite](https://github.com/alex8088/electron-vite)
