# CN Platform Search & Browser Skills Spec

## User Need

The 调研专家 Agent can search generic web (`web-search`) and reach a handful of platforms through
`agent-reach`, but it cannot search most Chinese platforms (知乎、微博、抖音、微信公众号、豆瓣、脉脉、
掘金、什么值得买、汽车之家、大众点评、电商、12306 等) and has no way to drive a real logged-in browser
for pages without an adapter. Users want both: broad Chinese-platform coverage, and a browser
capability that reuses their existing Chrome session.

## Goals

- Vendor OpenCLI's user-facing skills so the Agent can discover adapters, drive a real Chrome window,
  route searches to the right source, and self-repair broken adapters.
- Vendor two SenseNova Chinese search skills for script-based social search and free official Chinese
  market sources.
- Enable the new Skills for the 调研专家 preset.
- Unify browser fallback on `opencli browser` instead of the upstream `browser-use` references.

## Acceptance Criteria

- `resources/skills/` contains `opencli-usage`, `opencli-browser`, `smart-search` (+8 references),
  `opencli-autofix`, `sn-search-social-cn` (+scripts), and `sn-search-market-cn` (+scripts).
- Every vendored `SKILL.md` frontmatter `name` matches its directory and is discovered by the Skill
  discovery worker.
- `deepchat-researcher.json` enables all six new Skills, and the bundled-preset consistency test
  resolves them.
- OpenCLI and SenseNova attribution (repository, license, imported commit, upstream path, local
  edits) is recorded in `resources/skills/THIRD-PARTY-NOTICES.md`, and each new Skill directory
  carries the upstream `LICENSE.txt`.
- References to non-bundled OpenCLI Skills (`opencli-adapter-author`, `opencli-browser-sitemap`,
  `opencli-sitemap-author`) are removed from the vendored `opencli-usage` / `opencli-browser` text.
- SenseNova browser fallback text points at `opencli browser` / the `opencli-browser` Skill.
- No `src/**` change and no data migration.

## Constraints

- Vendor text only; do not bundle the OpenCLI CLI, its Chrome extension, or Python dependencies.
- Preserve upstream command semantics; only adjust skill cross-references and environment notes.
- Bundled Skill `name` must match `/^[a-z0-9][a-z0-9._-]*$/`.
- Follow Oxfmt for JSON changes.

## Non-Goals

- Bundling OpenCLI's adapter-author or sitemap-author skills.
- Wiring OpenCLI or SenseNova scripts into DeepChat MCP or the settings UI.
- Auto-installing OpenCLI, the Chrome extension, or Python packages during app startup.
- Replacing `agent-reach`, which keeps ownership of login-state platform routing.

## Decisions

| Topic | Decision |
|---|---|
| Chinese platform search | OpenCLI `smart-search` (adapter router, 100+ sites) plus SenseNova scripts as a keyless fallback |
| Browser capability | Vendor `opencli-browser`; reuse the user's existing Chrome session via the OpenCLI extension |
| Adapter authoring | Not bundled; references removed to avoid dangling Skills |
| Self-repair | Vendor `opencli-autofix` so broken adapters can be diagnosed and fixed in-place |
| Browser fallback wording | SenseNova `browser-use` replaced with `opencli browser` |
| Overlap | `agent-reach` routes login-state platforms; OpenCLI Skills drive adapters and raw browser work |

## Open Questions

None.