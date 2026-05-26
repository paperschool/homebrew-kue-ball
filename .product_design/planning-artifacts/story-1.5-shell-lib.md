---
epic: 1
story: 5
status: review
---

# Story 1.5: `src/lib/shell.js` — process execution

## User Story

As a developer,
I want `run()`, `spawnInteractive()`, and `spawnInteractiveWithExitKeys()` in one module,
So that all child-process logic — including PATH augmentation — lives at a single mockable boundary.

## Context

This is the most critical module for testability. Every other lib module calls `shell.run()` — if it is mockable, the entire shell interaction layer becomes controllable in tests. No other module should import `execSync`, `spawn`, or `spawnSync` directly.

## Acceptance Criteria

**Given** `src/lib/shell.js` exists and `run("some-cmd")` is called
**When** `execSync` succeeds
**Then** the trimmed stdout string is returned

**Given** `run()` is called and `execSync` throws
**When** the error is caught
**Then** `null` is returned (no throw propagated)

**Given** `run()` builds the child process environment
**When** the `env` option is inspected
**Then** `PATH` includes `~/.rd/bin`, `/opt/homebrew/bin`, and `/usr/local/bin` prepended to the original `PATH`

**Given** `shell.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function run(cmd, { silent = false } = {})
export function spawnInteractive(cmd, args)
export function spawnInteractiveWithExitKeys(cmd, args)
```

## Technical Notes

- Mock `child_process` (`execSync`, `spawn`, `spawnSync`) using `vi.mock('child_process', ...)`
- `spawnInteractive` and `spawnInteractiveWithExitKeys` are harder to unit-test (they depend on process stdin/stdout); a single smoke test asserting they return a Promise is sufficient — deeper testing belongs in integration tests
- The PATH augmentation logic must not use hardcoded `HOME` — use `process.env.HOME`

### Review Findings

- [ ] [Review][Patch] buildEnv — process.env.HOME unguarded [src/lib/shell.js:buildEnv] — When HOME is undefined, `"${process.env.HOME}/.rd/bin"` becomes `"undefined/.rd/bin"`, silently poisoning PATH. Fix: `process.env.HOME ? \`${process.env.HOME}/.rd/bin\` : null` then filter nulls from the extra-paths array.
- [ ] [Review][Patch] buildEnv — process.env.PATH unguarded [src/lib/shell.js:buildEnv] — When PATH is undefined, the constructed PATH becomes `"extraPaths:undefined"`, causing all spawned commands to fail. Fix: `process.env.PATH ?? \'\''`.
- [ ] [Review][Patch] spawnInteractiveWithExitKeys — escape swallows multi-byte terminal sequences [src/lib/shell.js:onStdinData] — `key.startsWith("\u001b")` intercepts every byte starting with ESC, including the leading byte of arrow keys (up/down/left/right are 3-byte sequences). This breaks navigation inside child processes (e.g. kubectl exec into a shell). Fix: buffer incomplete escape sequences and only intercept after a short delay if no continuation bytes arrive.
- [ ] [Review][Patch] spawnInteractiveWithExitKeys — proc.kill throws ESRCH on already-exited process [src/lib/shell.js:stopProc] — proc.killed guards against double-kill but not ESRCH if the OS has reaped the process before the flag is set. Fix: wrap `proc.kill` in try/catch.
- [ ] [Review][Patch] spawnInteractiveWithExitKeys — setRawMode(true) unguarded [src/lib/shell.js] — If the TTY fd is closed between the isTTY check and the setRawMode call, it throws. Fix: wrap in try/catch.
- [ ] [Review][Patch] spawnInteractiveWithExitKeys — proc.stdin.write on ended stream [src/lib/shell.js:onStdinData] — proc.stdin may have been ended by the child; writing after end throws. Fix: wrap `proc.stdin.write(buf)` in try/catch.
