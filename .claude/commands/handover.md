生成会话交接文档 (Handover Document)。

## 执行步骤

1. **归档已有文档**: 如果 `doc/handover/HANDOVER.md` 已存在，将其重命名为 `doc/handover/HANDOVER-{YYYY-MM-DD-HHmmss}.md`

2. **收集项目状态**:
   - 执行 `git status` 查看工作区状态
   - 执行 `git diff --stat` 查看变更统计
   - 执行 `git log --oneline -10` 查看最近提交
   - 执行 `git branch --show-current` 获取当前分支

3. **回顾本次会话**: 回顾整个对话历史，总结：
   - 用户的原始需求和目标
   - 已完成的所有任务
   - 正在进行但未完成的任务
   - 做出的关键技术决策及其原因
   - 遇到的问题和解决方案
   - 学到的经验教训

4. **生成 `doc/handover/HANDOVER.md`**，严格按照以下模板：

```markdown
# Handover Document

> 生成时间: {YYYY-MM-DD HH:MM:SS}
> 分支: {current_branch}

## Session Summary（会话概览）

{2-3 句话概述本次会话的目标和完成情况}

## Tasks Completed（已完成任务）

- [x] {任务描述}

## Tasks In Progress（进行中任务）

- [ ] {任务描述}（{当前进度}）

## Key Decisions（关键决策）

| 决策 | 选择 | 原因 |
|------|------|------|
| {决策描述} | {选择的方案} | {原因} |

## Files Changed（修改文件）

### 后端
- `{file_path}` - {修改说明}

### 配置
- `{file_path}` - {修改说明}

## Pitfalls & Workarounds（坑和解决方案）

- **{问题}**: {解决方案}

## Lessons Learned（经验教训）

- {经验总结}

## Git Status（工作区状态）

{粘贴 git status 输出}

## Next Steps（下一步优先级清单）

1. 🔴 {高优先级任务}
2. 🟡 {中优先级任务}
3. 🟢 {低优先级任务}
```

5. **输出确认信息**:
   - 文档生成路径
   - 任务统计（已完成/进行中）
   - 是否归档了旧文档

## 注意事项

- 文件修改列表必须基于实际 `git diff`，不要凭记忆
- 不要在文档中包含敏感信息（密码、API Key 等）
- Next Steps 按优先级排序
- 如果没有某个章节的内容，写 "无" 而不是省略该章节
