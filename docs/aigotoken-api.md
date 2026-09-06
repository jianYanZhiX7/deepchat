# Aigotoken 接口文档

> 本文档记录 DeepChat 客户端对 **aigotoken.com**（llm-new-api 网关，OpenAI 兼容）的所有网络调用，
> 涵盖 OAuth 认证、模型列表、对话推理与向量化等接口。代码事实基准：`src/main/provider/auth/aigotoken/`、
> `src/main/provider/aiSdk/`、`src/main/provider/providers/aiSdkProvider.ts`。

## 1. 概述

| 项 | 值 |
|---|---|
| 域名（内置默认） | `https://www.aigotoken.com` |
| API Base URL | `https://www.aigotoken.com/v1`（OpenAI 兼容，带 `/v1`） |
| Provider ID | `aigotoken` |
| apiType | `new-api` |
| 客户端标识 | `client_id=deepchat` |
| 请求超时 | 10s（`AIGOTOKEN_REQUEST_TIMEOUT_MS`，可环境变量覆盖） |
| 浏览器登录等待 | 10min（`AIGOTOKEN_BROWSER_TIMEOUT_MS`） |
| 模型列表轮询 | 30min（`AIGOTOKEN_MODELS_REFRESH_INTERVAL_MS`，登录态且非隐私模式） |
| 鉴权方式 | OAuth 2.0 PKCE 换取 `sk-` Key；此后所有 `/v1` 请求带 `Authorization: Bearer <sk->` |

注册定义：`src/main/provider/defaults.ts:267-281`（`apiType: 'new-api'`，`baseUrl: 'https://www.aigotoken.com/v1'`）。

URL 常量集中于 `src/main/provider/auth/aigotoken/constants.ts`：

| 常量 | 值 |
|---|---|
| `AIGOTOKEN_HOST` | `https://www.aigotoken.com` |
| `AIGOTOKEN_AUTHORIZE_URL` | `https://www.aigotoken.com/oauth/authorize` |
| `AIGOTOKEN_TOKEN_URL` | `https://www.aigotoken.com/api/oauth/token` |
| `AIGOTOKEN_MODELS_URL` | `https://www.aigotoken.com/v1/models` |
| `AIGOTOKEN_CLIENT_ID` | `deepchat` |
| 本地回调 | `http://localhost:1456/oauth/aigotoken/callback`（端口 1456，路径可被 `AIGOTOKEN_REDIRECT_URI` 整体覆盖） |

## 2. 接口清单

### 2.1 OAuth 授权（浏览器）— `/oauth/authorize`

- 方法：`GET`（系统浏览器打开，非 `fetch`）
- 触发：设置页/登录页点击"用 aigotoken 登录" → `AigotokenAuth.startBrowserLogin()`
- 代码：`src/main/provider/auth/aigotoken/index.ts:139-156`
- 参数（Query）：

| 参数 | 值 |
|---|---|
| `client_id` | `deepchat` |
| `response_type` | `code` |
| `redirect_uri` | 本地回环回调地址（由 loopback session 分配） |
| `state` | 随机防 CSRF |
| `code_challenge` | PKCE S256 派生 |
| `code_challenge_method` | `S256` |

### 2.2 Token 交换 — `POST /api/oauth/token`

- 方法：`POST`，`Content-Type: application/json`
- 触发：授权回调拿到 `code` 后 → `AigotokenAuth.exchangeAuthorizationCode()`
- 代码：`src/main/provider/auth/aigotoken/index.ts:263-313`
- 请求体：

```json
{
  "grant_type": "authorization_code",
  "client_id": "deepchat",
  "code": "<authorization code>",
  "redirect_uri": "<本地回调地址>",
  "code_verifier": "<PKCE verifier>"
}
```

- 响应：`{ "access_token": "<sk-...>" }`；业务错误以 `error` / `error_description` 字段返回，会抛错并脱敏记录。
- 成功后将 `access_token` 写入 provider `apiKey` 并自动 `enable=true`。

### 2.3 模型列表 — `GET /v1/models`

三处调用点（接口相同、时机不同）：

| 调用点 | 触发 | 代码 |
|---|---|---|
| 登录成功后拉取入库 | OAuth 完成 → `fetchAndStoreModels()` | `index.ts:339-379` |
| 手动同步 | UI 触发 → `syncModels()`（返回是否有变化） | `index.ts:381-440` |
| 运行时通用拉取 | 模型来源刷新/巡检（new-api modelSource） | `aiSdkProvider.ts:1976 fetchNewApiModels` |

- 请求头：`Authorization: Bearer <sk->`
- 响应：`{ "data": [ ModelRecord ] }`，字段：

| 字段 | 用途 |
|---|---|
| `id` | 模型 ID，同时作为展示名 |
| `owned_by?` | 归属（可用于路由判断） |
| `context_window?` / `context_length?` / `contextLength?` / `input_token_limit?` / `max_input_tokens?` | 上下文长度（按序取首个有效值） |
| `max_tokens?` / `max_output_tokens?` / `output_token_limit?` | 最大输出 token |

- 拉取后写入 provider 模型库并广播 `models.changed`；`/v1/models` 非 2xx 时：登录场景仅告警，同步场景返回 `false`，不中断会话。

### 2.4 对话推理 — `POST /v1/chat/completions`

- 主路径：文本对话 / 流式推理
- 代码：`providerFactory.ts:716`（`buildOpenAIEndpoint(baseUrl, '/chat/completions')`），
  baseUrl 运行时解析为 `${getNormalizedNewApiHost()}/v1`（`aiSdkProvider.ts:2732`）
- 归一化规则（`getNormalizedNewApiHost`，`aiSdkProvider.ts:252-258`）：去掉尾部 `/`，若以 `/v1`、`/v1beta...` 结尾则剥离，再统一拼 `/v1`。
- 鉴权：`Authorization: Bearer <sk->`；错误信息记录前脱敏（`access_token`/`Bearer`/`sk-` 打码，`index.ts:67-73`）。
- 语义：OpenAI Chat Completions 格式，支持流式与思考内容（reasoning_content）回传。

### 2.5 向量化 — `POST /v1/embeddings`

- 触发：embedding 策略为 `new-api` 的向量请求
- 代码：`aiSdkProvider.ts:2772`（`baseUrl: ${getNormalizedNewApiHost()}/v1`），走 openai-compatible embedding
- 鉴权同上。

### 2.6 图像生成 — `POST /v1/images/generations`

- 触发：选用该 provider 下的图像生成模型（OpenAI 兼容 image 通道），按需
- 代码：`providerFactory.ts` openai-compatible 分支 `imageModel`

### 2.7 按模型的原生协议通道（网关路由派生）

new-api 网关可按模型选择协议（`resolveNewApiEndpointType`，`aiSdkProvider.ts:328-343`），
判定信号依次为：模型 route 配置 `endpointType` → 本地存储路由元数据 → `ownedBy`/能力族提示。

- **anthropic 类**：baseUrl 用 host（不带 `/v1`），走 Anthropic 原生协议（`/v1/messages`），`aiSdkProvider.ts:415-436`
- **gemini 类**：走 Google 原生协议通道

此类路径是否出现取决于网关上模型的路由元数据，属可选派生路径，非默认主路径。

## 3. 非接口的域名访问（官网跳转）

| 场景 | 地址 | 代码 |
|---|---|---|
| 侧边栏品牌入口 | `https://www.aigotoken.com` | `WindowSideBar.vue:1333-1334` |
| API Key 控制台（配置展示） | `https://www.aigotoken.com/console` | `defaults.ts:276` |
| 模型文档链接 | `https://www.aigotoken.com/v1/models` | `defaults.ts:278` |

## 4. 定时任务与生命周期

- `AigotokenModelMonitor`（`auth/aigotoken/monitor.ts`）：`setInterval` 每 30min 执行一次；
  已登录且非隐私模式时调用 `syncModels()`，检测到模型集变化则记录日志并广播 `models.changed`。
- `logout()`：仅本地清空 `apiKey`，**不**调用服务端登出/吊销接口。
- OAuth 本地回调 session 超时 10min；取消登录会关闭回调 session 并清理 pending 状态。

## 5. 环境变量覆盖项

| 变量 | 默认 | 说明 |
|---|---|---|
| `AIGOTOKEN_REDIRECT_PORT` | `1456` | 本地回调端口（1-65535 合法才生效） |
| `AIGOTOKEN_REDIRECT_URI` | `http://localhost:1456/oauth/aigotoken/callback` | 整体覆盖回调地址 |
| `AIGOTOKEN_BROWSER_TIMEOUT_MS` | `600000` | 浏览器授权等待上限 |
| `AIGOTOKEN_REQUEST_TIMEOUT_MS` | `10000` | 单次请求超时 |
| `AIGOTOKEN_MODELS_REFRESH_INTERVAL_MS` | `1800000` | 模型列表巡检间隔 |

## 6. 注意事项

1. Token 交换接口位于 `/api/oauth/token`（带 `/api` 前缀），与常规 `/oauth/token` 不同；网关侧若调整路由需同步修改 `constants.ts`。
2. 内置默认 `baseUrl` 为 `https://www.aigotoken.com/v1`；用户在设置页可覆盖 baseUrl，归一化后域名将随配置变化。
3. 兜底模型常量 `DEFAULT_MODEL_FALLBACK`（`src/main/session/defaultModelFallback.ts`）引用 `aigotoken/deepseek-v4-pro`，与网关实际模型需保持一致，避免会话创建后模型不可用。
4. 推理请求经由统一 AI SDK 通道（含 fetch dispatcher/代理），若走代理需保证对上述域名可达。
