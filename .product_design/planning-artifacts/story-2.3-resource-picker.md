---
epic: 2
story: 3
status: complete
---

# Story 2.3: `src/ui/resourcePicker.js` — spinner + fetch + pick flow

## User Story

As a developer,
I want a shared "spinner → fetch → pick" primitive,
So that any command that loads remote resources before presenting a list does not inline its own spinner, error guard, or `searchableList` call.

## Context

Several command groups follow an identical pattern: write a DIM spinner message, run a `kubectl` or `az` query, clear the spinner line, handle an empty result with `warn()`, then present a `searchableList`. The `pickPod` function in the original monolith is the canonical example. This component extracts that pattern so Epic 3 command groups call `resourcePicker` rather than writing `process.stdout.write` / `\r\x1b[2K` / empty-check / `searchableList` inline each time.

## Acceptance Criteria

**Given** `src/ui/resourcePicker.js` is created and `resourcePicker` is called
**When** the function runs
**Then** `  ${DIM}{spinnerMessage}…${RESET}` is written to `process.stdout` (no newline) before `fetchFn` is awaited

**Given** `fetchFn` resolves
**When** the result is received
**Then** the spinner line is cleared with `process.stdout.write("\r\x1b[2K")`

**Given** `fetchFn` returns an empty array
**When** the empty check runs
**Then** `warn(emptyMessage)` is called and the function returns `null`

**Given** `fetchFn` returns a non-empty array and no `mapFn` is provided
**When** `searchableList` is called
**Then** the raw items are passed directly as the `items` option

**Given** a `mapFn` is supplied
**When** items are prepared
**Then** each raw item is transformed by `mapFn` before being passed to `searchableList`

**Given** items are present
**When** `searchableList` resolves
**Then** `resourcePicker` returns the resolved value

**Given** `src/ui/resourcePicker.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export async function resourcePicker({ spinnerMessage, emptyMessage, fetchFn, mapFn, listOptions })
```

| Option           | Type                                | Description                                                                 |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `spinnerMessage` | `string`                            | Text shown in the spinner (no trailing `…` needed — appended automatically) |
| `emptyMessage`   | `string`                            | Passed to `warn()` when the fetch returns nothing                           |
| `fetchFn`        | `() => Promise<any[]>`              | Async function that returns raw resource items                              |
| `mapFn`          | `(item) => { name, value, group? }` | Optional transform applied to each raw item                                 |
| `listOptions`    | `object`                            | Spread into `searchableList` options (e.g. `{ message, pageSize }`)         |

## Technical Notes

- Mock `./searchableList.js`, `../lib/output.js`, and `process.stdout.write` in tests
- The spinner write and the clear write are two separate `process.stdout.write` calls — do not combine them
- `warn` and `DIM`/`RESET` are imported from `../lib/output.js`

### Review Findings

- [x] [Review][Decision] Signature uses `listOptions` bundle; spec lists `message`/`pageSize` as top-level params [src/ui/resourcePicker.js:4–9] — Spec signature is `resourcePicker({ message, spinnerMessage, fetchFn, mapFn, pageSize })` but the spec's own parameter table documents `listOptions`. The implementation follows the table (using `listOptions`), which is the better design but leaves callers responsible for knowing `message` lives inside `listOptions`. Options: (a) keep `listOptions` and update the spec signature; (b) promote `message` to a top-level param and merge it into `listOptions` before calling `searchableList`.
- [x] [Review][Patch] Spinner not cleared when `fetchFn()` rejects [src/ui/resourcePicker.js:11–13] — If `fetchFn` rejects, `process.stdout.write("\r\x1b[2K")` never runs and the spinner line remains on screen. Fix: wrap the body in `try/finally` — move the clear into the `finally` block.
- [x] [Review][Patch] `fetchFn` returning `null`/`undefined` crashes after clearing spinner [src/ui/resourcePicker.js:15] — If `fetchFn` resolves to a non-array, `raw.map(mapFn)` throws a `TypeError`. The same `try/finally` that clears the spinner will also handle this gracefully by re-throwing after clearing.
