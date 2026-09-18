# Builtin Researcher Agent Tasks

## Specification

- [x] Inspect preset loader, Skill scope reconciliation, and packaging.
- [x] Decide delivery model (vendored Skill + on-demand CLI install).
- [x] Define acceptance criteria, constraints, and non-goals.

## Implementation

- [x] Vendor and localize `resources/skills/agent-reach/`.
- [x] Add upstream MIT attribution to the Skill and third-party notices.
- [x] Add `resources/agent-presets/deepchat-researcher.json`.
- [x] Add the `deepchat-researcher.svg` preset icon.

## Tests And Validation

- [x] Add a bundled preset-to-Skill consistency test.
- [x] Run focused main-process tests.
- [x] Run `pnpm run format`.
- [x] Run `pnpm run lint`.
- [x] Run `pnpm run typecheck`.