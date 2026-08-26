# Plan: 预置受保护的内置 DeepChat Agent（打包内置 JSON 配置）

## 目标（Objective）

通过**打包内置的 JSON 配置文件**，为 DeepChat 预置 4 个**受保护的内置 DeepChat Agent**：
通用助手（现有 `deepchat`）+ 代码专家 + 写作助手 + 数据分析师。它们彼此仅在
`name`/`description`/`systemPrompt`/`enabledSkillNames` 上不同，其余配置沿用内置默认，
并作为一等公民出现在"新建对话"选择器与子代理目标中。

## 关键理由（Rationale）

- 用户希望"多预置几个 DeepChat Agent"，且希望**用配置文件即可增删**，而非每次改 TS 代码 +
  手动 bump 迁移版本号。
- 现有机制只支持单一内置 agent（`BUILTIN_DEEPCHAT_AGENT_ID = 'deepchat'`），且内置技能已
  通过 `resources/skills/` + `electron-builder.yml` 的 `extraResources` 随应用分发，是天然的
  先例。复用同一套"资源文件 + 启动时幂等 materialize"模式，符合 KISS 与仓库既有约定。
- 用配置文件声明预设后，`ensure` 循环天然幂等（create-if-missing），无需版本化迁移即可安全
  支持后续"加一个 JSON 文件 = 加一个预设"。

## 约束（Constraints）

- 仅用 pnpm；Node >= 20.19、pnpm >= 10.11。
- 遵循 Oxfmt（单引号、无分号、100 列）、Conventional Commits。
- 原生能力保留在 typed preload/IPC 边界内；不新增无谓抽象。
- 预设必须 `source: 'builtin'`、`protected: true`、`enabled: true`，不可删除、默认启用。
- `ensure` 语义必须为 **create-if-missing**：绝不覆盖用户对内置 agent 的既有编辑（名称、
  提示词、技能勾选等）。
- 名称/描述/系统提示词仅中文，不做 i18n。

## 已定决策（Decisions）

| 维度 | 决策 |
|---|---|
| 形态 | 常驻内置、`protected: true`、默认 `enabled: true`、完全同权 |
| 差异维度 | `name`/`description`/`systemPrompt` + `enabledSkillNames` |
| 配置来源 | 打包内置 JSON（`resources/agent-presets/`，随应用分发） |
| i18n | 无，中文单语言 |
| 系统提示词 | 由实现者起草 |

### 预设清单与技能映射

| id | 名称 | enabledSkillNames |
|---|---|---|
| `deepchat`（现有，保留硬编码） | DeepChat（通用助手） | 全部 15 个内置技能（不设，默认全启用） |
| `deepchat-code-expert` | 代码专家 | `code-review` `git-commit` `mcp-builder` `skill-creator` `frontend-design` `web-artifacts-builder` |
| `deepchat-writing-assistant` | 写作助手 | `doc-coauthoring` `docx` `pptx` `pdf` `xlsx` |
| `deepchat-data-analyst` | 数据分析师 | `xlsx` `pdf` `docx` `infographic-syntax-creator` |

### 配置文件格式（`resources/agent-presets/<id>.json`）

每个预设一个 JSON 文件，文件名与 `id` 一致，字段：

```json
{
  "id": "deepchat-code-expert",
  "name": "代码专家",
  "description": "专注于软件工程与代码任务的助手",
  "systemPrompt": "……（实现者起草的中文人设）……",
  "enabledSkillNames": [
    "code-review", "git-commit", "mcp-builder",
    "skill-creator", "frontend-design", "web-artifacts-builder"
  ]
}
```

约束：`id` 必须匹配 `SAFE_AGENT_ID_PATTERN`（`src/main/skill/agentSkillRoots.ts`），否则技能
作用域根路径校验会失败。

## 立即行动（Next Steps / 实施步骤）

1. **定义 JSON schema 与类型**
   - 在 `src/shared/contracts/domainSchemas.ts` 增加 zod schema（`id`/`name`/`description`/
     `systemPrompt` 为 string，`enabledSkillNames` 为 `string[] | null`）。
   - 在 `src/shared/types/agent-interface.d.ts`（或就近的 shared 类型）增加
     `AgentPresetDefinition` 类型。

2. **新增内置预设资源**
   - 创建 `resources/agent-presets/deepchat-code-expert.json`、
     `deepchat-writing-assistant.json`、`deepchat-data-analyst.json`。
   - 起草三份中文 `systemPrompt` 与 `description`。
   - 在 `electron-builder.yml` 的 `extraResources` 增加：
     `from: ./resources/agent-presets/` → `to: app.asar.unpacked/resources/agent-presets`。

3. **泛化内置 agent 集合（核心）**
   - `src/main/agent/deepchat/deepChatAgentRepository.ts`：将 `ensureBuiltin` 泛化为可对任意
     稳定 id 执行 create-if-missing（保留现有 `ensureBuiltinDeepChatAgent` 对 `'deepchat'` 的行为）。
   - `src/main/agent/repository/index.ts`：新增 `ensureBuiltinDeepChatAgents(presets)`，循环
     调用 create-if-missing，并保留 `BUILTIN_DEEPCHAT_AGENT_ID` 导出。
   - `src/main/agent/settings.ts`：新增预设加载器（读取 `process.resourcesPath` 下
     `resources/agent-presets/*.json`，zod 校验，坏文件告警跳过、不阻断启动）；在
     `initializeUnifiedAgents()` 中先 ensure 主内置 `deepchat`，再 ensure 各预设。

4. **时序处理（关键风险）**
   - 确保 `AgentSettings.start()` 在 `SkillService.initialize()`（含
     `migrateLegacyAgentSkillScopes()`，见 `src/main/skill/index.ts`）之前完成内置 agent 落库，
     且 config 中已携带 `enabledSkillNames`，否则新内置会被按"全量技能"迁移落盘。
   - 核对 `src/main/skill/settings.ts:66` 的 `freezeLegacyMigrationTargets` 过滤逻辑是否把新
     内置 id 正确纳入技能迁移目标（当前仅排除 `BUILTIN_SKILL_AGENT_ID`）。

5. **排查单例假设**
   - `src/renderer/settings/components/DeepChatAgentsSettings.vue`：排序置顶
     （`a.id === 'deepchat'`，约 1057 行）与删除后回退（约 1704 行）改为"主内置集合优先"。
   - `src/main/agent/settings.ts` 的 `getPendingAgentSkillCleanupIds`（约 604 行）现仅排除
     `BUILTIN_DEEPCHAT_AGENT_ID`，需改为排除全部内置 id。
   - `src/main/agent/deepchat/deepChatAgentRepository.ts` 的
     `materializeLegacyInheritedConfigs`（约 274 行）现仅跳过 `'deepchat'`，需跳过全部内置。

6. **回归测试（最小、聚焦契约）**
   - `test/main/agent/...`：JSON 校验（合法/非法/坏文件）、幂等 create-if-missing（重复启动
     不重复创建、不覆盖用户编辑）。
   - `test/main/skill/...`：新内置的 `enabledSkillNames` 在技能作用域迁移后正确生效（白名单）。
   - 若存在，扩展 `test/renderer/components/DeepChatAgentsSettings.test.ts` 验证内置集合排序
     与"受保护不可删"。

7. **收尾**
   - `pnpm format`、`pnpm lint`、`pnpm typecheck`、相关最小测试套件。
   - Conventional Commit，如 `feat(agent): 通过打包内置 JSON 预置受保护 DeepChat Agent`。

## 验收标准（Definition of Done）

- 首次启动后，设置页 DeepChat Agent 列表出现 4 个内置：DeepChat、代码专家、写作助手、数据分析师。
- 4 个均为 `protected`（无删除按钮）、`enabled`，且出现在新建对话选择器与子代理目标中。
- 代码/写作/数据三个预设分别只启用各自 `enabledSkillNames` 的技能，通用助手启用全部。
- 编辑某个内置后重启，用户修改保留；删除配置文件中某个 JSON 不会破坏已存在的对应 agent。
- 坏 JSON 文件被跳过并告警，不阻断启动。
