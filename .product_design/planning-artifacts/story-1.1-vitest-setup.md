---
epic: 1
story: 1
status: review
---

# Story 1.1: Vitest setup & folder scaffold

## User Story

As a developer,
I want a working test harness and `src/` folder structure in place,
So that every subsequent story has a consistent home and can be verified immediately.

## Context

Currently the entire app is in a single file (`kubectl-wizard.mjs`) with no test infrastructure. Before any modules can be extracted, Vitest must be installed and the `src/` layout established. This story produces no extracted logic — it is purely additive scaffolding.

## Acceptance Criteria

**Given** the repo has no `src/` folder or test config
**When** story 1.1 is merged
**Then** `src/lib/`, `src/ui/`, `src/commands/` directories exist (each with a `.gitkeep`)
**And** `vitest` is installed as a dev dependency
**And** `package.json` has scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`
**And** `vitest.config.js` is present at the project root
**And** `npm test` exits 0 (no tests = pass)

## Technical Notes

- Use `vitest` not `jest` — ESM support is first-class
- `vitest.config.js` should set `testEnvironment: 'node'`
- Do not add `@vitest/coverage-v8` yet — keep the install minimal
- `.gitkeep` files ensure the empty dirs are tracked
