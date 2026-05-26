---
epic: 5
story: 3
status: review
files:
  - src/ui/authPoller.js
  - src/ui/authPoller.test.js
  - src/ui/chrome.js
  - src/ui/chrome.test.js
  - src/main.js
---

# Story 5.3: `src/ui/authPoller.js` — background auth health poller

## User Story

As a user,
I want a 🔒 indicator in the status bar that turns green when my Azure credentials are healthy and red when they are not,
So that I can see at a glance whether my session is still authenticated throughout my workflow.

## Context

Stories 5.1 and 5.2 established the chrome frame and populated the identity section. This story adds a lightweight background poller that calls `az account show` every 15 seconds and updates a 🔒 indicator in the right section of the status bar. The indicator provides immediate feedback if credentials expire or the Azure CLI session lapses during a long kue-ball session.

The poller runs entirely on the Node.js event loop via `setInterval` — it never spawns a thread or blocks the foreground prompt. Because `shell.run` is synchronous (`execSync` under the hood), each poll tick wraps the call in a `setImmediate`/Promise to yield control before executing, preventing any chance of blocking an in-progress prompt render.

## Acceptance Criteria

**Given** `src/ui/authPoller.js` is created
**When** `startAuthPoller(onStatusChange)` is called
**Then** `onStatusChange('checking')` is called immediately before the first check begins
**And** the first auth check runs by calling `shell.run('az account show', { silent: true })`
**And** after the first check resolves, `onStatusChange('ok')` is called if the result is non-null, or `onStatusChange('error')` if it is `null`
**And** a `setInterval` of 15 000 ms is established for all subsequent checks following the same ok/error callback pattern
**And** if a check is already in-flight when the interval fires, that tick is skipped (no stacked calls)

**When** `stopAuthPoller()` is called
**Then** the interval is cleared
**And** no further `onStatusChange` invocations occur after the call returns

**And** `src/ui/chrome.js` is extended with `setAuthStatus(status)`:
- `status === 'checking'` renders `🔒` in dim grey (`\x1b[2m`) in the status bar right section
- `status === 'ok'` renders `🔒` in green (`\x1b[32m`) in the status bar right section
- `status === 'error'` renders `🔒` in red (`\x1b[31m`) in the status bar right section
- `setAuthStatus` composes the full status bar line from `getIdentitySegment()` (left) and the lock indicator (right), padding the centre with spaces to fill the terminal width, then calls `updateStatusBar`

**And** `src/main.js` is updated to:
- call `chrome.setAuthStatus('checking')` before `startAuthPoller`
- call `startAuthPoller((status) => chrome.setAuthStatus(status))` immediately after `await chrome.loadIdentity()`
- call `stopAuthPoller()` before the process exits (inside the SIGINT handler or a `process.on('exit', ...)` listener)

**And** `authPoller.test.js` uses `vi.useFakeTimers()` and mocks `shell.run`, asserting:
- `startAuthPoller` immediately invokes `onStatusChange('checking')`
- after the first check, `onStatusChange('ok')` is called when `shell.run` returns a non-null string
- after the first check, `onStatusChange('error')` is called when `shell.run` returns `null`
- advancing fake timers by 15 000 ms triggers exactly one additional `onStatusChange` call
- advancing fake timers by 30 000 ms triggers exactly two additional `onStatusChange` calls (one per interval tick)
- after `stopAuthPoller()`, advancing timers by 15 000 ms does not invoke `onStatusChange` again

**And** `chrome.test.js` asserts:
- `setAuthStatus('ok')` calls `updateStatusBar` with a segment containing `\x1b[32m` and `🔒`
- `setAuthStatus('error')` calls `updateStatusBar` with a segment containing `\x1b[31m` and `🔒`
- `setAuthStatus('checking')` calls `updateStatusBar` with a segment containing `\x1b[2m` and `🔒`

## Technical Notes

- The in-flight guard: use a module-level `let polling = false` flag — set to `true` at the start of each check, back to `false` on completion. The interval callback is a one-liner: `if (polling) return; runCheck()`.
- `shell.run` is synchronous. Wrap the call in `new Promise(resolve => setImmediate(() => resolve(shell.run(...))))` inside the poller so the event loop gets a tick before the blocking call.
- `stopAuthPoller()` must also reset the `polling` flag to `false` so a restart (if ever needed) begins cleanly.
- Status bar right-alignment: pad the space between the identity string and the lock indicator with `' '.repeat(cols - identitySegment.length - lockIndicator.length - 2)`, clamping to `0` if negative.
