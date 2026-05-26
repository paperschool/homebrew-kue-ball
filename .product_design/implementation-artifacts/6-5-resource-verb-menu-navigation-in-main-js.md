# Story 6.5: Resource → verb menu navigation in `src/main.js`

Status: ready-for-dev

## Story

As a user,
I want the main menu to show a list of resource types first and then a list of verbs for the resource I pick,
so that I can navigate by "what" then "how" — which is how I actually think about kubectl operations — instead of scrolling a flat list of every `{verb} {resource}` combination.

## Acceptance Criteria

1. **Given** `src/main.js`'s command loop, **When** it iterates, **Then** the flat `buildAllCommands(ctx, ns)` call is replaced with a two-level picker.
2. **Given** the top-level picker, **Then** it is built from `getResources()` items (grouped by their `group` field — Workloads, Config, Networking, Cluster, Storage), plus four top-level entries appended after the resources: `Helm`, `Ping`, `Contexts`, `Exit`.
3. **Given** the top-level picker uses `searchableList` with `step("Choose resource", "Pick a kubernetes resource type to act on.")` rendered first.
4. **Given** the user picks a resource, **Then** the loop renders `step(\`${resource.displayName} — choose action\`, "Pick an operation to run.")` and calls `searchableList` with items = `[...resource.universalVerbs, ...resource.specificVerbs]` mapped to `{ name: displayName, value: { verb, kind } }`, plus a final `← Back to resources` item (value: `"__back__"`).
5. **Given** a verb is picked, **Then** the loop dispatches to either `UNIVERSAL_VERBS[verb].handler(resource, ctx, ns)` or `SPECIFIC_VERBS[verb].handler(resource, ctx, ns)` based on which mapping contains the verb name. After the handler completes, the user returns to the verb picker for the same resource (not the resource picker).
6. **Given** the verb picker, **When** the user picks `← Back to resources`, **Then** the loop returns to the resource picker without exiting.
7. **Given** the top-level `Helm` entry, **Then** it dispatches to `buildHelmCommands(ctx, ns)` and presents those commands in a sub-list (existing flow preserved). Same for `Ping` → `buildPingCommands`. `Contexts` → existing context-switching flow (search for the current "Change context" / "Change namespace" sentinels in `src/main.js`). `Exit` → break the loop.
8. **Given** any command's `run()` resolves to `RETURN_TO_MENU` or `"change-namespace"`, **Then** existing main-loop sentinel handling continues to work unchanged.
9. **Given** error handling, **Then** `isPermissionError` / `showPimReminder` flows are preserved exactly as before.
10. **Given** `main.test.js` is updated, **Then** it asserts:
    - The top-level picker's items list contains all `getResources()` entries (mock the registry to return two fixture resources) plus exactly four trailing entries: Helm, Ping, Contexts, Exit.
    - Selecting a resource and then a verb invokes the corresponding handler with `(resource, ctx, ns)`.
    - Selecting `← Back to resources` returns control to the resource picker without exiting the loop.
    - `buildAllCommands` is no longer called by the main loop (the export can stay temporarily, but main.js does not invoke it).

## Tasks / Subtasks

- [ ] **Task 1: Add imports** (AC: #1)
  - [ ] `import { getResources } from "./lib/resources.js";`
  - [ ] `import { UNIVERSAL_VERBS } from "./lib/universalVerbs.js";`
  - [ ] `import { SPECIFIC_VERBS } from "./lib/specificVerbs.js";`
  - [ ] Keep existing `buildHelmCommands`, `buildPingCommands` imports — they remain top-level dispatch targets.

- [ ] **Task 2: Build the top-level picker** (AC: #2, #3)
  - [ ] Inside the main `while (true)` loop, replace the call to `buildAllCommands(ctx, currentNamespace)` and the existing `searchableList({...})` block with:
    1. `step("Choose resource", "Pick a kubernetes resource type to act on.")` (from `./ui/chrome.js`).
    2. Build items: `getResources().map(r => ({ group: r.group, name: r.displayName, value: { type: "resource", resource: r } }))`.
    3. Append the four extras: `{ name: "Helm", value: { type: "extra", target: "helm" } }`, etc. No `group` on the extras so they render flat below the grouped resources (see `searchableList` separator behaviour — items with no `group` render without a `Separator` header).
    4. `const top = await searchableList({ message: "Resource or action:", items: [...resources, ...extras] });`

- [ ] **Task 3: Dispatch top-level selection** (AC: #5, #6, #7)
  - [ ] `if (top.type === "extra")` switch on `top.target`:
    - `"helm"` → run the existing helm sub-picker (build with `buildHelmCommands(ctx, currentNamespace)`, present via `searchableList`, dispatch).
    - `"ping"` → same shape with `buildPingCommands`.
    - `"contexts"` → keep the existing context/namespace-switching block as a nested call.
    - `"exit"` → `break` the main loop.
  - [ ] `if (top.type === "resource")` → enter the verb picker (Task 4).

- [ ] **Task 4: Verb picker loop** (AC: #4, #5, #6)
  - [ ] Inside the resource branch, open an inner `while (true)` loop:
    1. `step(\`${resource.displayName} — choose action\`, "Pick an operation to run.")`.
    2. Build verb items: for each name in `[...resource.universalVerbs, ...resource.specificVerbs]`, look up `UNIVERSAL_VERBS[name] ?? SPECIFIC_VERBS[name]`; if not found, skip and log a `warn(\`Verb "${name}" not found in registries — check resources.js.\`)`. Item shape: `{ name: verbEntry.displayName, value: { verb: name, source: UNIVERSAL_VERBS[name] ? "universal" : "specific" } }`.
    3. Append `{ name: "← Back to resources", value: { back: true } }` last (no `group`).
    4. `const picked = await searchableList({ message: "Action:", items });`
    5. `if (picked.back) break;` (out of inner loop, back to top-level).
    6. Otherwise, look up the handler and `await handler(resource, ctx, currentNamespace);` wrapped in the existing try/catch for `isPermissionError`.
  - [ ] After the inner loop breaks, the outer loop iterates again — the resource picker reappears.

- [ ] **Task 5: Preserve existing sentinel handling** (AC: #8, #9)
  - [ ] After any handler call, check for `RETURN_TO_MENU` and `"change-namespace"` sentinels exactly as the current main loop does. `"change-namespace"` should re-prompt for namespace and continue the outer loop; `RETURN_TO_MENU` should `continue` the inner loop.

- [ ] **Task 6: Update `main.test.js`** (AC: #10)
  - [ ] Add a `vi.mock("./lib/resources.js", () => ({ getResources: vi.fn().mockReturnValue([fixture1, fixture2]) }))`.
  - [ ] Add `vi.mock("./lib/universalVerbs.js", ...)` exposing `UNIVERSAL_VERBS` with one or two fake handlers.
  - [ ] Add `vi.mock("./lib/specificVerbs.js", ...)` similarly.
  - [ ] Existing tests that asserted `buildAllCommands` was called must be updated or replaced. Find them with `grep -n buildAllCommands src/main.test.js`.
  - [ ] New tests: assert the resource picker items, assert handler dispatch, assert back navigation.

- [ ] **Task 7: Manual smoke test**
  - [ ] `node src/main.js` against a real cluster (or a `kind`/`minikube` local cluster).
  - [ ] Pick Pods → List → see pod list, return to verb picker. Pick `← Back` → see resource picker. Pick `Helm` → see helm sub-list (unchanged). Pick `Exit` → terminal restores cleanly.
  - [ ] Record any UX rough edges in Dev Agent Record → Completion Notes.

- [ ] **Task 8: Verify no regressions**
  - [ ] `npm test` — all tests pass.
  - [ ] `src/commands/*` modules are unchanged — they're still imported by `buildAllCommands`, which still exists but is no longer called from the main loop. (Story 6-6 deletes them.)

## Dev Notes

### Dependency chain

- **6-5 depends on 6-1, 6-2, 6-3, 6-4.** Without those, there are no entries to iterate, no verb handlers to dispatch to.
- 6-5 does NOT delete `buildAllCommands` or the `src/commands/*` files. That's 6-6's job. After 6-5 merges, the old code is dormant but present.

### Why dispatch via lookup table not switch

Two registries, ~20 verbs total. A `switch (verbName) { case "list": ... }` would duplicate the verb names already in the registries. The lookup approach:

```js
const verbEntry = UNIVERSAL_VERBS[verbName] ?? SPECIFIC_VERBS[verbName];
if (!verbEntry) { warn(...); continue; }
await verbEntry.handler(resource, ctx, ns);
```

…trusts the registries as the source of truth. If a resource lists `"logs"` in its `specificVerbs` and `logs` doesn't exist in `SPECIFIC_VERBS`, that's a registration bug — surface it with `warn`, don't crash.

### Why `← Back` not a key binding

Inquirer's `search` prompt doesn't expose a customizable Escape handler. Adding `← Back to resources` as a regular list item is the simplest, most discoverable affordance. Inquirer's `Ctrl+C` already escapes anyway.

### Helm / Ping / Contexts — why not "resources"

The epic explicitly carves these out (FR16): they aren't kubernetes resources, they're tools. Wrapping them as resource entries would be a category error. The four extras render below the resource list, separated by absence of a `group` field (so `searchableList` doesn't draw a Separator before them).

### Step header rationale

The `step()` helper from chrome.js (added pre-Epic 6) clears the content area and prints a titled wizard page. Use it on every transition — including back navigation — so the user always sees fresh context. Without it, the previous page's content lingers above the picker and feels unkempt.

### What NOT to do

- Don't delete `buildAllCommands` yet. 6-6 owns that.
- Don't add a "recent verbs" or "favourites" feature. Out of scope. The epic mentions no such thing.
- Don't render `Helm` / `Ping` / `Contexts` with icons or special styling. Plain entries. The user will discover them by reading.
- Don't introduce a `verbDispatcher.js` module to wrap the lookup logic. It's 4 lines. Inline it in main.js until a second consumer appears.

### File size budget

`src/main.js` was 199 lines pre-Epic-6 changes. This story may push it past 200 — that's fine, but stay under 250. If the two-level picker logic gets gnarly, extract it to `src/ui/menu.js` rather than fighting the line count in main.js. **Decision rule:** if the new code crosses 60 lines of menu logic, extract.

### Testing approach

- Existing `main.test.js` has mocks for every command builder. After 6-5, most of those mocks become irrelevant — but **leave them in** until 6-6 removes them. Half-removing mocks creates a confusing test setup.
- New tests focus on:
  1. The top-level picker is constructed from `getResources()` + 4 extras.
  2. Picking a resource → inner loop opens → picking a verb dispatches correctly.
  3. Picking `← Back` exits the inner loop without ending the session.
  4. Picking `Exit` ends the session.
- Mock `searchableList` as `vi.fn()` and `.mockResolvedValueOnce(...)` the sequence of selections the test wants.

### Source Tree After This Story

```
src/
├── commands/                  ← UNCHANGED (deleted in 6-6)
├── lib/
│   ├── resources.js
│   ├── specificVerbs.js
│   └── universalVerbs.js
├── ui/
│   └── chrome.js (step() already exists)
├── main.js                    ← MODIFIED (two-level picker)
└── main.test.js               ← MODIFIED
```

### Definition of Done

- [ ] Two-level picker live in `main.js`; old flat picker replaced.
- [ ] Manual smoke test passes against a real cluster.
- [ ] `npm test` passes.
- [ ] `buildAllCommands` is not called from `main()` (verified by `grep buildAllCommands src/main.js`).

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.5" (lines 979–1002).
- Registry: `src/lib/resources.js` (story 6-1).
- Verb registries: `src/lib/universalVerbs.js`, `src/lib/specificVerbs.js`.
- Chrome step helper: `src/ui/chrome.js` `step()`.
- Current main loop & sentinels: `src/main.js:130-200` (exact line numbers may shift after pre-Epic-6 commits).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
