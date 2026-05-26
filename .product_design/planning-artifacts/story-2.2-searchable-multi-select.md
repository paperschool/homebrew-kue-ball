---
epic: 2
story: 2
status: complete
---

# Story 2.2: `src/ui/searchableMultiSelect.js` — grouped checkbox with pre-selection

## User Story

As a developer,
I want a shared multi-select primitive that supports pre-selection and group separators,
So that the subscription picker (and any future multi-select flow) does not inline its own `checkbox` construction or separator layout.

## Context

The subscription picker in `refreshContexts` uses `@inquirer/prompts` `checkbox` with a specific ordering rule: subscriptions the user has selected before (`checked: true`) float to the top, separated from untouched ones by a `Separator`. This component captures that convention. Any future multi-select that needs the same "previously used first" pattern uses this primitive rather than rebuilding it.

## Acceptance Criteria

**Given** `src/ui/searchableMultiSelect.js` is created and `searchableMultiSelect` is called with a mix of checked and unchecked items
**When** `checkbox` receives the `choices` array
**Then** all `checked: true` items appear before all `checked: false` items

**Given** both checked and unchecked groups are non-empty
**When** choices are built
**Then** a `Separator` is inserted between the two groups

**Given** all items are checked (or all are unchecked)
**When** choices are built
**Then** no `Separator` is inserted

**Given** no `validate` option is supplied
**When** the user confirms with zero items selected
**Then** the default validator returns a non-`true` string message

**Given** a caller supplies a `validate` function
**When** `checkbox` is called
**Then** the caller's function is forwarded unchanged (default is not applied)

**Given** `src/ui/searchableMultiSelect.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export async function searchableMultiSelect({ message, items, pageSize, validate })
```

`items` shape: `{ name: string, value: any, checked: boolean, group?: string }`

Returns: the array of selected `value`s as resolved by `checkbox`.

## Technical Notes

- Mock `@inquirer/prompts` using `vi.mock('@inquirer/prompts', ...)`
- `pageSize` defaults to `20` when omitted
- `group` is stored on item objects for forward-compatibility but this component does not render group separators — it only separates checked from unchecked; Epic 3 command groups that need sub-group headers should compose with `searchableList` instead

### Review Findings

- [x] [Review][Decision] `searchableMultiSelect` does not enable live filtering despite the name [src/ui/searchableMultiSelect.js:27] — `@inquirer/prompts` `checkbox` requires `searchable: true` (v3+) to narrow choices as the user types. Without it the function name implies filtering that does not work. Options: (a) add `searchable: true` to the `checkbox` call; (b) rename the function to `groupedMultiSelect` to accurately reflect its behaviour.
- [x] [Review][Defer] `items` param not guarded against `null`/`undefined` [src/ui/searchableMultiSelect.js:9] — deferred, pre-existing; internal CLI module, YAGNI applies
