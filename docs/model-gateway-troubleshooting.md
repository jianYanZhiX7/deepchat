# 模型网关相关故障排查

> 适用范围：DeepChat 主进程 → 模型网关（provider / 中转 / 代理）的请求-流式响应链路。
> 本文面向开发者与运维，描述典型故障现象、可观测字段、代码级处理策略与排查步骤。

## 1. 故障现象速查表

| 界面/日志现象 | 归类 | 典型 errorCode / 触发点 | 客户端行为 |
| --- | --- | --- | --- |
| 报错 `terminated`，流式生成中断 | 瞬时（transient） | `UND_ERR_SOCKET`（undici SocketError） | 分类为 transient；聊天路径自动重试一次；文案映射为「网络连接中断，请重试。」 |
| `Provider stream ended without a terminal stop event.` | 瞬时 | `premature_eof` | 无输出时重试；有输出时视配置重试一次 |
| 上下文窗口溢出相关报错 | 上下文溢出（context_overflow） | 请求组装层错误 | 触发压缩/摘要恢复或严格重试，耗尽后失败 |
| 限流/过载 429、5xx | 瞬时 | 见响应头 `retry-after*` / `x-should-retry` | 按服务端延时或指数退避重试（每逻辑轮上限 2 次） |
| 认证/配额/参数类 4xx | 永久（permanent） | `auth`/`api_key`/`quota`/`invalid_request` 等 | 不重试，直接报错 |
| 用户主动停止 | aborted | `AbortError` | 不重试 |
| MCP/ACP 子进程退出，`...could not be terminated` / `exited before session ... completed` | 进程层 | 子进程信号退出 | 视服务而定，查进程管理器日志 |

## 2. 已确认案例（参考）

- 现象：会话内模型生成长文约 118 秒后被中断，界面显示 `terminated`。
- 运行记录（`agent.db` 的 tape 事件）：

```
provider/attempt_completed:
  status: "error"
  failureClassification: "transient"
  retryDecision: "output_committed"
  errorCode: "UND_ERR_SOCKET"
```

- 根因：`UND_ERR_SOCKET` 为 Node 内置 HTTP 客户端 undici 的 `SocketError`——流式响应过程中 socket 被对端提前关闭，底层错误消息即 `terminated`（`node_modules/undici/lib/core/errors.js`）。
- 说明：该轮持续流出 token（非卡死），在推理结束、即将产出最终正文时连接被网关断开；属瞬时故障，客户端此前按 `output_committed` 处理（不重放）。

## 3. 错误分类与可观测字段

### 3.1 分类（`failureClassification`）

由 `src/main/agent/deepchat/loop/providerRetryPolicy.ts` 的 `classifyProviderFailure` 判定：

- 优先级：`aborted`（用户中止）> `context_overflow` > `permanent` > `transient` > `unknown`。
- 判定依据：错误码黑名单/白名单、HTTP 状态码、`retry-after`/`x-should-retry` 响应头、错误文本模式、`prematureEof`。
- 常见瞬时错误码（网络/socket/超时类）：`UND_ERR_SOCKET`、`ECONNRESET`、`ECONNABORTED`、`EPIPE`、`ETIMEDOUT`、`ESOCKETTIMEDOUT`、`ENET*`、`EAI_AGAIN`、`UND_ERR_BODY_TIMEOUT` 等。

### 3.2 重试决策（`retryDecision`）

由 `src/main/agent/deepchat/loop/contextCoordinator.ts` 在每个物理尝试后生成：

| 取值 | 含义 | 触发条件 |
| --- | --- | --- |
| `retry_scheduled` | 计划重试（尚未提交任何输出） | transient，未超预算，延时在服务端上限内 |
| `output_committed` | 已有输出提交，放弃重试或仅重试一次（见 §4.2） | transient/aborted 且已提交输出 |
| `retry_budget_exhausted` | 每逻辑轮重试预算耗尽 | 默认 2 次（`MAX_TRANSIENT_RETRIES_PER_LOGICAL_ROUND`） |
| `retry_after_exceeds_limit` | 服务端要求延时过长 | `Retry-After > 60s`（`PROVIDER_RETRY_MAX_SERVER_DELAY_MS`） |
| `context_recovery_scheduled` / `context_recovery_exhausted` | 上下文压缩恢复流程 | context_overflow |
| `not_retryable` | 不重试 | permanent / aborted / 禁用瞬时重试 |

### 3.3 数据落点

- 主进程日志：`<userData>/logs/main.log`（macOS 默认 `~/Library/Application Support/DeepChat/logs/main.log`）。
- 每次物理尝试：`agent.db` → `deepchat_tape_entries` 中 `kind='event'` 的 `provider/attempt_completed`（含 `failureClassification`、`retryDecision`、`errorCode`、`httpStatus`、`usage`）。
- 会话消息级：`deepchat_messages.metadata`（含 `runStopReason`、`runOutcome`、`provider`、`model`、`noProgressToolLoop` 等）。

## 4. 代码级处理策略

### 4.1 网络类错误：友好文案

`providerRetryPolicy.ts` 导出 `resolveFriendlyProviderFailureText(error)`：

- 遍历 error 及 cause 链，命中网络/socket 错误码（含 `UND_ERR_SOCKET`）或消息恰为 `terminated` 时，返回 `网络连接中断，请重试。`；
- 否则返回 `null`（保留原始文案）。
- 接入点：`runtime/process.ts`、`runtime/turnCoordinator.ts`、`runtime/dispatch.ts` 的终端错误消息生成处——不影响分类、重试决策与运行记录，仅替换用户可见文案。

### 4.2 已提交输出后的自动重试（单次）

背景：瞬时失败发生在已提交部分输出（如已流出的推理内容）之后时，旧逻辑直接以 `output_committed` 收尾，用户看到的是整轮失败。

新行为（`contextCoordinator.ts`）：

- 输入开关 `retryAfterOutputCommittedTransient`（仅主聊天路径由 `deepChatLoopRunner.ts` 开启，ACP/媒体/TTS 等不可幂等重放的路由保持关闭）；
- 条件：transient + 已提交输出 + 开关开启 + 未超过 `MAX_OUTPUT_COMMITTED_RETRIES_PER_LOGICAL_ROUND`（=1）+ 服务端延时未超上限；
- 触发一次同请求的物理重试（`attemptOrigin='transient_retry'`），重试后仍失败则按原语义收尾，不再无限重放。

已知代价（设计取舍）：重放会使**已展示内容重复一次**，并可能对输出 token **双倍计费**；因此限定为每逻辑轮 1 次且默认仅在主聊天路径生效。如产品上不可接受，将 `deepChatLoopRunner.ts` 中该参数置 `false` 即可回退旧行为。

### 4.3 上下文溢出恢复

`context_overflow` 由压缩/摘要（compaction）、严格重试、上下文压力恢复多级处理，相关实现位于：

- `runtime/contextBudget.ts`（上下文预算、输出预留、preflight）
- `runtime/contextBuilder.ts`（历史裁剪、溢出报错文案）
- `runtime/compactionRuntimeCoordinator.ts` / `compactionService.ts`（摘要恢复）
- `loop/contextCoordinator.ts`（决策与恢复编排）

### 4.4 其他注意点

- 每逻辑轮瞬时重试总预算默认 2 次；新增的“提交后重试”计入该预算（通过共用 `transientRetriesUsed`）。
- 服务端 `Retry-After` 超过 60 秒或 `x-should-retry: false` 会阻止重试。
- 用户主动中止（abort）永不自动重试。

## 5. 排查步骤

1. 复现并记录报错文案与发生时间。
2. 查 `main.log` 是否有进程级异常（崩溃/重启/子进程退出）。
3. 查最近一次失败会话在 `agent.db` 的 tape 事件：确认 `failureClassification` 与 `errorCode`：
   - `transient` + `UND_ERR_SOCKET`/`ECONNRESET` 等 → 网络链路/网关侧连接稳定性问题；
   - `permanent` → 检查密钥、配额、请求参数；
   - `context_overflow` → 查看输出预留与上下文预算设置。
4. 若为长流式中断：确认单次请求时长、网关空闲/时长限制、代理与本地网络（抓包看 RST/FIN）；必要时让任务分段生成以缩短单条连接时长。
5. 配置侧核对：模型「上下文长度」、聊天级「上下文长度/最大输出长度」覆盖、`thinkingBudget` 是否超出模型能力画像与 API 上限。

## 6. 相关常量位置

| 常量 | 文件 |
| --- | --- |
| `MAX_TRANSIENT_RETRIES_PER_LOGICAL_ROUND = 2`、`MAX_OUTPUT_COMMITTED_RETRIES_PER_LOGICAL_ROUND = 1` | `src/main/agent/deepchat/loop/providerRetryPolicy.ts` |
| 退避/服务端延时上限（500ms 起、8s 封顶、服务端 60s 封顶） | 同上 |
| 瞬时错误码集合、永久错误模式 | 同上 |
| `AGENT_CONTEXT_SAFETY_MARGIN_TOKENS`、`AGENT_REQUEST_MAX_OUTPUT_TOKENS_CAP` | `src/main/agent/deepchat/runtime/contextBudget.ts` |
| 模型上下文/输出默认值 | `src/shared/modelConfigDefaults.ts` |
