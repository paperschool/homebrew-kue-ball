---
epic: 5
story: 4
status: review
files:
  - src/ui/searchableList.js
  - src/ui/searchableList.test.js
  - src/ui/chrome.js
---

# Story 5.4: Anchored search input

## User Story

As a user,
I want the fuzzy-search text input to always appear at the bottom of the screen (just above the status bar) when I am picking from a list,
So that my eye and cursor position are consistent and predictable regardless of how many results are displayed.

## Context

`@inquirer/search` renders its prompt (label + input field) at the current cursor position, then prints the result list below it. With the chrome active, the status bar occupies the last row and the title bar occupies rows 1–2. Without intervention, the prompt appears wherever the cursor happens to be, which drifts as the session progresses.

This story pre-positions the cursor to row `(totalRows - 3)` before invoking `@inquirer/search`, so the label renders at `(totalRows - 3)`, the input at `(totalRows - 2)`, and the result list scrolls upward into the content area from `(totalRows - 4)` and above. The status bar at `totalRows` remains untouched.

This story carries the highest implementation risk in Epic 5. The developer should prototype cursor pre-positioning first and verify that inquirer does not re-home the cursor on each render cycle. If it does, a deeper intercept strategy must be agreed with the PM before the story is marked complete.

## Acceptance Criteria

**Given** `src/ui/searchableList.js` is modified
**When** `searchableList` is called and `chrome.isActive()` returns `true`
**Then** before calling `@inquirer/search`, the cursor is positioned to row `(process.stdout.rows - 3)`, column 1 (`\x1b[{row};1H`)
**And** the `pageSize` passed to `@inquirer/search` is `Math.max(4, chrome.getContentRows() - 2)` — ensuring the result list fits within the content area without overwriting the title bar or status bar
**And** the `source` fuzzy-match callback is unchanged — no modifications to matching logic

**When** `searchableList` is called and `chrome.isActive()` returns `false`
**Then** no cursor pre-positioning is performed
**And** the `pageSize` calculation uses the existing formula: `Math.max(8, (process.stdout.rows ?? 24) - 4)`
**And** behaviour is identical to pre-Epic-5 for all non-chrome paths

**And** `searchableList.test.js` asserts:
- when `chrome.isActive()` returns `true` and `process.stdout.rows` is `30`, `pageSize` passed to `@inquirer/search` is `Math.max(4, chrome.getContentRows() - 2)` (using the mocked `getContentRows()` value)
- when `chrome.isActive()` returns `true`, `process.stdout.write` is called with a cursor-positioning escape before `@inquirer/search` is invoked
- when `chrome.isActive()` returns `false`, `process.stdout.write` is not called with a cursor-positioning escape and the original `pageSize` formula is used
- all existing fuzzy-match assertions from Story 2.1 continue to pass unchanged

## Technical Notes

- **Prototype first**: Before writing the full implementation, manually test cursor pre-positioning against `@inquirer/search` v3+ in a real terminal. If the library resets the cursor to the top of its render area on each keypress, the pre-positioning approach will not hold and an alternative strategy (e.g. writing a custom `search` renderer, or using `process.stdout.on('data', ...)` to intercept cursor moves) will be needed. Flag this to the PM immediately if it arises — do not implement a workaround without alignment.
- `chrome.isActive()` and `chrome.getContentRows()` are already exported from Story 5.1. Import them via `import { isActive, getContentRows } from './chrome.js'`.
- The cursor pre-positioning write must happen *synchronously* immediately before the `search()` call — no `await` or `setImmediate` between them, as that would allow other renders to shift the cursor.
- This story does not modify `searchableMultiSelect.js` or `resourcePicker.js` — those are candidates for a follow-up story if the anchoring approach proves stable.
