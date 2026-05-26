---
epic: 3
story: 8
status: done
---

# Story 3.8: `src/commands/contexts.js` — contexts command group

## User Story

As a developer,
I want the Contexts command group isolated in one module,
So that kubeconfig context management and namespace switching are testable without live Azure or cluster connections.

## Context

This group bridges the Azure and kubectl worlds. "Refresh contexts" delegates entirely to `azure.refreshContexts()` from `src/lib/azure.js`. "Switch current context" queries `kubectl.getContexts()` then issues a `kubectl config use-context` command. "Change namespace" is special — it does not run any kubectl command; instead it returns the sentinel string `"change-namespace"` so the main command loop in `src/main.js` (Epic 4) can handle the namespace transition.

The `ctx` parameter is not used by this group — context management is cluster-wide by definition — but the factory signature is kept consistent with other groups.

## Acceptance Criteria

**Given** `buildContextsCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 4 objects all with `group: "Contexts"`

**Given** "Refresh contexts" `run()` is invoked and `azure.refreshContexts()` resolves `true`
**When** it executes
**Then** `output.ok` is called with a message telling the user to restart the wizard

**Given** "Refresh contexts" `run()` is invoked and `azure.refreshContexts()` resolves `false`
**When** it executes
**Then** `output.ok` is NOT called

**Given** "List all contexts" `run()` is invoked
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and `["config", "get-contexts"]`

**Given** "Switch current context" `run()` is invoked and `kubectl.getContexts()` returns an empty array
**When** it executes
**Then** `output.warn` is called and `runner.runLive` is never called

**Given** "Switch current context" `run()` is invoked, `kubectl.getContexts()` returns contexts, and a target is selected
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and `["config", "use-context", selectedContext]`

**Given** "Change namespace" `run()` is invoked
**When** it executes
**Then** it resolves to the string `"change-namespace"`

**Given** `src/commands/contexts.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildContextsCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import            | Source              |
| ----------------- | ------------------- |
| `runLive`         | `../lib/runner.js`  |
| `getContexts`     | `../lib/kubectl.js` |
| `refreshContexts` | `../lib/azure.js`   |
| `ok`, `warn`      | `../lib/output.js`  |
| `select`          | `@inquirer/prompts` |

## Technical Notes

- Mock `../lib/azure` to control whether `refreshContexts` returns `true` or `false`
- The `"change-namespace"` sentinel is consumed by the main loop in Epic 4 — this story only needs to verify it is returned, not handled
- `ctx` and `ns` are accepted by the factory for API consistency but are not used inside this module

## Review Findings

- [x] [Review][Patch] Indentation inconsistency — `contexts.js` uses 4-space indentation; all other `src/commands/` files use 2-space [src/commands/contexts.js]
