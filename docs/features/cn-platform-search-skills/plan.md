# CN Platform Search & Browser Skills Plan

## Approach

Vendor upstream Skill text into `resources/skills/`, adjust only the cross-references that would
dangle or contradict DeepChat's runtime, and extend the researcher preset allow-list. The preset
loader and `reconcileAgentSkillScopes` already propagate new allow-listed Skills, so no main-process
changes are required.

## Source Changes

1. OpenCLI (Apache-2.0) under `resources/skills/`:
   - `opencli-usage/SKILL.md` — remove references to the non-bundled `opencli-adapter-author`.
   - `opencli-browser/SKILL.md` — remove `opencli-adapter-author` / sitemap Skill references; point
     "See also" at the bundled OpenCLI Skills.
   - `smart-search/SKILL.md` + `references/sources-*.md` (8 files) — verbatim.
   - `opencli-autofix/SKILL.md` — verbatim.
2. SenseNova (MIT) under `resources/skills/`:
   - `sn-search-social-cn/SKILL.md` + `requirements.txt` + `scripts/*.py` — replace `browser-use`
     with `opencli browser`, adjust the credential paragraph.
   - `sn-search-market-cn/SKILL.md` + `scripts/free_market_api.py` — same replacements.
3. Add upstream `LICENSE.txt` to each new Skill directory.
4. Append OpenCLI and SenseNova sections to `resources/skills/THIRD-PARTY-NOTICES.md`.
5. Add the six Skills to `resources/agent-presets/deepchat-researcher.json`.

## Affected Interfaces

- No TypeScript contract, IPC, or schema change.
- Six new bundled Skills, one preset allow-list extension, notices documentation.

## Data Flow

1. Startup materializes the extended preset allow-list.
2. `reconcileAgentSkillScopes` copies the six Skills into `.agent-scopes/deepchat-researcher/`.
3. Conversation: `smart-search` selects an OpenCLI source, `opencli <site> <command>` runs the
   adapter, `opencli-browser` drives the Chrome session for uncovered pages, `opencli-autofix`
   repairs a broken adapter, and SenseNova Skills cover keyless script search and official Chinese
   market sources.

## Compatibility

Existing presets are unchanged apart from the researcher gaining Skills. The general `deepchat`
Agent gains all six through its `null` allow-list, consistent with the accepted `agent-reach`
behavior. OpenCLI and SenseNova remain on-demand installs; nothing runs at app startup.

## Test Strategy

- The bundled-resource consistency test now also resolves and discovers the six new Skills.
- Run the focused contract, Agent, and Skill test suites.

## Validation

Run `pnpm run format`, `pnpm run lint`, `pnpm run typecheck`, and the focused main-process suites.