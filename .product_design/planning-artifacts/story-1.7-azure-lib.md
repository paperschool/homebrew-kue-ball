---
epic: 1
story: 7
status: review
---

# Story 1.7: `src/lib/azure.js` — Azure CLI helpers

## User Story

As a developer,
I want all Azure CLI interactions in one module,
So that subscription/cluster discovery and credential refresh are testable without a live Azure tenant.

## Context

`azure.js` is the most complex lib module — it orchestrates multi-step async flows (`refreshContexts`), handles API version bugs in the `az aks` extension, and surfaces PIM reminders. It calls both `shell.run` and `spawnSync` directly. After extraction it must delegate all process execution to `shell`.

## Acceptance Criteria

**Given** the error message contains "forbidden"
**When** `isPermissionError(msg)` is called
**Then** it returns `true`

**Given** the error message contains "403"
**When** `isPermissionError(msg)` is called
**Then** it returns `true`

**Given** `shell.run` is mocked to return invalid JSON
**When** `listSubscriptions()` is called
**Then** it returns `[]` (no throw)

**Given** `spawnSync` for `az aks list` returns a non-zero status with a stderr message
**When** `listAksClustersForSub(subId)` is called
**Then** it returns `{ clusters: [], error: <extracted message> }`

**Given** `azure.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function isAzCliAvailable()
export function isPermissionError(errorMsg)
export function showPimReminder()
export function listSubscriptions({ refresh = false } = {})
export function listAksClustersForSub(subscriptionId)
export async function listAllAksClusters(subs)
export async function refreshContexts()
```

## Technical Notes

- `listAllAksClusters` writes progress to `process.stdout` — tests should spy on `process.stdout.write` or suppress it
- `refreshContexts` calls multiple prompts (`confirm`, `checkbox`, `search`) — these can be mocked with `vi.mock('@inquirer/prompts')`
- `showPimReminder` should use `output.warn()` / `console.log` — not write ANSI directly

### Review Findings

- [ ] [Review][Decision] azure.js imports spawnSync from child_process directly — Story 1.5 AC states "no other module should import execSync/spawn/spawnSync directly"; Story 1.7 notes say "delegate all process execution to shell". azure.js imports `spawnSync` from `child_process` and shell.js exports no `spawnSync` wrapper. Options: (1) Add `runSync(cmd, args, opts)` to shell.js and update azure.js + azure.test.js to use it. (2) Treat azure.js's use of spawnSync as a documented exception and annotate with a comment.
- [ ] [Review][Decision] listAllAksClusters — doFix reinstall branch is an empty stub — When api_version mismatch is detected and user confirms reinstall, the body is `/* reinstall logic */`. The user sees a prompt, confirms, and nothing happens. Options: (1) Implement reinstall (`az extension remove aks-preview && az extension add aks-preview`). (2) Treat as intentional scaffolding and add a `warn("Not yet implemented")` fallback so the user knows nothing happened.
- [ ] [Review][Decision] fuzzyMatch defined but never called anywhere in the diff — `fuzzyMatch` is a module-private function in azure.js with no visible call-sites. Options: (1) Wire it into the `@inquirer/prompts` `search` component (likely the intended use). (2) Remove it as dead code.
- [ ] [Review][Decision] listAllAksClusters calls confirm() without a TTY guard — `confirm()` from @inquirer/prompts hangs or throws in non-interactive environments (CI, piped stdin). Options: (1) Add `if (!process.stdin.isTTY) { /* skip or log and continue */ }` guard. (2) Accept that kue-ball is a fully interactive CLI and document non-TTY as unsupported.
- [ ] [Review][Patch] refreshContexts — undeclared variable 'results' causes ReferenceError [src/lib/azure.js:refreshContexts] — The function body contains `// ... (subscription selection and az aks get-credentials loop)` placeholder, then `return { results, retry: false }`. The variable `results` is never declared. This is a ReferenceError at runtime. The subscription-selection and credential-refresh loop must be implemented, or the return value corrected.
