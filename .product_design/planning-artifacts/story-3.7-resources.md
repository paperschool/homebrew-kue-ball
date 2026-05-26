---
epic: 3
story: 7
status: done
---

# Story 3.7: `src/commands/resources.js` — resource usage command group

## User Story

As a developer,
I want the Resources command group isolated in one module,
So that CPU/memory usage commands for pods and nodes are testable independently.

## Context

Two commands: "Top pods" (namespace-scoped) and "Top nodes" (cluster-wide). The only meaningful distinction between them is whether a `--namespace` flag is included — "Top nodes" operates at cluster scope and must not receive one. Both use `runLiveWithOptionalWatch` so the user can re-run in watch mode after the initial output.

## Acceptance Criteria

**Given** `buildResourcesCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 2 objects both with `group: "Resources"`

**Given** "Top pods" `run()` is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with `"kubectl"` and `["--context=ctx", "--namespace=ns", "top", "pods"]`

**Given** "Top nodes" `run()` is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with `"kubectl"` and `["--context=ctx", "top", "nodes"]` — the args array must NOT contain a `--namespace` flag

**Given** `src/commands/resources.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildResourcesCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                     | Source             |
| -------------------------- | ------------------ |
| `runLiveWithOptionalWatch` | `../lib/runner.js` |

## Technical Notes

- Only `../lib/runner.js` needs to be mocked
- The test for "Top nodes" should assert that the args array passed to `runLiveWithOptionalWatch` does not include any element matching `/--namespace/`
