---
epic: 3
story: 2
status: done
---

# Story 3.2: `src/commands/logs.js` — logs command group

## User Story

As a developer,
I want the Logs command group isolated in one module,
So that log streaming, previous-container logs, and log-to-file can be tested in isolation.

## Context

The Logs group has the most conditional behaviour of any command group. The "Stream logs — latest pod" command is only included when `APP_NAME` (from `src/lib/env.js`) is set — it uses a label selector (`app=APP_NAME`) rather than pod selection. The other three commands all call `kubectl.pickPod`.

"Dump logs to file" is the most complex: it constructs a shell pipeline that optionally pipes through `jq` (when available via `runner.isJqAvailable()`), writes to `./logs/{pod}_{timestamp}.log`, and calls `shell.spawnInteractive("sh", ["-c", shellCmd])` directly. It calls `output.ok()` on exit code 0 and `output.warn()` otherwise.

## Acceptance Criteria

**Given** `APP_NAME` is set to a non-empty string and `buildLogsCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** the array includes a command named with "Stream logs — latest pod" containing `--selector=app=APP_NAME`

**Given** `APP_NAME` is empty and `buildLogsCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** no command with a `--selector` flag is present; the array has 3 commands

**Given** the "Stream logs — specific pod" command's `run()` is invoked and `pickPod` resolves a pod name
**When** it executes
**Then** `runner.runLivePipedWithExitKeys` is called with `"kubectl"` and `["--context=ctx", "--namespace=ns", "logs", "-f", podName, "--tail=200"]`

**Given** the "Previous container logs" command's `run()` is invoked and `pickPod` resolves a pod name
**When** it executes
**Then** `runner.runLivePiped` is called with args including `"logs"`, `podName`, `"--previous"`, `"--tail=300"`

**Given** any command that calls `pickPod` is invoked and `pickPod` resolves `null`
**When** it executes
**Then** no runner function is called and the command returns without error

**Given** "Dump logs to file" is invoked, `pickPod` resolves a pod name, and `runner.isJqAvailable()` returns `true`
**When** the shell command is constructed
**Then** it includes a `| jq` pipe segment and writes to `./logs/{pod}_{timestamp}.log`

**Given** `shell.spawnInteractive` resolves with exit code `0`
**When** the result is handled
**Then** `output.ok` is called with a message referencing the log filename

**Given** `shell.spawnInteractive` resolves with a non-zero exit code
**When** the result is handled
**Then** `output.warn` is called

**Given** `src/commands/logs.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildLogsCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                                                      | Source              |
| ----------------------------------------------------------- | ------------------- |
| `runLivePipedWithExitKeys`, `runLivePiped`, `isJqAvailable` | `../lib/runner.js`  |
| `pickPod`                                                   | `../lib/kubectl.js` |
| `spawnInteractive`                                          | `../lib/shell.js`   |
| `ok`, `warn`                                                | `../lib/output.js`  |
| `APP_NAME`                                                  | `../lib/env.js`     |
| `input`                                                     | `@inquirer/prompts` |

## Technical Notes

- Mock all imports with `vi.mock(...)` — especially `../lib/env.js` so `APP_NAME` can be varied between tests
- The `./logs/` directory is created at runtime with `shell.run("mkdir -p ./logs", { silent: true })` — this can be omitted from tests or asserted if desired
- Timestamp in the filename is from `new Date().toISOString().replace(/[:.]/g, "-")` — stub `Date` if you need a deterministic filename in tests
- `isJqAvailable` is called at command execution time, not at factory time
