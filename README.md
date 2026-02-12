# Tranlater - 实时翻译应用

macOS 桌面端实时中英互译应用，支持麦克风和系统音频捕获，悬浮双语字幕显示。

## 功能特性

- **实时语音翻译**：基于 Google Cloud Speech-to-Text V2 (chirp_2 模型)，翻译延迟 < 2 秒
- **中英互译**：支持中文 → 英文、英文 → 中文双向翻译
- **多音频源**：支持麦克风输入和系统内部音频（视频/会议音频），可多选
- **悬浮字幕**：透明悬浮字幕条，自动滚动显示双语字幕
- **语言选择**：手动切换源语言和目标语言

## 系统要求

- macOS 13.0 (Ventura) 或更高版本
- Node.js 18+
- Google Cloud 项目（已启用 Speech-to-Text API）

## 快速开始

### 1. 安装依赖

```bash
make install
```

### 2. 配置 Google Cloud 凭证

复制 `.env.example` 为 `.env` 并填写你的 Google Cloud 配置：

```bash
cp .env.example .env
```

需要配置：
- `GOOGLE_APPLICATION_CREDENTIALS`：服务账号密钥 JSON 文件路径
- `GOOGLE_CLOUD_PROJECT_ID`：Google Cloud 项目 ID

### 3. 启动开发模式

```bash
make dev
```

### 4. 构建和打包

```bash
make build      # 构建生产版本
make package    # 打包 macOS 应用 (DMG)
make release    # 完整构建流程
```

## 权限说明

应用需要以下 macOS 权限：

- **麦克风权限**：用于捕获语音输入（首次使用时自动提示）
- **屏幕录制权限**：用于捕获系统内部音频（需在系统设置中手动开启）

## 技术架构

- **Electron** + **React** + **TypeScript**
- **Google Cloud Speech-to-Text V2**：chirp_2 模型，支持流式转写和翻译
- **Web Audio API**：浏览器端音频捕获和处理
- **electron-vite**：基于 Vite 的快速构建工具

## 开发调试

使用 VS Code 打开项目，按 F5 启动调试（已配置 launch.json）。

## 常用命令

| 命令 | 说明 |
|------|------|
| `make install` | 安装依赖 |
| `make dev` | 开发模式（热重载） |
| `make build` | 生产构建 |
| `make package` | 打包 macOS 应用 |
| `make typecheck` | TypeScript 类型检查 |
| `make lint` | 代码检查 |
| `make clean` | 清理构建产物 |
| `make help` | 查看所有命令 |
