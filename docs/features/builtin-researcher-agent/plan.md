# Builtin Researcher Agent Plan

## Approach

Reuse the existing bundled-resource mechanism exactly as the other presets do. `loadAgentPresetDefinitions`
already scans `resources/agent-presets/*.json`, and `reconcileAgentSkillScopes` already copies newly
allow-listed bundled Skills into each Agent scope on startup. Adding a preset plus one vendored Skill
directory is therefore sufficient; no main-process code changes.

## Source Changes

1. Add `resources/skills/agent-reach/`:
   - `SKILL.md` adapted from upstream `agent_reach/skill/SKILL.md`.
   - `references/{search,social,career,dev,web,video,finance}.md` vendored verbatim.
   - `LICENSE.txt` with the upstream MIT notice.
   - Localize `SKILL.md`: replace the machine-specific conda environment note with a PATH check,
     drop the `~/.openclaw/skills/` path and the `check-update` self-update nag, and add a
     DeepChat-specific install section that installs the CLI under `~/.agent-reach/` with `exec`
     after explicit user approval and never writes into the workspace.
2. Append an Agent Reach section to `resources/skills/THIRD-PARTY-NOTICES.md` with repository,
   license, imported commit, upstream path, and local edits.
3. Add `resources/agent-presets/deepchat-researcher.json` with the researched Skill allow-list.
4. Add `resources/agent-presets/deepchat-researcher.svg` served through the existing
   `agentpreset://` protocol.
5. Add a focused consistency test that loads every bundled preset, validates it against
   `AgentPresetDefinitionSchema`, and asserts each `enabledSkillNames` entry resolves to a bundled
   Skill directory.

## Affected Interfaces

- No TypeScript interface, contract, IPC, or schema change.
- New runtime artifacts only: one preset definition and one bundled Skill.
- `electron-builder.yml` already ships `resources/skills/` and `resources/agent-presets/`.

## Data Flow

1. Startup: `AgentSettings.start()` loads preset JSON files and calls `ensureBuiltinDeepChatAgents`
   (create-if-missing) followed by `syncBuiltinPresetSkillPolicies`.
2. Skill startup: `reconcileAgentSkillScopes` reads the Agent's `enabledSkillNames`, finds newly
   allow-listed Skills missing from `.agent-scopes/deepchat-researcher/`, and copies them in.
3. Conversation: the Agent sees the Skill description and activates `agent-reach` on explicit
   research intent; the Skill routes to upstream tools through the `exec` tool.

## Compatibility

The general, code, writing, and data presets are untouched. Existing installs gain the new Agent on
next start without migration. Because the general `deepchat` Agent uses `null` allow-lists it also
gains the bundled Skill; this is accepted in the spec.

## Test Strategy

- Extend the preset contract coverage with a bundled-resource consistency check: parse each
  `resources/agent-presets/*.json`, validate schema, and assert Skill directory existence.
- Keep the existing `agentPresetSchema` and `deepChatAgentRepository` representable-preset tests as
  the behavior contract; no new repository test is required because create-if-missing is already
  covered.

## Validation

Run `pnpm run format`, `pnpm run lint`, `pnpm run typecheck`, and the focused main-process test
suites for contracts and Agent presets.