---
epic: 1
story: 8
status: review
---

# Story 1.8: `src/lib/helm.js` — Helm helpers

## User Story

As a developer,
I want Helm availability check and release listing in one module,
So that Helm interactions are independently testable and the command group can stay focused on UI.

## Context

Currently `isHelmAvailable` and `listHelmReleases` sit inline in `kubectl-wizard.mjs`. This is a small, self-contained extraction with minimal risk.

## Acceptance Criteria

**Given** `src/lib/helm.js` exists and `shell.run` is mocked to return `null`
**When** `isHelmAvailable()` is called
**Then** it returns `false`

**Given** `shell.run` is mocked to return valid Helm JSON
**When** `listHelmReleases(ctx, ns)` is called
**Then** it returns the parsed array of release objects

**Given** `shell.run` is mocked to return invalid JSON
**When** `listHelmReleases(ctx, ns)` is called
**Then** it returns `[]` (no throw)

**Given** `helm.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function isHelmAvailable()
export function listHelmReleases(ctx, ns)
```

## Technical Notes

- `listHelmReleases` runs `helm list --namespace <ns> --kube-context <ctx> -o json` — assert these exact args in the test

### Review Findings

- [ ] [Review][Patch] Shell injection — ctx/ns interpolated into execSync strings [src/lib/helm.js:listHelmReleases] — Same pattern as kubectl.js: `ctx` and `ns` are interpolated directly into a string passed to `execSync`. Fix: use `spawnSync` with an explicit args array.
