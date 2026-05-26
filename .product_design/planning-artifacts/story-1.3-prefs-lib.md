---
epic: 1
story: 3
status: review
---

# Story 1.3: `src/lib/prefs.js` — preference persistence

## User Story

As a developer,
I want preference load/save logic isolated in one module,
So that it can be tested in isolation and the config path is a single source of truth.

## Context

`loadPrefs` and `savePrefs` currently live in `kubectl-wizard.mjs` and write next to the script file (fixed in a previous change to `~/.config/kue-ball`). This story moves them to `src/lib/prefs.js` so they are independently testable with mocked `fs`.

## Acceptance Criteria

**Given** `src/lib/prefs.js` exists
**When** `loadPrefs()` is called and `~/.config/kue-ball/prefs.json` does not exist
**Then** it returns `{ subFrequency: {} }`

**Given** `~/.config/kue-ball/prefs.json` contains invalid JSON
**When** `loadPrefs()` is called
**Then** it returns `{ subFrequency: {} }` (safe fallback, no throw)

**Given** `savePrefs(prefs)` is called
**When** it executes
**Then** `mkdirSync(CONFIG_DIR, { recursive: true })` is called before `writeFileSync`
**And** the written content is pretty-printed JSON followed by a newline

**Given** `prefs.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export const CONFIG_DIR  // ~/.config/kue-ball
export const PREFS_PATH  // ~/.config/kue-ball/prefs.json
export function loadPrefs()
export function savePrefs(prefs)
```

## Technical Notes

- Mock `node:fs` (`existsSync`, `readFileSync`, `writeFileSync`, `mkdirSync`) using Vitest's `vi.mock`
- Do not mock `node:os` — `homedir()` can return a stable path in the test environment

### Review Findings

- [ ] [Review][Patch] loadPrefs non-object JSON crashes callers [src/lib/prefs.js:loadPrefs] — `JSON.parse` of a valid but non-object value (e.g. `null`, `[]`, `42`) is returned directly. Callers access `.subFrequency` on the result, causing a TypeError. Add a shape guard: `const p = JSON.parse(raw); return (p && typeof p === 'object' && !Array.isArray(p)) ? p : { subFrequency: {} }`.
