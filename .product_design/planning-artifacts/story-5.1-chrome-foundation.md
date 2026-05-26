---
epic: 5
story: 1
status: review
files:
  - src/ui/chrome.js
  - src/ui/chrome.test.js
---

# Story 5.1: `src/ui/chrome.js` — TUI chrome foundation

## User Story

As a developer,
I want a chrome module that manages the terminal screen layout with a persistent title bar and status bar,
So that every kue-ball session runs inside a visually bounded shell that is reliably restored on exit.

## Context

All current UI interactions use `@inquirer/prompts` which writes to stdout sequentially. This story introduces a chrome layer that owns the alternate screen buffer and reserves fixed rows at the top and bottom of the terminal — without modifying any existing prompt logic. The chrome module uses raw ANSI escape codes so it does not introduce a full TUI framework that would conflict with inquirer's rendering.

The alternate screen buffer (`\x1b[?1049h`) is the key mechanism: it gives kue-ball its own clean canvas while leaving the user's pre-existing terminal history untouched, and restores it perfectly on exit.

## Acceptance Criteria

**Given** `src/ui/chrome.js` is created
**When** `initChrome()` is called
**Then** the terminal switches to the alternate screen buffer (`\x1b[?1049h`)
**And** the cursor is hidden (`\x1b[?25l`)
**And** a title bar containing `kue-ball` is written to row 1, bold and horizontally centred relative to `process.stdout.columns`
**And** a horizontal divider line (`─` repeated to fill the terminal width) is written to row 2
**And** a status bar row is reserved at the last row (`process.stdout.rows`) with a contrasting visual style (e.g. reversed colours via `\x1b[7m`)
**And** a SIGINT handler is registered so `destroyChrome()` is called before the process exits
**And** `process.on('exit', destroyChrome)` is registered so any exit path triggers cleanup

**When** `destroyChrome()` is called (manually or via the registered exit/signal handlers)
**Then** the terminal is restored to the normal screen buffer (`\x1b[?1049l`)
**And** the cursor is made visible again (`\x1b[?25h`)
**And** calling `destroyChrome()` a second time is a no-op (idempotent guard via an `isActive` flag)

**When** `updateStatusBar(segments)` is called with an array of `{ text, color? }` objects
**Then** the cursor is saved (`\x1b[s`), positioned to the last row and column 1, the row is cleared (`\x1b[2K`), the segments are written left-to-right (applying `\x1b[{color}m` / `\x1b[0m` wrappers when `color` is set), and the cursor is restored (`\x1b[u`)
**And** calling `updateStatusBar` before `initChrome()` is a no-op and does not throw

**When** `getContentRows()` is called
**Then** it returns `(process.stdout.rows ?? 24) - 4` — the rows available between the divider (row 2) and the status bar (last row), minus one buffer row

**When** `isActive()` is called
**Then** it returns `true` after `initChrome()` and `false` before it or after `destroyChrome()`

**And** `chrome.test.js` mocks `process.stdout.write` and asserts:
- `initChrome()` emits `\x1b[?1049h` (alternate screen enter)
- `initChrome()` emits a string containing `kue-ball` targeting row 1
- `destroyChrome()` emits `\x1b[?1049l` (alternate screen exit)
- `destroyChrome()` called twice does not emit the restore escape a second time
- `updateStatusBar([{ text: 'hello' }])` saves the cursor, clears the bottom row, writes `hello`, and restores the cursor
- `updateStatusBar` called when `isActive()` is `false` does not call `process.stdout.write`
- `isActive()` returns `false` before `initChrome()` and `true` after

## Technical Notes

- Prefer direct ANSI escape codes (`process.stdout.write`) with no additional runtime dependency. If the developer finds a utility helper (e.g. `ansi-escapes`) genuinely reduces fragility, it may be introduced as a devDependency only after checking it does not own the event loop.
- Use `\x1b[s` / `\x1b[u` (ANSI cursor save/restore) rather than tracking cursor position manually — these are universally supported in macOS Terminal and iTerm2.
- Do not use `console.log` inside the chrome module — it appends a newline and disrupts the fixed-row layout.
- `initChrome` must handle terminal resize (`process.stdout.on('resize', ...)`) by redrawing the title bar and status bar at the new dimensions.
- The file must not exceed 150 lines (project NFR). If the resize handler adds complexity, extract it into a private helper within the same file.
