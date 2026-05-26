---
epic: 3
story: 10
status: done
---

# Story 3.10: `src/commands/helm.js` — helm command group

## User Story

As a developer,
I want the Helm command group isolated in one module,
So that release listing and deletion are testable with a mocked helm lib.

## Context

Both commands guard on `helm.isHelmAvailable()` at the start of each `run()` call — if Helm is not installed, they warn and return early without performing any action. "Delete a Helm release" follows the spinner → fetch (`helm.listHelmReleases`) → select → confirm → uninstall pattern. The `helm.listHelmReleases` function is already implemented in `src/lib/helm.js` (Story 1.8).

## Acceptance Criteria

**Given** `buildHelmCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 2 objects both with `group: "Helm"`

**Given** "List Helm releases" `run()` is invoked and `helm.isHelmAvailable()` returns `false`
**When** it executes
**Then** `output.warn` is called with an install hint and `runner.runLive` is never called

**Given** "List Helm releases" `run()` is invoked and `helm.isHelmAvailable()` returns `true`
**When** it executes
**Then** `runner.runLive` is called with `"helm"` and `["list", "--namespace", ns, "--kube-context", ctx]`

**Given** "Delete a Helm release" `run()` is invoked and `helm.isHelmAvailable()` returns `false`
**When** it executes
**Then** `output.warn` is called and `runner.runLive` is never called

**Given** "Delete a Helm release" `run()` is invoked, Helm is available, and `helm.listHelmReleases` returns `[]`
**When** it executes
**Then** `output.warn` is called with an empty-list message and no picker is shown

**Given** "Delete a Helm release" `run()` is invoked, releases are found, and `confirm` resolves `false`
**When** it executes
**Then** `runner.runLive` is never called

**Given** "Delete a Helm release" `run()` is invoked, releases are found, and `confirm` resolves `true`
**When** it executes
**Then** `runner.runLive` is called with `"helm"` and `["uninstall", "--namespace", ns, "--kube-context", ctx, chosenRelease]`

**Given** `src/commands/helm.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildHelmCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                                | Source              |
| ------------------------------------- | ------------------- |
| `runLive`                             | `../lib/runner.js`  |
| `isHelmAvailable`, `listHelmReleases` | `../lib/helm.js`    |
| `warn`                                | `../lib/output.js`  |
| `select`, `confirm`                   | `@inquirer/prompts` |

## Technical Notes

- Mock `../lib/helm` to control both `isHelmAvailable` and `listHelmReleases` return values independently
- The spinner/clear pattern for "Delete a Helm release" (`process.stdout.write` before `listHelmReleases`, `"\r\x1b[2K"` after) is optional to assert in tests — focus on the logic assertions
- `confirm` uses `{ default: false }`

## Review Findings

- [x] [Review][Patch] Indentation inconsistency — `helm.js` uses 4-space indentation; all other `src/commands/` files use 2-space [src/commands/helm.js]
- [x] [Review][Defer] `listHelmReleases` sync contract undocumented — called without await; correct today but silent regression risk if function is ever made async [src/commands/helm.js] — deferred, pre-existing
