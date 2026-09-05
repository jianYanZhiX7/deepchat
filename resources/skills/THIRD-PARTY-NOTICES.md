# Third-Party Skill Notices

本目录下部分 skill 取自第三方开源仓库，均为 MIT 许可，与 DeepChat 的 Apache-2.0 许可兼容。
每个 skill 目录内的 `LICENSE.txt` 为上游许可证原文，下表为来源溯源信息。

## obra/superpowers

- 仓库：<https://github.com/obra/superpowers>
- 许可：MIT（Copyright (c) 2025 Jesse Vincent）
- 引入版本：`b36e0829c6d0`（2026-08-12）
- 上游路径：`skills/<name>/`

| Skill | 说明 |
| --- | --- |
| `brainstorming` | 编码前的需求澄清与方案探索，产出设计文档 | 
| `writing-plans` | 将方案拆解为可执行的实施计划 |
| `test-driven-development` | 红-绿-重构循环 |
| `systematic-debugging` | 四阶段系统化调试与根因追溯 |
| `verification-before-completion` | 声称完成前的实证验证 |
| `using-git-worktrees` | 通过 git worktree 建立隔离工作区 |
| `finishing-a-development-branch` | 分支收尾：合并、PR、清理 |
| `dispatching-parallel-agents` | 无共享状态任务的并行子代理派发 |

本地改动：`brainstorming` 移除了上游的 Visual Companion 能力（`scripts/`、`visual-companion.md`
、`spec-document-reviewer-prompt.md`）及 SKILL.md 中对应章节，使其不再依赖本地 HTTP 服务与
Node 运行时。`systematic-debugging` 与 `writing-plans` 移除了上游未被任何文档引用的开发产物
（`CREATION-LOG.md`、`test-pressure-*.md`、`test-academic.md`、`plan-document-reviewer-prompt.md`）。

## addyosmani/agent-skills

- 仓库：<https://github.com/addyosmani/agent-skills>
- 许可：MIT（Copyright (c) 2025 Addy Osmani）
- 引入版本：`84ee50673804`（2026-09-05）
- 上游路径：`skills/<name>/`

| Skill | 说明 |
| --- | --- |
| `api-and-interface-design` | API 与模块边界、类型契约设计 |
| `code-simplification` | 不改变行为的前提下化简既有代码 |
| `ci-cd-and-automation` | CI/CD 流水线与质量门禁 |
| `security-and-hardening` | 输入校验、认证、依赖与供应链安全加固 |
| `performance-optimization` | 前后端、查询与数据库性能优化 |
| `observability-and-instrumentation` | 日志、指标、链路追踪与告警埋点 |
| `documentation-and-adrs` | 技术文档与架构决策记录（ADR） |

## K-Dense-AI/scientific-agent-skills

- 仓库：<https://github.com/K-Dense-AI/scientific-agent-skills>
- 许可：MIT（Copyright (c) 2025 K-Dense Inc.）
- 引入版本：`1e5eeffbdad3`（2026-09-02）
- 上游路径：`skills/<name>/`

| Skill | 说明 |
| --- | --- |
| `polars` | 高性能 DataFrame 数据处理与转换 |
| `dask` | 并行 / 超内存的大数据与延迟计算 |
| `statsmodels` | 统计推断、回归与时序建模 |
| `scikit-learn` | 机器学习建模、预处理与评估 |
| `seaborn` | 统计图表 |
| `matplotlib` | 通用可视化与绘图模板 |
| `scientific-visualization` | 出版级科研图表规范 |
| `timesfm-forecasting` | 时间序列预测（TimesFM） |
| `geopandas` | 地理空间数据分析 |
| `shap` | 模型可解释性与特征归因 |

本地改动：`timesfm-forecasting` 移除了 `examples/*/output` 下的二进制产物（PNG/GIF/HTML/CSV），
仅保留 SKILL.md、references 与脚本，体积由 2.1M 降至 196K。

## brycewang-stanford/StatsPAI

- 仓库：<https://github.com/brycewang-stanford/StatsPAI>
- 许可：MIT
- 引入：tarball 快照（2026-09-05）
- 上游路径：`StatsPAI_full_data_analysis_skill/`

| Skill | 说明 |
| --- | --- |
| `StatsPAI_skill` | 计量 / 因果实证分析（DID、RD、IV、SCM、DML、生存分析、ML 因果）全流程 |

## antvis/chart-visualization-skills

- 仓库：<https://github.com/antvis/chart-visualization-skills>
- 许可：MIT
- 引入：tarball 快照（2026-09-05）
- 上游路径：`skills/narrative-text-visualization/`

| Skill | 说明 |
| --- | --- |
| `narrative-text-visualization` | 用 T8 语法把数据转为结构化叙事文本可视化 |

## ai-analyst-lab/ai-analyst-plugin

- 仓库：<https://github.com/ai-analyst-lab/ai-analyst-plugin>
- 许可：MIT
- 引入：tarball 快照（2026-09-05）
- 上游路径：`ai-analyst-plus/skills/<name>/`

| Skill | 说明 |
| --- | --- |
| `data-profiling` | 数据集深度剖析：分布、时间模式、相关性、完整性 |
| `metrics` | 指标字典浏览与口径定义 |
| `question-framing` | 用问题阶梯（目标 / 决策 / 指标 / 假设）结构化分析问题 |

## op7418/Humanizer-zh

- 仓库：<https://github.com/op7418/Humanizer-zh>
- 许可：MIT（翻译自 `blader/humanizer`，沿用其 MIT）
- 引入：tarball 快照（2026-09-05）

| Skill | 说明 |
| --- | --- |
| `humanizer-zh` | 中文去 AI 味润色（检测并修正 24 类 AI 写作痕迹） |

## JimLiu/baoyu-skills

- 仓库：<https://github.com/JimLiu/baoyu-skills>
- 许可：MIT（Copyright (c) 2026 Jim Liu）
- 引入：tarball 快照（2026-09-05）

| Skill | 说明 |
| --- | --- |
| `baoyu-format-markdown` | Markdown 排版与格式化 |
| `baoyu-article-illustrator` | 文章配图（调用图像生成能力，需 raster 后端） |
| `baoyu-translate` | 精炼式中英翻译（分析→提示词→草稿→ critique→修订 五阶段） |

## zenstory-ai/oh-story-claudecode

- 仓库：<https://github.com/zenstory-ai/oh-story-claudecode>
- 许可：MIT（Copyright (c) 2025-2026 oh-story-claudecode）
- 引入：tarball 快照（2026-09-05）

| Skill | 说明 |
| --- | --- |
| `story-long-write` | 长篇网文创作（世界观 / 人物 / 情节 / 章节） |
| `story-review` | 多视角对抗式网文审读与反馈 |
| `story-short-write` | 短篇网文创作（提纲→初稿→打磨，轻量流程） |

本地改动：`story-review` 的 SKILL.md 中上游嵌套路径前缀 `story-review/` 已剥离为相对路径
（`references/`、`scripts/`、`state.md`），以适配 DeepChat 扁平 skill 布局；其 reviewer agent
派生机制（`.agents/agents/...`）在 DeepChat 中不存在时按上游内置逻辑降级为 solo 审读。

## blader/humanizer

- 仓库：<https://github.com/blader/humanizer>
- 许可：MIT
- 引入：tarball 快照（2026-09-05）
- 上游路径：`skills/humanizer/`（含 `agents/`、`AGENTS.md`）

| Skill | 说明 |
| --- | --- |
| `humanizer` | 英文去 AI 味润色（检测并修正 AI 写作痕迹，可与 humanizer-zh 互补） |

## WenyuChiou/academic-writing-skills

- 仓库：<https://github.com/WenyuChiou/academic-writing-skills>
- 许可：MIT
- 引入：tarball 快照（2026-09-05）
- 上游路径：`skills/academic-writing-skills/`

| Skill | 说明 |
| --- | --- |
| `academic-writing-skills` | 学术写作全流程（议题提炼、综述、论证、引用规范与润色） |

## 来源筛选口径

仅纳入同时满足以下条件的仓库：

1. Star 数量处于同类前列（superpowers 约 282k、agent-skills 约 92k）；
2. 许可证为 MIT，可安全随 Apache-2.0 项目分发；
3. skill 内容为纯指令文本，或仅附带无网络访问、无破坏性操作的本地脚本。

因许可证原因排除：`NeoLabHQ/context-engineering-kit`（GPL-3.0）、`trailofbits/skills`
（CC-BY-SA-4.0）、`vercel-labs/agent-skills`（无许可证）。
