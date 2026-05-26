---
epic: 3
story: 9
status: done
---

# Story 3.9: `src/commands/exec.js` — exec command group

## User Story

As a developer,
I want the Exec command group isolated in one module,
So that interactive shell and one-off command execution can be tested with mocked pod selection.

## Context

Two commands: interactive shell (`kubectl exec -it`) and one-off command (`kubectl exec -- sh -c`). Both call `kubectl.pickPod` first and return early if it resolves `null`. The interactive shell command offers a `select` prompt for `sh` vs `bash`. The one-off command uses `input` to accept an arbitrary command string with a default of `"env"`.

## Acceptance Criteria

**Given** `buildExecCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 2 objects both with `group: "Exec"`

**Given** "Shell into a pod" `run()` is invoked and `pickPod` resolves `null`
**When** it executes
**Then** `runner.runLive` is never called

**Given** "Shell into a pod" `run()` is invoked, `pickPod` resolves a pod name, and `"bash"` is selected
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and args including `"exec"`, `"-it"`, podName, `"--"`, `"bash"`

**Given** "Shell into a pod" `run()` is invoked, `pickPod` resolves a pod name, and `"sh"` is selected
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and args including `"exec"`, `"-it"`, podName, `"--"`, `"sh"`

**Given** "Run a one-off command in a pod" `run()` is invoked and `pickPod` resolves `null`
**When** it executes
**Then** `runner.runLive` is never called

**Given** "Run a one-off command in a pod" `run()` is invoked, `pickPod` resolves a pod name, and `input` resolves `"env"`
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and args including `"exec"`, podName, `"--"`, `"sh"`, `"-c"`, `"env"`

**Given** `src/commands/exec.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildExecCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import            | Source              |
| ----------------- | ------------------- |
| `runLive`         | `../lib/runner.js`  |
| `pickPod`         | `../lib/kubectl.js` |
| `select`, `input` | `@inquirer/prompts` |

## Technical Notes

- Mock `@inquirer/prompts` `select` to return `"bash"` or `"sh"` as needed per test
- Mock `@inquirer/prompts` `input` to return the desired command string
- No shell or output lib imports are required in this module

## Review Findings

- [x] [Review][Patch] Indentation inconsistency — `exec.js` uses 4-space indentation; all other `src/commands/` files use 2-space [src/commands/exec.js]
- [x] [Review][Patch] Missing "sh" shell selection test — AC requires asserting `runLive` is called with `"sh"` when sh is selected; only bash path is covered [src/commands/exec.test.js]
