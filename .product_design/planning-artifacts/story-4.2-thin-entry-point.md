---
epic: 4
story: 2
status: review
files:
  - kubectl-wizard.mjs
---

# Story 4.2: Thin entry-point (`kubectl-wizard.mjs`)

## User Story

As a developer,
I want `kubectl-wizard.mjs` to delegate entirely to `src/main.js`,
So that the binary entry-point is a shebang-only thin wrapper and all application logic lives under `src/`.

## Context

`kubectl-wizard.mjs` is the Homebrew-installed binary (`kue-ball`). It currently contains the entire application (~1500 lines). After Stories 1.1–4.1 are complete, all logic has been extracted into `src/`. This story replaces the file's content with two lines: the Node.js shebang and a single ESM import of `./src/main.js`.

The side-effect import works because `src/main.js` calls `main().catch(...)` at the module level — importing the file triggers execution. No export wiring is needed.

## Acceptance Criteria

**Given** Story 4.1 is complete and `src/main.js` exists and is runnable
**When** `kubectl-wizard.mjs` is updated
**Then** its entire content is exactly:
```
#!/usr/bin/env node
import './src/main.js';
```
(shebang on line 1, import on line 2, nothing else)

**And** running `node kubectl-wizard.mjs` invokes `src/main.js` and launches the wizard identically to before the refactor

**And** `npm test` passes without modification to any test file

**And** FR7 is satisfied: the entry-point binary contains no application logic

## Technical Notes

- This is a replacement of the entire file content — the original 1500+ lines are removed
- No new test file is required for this story; correctness is proven by the full test suite passing and a manual smoke-test of `node kubectl-wizard.mjs`
- Smoke test checklist: kubectl availability check appears; context list populates; namespace list populates; command menu is searchable and grouped; at least one command executes successfully
- The Homebrew formula (`Formula/kue-ball.rb`) does not need updating — it already references `kubectl-wizard.mjs` as the script entry-point
