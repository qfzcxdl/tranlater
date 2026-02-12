#!/usr/bin/env python3
"""
PreCompact Hook: 在 Claude Code 上下文压缩前自动生成 Handover 文档。

工作流程:
1. 读取当前对话的完整上下文（通过 stdin）
2. 调用 claude -p 生成 handover 摘要
3. 保存为 HANDOVER-YYYY-MM-DD.md

触发方式: 由 .claude/settings.local.json 中的 hooks.PreCompact 配置自动触发
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def get_project_root():
    """获取项目根目录"""
    # 尝试通过 git 获取项目根目录
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 回退到当前工作目录
    return os.getcwd()


def get_git_info(project_root):
    """收集 Git 状态信息"""
    git_info = {}

    commands = {
        "branch": ["git", "branch", "--show-current"],
        "status": ["git", "status", "--short"],
        "log": ["git", "log", "--oneline", "-10"],
        "diff_stat": ["git", "diff", "--stat"],
    }

    for key, cmd in commands.items():
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=project_root,
                timeout=10,
            )
            git_info[key] = result.stdout.strip() if result.returncode == 0 else ""
        except (subprocess.TimeoutExpired, FileNotFoundError):
            git_info[key] = ""

    return git_info


def archive_existing_handover(handover_dir, handover_file):
    """归档已有的 HANDOVER.md"""
    if handover_file.exists():
        timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
        archive_name = handover_dir / f"HANDOVER-{timestamp}.md"
        handover_file.rename(archive_name)
        return str(archive_name)
    return None


def cleanup_old_archives(handover_dir, keep=10):
    """清理旧的归档文件，只保留最近 N 个"""
    archives = sorted(
        handover_dir.glob("HANDOVER-*.md"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    for old_file in archives[keep:]:
        old_file.unlink()


def generate_handover(conversation_text, git_info, project_root):
    """调用 claude -p 生成 handover 文档"""
    prompt = f"""你是一个会话交接文档生成助手。请根据以下对话记录和 Git 状态信息，生成一份结构化的 Handover 文档。

## Git 信息
- 分支: {git_info.get('branch', 'unknown')}
- 最近提交:
{git_info.get('log', '无')}
- 变更统计:
{git_info.get('diff_stat', '无')}
- 工作区状态:
{git_info.get('status', '无')}

## 对话记录
{conversation_text[:50000]}

## 输出要求

请严格按照以下 Markdown 模板生成文档，不要遗漏任何章节：

# Handover Document

> 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
> 分支: {git_info.get('branch', 'unknown')}

## Session Summary（会话概览）
（2-3 句话概述）

## Tasks Completed（已完成任务）
- [x] 任务描述

## Tasks In Progress（进行中任务）
- [ ] 任务描述（当前进度）

## Key Decisions（关键决策）
| 决策 | 选择 | 原因 |
|------|------|------|

## Files Changed（修改文件）
### 后端
### 配置

## Pitfalls & Workarounds（坑和解决方案）

## Lessons Learned（经验教训）

## Git Status（工作区状态）

## Next Steps（下一步优先级清单）
1. 🔴 高优先级
2. 🟡 中优先级
3. 🟢 低优先级

如果某个章节没有内容，写 "无" 而不是省略。
"""

    try:
        result = subprocess.run(
            ["claude", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=project_root,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"Warning: Failed to call claude -p: {e}", file=sys.stderr)

    # 如果 claude -p 失败，生成一个基础模板
    return generate_fallback_handover(git_info)


def generate_fallback_handover(git_info):
    """当 claude -p 不可用时，生成基础 handover 模板"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    branch = git_info.get("branch", "unknown")

    return f"""# Handover Document

> 生成时间: {now}
> 分支: {branch}
> ⚠️ 此文档由 PreCompact hook 自动生成（fallback 模式）

## Session Summary（会话概览）

上下文压缩前自动保存的会话状态。请查看 Git 状态和最近提交了解工作进度。

## Tasks Completed（已完成任务）

请查看 git log 了解已完成的工作。

## Tasks In Progress（进行中任务）

请查看 git status 了解进行中的工作。

## Key Decisions（关键决策）

无（自动生成模式无法提取决策信息）

## Files Changed（修改文件）

```
{git_info.get('diff_stat', '无变更')}
```

## Pitfalls & Workarounds（坑和解决方案）

无

## Lessons Learned（经验教训）

无

## Git Status（工作区状态）

```
{git_info.get('status', '无')}
```

## Recent Commits（最近提交）

```
{git_info.get('log', '无')}
```

## Next Steps（下一步优先级清单）

请根据 Git 状态和上次工作内容确定下一步计划。
"""


def main():
    """主函数"""
    project_root = get_project_root()
    handover_dir = Path(project_root) / "docs" / "handover"
    handover_file = handover_dir / "HANDOVER.md"

    # 确保目录存在
    handover_dir.mkdir(parents=True, exist_ok=True)

    # 读取 stdin（对话上下文）
    conversation_text = ""
    if not sys.stdin.isatty():
        try:
            conversation_text = sys.stdin.read()
        except Exception:
            conversation_text = ""

    # 收集 Git 信息
    git_info = get_git_info(project_root)

    # 归档已有文档
    archived = archive_existing_handover(handover_dir, handover_file)
    if archived:
        print(f"📦 Archived existing handover: {archived}", file=sys.stderr)

    # 清理旧归档
    cleanup_old_archives(handover_dir, keep=10)

    # 生成新的 handover 文档
    if conversation_text:
        handover_content = generate_handover(
            conversation_text, git_info, project_root
        )
    else:
        handover_content = generate_fallback_handover(git_info)

    # 写入文件
    handover_file.write_text(handover_content, encoding="utf-8")

    # 保存为带日期的副本
    date_str = datetime.now().strftime("%Y-%m-%d")
    dated_file = handover_dir / f"HANDOVER-{date_str}.md"
    if not dated_file.exists():
        dated_file.write_text(handover_content, encoding="utf-8")

    print(f"✅ Handover document generated: {handover_file}", file=sys.stderr)

    # 输出提示信息给 Claude（通过 stdout）
    print(
        "IMPORTANT: Before compacting, a handover document has been saved to "
        f"doc/handover/HANDOVER.md. "
        "In the next session, read this file first to resume work seamlessly."
    )


if __name__ == "__main__":
    main()
