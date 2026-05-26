---
epic: 3
story: 1
status: done
---

# Story 3.1: `src/commands/pods.js` — pods command group

## User Story

As a developer,
I want the Pods command group isolated in one module,
So that pod listing, description, and deletion can be imported and tested independently.

## Context

The Pods group is the first and simplest command group. It covers four operations: listing pods in the current namespace, listing pods cluster-wide, describing a selected pod, and deleting a selected pod. All four use `kubectl.pickPod` (from `src/lib/kubectl.js`) for pod selection and `runner.runLive` or `runner.runLiveWithOptionalWatch` (from `src/lib/runner.js`) for execution. No Azure or Helm dependencies.

The `confirm` guard on delete (default: `false`) is critical — this is a destructive operation and the test must verify the guard is respected.

## Acceptance Criteria

**Given** `src/commands/pods.js` is created and `buildPodsCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it is an array of exactly 4 objects, each with `group: "Pods"`, a non-empty `name` string, and a `run` function

**Given** the "List pods" command's `run()` is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with `"kubectl"` and `["--context=ctx", "--namespace=ns", "get", "pods", "-o", "wide"]`

**Given** the "List pods — all namespaces" command's `run()` is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with `"kubectl"` and `["--context=ctx", "get", "pods", "-A", "-o", "wide"]` with no `--namespace` flag

**Given** the "Describe a pod" command's `run()` is invoked and `kubectl.pickPod` resolves `null`
**When** it executes
**Then** `runner.runLive` is never called

**Given** the "Describe a pod" command's `run()` is invoked and `kubectl.pickPod` resolves a pod name
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and `["--context=ctx", "--namespace=ns", "describe", "pod", podName]`

**Given** the "Delete a pod" command's `run()` is invoked and `confirm` resolves `false`
**When** it executes
**Then** `runner.runLive` is never called

**Given** the "Delete a pod" command's `run()` is invoked and `confirm` resolves `true`
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and `["--context=ctx", "--namespace=ns", "delete", "pod", podName]`

**Given** `src/commands/pods.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildPodsCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                                | Source              |
| ------------------------------------- | ------------------- |
| `runLive`, `runLiveWithOptionalWatch` | `../lib/runner.js`  |
| `pickPod`                             | `../lib/kubectl.js` |
| `confirm`                             | `@inquirer/prompts` |

## Technical Notes

- Mock `../lib/runner`, `../lib/kubectl`, and `@inquirer/prompts` with `vi.mock(...)` — never call the real functions in tests
- The `confirm` call uses `{ message: ..., default: false }` — the default must be `false` to prevent accidental deletion
- `buildPodsCommands` must be a pure factory — calling it twice with the same args must return independent arrays
- The "Delete a pod" `run()` must return early (without calling `pickPod`) if `pickPod` resolves `null`
