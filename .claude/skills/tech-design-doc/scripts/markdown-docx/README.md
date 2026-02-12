# Markdown to DOCX Converter

将 Markdown 文件转换为 DOCX 格式，自动将 Mermaid 图表渲染为图片。

## 功能特性

- 批量转换 Markdown 文件
- Mermaid 图表自动渲染为图片（使用 Kroki API）
- 5 种主题风格：`default`, `dark`, `forest`, `ocean`, `elegant`
- 支持中文内容

## 快速开始

### 1. 环境配置 (Poetry)

```bash
# 方式一：使用安装脚本
chmod +x setup.sh
./setup.sh

# 方式二：手动安装
poetry install
```

### 2. 使用方法

```bash
# 使用 Make（推荐）
make convert              # 批量转换 input/ -> output/
make convert-forest       # 使用 forest 主题
make convert-dark         # 使用 dark 主题

# 使用 Poetry 直接运行
poetry run md2docx                              # 批量转换
poetry run md2docx --theme forest               # 指定主题
poetry run md2docx -i docs -o outputs           # 指定目录
poetry run md2docx --single input/file.md output/file.docx  # 单文件
```

## Makefile 命令

| 命令 | 说明 |
|------|------|
| `make install` | 安装依赖 |
| `make convert` | 批量转换（默认主题） |
| `make convert-forest` | 使用 forest 主题 |
| `make convert-dark` | 使用 dark 主题 |
| `make lint` | 代码检查 |
| `make format` | 代码格式化 |
| `make clean` | 清理输出文件 |
| `make help` | 显示帮助 |

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-i, --input` | 输入目录 | `input` |
| `-o, --output` | 输出目录 | `output` |
| `-t, --theme` | Mermaid 主题 | `default` |
| `--single` | 转换单个文件 | - |
| `-v, --version` | 显示版本 | - |

## 项目结构

```
markdown-docx/
├── src/md2docx/
│   ├── __init__.py     # 包初始化
│   ├── cli.py          # 命令行入口
│   └── converter.py    # 核心转换逻辑
├── input/              # 输入 Markdown 文件
├── output/             # 输出 DOCX 文件
├── pyproject.toml      # Poetry 配置
├── Makefile            # 快捷命令
├── setup.sh            # 安装脚本
└── README.md
```

## 依赖

- Python 3.12+
- Poetry
- md-to-docx (使用 Kroki API 渲染 Mermaid)

## 注意事项

- Mermaid 图表渲染需要网络连接（调用 Kroki API）
