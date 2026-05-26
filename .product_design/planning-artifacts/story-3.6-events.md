---
epic: 3
story: 6
status: done
---

# Story 3.6: `src/commands/events.js` — events command group

## User Story

As a developer,
I want the Events command group isolated in one module,
So that namespace event listing and warning filtering are testable without a live cluster.

## Context

This is the simplest command group — two commands, no pickers, no confirmations, no conditional logic. Both commands are direct calls to `runner.runLive`. The only variation is the field-selector flag on "Warning events only". This story is a good starting point if tackling Epic 3 sequentially.

## Acceptance Criteria

**Given** `buildEventsCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 2 objects both with `group: "Events"`

**Given** "Recent events — namespace" `run()` is invoked
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and `["--context=ctx", "--namespace=ns", "get", "events", "--sort-by=.lastTimestamp"]`

**Given** "Warning events only" `run()` is invoked
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and args including `"--field-selector=type=Warning"` and `"--sort-by=.lastTimestamp"`

**Given** `src/commands/events.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildEventsCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import    | Source             |
| --------- | ------------------ |
| `runLive` | `../lib/runner.js` |

## Technical Notes

- Only `../lib/runner.js` needs to be mocked — there are no prompts or shell calls in this module
- Both commands pass `--context` and `--namespace` flags — verify these interpolate `ctx` and `ns` correctly in tests
