---
epic: 1
story: 10
status: review
---

# Story 1.10: `src/lib/runner.js` — command runner helpers

## User Story

As a developer,
I want `runLive`, `runLivePiped`, `runLivePipedWithExitKeys`, and watch-mode helpers in one module,
So that command groups can invoke them without knowing about `jq` detection or shell piping internals.

## Context

These are the "execution adapters" between command definitions and the shell. They handle `jq` pipe-through, the watch-mode re-run prompt, and the Esc/q exit-key wrapper. Extracting them completes Epic 1 — after this, all `src/lib/` modules are in place and Epic 2 (UI components) can begin.

## Acceptance Criteria

**Given** `src/lib/runner.js` exists and `shell.spawnInteractive` is mocked
**When** `runLive("kubectl", ["get", "pods"])` is called
**Then** `printCommand` is called with the full command string
**And** `shell.spawnInteractive` is called with `("kubectl", ["get", "pods"])`

**Given** `isJqAvailable()` returns `true` and `shell.spawnInteractive` is mocked
**When** `runLivePiped("kubectl", ["logs", "my-pod"])` is called
**Then** `shell.spawnInteractive` is called with `("sh", ["-c", <cmd including jq pipe>])`

**Given** `isJqAvailable()` returns `false`
**When** `runLivePiped` is called
**Then** `shell.spawnInteractive` is called directly with the original command (no `sh -c`)

**Given** `runner.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function isJqAvailable()
export async function runLive(cmd, args)
export async function runLiveWithOptionalWatch(cmd, args)
export async function runLivePiped(cmd, args)
export async function runLivePipedWithExitKeys(cmd, args)
export const RETURN_TO_MENU   // sentinel string constant
```

## Technical Notes

- `promptWatchReplay` is an internal helper (not exported) — it can be tested indirectly via `runLiveWithOptionalWatch`
- Mock `process.stdin` carefully for the watch-replay test: set `isTTY = true` and `setRawMode` as a spy, then emit a `"data"` event with `Buffer.from("w")`
- `RETURN_TO_MENU` must be the same sentinel string that `src/main.js` will check — define it once here and re-export it

### Review Findings

- [ ] [Review][Patch] promptWatchReplay — stdin listener leaked on SIGINT/SIGTERM [src/lib/runner.js:promptWatchReplay] — If the process is killed while waiting for the 'w' keypress, `cleanup()` is never called, leaving stdin in raw mode and the 'data' listener attached. The terminal is broken after exit. Fix: register `process.once('SIGINT', cleanup)` and `process.once('SIGTERM', cleanup)` inside the Promise, removing them in `cleanup`.
