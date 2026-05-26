---
epic: 1
story: 2
status: review
---

# Story 1.2: `src/lib/output.js` — colours & logging helpers

## User Story

As a developer,
I want all ANSI colour constants and logging helpers in one module,
So that every other module can import them without duplicating colour codes.

## Context

Currently ANSI codes and `ok()`/`warn()`/`info()`/`header()` are defined inline in `kubectl-wizard.mjs` and referenced throughout. Extracting them first means every subsequent story can import from `output.js` rather than defining its own constants.

## Acceptance Criteria

**Given** `src/lib/output.js` exists
**When** another module does `import { ok, warn, CYAN } from '../lib/output.js'`
**Then** the import resolves without error

**Given** `stripAnsi` is called with a string containing ANSI escape sequences
**When** the result is inspected
**Then** all escape sequences are removed and only plain text remains

**Given** `styleDeleteCommandLabel` is called with a label containing the word "delete"
**When** the result is inspected
**Then** the word "delete" (any case) is wrapped in the RED colour code

**Given** `output.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
// Constants
export { CYAN, YELLOW, GREEN, RED, DIM, BOLD, RESET }

// Functions
export function stripAnsi(str)
export function styleDeleteCommandLabel(label)
export function ok(text)
export function warn(text)
export function info(text)
export function header(text)
export function printCommand(cmd)
```

## Technical Notes

- `ok`/`warn`/`info`/`header`/`printCommand` write to `console.log` — no return value needed
- Tests for `ok`/`warn` etc. should spy on `console.log` to assert the correct output shape without asserting exact ANSI codes (fragile)
- `stripAnsi` regex: `/\x1b\[[0-9;]*m/g`
