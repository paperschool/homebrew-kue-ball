---
epic: 3
story: 3
status: done
---

# Story 3.3: `src/commands/deployments.js` — deployments command group

## User Story

As a developer,
I want the Deployments command group isolated in one module,
So that listing, rollout management, rollback, restart, and deployment deletion are testable independently.

## Context

This is the largest command group due to the app-specific commands gated on `APP_NAME`. When `APP_NAME` is set, five extra commands appear: describe, rollout status, rollout history, rollback, and restart. When `APP_NAME` is empty, only the two universal commands (list, delete) are present.

"Delete a deployment" is the most complex command: it fetches deployments via `shell.run()`, picks one, then inspects ServiceAccount annotations to find any SA sharing the same `meta.helm.sh/release-name` and deletes them alongside the deployment. This co-deletion logic must be tested.

## Acceptance Criteria

**Given** `APP_NAME` is empty and `buildDeploymentsCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 2 commands: "List deployments" and "Delete a deployment", both with `group: "Deployments"`

**Given** `APP_NAME` is set and `buildDeploymentsCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 7 commands including "Describe deployment", "Rollout status", "Rollout history", "Rollback deployment", "Restart deployment"

**Given** "List deployments" `run()` is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with `"kubectl"` and args including `"get"`, `"deployments"`

**Given** "Rollback deployment" `run()` is invoked and `confirm` resolves `false`
**When** it executes
**Then** `runner.runLive` is never called

**Given** "Rollback deployment" `run()` is invoked and `confirm` resolves `true`
**When** it executes
**Then** `runner.runLive` is called with args including `"rollout"`, `"undo"`, `"deployment/APP_NAME"`

**Given** "Restart deployment" `run()` is invoked and `confirm` resolves `true`
**When** it executes
**Then** `runner.runLive` is called with args including `"rollout"`, `"restart"`, `"deployment/APP_NAME"`

**Given** "Delete a deployment" `run()` is invoked and `shell.run` returns JSON with no deployments
**When** it executes
**Then** `output.warn` is called and the command returns without presenting a picker

**Given** "Delete a deployment" `run()` is invoked, a deployment is selected, and `confirm` resolves `false`
**When** it executes
**Then** `runner.runLive` is never called

**Given** "Delete a deployment" `run()` is invoked, a deployment is selected, `confirm` resolves `true`, and the deployment has a `meta.helm.sh/release-name` annotation matching a ServiceAccount
**When** it executes
**Then** `runner.runLive` is called to delete the deployment AND is called again to delete each orphaned ServiceAccount

**Given** `src/commands/deployments.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildDeploymentsCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                                | Source              |
| ------------------------------------- | ------------------- |
| `runLive`, `runLiveWithOptionalWatch` | `../lib/runner.js`  |
| `run`                                 | `../lib/shell.js`   |
| `warn`                                | `../lib/output.js`  |
| `APP_NAME`                            | `../lib/env.js`     |
| `select`, `confirm`                   | `@inquirer/prompts` |

## Technical Notes

- Mock `../lib/env.js` so `APP_NAME` can be set/cleared per test
- The orphaned-SA check reads `meta.helm.sh/release-name` from the chosen deployment's annotations, then matches against all ServiceAccounts in the namespace — mock both `shell.run` calls (deployments JSON and service-accounts JSON) separately using `vi.fn().mockReturnValueOnce()`
- `confirm` calls use `{ default: false }` on destructive operations
