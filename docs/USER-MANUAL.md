# DeepChat 用户使用手册

> 适用版本：1.1.0-beta.x（跨平台桌面客户端）
> 编写日期：2026-09-06
> 说明：本文面向最终用户。文中菜单名称以当前版本界面为准，若与你安装的版本不一致，以实际发布版为准。

## 1. 产品简介

DeepChat 是一款开源、本地优先的 Agent 桌面客户端。它将云端大模型与本地模型、Agent、
Skills、MCP（Model Context Protocol）、ACP（Agent Client Protocol）与远程控制能力统一在
一个桌面应用中，数据默认保存在本地。

核心定位：

- 一套应用管理多家模型提供商（云端 API 与本地 Ollama 等），无需在多个应用间切换。
- 会话与 Agent 过程基于 Tape.systems 哲学设计：工作历史可恢复、可追踪、可审计。
- 支持以 MCP/Skills/ACP 扩展能力，可通过 IM 工具远程控制会话。
- 支持 Windows、macOS、Linux 三个平台。

## 2. 安装

### 2.1 平台与安装包格式

| 平台 | 安装包格式 |
| --- | --- |
| Windows | `.exe` 安装程序 |
| macOS | `.dmg` 镜像 |
| Linux | `.AppImage` 或 `.deb` |

### 2.2 获取安装包

方式一：GitHub Releases
从 [GitHub Releases](https://github.com/ThinkInAIXYZ/deepchat/releases) 下载对应系统的最新版本。

方式二：官网下载
访问[官网下载页](https://deepchatai.cn/#/download)。

方式三：Homebrew（仅 macOS）

```bash
brew install --cask deepchat
```

### 2.3 首次启动

启动后进入主界面。首次使用前需要先配置至少一个可用的模型或 Agent（见第 3 节），然后即可
新建会话开始对话。

## 3. 快速上手

### 3.1 配置模型

1. 点击界面中的**设置**图标。
2. 选择**模型提供商**选项卡。
3. 按需执行下列任一配置。

配置云端模型（以官方 API 为例）：

- 选择供应商预设（如 OpenAI、Anthropic、Gemini、DeepSeek、Moonshot/Kimi、智谱、豆包、
  通义千问/DashScope、MiniMax、腾讯混元、Grok 等）。
- 填入 API Key 并保存。

配置本地模型（Ollama）：

- 选择 Ollama 预设，确保本机 Ollama 服务已运行，应用内可直接管理模型的下载、部署与运行。

配置自定义/兼容端点：

- DeepChat 兼容任何 **OpenAI / Gemini / Anthropic API 格式**的服务。聚合网关与中转服务
  （如 OpenRouter、New API、AIHubMix 等）同样以预设或自定义端点形式接入。
- 自定义时填写 Base URL、API Key 与模型名即可。

### 3.2 新建会话并选择模型

1. 点击 **"+"** 按钮创建新对话。
2. 在模型选择器中选择模型（或 Agent，见第 4 节）。
3. 输入内容开始与 AI 交互。

### 3.3 基础对话操作

- 多窗口 + 多 Tab：支持多个会话并行运行，互不阻塞，类似浏览器标签页的使用方式。
- 停止生成：生成过程中可随时停止当前回复。
- 重试与变体：可对消息重试生成多个候选回复。
- 对话分支：可在任意消息处分支出新会话路径。
- 渲染能力：完整 Markdown 渲染、代码块、图片、Mermaid 图表等；支持 Artifacts 结果展示；
  部分模型支持文本生成图像（如 GPT-4o、Gemini、Grok 系模型）。

## 4. 界面与核心概念

- **模型选择器**：统一的入口。除普通模型外，也可在此选择 DeepChat 内置 Agent、ACP Agent
  或远程控制能力 Agent。
- **Agent 会话**：支持绑定项目目录、设置权限模式、查看工具输出；上下文可恢复，适合长时间
  运行的任务。
- **Tape 与 Trace**：会话 Tape 记录结构化工作历史，支持恢复与续跑。Trace 预览可查看请求
  序号、供应商/模型元数据、Tape 视图清单、上下文条目与 token 预算，便于调试长会话。
- **权限与工具**：Agent/工具调用受权限控制，使用前会明确展示工具调用及其参数/返回数据。

## 5. 功能详解

### 5.1 Skills

Skills 是兼容标准 Agent Skills 规范的能力包，可包含任务说明、参考资料、素材与可选脚本。
启用后 DeepChat 在对应会话中更像某个领域的专门助手。

快速上手：

1. 打开 **设置 → Skills**。
2. 从**文件夹、ZIP 文件或 URL** 安装一个 Skill，或从其他工具导入。
3. 在需要该能力的会话中**启用**它。

其他要点：

- 内置 Skills 覆盖算法艺术、代码审查、文档协作、DOCX、前端设计、git commit、信息图语法、
  MCP 构建、PDF、PPTX、Skill 创建、Web Artifacts、XLSX 等工作流。
- 可与 Claude Code、Codex、Cursor、Windsurf、GitHub Copilot 等兼容工具相互导入/导出。

### 5.2 MCP（Model Context Protocol）

DeepChat 完整支持 MCP 三大核心能力，是扩展工具生态的主要方式：

- **Resources / Prompts / Tools** 全支持。
- 传输协议：支持 StreamableHTTP、SSE、Stdio 等。
- 内置 Node.js 运行环境，`npx` / `node` 类 MCP 服务可开箱即用。
- 支持 **inMemory 服务**，内置代码执行、网络信息获取、文件操作等实用能力。
- 工具调用过程清晰展示，支持查看参数与返回数据以辅助调试。
- 支持通过 **DeepLink 一键安装** MCP 服务（见 5.6）。

### 5.3 ACP（Agent Client Protocol）Agent

DeepChat 可将外部 Agent Runtime 以原生体验接入，ACP Agent 会作为一等"模型"出现在模型
选择器中，适合编码/任务类工作流。

快速上手：

1. 打开 **设置 → ACP Agent** 并开启 ACP。
2. 启用一个内置 ACP Agent，或添加自定义 ACP 兼容命令。
3. 在模型选择器中选择该 ACP Agent，开始一个 Agent 会话。

Agent 支持时，可通过 Workspace UI 查看结构化计划、工具调用与终端输出。

### 5.4 搜索与联网

- 内置集成博查搜索、Brave Search 等搜索 API，模型可自行决定何时搜索。
- 支持模拟用户网页浏览，读取 Google、Bing、百度、搜狗公众号搜索等主流搜索引擎结果。
- 可配置"搜索助手模型"，连接任意搜索源（内部网络、无 API 的引擎、垂直领域搜索引擎）作为
  模型的信息源。
- 外部信息源在内容中以高亮方式标出。

### 5.5 Ollama 本地模型管理

集成 Ollama 并提供完整管理功能，无需命令行即可在应用内完成模型的下载、部署与运行。

### 5.6 DeepLink

DeepChat 支持通过链接与外部应用集成：

- 通过链接直接发起对话。
- 通过链接一键安装 MCP 服务。

### 5.7 远程控制（IM）

配置入口：**设置 → Remote**。

当前支持的渠道：Telegram、飞书/Lark、QQBot、Discord、微信 iLink。

能力范围：

- 远程端点可绑定到一个 DeepChat 会话。
- 在远程聊天中可：创建新会话、列出/切换最近会话、停止生成、在桌面打开对应会话、
  回答待确认的问题或权限请求、切换模型、查看运行状态。

常用命令：

| 命令 | 用途 |
| --- | --- |
| `/start` | 启动远程会话 |
| `/help` | 查看帮助 |
| `/pair` | 绑定/配对桌面会话 |
| `/new` | 创建新会话 |
| `/sessions` | 列出最近会话 |
| `/use` | 切换到指定会话 |
| `/stop` | 停止当前生成 |
| `/open` | 在桌面打开当前会话 |
| `/pending` | 处理待确认交互 |
| `/model` | 切换模型 |
| `/status` | 查看运行状态 |

## 6. 隐私与安全

- **本地优先**：聊天与配置数据默认保存在本地，不上传。
- **加密能力**：聊天数据与配置数据预留加密接口与代码混淆能力（面向企业自托管定制）。
- **网络代理**：支持配置代理，降低直连泄露风险。
- **隐私工具**：支持屏幕投影隐藏等保护手段。
- 开源许可为 Apache License 2.0，企业可自由使用与二次开发。

## 7. 常见问题

**Q：连接模型失败怎么办？**
检查 API Key 是否正确、网络能否访问目标服务（必要时配置代理）、模型名是否与供应商
控制台一致；本地模型请确认 Ollama 服务已启动。

**Q：找不到某个 MCP 服务？**
确认服务已安装且已授权；`npx` 类服务要求本机可访问 npm registry 或已内置 Node 运行时。

**Q：远程 IM 无法控制会话？**
在 **设置 → Remote** 中确认端点已配置并完成与桌面会话的绑定（`/pair`）。

**Q：会话太多、历史混乱？**
使用分支与多 Tab 组织会话；长会话可利用 Trace 检查上下文与 token 预算，必要时续跑。

## 8. 获取帮助与反馈

- 问题反馈与功能建议：[GitHub Issues](https://github.com/ThinkInAIXYZ/deepchat/issues)
- 文档与常见问题：[GitHub Wiki](https://github.com/ThinkInAIXYZ/deepchat/wiki)
- 官方网站：<https://deepchatai.cn/>

---

相关内部文档：[README.zh.md](../README.zh.md)、[快速入门（开发者）](./guides/getting-started.md)
