---
name: web-search
description: >-
  免费、无需 API Key 的通用网络搜索与网页阅读。USE when the user asks to 搜索/搜一下/查一下/找资料/
  找最新消息/找官方文档/核实事实/比较方案, or when a general web lookup is needed and no
  platform-specific access is required.
  Two channels: ddgs multi-engine metasearch (free, no key) and Jina Reader (https://r.jina.ai/URL)
  for clean Markdown.
  Prefer the agent-reach Skill for platform-scoped lookups (小红书/Twitter/B站/Reddit/YouTube/知乎/
  GitHub/雪球 etc.) and for anything needing login state or platform-specific commands.
  NOT for: 发帖/评论等写操作, 数据分析, 翻译, 内容加工.
license: MIT
metadata:
  upstream:
    - https://github.com/deedy5/ddgs
    - https://github.com/jina-ai/reader
---

# Web Search — 免费通用搜索与网页阅读

两条通道：`ddgs` 多引擎元搜索（免费、无需 Key），Jina Reader（`r.jina.ai`，网页转 Markdown）。
平台内检索与登录态内容不在本 skill 范围，交给 `agent-reach`。

## 常驻规则

1. **网页阅读零安装**：读任意 URL 优先 `curl -s "https://r.jina.ai/URL"`。
2. **搜索先检查 `ddgs`**：`command -v ddgs` 或 `ddgs version`；不在 PATH 时按需安装。
3. **平台内检索走 agent-reach**：小红书/推特/B站/Reddit/YouTube 等不要用本 skill 硬凑。
4. **结论必须带来源**：每条关键信息附 URL；不编造标题、日期或引用。
5. **时效性可声明**：用 `-t` 限定时间范围并在汇报时说明检索口径。

## 安装 ddgs（按需、需授权）

`ddgs` 是 MIT 许可的 Python 元搜索工具（上游 `deedy5/ddgs`），提供 CLI、MCP 与 HTTP API。
未安装时先向用户说明并取得授权，再安装到隔离位置，**绝不写入工作目录**：

```bash
# 推荐 pipx（隔离且自动进 PATH）
pipx install ddgs

# 没有 pipx 时用 venv
python3 -m venv ~/.cache/web-search-venv
~/.cache/web-search-venv/bin/pip install -U ddgs
# 之后用 ~/.cache/web-search-venv/bin/ddgs 调用
```

可选能力（只在用户明确需要时安装）：

```bash
pip install -U "ddgs[mcp]"   # ddgs mcp：stdio MCP server
pip install -U "ddgs[api]"   # ddgs api：本地 HTTP API server（默认 127.0.0.1:4479）
```

## 命令参考

```bash
# 文本搜索（默认通道）
ddgs text -q "query" -m 10

# 时效检索：-t d|w|m|y（天/周/月/年）
ddgs news -q "query" -t d -m 10

# 指定引擎（可重复）：auto, all, bing, brave, duckduckgo, google,
# grokipedia, mojeek, startpage, yandex, yahoo, wikipedia
ddgs text -q "query" -b google -b brave -m 10

# 指定地区与安全等级（默认 us-en / moderate）
ddgs text -q "query" -r cn-zh -s off -m 10

# 结构化输出到文件，便于后续处理
ddgs text -q "query" -m 20 -o /tmp/search.json

# 图片 / 视频 / 图书
ddgs images -q "query" -m 10
ddgs videos -q "query" -m 10
ddgs books  -q "query" -m 10

# 抓取并抽取网页正文（text_markdown | text_plain | text_rich | text | content）
ddgs extract -u "https://example.com" -f text_markdown

# 版本与自检
ddgs version
```

## 通道选择

| 需求 | 通道 |
|---|---|
| 读某个已知 URL | `curl -s "https://r.jina.ai/URL"` |
| 通用网页搜索 | `ddgs text` |
| 最新消息 / 近 N 天 | `ddgs news -t d\|w\|m` |
| 图片 / 视频 / 图书 | `ddgs images\|videos\|books` |
| 平台内内容（小红书/推特/B站/Reddit/YouTube 等） | `agent-reach` |
| 需要登录态或平台命令 | `agent-reach` |

## 失败与降级

- `ddgs` 不存在且用户暂不授权安装：先用 `r.jina.ai` 读已知来源 URL，并把缺口告知用户。
- `ddgs` 全部 backend 返回空：换 `-b`（如 `-b bing`、`-b duckduckgo`）、换 `-r`、或改写查询词后重试一次。
- 页面被反爬或需要登录：改用 `agent-reach` 的对应平台通道，不要伪装请求。
- 结果明显过期：加 `-t` 重查，并在汇报中标注检索时间。

## 输出与引用

- 优先给出「结论 + 来源 URL」，来源按可信度排序；同一个结论尽量有两个独立来源。
- 不把搜索结果直接倒给用户：先归纳，再附证据链接。
- 临时文件放 `/tmp`，不要在工作目录创建文件，也不要倾倒原始 HTML。

## 详细文档

- `ddgs` 上游：<https://github.com/deedy5/ddgs>
- Jina Reader 上游：<https://github.com/jina-ai/reader>