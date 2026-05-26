---
epic: 2
story: 1
status: complete
---

# Story 2.1: `src/ui/searchableList.js` — fuzzy-filtered grouped list

## User Story

As a developer,
I want a shared fuzzy-searchable list primitive,
So that any command group can present a searchable, grouped selection without reimplementing search or `Separator` logic.

## Context

The main command loop, the AKS cluster picker, the context picker, and the namespace picker all use `@inquirer/prompts` `search` with an identical `fuzzyMatch` + `Separator` grouping pattern. This module is the canonical home for that pattern. Epic 3 command groups must import `searchableList` rather than calling `search` directly.

`fuzzyMatch` is a character-subsequence algorithm: every character of the query must appear in order somewhere in the (ANSI-stripped) text. It is exported so `searchableMultiSelect` and tests can reuse it.

## Acceptance Criteria

**Given** `src/ui/searchableList.js` is created and imported
**When** `fuzzyMatch("pod", "my-pod-abc")` is called
**Then** it returns `true`

**Given** `fuzzyMatch("xyz", "pod")` is called
**Then** it returns `false`

**Given** the text argument contains ANSI escape sequences
**When** `fuzzyMatch` is called
**Then** escape codes are stripped before matching

**Given** `searchableList` is called with items that have no `group` property
**When** the user types a query
**Then** items whose `name` fuzzy-matches are returned as flat `{ name, value }` choices; non-matching items are excluded

**Given** `searchableList` is called with items that carry a `group` property
**When** the source function is invoked
**Then** each group is preceded by a `Separator` styled `  ${CYAN}${DIM}── {group} ──${RESET}`; groups with no matching items are omitted entirely

**Given** `src/ui/searchableList.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function fuzzyMatch(query, text)
export async function searchableList({ message, items, pageSize })
```

`items` shape: `{ name: string, value: any, group?: string }`

## Technical Notes

- Mock `@inquirer/prompts` using `vi.mock('@inquirer/prompts', ...)` — never call the real prompt in tests
- `pageSize` defaults to `Math.max(8, process.stdout.rows - 4)` when omitted
- The `source` function passed to `search` must handle `null`/`undefined` input (treat as empty string)
- `stripAnsi` is imported from `../lib/output.js` — do not duplicate it here

### Review Findings

- [x] [Review][Patch] Ungrouped items silently dropped in grouped mode [src/ui/searchableList.js:28–40] — When `hasGroups` is `true`, `groups` is built with `.filter(Boolean)`, so items with `group: null`, `group: undefined`, or `group: ""` are excluded from every group iteration and never added to `results`. They silently vanish. Fix: after the named-group loop, collect items where `item.group == null` and append them (no separator needed, or a fallback separator).
- [x] [Review][Patch] `fuzzyMatch` crashes on `null`/`undefined` query [src/ui/searchableList.js:7] — `query.toLowerCase()` throws a `TypeError` if `query` is `null` or `undefined`. Fix: `const q = (query ?? "").toLowerCase()`.
- [x] [Review][Patch] Tests call `searchableList()` without `await` [src/ui/searchableList.test.js:61,76,90,105] — The four `source`-capture tests fire a Promise and never await it. If `searchableList` ever throws post-`search`, the rejection is silently swallowed and the tests still pass. Fix: add `await` or ignore the return intentionally with `void`.
- [x] [Review][Defer] `items` param not guarded against `null`/`undefined` [src/ui/searchableList.js:22] — deferred, pre-existing; internal CLI module, YAGNI applies
