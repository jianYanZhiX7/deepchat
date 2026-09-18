# CN Platform Search & Browser Skills Tasks

## Specification

- [x] Survey Chinese-platform Skills and CLIs via `gh`.
- [x] Verify OpenCLI and SenseNova licenses, structure, and cross-references.
- [x] Define acceptance criteria, constraints, and non-goals.

## Implementation

- [x] Vendor OpenCLI `opencli-usage`, `opencli-browser`, `smart-search`, `opencli-autofix`.
- [x] Vendor SenseNova `sn-search-social-cn`, `sn-search-market-cn`.
- [x] Localize dangling OpenCLI references and `browser-use` fallback text.
- [x] Add upstream licenses and third-party notices.
- [x] Enable the six Skills in the researcher preset.

## Tests And Validation

- [x] Confirm the bundled-resource test resolves and discovers the new Skills.
- [x] Run focused main-process tests.
- [x] Run `pnpm run format`.
- [x] Run `pnpm run lint`.
- [x] Run `pnpm run typecheck`.