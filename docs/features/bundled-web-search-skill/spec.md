# Bundled Web Search Skill Spec

## User Need

The built-in 调研专家 Agent reaches the internet through the `agent-reach` Skill, but most of that
Skill's practical power depends on the externally installed Agent Reach CLI and its `mcporter`/Exa
channel. Users need a free, zero-API-key fallback for generic web search and page reading that works
immediately after install, without configuring any provider or key.

## Goals

- Add a bundled `web-search` Skill that wraps two free channels:
  - `ddgs` (MIT, `deedy5/ddgs`): multi-engine metasearch CLI with no API key.
  - Jina Reader (`https://r.jina.ai/URL`, Apache-2.0): URL to clean Markdown.
- Enable `web-search` for the 调研专家 preset.
- Keep the Skill text original; do not vendor the `ddgs` source or README.

## Acceptance Criteria

- `resources/skills/web-search/SKILL.md` exists, its frontmatter `name` is `web-search`, and the
  Skill discovery worker parses it without warnings.
- `deepchat-researcher.json` lists `web-search` in `enabledSkillNames`, and the bundled-preset
  consistency test resolves it.
- The Skill documents the exact, verified `ddgs` commands (`text`/`news`/`images`/`videos`/`books`/
  `extract`, backend list, output flags) and the on-demand install flow with explicit user approval.
- The Skill routes platform-scoped lookups to `agent-reach` instead of duplicating platform logic.
- No `src/**` change and no data migration.

## Constraints

- Chinese-first Skill text matching the repository's bundled-Skill style; no emoji.
- Install must target an isolated location (`pipx` or a venv under `~/.cache/`/`~/.local/`) and never
  the workspace.
- Bundled Skill text must not contain machine-specific paths or fixed Python environments.
- Follow Oxfmt for the JSON and test changes.

## Non-Goals

- Bundling the `ddgs` Python package or its dependencies.
- Adding a new MCP server entry or changing MCP settings.
- Replacing or trimming `agent-reach`.
- Adding screenshot/image download workflows (`ddgs --download`) to the default flow.

## Decisions

| Topic | Decision |
|---|---|
| Search backend | `ddgs` multi-engine metasearch, free and keyless |
| Page reading | Jina Reader via `r.jina.ai`, keyless |
| Delivery | Original Skill text; external CLI installed on demand with user approval |
| Placement | Bundled `resources/skills/web-search/`, enabled by the researcher preset |
| Overlap with agent-reach | `web-search` is the generic/fallback channel; platform-scoped lookups stay in `agent-reach` |

## Open Questions

None.