# Builtin Researcher Agent Spec

## User Need

DeepChat ships general, coding, writing, and data-analysis built-in Agents, but no Agent dedicated to
internet research. Users who ask an Agent to investigate a topic still have to install and configure
per-platform reading tools themselves. They want one built-in research Agent that already knows how
to reach the open internet.

## Goals

- Add a fifth protected built-in DeepChat Agent: 调研专家 (`deepchat-researcher`).
- Give that Agent internet-reaching capability through the upstream
  [Agent Reach](https://github.com/Panniantong/Agent-Reach) skill, vendored into the bundled Skill set.
- Keep the Agent discoverable in the new-conversation selector and sub-agent targets like the
  existing presets.
- Require no new abstraction and no main-process source change.

## Acceptance Criteria

- On startup `resources/agent-presets/deepchat-researcher.json` materializes a protected, enabled,
  builtin DeepChat Agent exactly once (`create-if-missing`, never overwriting user edits).
- The Agent lists `agent-reach` plus research-oriented bundled Skills in `enabledSkillNames`.
- `resources/skills/agent-reach/` contains a valid `SKILL.md` whose frontmatter `name` is
  `agent-reach`, plus the upstream `references/*.md`.
- The vendored Skill carries upstream MIT attribution in `LICENSE.txt` and in
  `resources/skills/THIRD-PARTY-NOTICES.md`.
- Existing preset Agents continue to materialize with their current Skill allow-lists unchanged.
- A consistency test fails if any preset `enabledSkillNames` entry has no matching bundled Skill
  directory.

## Constraints

- Resources-only change: no `src/**` edits, no schema change, no data migration.
- `id` must satisfy the safe Agent id pattern `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`.
- Chinese-only name, description, and system prompt to match the other presets.
- Follow Oxfmt (single quotes, no semicolons, 100 columns).
- Agent Reach stays the installer/router; the Skill teaches upstream tool usage instead of
  reimplementing channels.
- The bundled Skill must not reference OpenClaw paths, a machine-specific conda environment, or a
  manual upstream update flow.

## Non-Goals

- Bundling the `agent-reach` Python CLI or its dependencies into the app runtime.
- Adding `enabledMcpServerIds` to the preset schema or wiring a new MCP server.
- Renaming or editing the existing general, code, writing, or data presets.
- Automatically installing system packages during app startup.

## Decisions

| Topic | Decision |
|---|---|
| Delivery | Vendor the upstream `agent_reach/skill/` documents; the Agent installs the CLI on demand with user approval via the `exec` tool |
| Preset id / name | `deepchat-researcher` / 调研专家 |
| MCP | Not wired; Agent Reach's `mcporter` Exa channel is documented in the Skill instead |
| General Agent reach | The new Skill also becomes available to the general `deepchat` Agent because its `enabledSkillNames` is `null` (all Skills). Activation stays description-gated to explicit research intent; accepted as a side effect |
| Update flow | Skill updates ship with the app; the upstream self-update nag and OpenClaw skill path are removed |

## Open Questions

None.