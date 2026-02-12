# Handover - 会话交接文档生成技能

## 概述

在会话结束或上下文即将压缩时，生成一份结构化的 HANDOVER.md 交接文档，确保下一次会话能无缝续接当前工作。

## 触发方式

- **手动触发**: 在 Claude Code 中输入 `/handover`
- **自动触发**: PreCompact hook 在上下文压缩前自动调用
- **Cursor 触发**: 在 Cursor 中使用 handover command

## 使用场景

1. 会话即将结束，需要保存当前进度
2. 上下文窗口快满了，需要压缩前保存状态
3. 需要将工作交接给另一个会话继续
4. 阶段性工作完成，需要记录里程碑

## 生成流程

### 步骤 1: 检查并归档已有文档

如果 `doc/handover/HANDOVER.md` 已存在，先将其重命名归档：

```bash
# 归档格式: HANDOVER-{date}.md
mv doc/handover/HANDOVER.md doc/handover/HANDOVER-$(date +%Y-%m-%d-%H%M%S).md
```

### 步骤 2: 收集当前状态信息

执行以下命令收集项目状态：

```bash
# Git 状态
git status
git diff --stat
git log --oneline -10

# 当前分支
git branch --show-current
```

### 步骤 3: 生成 HANDOVER.md

在 `doc/handover/HANDOVER.md` 生成交接文档，包含以下章节：

```markdown
# Handover Document

> 生成时间: {YYYY-MM-DD HH:MM:SS}
> 分支: {current_branch}
> 会话 ID: {session_id_if_available}

## Session Summary（会话概览）

简要描述本次会话的目标和完成情况（2-3 句话）。

## Tasks Completed（已完成任务）

- [x] 任务描述 1
- [x] 任务描述 2

## Tasks In Progress（进行中任务）

- [ ] 任务描述（当前进度说明）

## Key Decisions（关键决策）

| 决策 | 选择 | 原因 |
|------|------|------|
| 决策描述 | 选择的方案 | 为什么选择这个方案 |

## Files Changed（修改文件）

### 后端
- `path/to/file.go` - 修改说明

### 前端
- `path/to/file.tsx` - 修改说明

### 配置
- `path/to/config.yaml` - 修改说明

## Pitfalls & Workarounds（坑和解决方案）

- **问题描述**: 解决方案说明

## Lessons Learned（经验教训）

- 经验总结

## Git Status（工作区状态）

```
{git status output}
```

## Next Steps（下一步优先级清单）

1. 🔴 高优先级 - 任务描述
2. 🟡 中优先级 - 任务描述
3. 🟢 低优先级 - 任务描述
```

### 步骤 4: 确认生成

生成完成后输出确认信息：

```
✅ Handover 文档已生成: doc/handover/HANDOVER.md
📋 包含 {N} 个已完成任务, {M} 个进行中任务
📁 已归档旧文档: doc/handover/HANDOVER-{date}.md (如果有)
```

## 新会话恢复

在新会话开始时，如果存在 `doc/handover/HANDOVER.md`，应该：

1. 读取该文件了解上次工作状态
2. 检查 "Tasks In Progress" 和 "Next Steps" 确定续接点
3. 验证 Git 状态是否与文档记录一致
4. 继续未完成的工作

## 重要注意事项

- HANDOVER.md 中不要包含敏感信息（密码、密钥等）
- 文件修改列表应基于实际 git diff，而非记忆
- Next Steps 应该按优先级排序，便于下次会话快速定位
- 归档文件保留最近 10 个版本，超出的可以删除
