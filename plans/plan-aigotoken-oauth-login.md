# Plan: aigotoken OAuth 登录与内置 provider 接入（DeepChat）

## 目标

为 DeepChat 新增 aigotoken.com（自托管 llm-new-api 实例）作为内置 provider，支持两条接入路径：

1. **浏览器 OAuth 登录**（PKCE）：点"用 aigotoken 登录"打开系统浏览器，用户在 aigotoken.com 授权后自动获得 `sk-` key，写入 `provider.apiKey`，并自动拉取 `/v1/models` 填充模型列表。
2. **手动 apiKey**：用户也可直接粘贴已有 `sk-` key（与现有 custom provider 一致）。

参考 `claude-desktop-app` 的同名方案，但适配 DeepChat 的 Electron/Vue3/TS + IPC 路由契约架构，复用现有 OpenAI Codex（浏览器 + PKCE + loopback callback）范式。两个仓库都要改：llm-new-api（服务端 OAuth 提供方）+ DeepChat（客户端）。

llm-new-api: /home/cxy/projects/llm-new-api/
claude-desktop-app: /home/cxy/projects/claude-desktop-app/

## 关键依据

- DeepChat 已有成熟的 OAuth 基础设施（`src/main/provider/auth/`）：OpenAI Codex（浏览器 + PKCE + `oauthLoopbackCallback.ts`）、GitHub Copilot、xAI Grok。aigotoken 走最接近的 OpenAI Codex 范式，最大化复用。
- aigotoken.com 是 llm-new-api 实例，OpenAI 兼容网关，全部模型走 openai 格式代理；`/v1/models` 可动态拉取模型列表。
- 服务端 token 端点直接返回 `sk-` key（无限配额、无过期），链路最短、无 refresh 流程（比 OpenAI Codex 更简单，无需 CredentialStore/JWT 解析）。
- PKCE 使 public client 无需 client_secret；loopback callback 是桌面应用标准登录范式。
- 服务端按 client + token 名 find-or-create，避免重复 token；同用户跨设备复用同一 token。

## 约束

- **增量改造、不破坏现有代码**：新逻辑放新文件；对现有代码仅新增分支，不删除、不重写。遵循开闭原则（AGENTS.md）。
- **PKCE**：public client，无 client_secret；S256。
- **base URL**：`https://www.aigotoken.com` 统一用于 OAuth 授权页 + token 交换 + 推理 + 模型列表。provider 的 `baseUrl` = `https://www.aigotoken.com/v1`（OpenAI 兼容，与 deepseek/openrouter 等约定一致，带 `/v1`）。
- **client_id**：DeepChat 用硬编码 `deepchat`；服务端 client 注册表内校验，不做动态 client 注册。
- **回调端口**：DeepChat 用固定端口 `1456`（OpenAI Codex 用 1455，不冲突），路径 `/oauth/aigotoken/callback`，`redirect_uri = http://localhost:1456/oauth/aigotoken/callback`。端口必须固定（服务端注册表需精确匹配，不能 fallback 随机端口；与 OpenAI Codex 同样的已知限制：端口被占用则登录失败）。
- **不动 onboarding/首启**：aigotoken 仅作为 `DEFAULT_PROVIDERS` 里的内置可选项，默认 `enable: false`，用户主动选用或登录。
- **key 失效处理精简**：不做推理前预检、不发结构化 401 事件。复用 chat loop 现有 per-request 错误处理 + `providers.testConnection` 手动测试。
- **登出**：仅清本地 `provider.apiKey`，保留内置 provider 条目，不在服务端吊销 token（用户在 aigotoken 面板自行管理）。
- **双通道收敛**：OAuth 与手动输入都写入同一 `provider.apiKey` 字段，last-write-wins。
- **服务端向后兼容**：泛化时保留原 `claude-desktop-app` client 条目，不破坏 claude-desktop-app 现有流程。
- 遵循 AGENTS.md：pnpm、Oxfmt（单引号、无分号、100 列）、vue-i18n、shadcn-vue、Conventional Commits、类型化 preload/IPC 边界。

## 架构

### llm-new-api 侧（aigotoken.com）— 泛化为多 client OAuth 提供方

当前 `controller/oauth_provider.go:19-21` 写死单一 client（`claude-desktop-app` / 端口 30080 / token 名 `Claude-Code`）。改为 client 注册表：

新增结构（`controller/oauth_provider.go` 内）：

```go
type oauthProviderClient struct {
    ClientID    string
    RedirectURI string
    TokenName   string
    DisplayName string // 供 SPA 授权页展示
}

var oauthProviderClients = map[string]oauthProviderClient{
    "claude-desktop-app": {
        ClientID:    "claude-desktop-app",
        RedirectURI: "http://127.0.0.1:30080/api/aigotoken/callback",
        TokenName:   "Claude-Code",
        DisplayName: "Claude Desktop App",
    },
    "deepchat": {
        ClientID:    "deepchat",
        RedirectURI: "http://localhost:1456/oauth/aigotoken/callback",
        TokenName:   "DeepChat",
        DisplayName: "DeepChat",
    },
}
```

增量改动（仅替换硬编码常量为查表，逻辑不变）：

- `OAuthProviderAuthorize`：用 `oauthProviderClients[req.ClientID]` 查找；校验 `req.RedirectURI === client.RedirectURI`；`findOrCreateOAuthProviderToken` 改为接收 `client.TokenName` 参数；`AuthFlow.Provider` 存实际 `client_id`。
- `OAuthProviderToken`：同样查表校验 `client_id` + `redirect_uri`；`ConsumeAuthFlow` 的 `AuthFlowMatch.Provider` 用实际 `client_id`。
- `findOrCreateOAuthProviderToken(userId, tokenName)`：按传入的 token 名 find-or-create。

SPA 授权同意页（`web/src/routes/oauth/authorize.tsx`）：

- 当前可能硬编码 "Claude-Code" 文案。改为从 `client_id` 查注册表取 `DisplayName` + `TokenName` 动态展示（如 "DeepChat 请求创建一个名为 DeepChat 的 API token"）。
- 若该 SPA 路由已存在，仅需把硬编码文案替换为按 client 查表；若未覆盖 `deepchat`，无需新路由，沿用 NoRoute fallback 服务 SPA 即可。

### DeepChat 侧 — 客户端

**新增文件：**

- `src/main/provider/auth/aigotoken/constants.ts`
  - `AIGOTOKEN_CLIENT_ID = 'deepchat'`
  - `AIGOTOKEN_HOST = 'https://www.aigotoken.com'`
  - `AIGOTOKEN_AUTHORIZE_URL = ${HOST}/oauth/authorize`（SPA 路由 URL，服务器 NoRoute fallback 服务 SPA）
  - `AIGOTOKEN_TOKEN_URL = ${HOST}/api/oauth/token`
  - `AIGOTOKEN_MODELS_URL = ${HOST}/v1/models`
  - `AIGOTOKEN_REDIRECT_PORT = 1456`（env 可覆盖，仿 openaiCodex 的 `getPortEnv`）
  - `AIGOTOKEN_REDIRECT_PATH = '/oauth/aigotoken/callback'`
  - `AIGOTOKEN_REDIRECT_URI`（默认 `http://localhost:1456/oauth/aigotoken/callback`，env 可覆盖）
  - `AIGOTOKEN_BROWSER_TIMEOUT_MS`（10 分钟，仿 codex）
  - `AIGOTOKEN_REQUEST_TIMEOUT_MS`（10s，token 交换超时）

- `src/main/provider/auth/aigotoken/pkce.ts`
  - `createAigotokenPkcePair()`：`code_verifier` = `crypto.randomBytes(32)` base64url 无 padding；`code_challenge` = `sha256(verifier)` base64url 无 padding。
  - `createAigotokenState()`：`crypto.randomBytes(16)` hex。
  - （与 openaiCodex/pkce 同构；独立成文件以保持所有权清晰，避免跨模块耦合。）

- `src/main/provider/auth/aigotoken/index.ts`
  - `AigotokenAuth` 类，构造注入 `ProviderSettingsPort`（getProviderById/setProviderById）+ `DeepchatEventPublisher`。
  - 内存 `pendingBrowserFlow: { state, codeVerifier, redirectUri, callbackSession, cancelled }`。
  - `getStatus(): AigotokenAuthStatus`：读 aigotoken provider 的 `apiKey` 是否非空 + pending 状态。
  - `startBrowserLogin()`：生成 state + PKCE；`startOAuthLoopbackCallbackSession`（复用 `oauthLoopbackCallback.ts`，preferredPort=1456，path=`/oauth/aigotoken/callback`，redirectHost=`localhost`）；构造 authorize URL（`client_id`/`response_type=code`/`redirect_uri`/`state`/`code_challenge`/`code_challenge_method=S256`）；`shell.openExternal`；后台跑 `completeBrowserLogin`。
  - `completeBrowserLoginFromCallbackUrl(url)`：委托 `callbackSession.resolveCallbackUrl`（支持手动粘贴回调 URL，与 OpenAI Codex 一致）。
  - `cancelLogin()`：关 callbackSession、清 pending。
  - `logout()`：清 aigotoken provider 的 `apiKey`（保留 provider 条目），发 statusChanged。
  - `completeBrowserLogin(flow, callbackPromise)`：拿 code -> POST `${AIGOTOKEN_TOKEN_URL}`（`grant_type=authorization_code`/`code`/`code_verifier`/`client_id`/`redirect_uri`，10s 超时）-> 收 `access_token`（`sk-` key）-> 写 aigotoken provider.apiKey -> 调模型拉取填充 provider.models -> 发 statusChanged。
  - `fetchModels(apiKey)`：GET `${AIGOTOKEN_MODELS_URL}`，映射为 `{id, name, enabled}` 写入 provider.models。
  - PKCE 校验在服务端做（客户端只生成，不验证 challenge）。
  - `initializeGlobalAigotokenAuth(publishEvent)` / `getGlobalAigotokenAuth()`，与 openaiCodex 同构。
  - `AigotokenAuthStatus`：`{ state: 'signed-out'|'pending-browser'|'authenticated'|'error', authenticated: boolean, error?: string }`（无 accountId/expiresAt/storage，sk- key 不透明、无过期）。

- `src/renderer/settings/components/AigotokenOAuth.vue`
  - 仿 `OpenAICodexOAuth.vue` 结构：状态条 + "用 aigotoken 登录"按钮 + pending 时的"粘贴回调 URL"对话框 + "取消" + 已认证时的"登出"+"测试连接"。
  - `createOAuthClient()` 调 aigotoken 方法；`onAigotokenStatusChanged` 订阅事件；pending 时 2s 轮询 status。
  - `auth-success` emit 供父组件触发 provider 刷新。

- `plans/plan-aigotoken-oauth-login.md`（本文件）

**对现有文件的增量编辑（仅新增分支）：**

- `src/main/provider/defaults.ts`
  - `DEFAULT_PROVIDERS` 新增条目：
    ```
    { id: 'aigotoken', name: 'Aigotoken', apiType: 'openai-completions',
      apiKey: '', baseUrl: 'https://www.aigotoken.com/v1', enable: false,
      websites: { official: 'https://www.aigotoken.com',
                  apiKey: 'https://www.aigotoken.com/console',
                  docs: 'https://www.aigotoken.com',
                  models: 'https://www.aigotoken.com/v1/models',
                  defaultBaseUrl: 'https://www.aigotoken.com/v1' } }
    ```
  - apiType 用 `openai-completions`（多数 OpenAI 兼容网关的通用类型，如 openrouter/deepseek 网关类）。若 `new-api` apiType 有更优的模型拉取行为，实现时调研后可改用 `new-api`（待验证）。

- `src/shared/contracts/routes/oauth.routes.ts`
  - 新增 `AigotokenAuthStatusSchema` + `AigotokenStatusResultSchema`。
  - 新增路由契约：`oauthAigotokenGetStatusRoute` / `oauthAigotokenStartBrowserLoginRoute` / `oauthAigotokenCompleteBrowserLoginFromUrlRoute`（input: `{ callbackUrl }`）/ `oauthAigotokenCancelLoginRoute` / `oauthAigotokenLogoutRoute`。结构与 openaiCodex 路由对称。

- `src/shared/contracts/events/oauth.events.ts`
  - 新增 `oauthAigotokenStatusChangedEvent`（payload: `{ status: AigotokenAuthStatusSchema, version }`）。

- `src/shared/types/oauth.ts`
  - `OAuthServicePort` 接口新增 aigotoken 方法签名（getStatus/startBrowserLogin/completeBrowserLoginFromUrl/cancelLogin/logout）。

- `src/main/provider/auth/index.ts`（OAuthService）
  - 构造里 `initializeGlobalAigotokenAuth(publishEvent)`。
  - 新增 5 个委托方法，调 `getGlobalAigotokenAuth()`。

- `src/main/provider/routes.ts`
  - import 5 个 aigotoken route 契约；在 `createRouteMap` 末尾新增 5 个 `[name, handler]` 元组，结构与 openaiCodex 处理器对称（line 693-736 范式）。

- `src/main/app/composition.ts`
  - 若需要全局初始化（仿 openaiCodex 的 initialize 调用点），加一行。否则 OAuthService 构造已覆盖。

- `src/renderer/api/OAuthClient.ts`
  - 新增 aigotoken 方法：`getAigotokenStatus` / `startAigotokenBrowserLogin` / `completeAigotokenBrowserLoginFromUrl` / `cancelAigotokenLogin` / `logoutAigotoken` + `onAigotokenStatusChanged`。仿 openaiCodex 客户端写法。

- `src/renderer/settings/components/ProviderApiConfig.vue`
  - 在 OAuth 组件选择区（line 86-107 范围）新增分支：`provider.id === 'aigotoken'` 时渲染 `<AigotokenOAuth>` + 保留下方手动 apiKey 输入框（双通道，仿 grok 分支把 OAuth 放在手动 key 字段之上的写法）。
  - import `AigotokenOAuth`。
  - `auth-success` 回调里调 provider 刷新（刷新模型列表）。

- i18n：`src/renderer/src/i18n/{en-US,zh-CN}/settings.json`（其余语种按现有流程跟进）
  - 新增 `settings.provider.aigotoken*` 文案：登录/重连/登出/取消/粘贴回调/已连接/未连接/等待浏览器/登录失败/提示语。

## 数据模型

- `DEFAULT_PROVIDERS`：新增 aigotoken 内置条目（见上）。
- provider 运行时：aigotoken provider 的 `apiKey` 存 `sk-` key（与现有 custom provider 一致，明文随 provider store 持久化，属既有行为，非本次引入的风险）。
- OAuth state + code_verifier：仅内存（`pendingBrowserFlow`），不持久化；登录完成或取消即弃。
- llm-new-api DB：`AuthFlow`（Purpose=`oauth_provider`，Provider=实际 client_id，payload 存 PKCE challenge + token_id + client/redirect 绑定）；`Token`（按 user + token 名 find-or-create，无限配额、无过期）。

## OAuth 流程时序

1. 用户在 ProviderApiConfig（aigotoken provider 配置）点"用 aigotoken 登录"。
2. 前端 `oauthAigotokenStartBrowserLoginRoute` -> OAuthService -> `AigotokenAuth.startBrowserLogin`：
   - 生成 state + PKCE pair；`startOAuthLoopbackCallbackSession`（port 1456, path `/oauth/aigotoken/callback`）。
   - 构造 `https://www.aigotoken.com/oauth/authorize?client_id=deepchat&response_type=code&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256`。
   - `shell.openExternal` 打开系统浏览器；后台等 callback。
3. 浏览器访问授权 URL，服务器 NoRoute fallback 返回 SPA；SPA 检查登录态（未登录跳 sign-in 后回跳），渲染同意页（按 client_id 查注册表展示 "DeepChat"）。
4. 用户点"允许" -> SPA `POST /api/oauth/authorize`（带 Bearer header）-> 服务端查 `deepchat` client、校验 redirect_uri、find-or-create 名为 "DeepChat" 的 token、生成短期 auth code、返回 `{ code, state, redirect_uri }`。
5. SPA `window.location.href = redirect_uri?code=...&state=...`（顶层导航到 DeepChat loopback callback）。
6. loopback server 收 code -> `AigotokenAuth.completeBrowserLogin`：POST `${AIGOTOKEN_TOKEN_URL}`（code + code_verifier + client_id + redirect_uri，10s 超时）-> 收 `access_token`（`sk-` key）。
7. 写 aigotoken provider.apiKey = sk- key；`fetchModels` 填充 provider.models；发 statusChanged。
8. loopback 返回"返回 DeepChat"成功 HTML 给浏览器。
9. 前端轮询/事件检测到 authenticated -> 导航/刷新 provider 配置。
10. 手动粘贴回退：用户可复制浏览器 URL，点"粘贴回调 URL"对话框，走 `completeBrowserLoginFromUrl`。

## 健壮性与边界

- **启动校验**：AigotokenOAuth.vue 挂载时调 `getAigotokenStatus`；apiKey 非空即 authenticated，UI 正常。
- **key 失效**：靠 chat loop 现有 per-request 401 错误处理自然报错；用户在 provider 配置点"测试连接"（`providers.testConnection`）或重新登录/改 key。不做预检、不发结构化事件。
- **exchangeCode 超时**：10s，超时 abort 并 reject，错误进 status.error。
- **回调超时**：用户打开浏览器后 10 分钟未回调 -> loopback session 超时 -> status.error。
- **端口占用**：1456 被占则登录失败（与 OpenAI Codex 同样的已知限制；不 fallback 随机端口，因 redirect_uri 需精确注册）。
- **重复 token**：服务端按 user + token 名 find-or-create；已存在但被禁用（Status != 1）自动重启用；不存在才创建。
- **PKCE 双端一致**：JS base64url 无 padding，Go `base64.RawURLEncoding` 无 padding，S256 一致。
- **Auth code 用后即焚**：服务端 `ConsumeAuthFlow` 事务级原子消费。
- **state 防泄漏**：loopback session 完成即关 server；pendingFlow 即用即弃。
- **登出**：清 provider.apiKey，保留 provider 条目；不在服务端吊销（用户在 aigotoken 面板自行管理）。
- **双通道冲突**：OAuth 与手动输入都写 provider.apiKey，last-write-wins；OAuth 成功后自动刷新模型列表。
- **跨设备**：同用户 find-or-create 同一 "DeepChat" token，多设备共享 key（可接受）。

## 立即下一步

1. **llm-new-api**：`controller/oauth_provider.go` 引入 client 注册表，泛化 authorize/token handler + find-or-create 接收 token 名；保留 claude-desktop-app 条目。
2. **llm-new-api**：SPA 授权页按 client_id 查表动态展示 DisplayName/TokenName。
3. **DeepChat**：`src/main/provider/auth/aigotoken/`（constants + pkce + index），实现 PKCE + loopback + 交换 + provider 写 key + 拉模型 + status 事件。
4. **DeepChat**：`defaults.ts` 新增 aigotoken 内置 provider。
5. **DeepChat**：`oauth.routes.ts` + `oauth.events.ts` + `types/oauth.ts` 新增契约与接口。
6. **DeepChat**：`OAuthService`（auth/index.ts）+ `routes.ts` 接入 5 个路由处理器。
7. **DeepChat**：`OAuthClient.ts` + `AigotokenOAuth.vue` + `ProviderApiConfig.vue` 接入 UI（双通道：OAuth + 手动 key）。
8. **DeepChat**：i18n（en-US + zh-CN 优先）。
9. **测试**：PKCE pair 正确性、provider upsert（写 apiKey + models）、model fetch 映射的最小回归测试（vitest）；oauth 路由契约一致性（仿 `test/main/routes/contracts.test.ts`）。
10. **联调**：本地跑通 llm-new-api + DeepChat，浏览器登录 -> 拿 key -> 拉模型 -> 发消息。
11. **handoff 前**：format（Oxfmt）+ typecheck + lint + i18n + 相关测试套件。

## 受影响文件清单

### llm-new-api（增量编辑，泛化为多 client）
- `controller/oauth_provider.go`（client 注册表 + authorize/token/find-or-create 参数化）
- `web/src/routes/oauth/authorize.tsx`（按 client 动态展示，若已硬编码文案）

### DeepChat（新增）
- `src/main/provider/auth/aigotoken/constants.ts`
- `src/main/provider/auth/aigotoken/pkce.ts`
- `src/main/provider/auth/aigotoken/index.ts`
- `src/renderer/settings/components/AigotokenOAuth.vue`
- `plans/plan-aigotoken-oauth-login.md`（本文件）

### DeepChat（增量编辑，仅新增分支）
- `src/main/provider/defaults.ts`（+aigotoken 内置 provider）
- `src/shared/contracts/routes/oauth.routes.ts`（+5 路由契约 + status schema）
- `src/shared/contracts/events/oauth.events.ts`（+statusChanged 事件）
- `src/shared/types/oauth.ts`（+OAuthServicePort aigotoken 方法）
- `src/main/provider/auth/index.ts`（OAuthService +aigotoken 委托）
- `src/main/provider/routes.ts`（+5 路由处理器）
- `src/main/app/composition.ts`（+初始化，如需）
- `src/renderer/api/OAuthClient.ts`（+aigotoken 客户端方法）
- `src/renderer/settings/components/ProviderApiConfig.vue`（+aigotoken 分支，双通道）
- `src/renderer/src/i18n/{en-US,zh-CN}/settings.json`（+aigotoken 文案）

### 测试（新增）
- `test/main/provider/auth/aigotoken/*.test.ts`（PKCE + provider upsert + model 映射）
- `test/main/routes/contracts.test.ts`（+aigotoken 路由契约一致性）

## 遗留/待验证

1. **apiType 选择**：`openai-completions` vs `new-api`。aigotoken 是 llm-new-api 实例，若 `new-api` apiType 有更优的模型拉取/能力探测行为则改用；实现时调研 `src/main/provider/` 下两者差异后定。
2. **服务端 SPA 授权页现状**：需确认 `web/src/routes/oauth/authorize.tsx` 当前是否硬编码 "Claude-Code" 文案；若已按 client 动态展示则服务端 SPA 无需改动。
3. **端口 1456 可用性**：实现时确认无其他流程占用；若需避让可调（但需服务端注册表同步）。
4. **API key 明文存储**：sk- key 随 provider store 明文持久化，与现有 custom provider 一致，属既有风险，非本次引入。
5. **find-then-create 竞态**：并发 authorize 可能各自创建 token，靠 Key 唯一索引兜底；罕见，可接受（与 reference plan 同）。
