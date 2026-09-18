# Bundled Web Search Skill Plan

## Approach

Add one bundled Skill directory and one preset entry. The existing preset loader and
`reconcileAgentSkillScopes` already copy allow-listed bundled Skills into each Agent scope on
startup, so no main-process code changes are needed.

Unlike `agent-reach`, this Skill is written in-repo rather than vendored, because it only describes
how to use two upstream tools and does not redistribute their content. No third-party notice is
required; the upstream repositories are linked from the Skill.

## Source Changes

1. Add `resources/skills/web-search/SKILL.md`:
   - zero-install channels first: `curl -s "https://r.jina.ai/URL"` and `ddgs text -q ...`;
   - verified `ddgs` command reference (`text`, `news`, `images`, `videos`, `books`, `extract`,
     `version`, `mcp`, `api`) with backend, region, timelimit, and output flags;
   - on-demand install (`pipx install ddgs`, venv fallback) gated on explicit user approval;
   - routing rule that platform-scoped or login-gated lookups go to `agent-reach`;
   - citation and failure-fallback rules.
2. Add `web-search` to `enabledSkillNames` in `resources/agent-presets/deepchat-researcher.json`.
3. Extend `test/main/contracts/agentPresetBundledResources.test.ts` to run the Skill discovery
   worker over `resources/skills` and assert every preset-referenced Skill is discovered with a
   matching name, which also covers frontmatter validity.

## Affected Interfaces

- No TypeScript contract, IPC, or schema change.
- One new bundled Skill, one preset field addition, one test assertion extension.

## Data Flow

1. Startup materializes the updated preset Skill allow-list.
2. `reconcileAgentSkillScopes` copies `web-search` into `.agent-scopes/deepchat-researcher/`.
3. Conversation: the Agent reads the Skill description, activates `web-search` for generic lookups,
   and falls back to `agent-reach` for platform-scoped ones.

## Compatibility

Existing preset allow-lists are unchanged apart from the researcher gaining one Skill. The general
`deepchat` Agent gains `web-search` through its `null` allow-list, consistent with the accepted
`agent-reach` behavior.

## Test Strategy

- Extend the bundled-resource test to discover preset-referenced Skills through the real worker and
  assert the only undiscovered names are those violating the lowercase Skill name pattern, in
  addition to the existing file-existence and icon checks. This surfaced the pre-existing
  `StatsPAI_skill` entry in the data-analyst preset, whose mixed-case name can never be discovered.
- Rely on the existing preset schema and repository tests for behavior coverage.

## Validation

Run `pnpm run format`, `pnpm run lint`, `pnpm run typecheck`, and the focused contract, Agent, and
Skill test suites.