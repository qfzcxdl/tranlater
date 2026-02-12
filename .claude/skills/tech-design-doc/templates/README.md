# Tech Design Doc - 模板使用指南

本目录包含技术方案设计文档生成所需的所有模板文件。

## 模板列表

| 序号 | 模板文件 | 用途 | 阶段 |
|------|----------|------|------|
| 01 | `01-research-summary.md` | 调研资料汇总 | 阶段1: 技术调研 |
| 02 | `02-comparison-analysis.md` | 方案对比分析 | 阶段1: 技术调研 |
| 03 | `03-project-analysis.md` | 项目现有实现分析 | 阶段2: 项目分析 |
| 04 | `04-design-thinking.md` | 设计思路文档 | 阶段3: 设计思路 |
| 05 | `05-design-document.md` | 最终设计文档 | 阶段4: 文档生成 |

## 使用流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                         模板使用流程                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 创建调研目录                                                     │
│     mkdir -p tmp/{project-name}/research                           │
│     mkdir -p tmp/{project-name}/analysis                           │
│     mkdir -p tmp/{project-name}/design                             │
│                                                                     │
│  2. 使用调研模板                                                     │
│     → 01-research-summary.md → tmp/{project}/research/             │
│     → 02-comparison-analysis.md → tmp/{project}/research/          │
│                                                                     │
│  3. 使用分析模板                                                     │
│     → 03-project-analysis.md → tmp/{project}/analysis/             │
│                                                                     │
│  4. 使用设计模板                                                     │
│     → 04-design-thinking.md → tmp/{project}/design/                │
│                                                                     │
│  5. 生成最终文档                                                     │
│     → 05-design-document.md → doc/design/{document-name}.md        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 模板说明

### 01-research-summary.md (调研资料汇总)

**用途**: 记录和汇总技术调研收集的资料

**关键要求**:
- 资料数量不少于 15 篇
- 覆盖多种来源（博客、官方文档、开源项目、论文、演讲）
- 每篇资料记录核心观点、优缺点、适用场景

**输出位置**: `tmp/{project-name}/research/research_summary.md`

---

### 02-comparison-analysis.md (方案对比分析)

**用途**: 对调研收集的技术方案进行系统性对比

**关键要求**:
- 至少对比 2-3 个候选方案
- 多维度对比（复杂度、性能、可维护性、扩展性、社区）
- 给出加权评分和推荐结论

**输出位置**: `tmp/{project-name}/research/comparison.md`

---

### 03-project-analysis.md (项目现有实现分析)

**用途**: 分析当前项目中可复用的模块和组件

**关键要求**:
- 识别可复用组件
- 评估复用性（直接复用/改造后复用/需新建）
- 识别技术债务
- 估算工作量

**输出位置**: `tmp/{project-name}/analysis/project_analysis.md`

---

### 04-design-thinking.md (设计思路文档)

**用途**: 综合外部调研和内部分析，形成设计思路

**关键要求**:
- 明确设计原则
- 记录关键设计决策及理由
- 技术选型说明
- 风险评估

**输出位置**: `tmp/{project-name}/design/design_thinking.md`

---

### 05-design-document.md (最终设计文档)

**用途**: 生成正式的架构设计文档

**关键要求**:
- 参考 `doc/design/*.md` 现有文档结构
- 突出方案调研内容（第2章）
- 突出关键问题与解决方案（第5章）
- 使用 Mermaid 绘制架构图

**输出位置**: `doc/design/{document-name}.md`

---

## 模板占位符说明

模板中使用以下占位符，使用时需替换为实际内容：

| 占位符 | 说明 |
|--------|------|
| `{PROJECT_NAME}` | 项目名称 |
| `{DATE}` | 日期 (YYYY-MM-DD) |
| `{AUTHOR}` | 作者/团队 |
| `{功能名称}` | 功能名称 |
| `{方案名称}` | 技术方案名称 |
| `{描述}` | 需要填写的描述内容 |
| `URL` | 需要替换的链接 |

## 参考资料

- 现有设计文档: `doc/design/*.md`
- Mermaid 语法: https://mermaid.js.org/
- C4 模型: https://c4model.com/
