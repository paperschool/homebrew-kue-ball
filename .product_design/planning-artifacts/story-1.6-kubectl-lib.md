---
epic: 1
story: 6
status: review
---

# Story 1.6: `src/lib/kubectl.js` — kubeconfig helpers

## User Story

As a developer,
I want all kubeconfig-querying functions in one module,
So that kubectl interactions are testable without a live cluster.

## Context

These functions are called from the main loop, the context-selection flow, and command definitions. Extracting them lets tests mock `shell.run` and assert the exact kubectl arguments each function constructs.

## Acceptance Criteria

**Given** `src/lib/kubectl.js` exists and `shell.run` is mocked to return a multi-line string
**When** `getContexts()` is called
**Then** it returns a filtered array of non-empty strings split by newline

**Given** `shell.run` is mocked to return a space-separated string
**When** `getNamespaces(ctx)` is called
**Then** it returns a filtered array of non-empty strings split by space

**Given** `shell.run` is mocked to return `null`
**When** `getContexts()` or `getNamespaces()` is called
**Then** it returns an empty array `[]` (no throw)

**Given** `shell.run` is mocked to return `null`
**When** `getCurrentContext()` is called
**Then** it returns the string `"(none)"`

**Given** `kubectl.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function isKubectlAvailable()
export function getCurrentContext()
export function getContexts()
export function getNamespaces(context)
export async function pickPod(ctx, ns)
```

## Technical Notes

- `pickPod` uses `@inquirer/prompts` `select` — mock the prompt or extract the data-fetching part from the presentation so the JSON parsing is independently testable
- All functions must call `shell.run()` — never import `execSync` directly

### Review Findings

- [ ] [Review][Patch] Shell injection — context/ns interpolated into execSync strings [src/lib/kubectl.js:getNamespaces, pickPod] — Context names and namespace names are interpolated directly into template strings passed to `execSync`. A context name containing spaces, semicolons, or `$()` is valid in Kubernetes and would break the command or allow injection. Fix: switch to `spawnSync` / `spawn` with an explicit args array (as azure.js already does), or shell-escape values.
- [ ] [Review][Patch] pickPod — pods.map accesses p.metadata.name without null guard [src/lib/kubectl.js:pickPod] — If the Kubernetes API returns a pod object without a `metadata` field (malformed response or error state), `p.metadata.name` throws a TypeError mid-map, crashing the pod-selection flow. Fix: add `p.metadata?.name ?? "(unknown)"`.
