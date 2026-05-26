# Story 6.1: `src/lib/resources.js` — resource registry

Status: ready-for-dev

## Story

As a developer,
I want a single registry that maps resource types to their kubectl identifiers, display labels, and supported verbs,
so that menu navigation, verb dispatch, and future-resource additions all read from one source of truth instead of being scattered across command modules.

## Acceptance Criteria

1. **Given** `src/lib/resources.js` is created, **When** imported, **Then** it exports `RESOURCES` (an array), `getResource(kind)`, and `getResources()`.
2. **Given** each resource entry, **Then** it has the shape `{ kind, plural, displayName, group, namespaced, universalVerbs, specificVerbs }` where:
   - `kind` is the singular kubectl name (e.g. `"pod"`, `"deployment"`)
   - `plural` is the kubectl plural (e.g. `"pods"`, `"deployments"`)
   - `displayName` is the user-facing label (e.g. `"Pods"`, `"Deployments"`)
   - `group` is the menu grouping label — one of `"Workloads"`, `"Config"`, `"Networking"`, `"Cluster"`, `"Storage"`
   - `namespaced` is `true` for namespace-scoped resources, `false` for cluster-scoped
   - `universalVerbs` is an array of strings from `["list", "describe", "edit", "delete"]`
   - `specificVerbs` is an array of strings (free-form for now — story 6-2/6-3 will define the canonical set)
3. **Given** the registry, **Then** it includes entries for **Pods, Deployments, ReplicaSets, Services, ConfigMaps, Secrets, Ingress, ServiceAccounts** — every resource that has a current `src/commands/*.js` module today.
4. **Given** `getResource("pod")`, **Then** it returns the Pods entry; `getResource("nonexistent")` returns `null` (not `undefined` — choose explicitly).
5. **Given** `getResources()`, **Then** it returns the `RESOURCES` array in display order (the order they should appear in the menu — group order: Workloads → Config → Networking → Cluster → Storage; alphabetical inside each group).
6. **Given** the registry, **Then** no two entries share the same `kind` (enforced by a startup-time validation or by the test).
7. **Given** `resources.test.js`, **Then** it asserts: every entry has all required fields with the correct types; `getResource("pod")` returns the Pods entry; `getResource("nonexistent")` returns `null`; `getResources()` returns entries in the expected display order; no two entries share the same `kind`.

## Tasks / Subtasks

- [ ] **Task 1: Create the resource entry shape and the eight initial entries** (AC: #2, #3)
  - [ ] Define a JSDoc-style typedef comment or inline shape doc at the top of `src/lib/resources.js` describing the entry — keep it brief, one line per field
  - [ ] Add entries in this order: Pods, Deployments, ReplicaSets (Workloads); ConfigMaps, Secrets (Config); Services, Ingress, ServiceAccounts (Networking)
  - [ ] For each entry, populate `universalVerbs` based on today's behaviour:
    - Pods: `["list", "describe", "delete"]` (no edit today — but plan ahead: add `"edit"` since 6-2 will support it)
    - Deployments: `["list", "describe", "edit", "delete"]`
    - ReplicaSets: `["list", "describe", "edit", "delete"]`
    - Services: `["list", "describe", "edit", "delete"]`
    - ConfigMaps: `["list", "describe", "edit", "delete"]`
    - Secrets: `["list", "describe", "delete"]` (no `edit` — per epic 6.6, intentional)
    - Ingress: `["list", "describe", "edit", "delete"]`
    - ServiceAccounts: `["list", "describe", "delete"]`
  - [ ] Leave `specificVerbs` as `[]` for now — story 6-3 fills these in. Use empty arrays, not `undefined`.
  - [ ] All eight entries are namespace-scoped → `namespaced: true`.

- [ ] **Task 2: Implement `getResource(kind)` and `getResources()`** (AC: #1, #4, #5)
  - [ ] `getResource(kind)` does a linear scan of `RESOURCES` and returns the matching entry or `null`. No `Map` — keep it a plain array so the test can assert order easily.
  - [ ] `getResources()` returns `RESOURCES` directly (no copy). Document with a one-line `// why:` if a caller should treat it as immutable.

- [ ] **Task 3: Add startup-time uniqueness check** (AC: #6)
  - [ ] At module top-level, after the array is declared, iterate once and `throw new Error(...)` if duplicate `kind`s are found. This catches bad merges at import time, not at runtime.
  - [ ] Test verifies the check exists by attempting a duplicate (or by inspecting it via a helper).

- [ ] **Task 4: Author `src/lib/resources.test.js`** (AC: #7)
  - [ ] Use Vitest (`import { describe, it, expect } from "vitest"`) — match the existing test convention.
  - [ ] Group tests under one top-level `describe("resources registry", () => { ... })`.
  - [ ] Test required-field presence by iterating `RESOURCES` and asserting `typeof` for each field.
  - [ ] Test `getResource("pod")` returns object with `displayName: "Pods"`.
  - [ ] Test `getResource("nonexistent")` returns `null` (strict equality).
  - [ ] Test ordering: assert the first three entries are Pods, Deployments, ReplicaSets (Workloads group) in that order; assert all `group` values are one of the five allowed.
  - [ ] Test uniqueness: assert `new Set(RESOURCES.map(r => r.kind)).size === RESOURCES.length`.

- [ ] **Task 5: Verify no regressions and integrate** (AC: all)
  - [ ] Run `npm test` — all existing 333 tests plus the new ones should pass.
  - [ ] No changes to `src/commands/*` or `src/main.js` — this story is purely additive. The registry isn't wired anywhere yet; that's story 6-5.

## Dev Notes

### Architecture & Constraints

- **ESM only.** `package.json` has `"type": "module"` — use `import`/`export` syntax, never `require`.
- **Node ≥ 22.** No transpilation. Modern syntax (`??`, `?.`, top-level destructuring) is fine.
- **Vitest** is the only test framework. Existing pattern: co-located `*.test.js`, no `__mocks__` directories, `vi.mock("./shell.js", ...)` for boundary mocking.
- **No external dependencies needed.** This is a pure data module — no `kubectl`, no shell, no I/O. Don't add deps.
- **File size budget:** Aim for <100 lines including the eight entries. The project-context.md says ≤150 lines per source file; this should be well under.
- **Naming:** camelCase for fields per `project-context.md §3`. Resource entries use camelCase keys (`displayName`, not `display_name` or `DisplayName`).

### Why "null" not "undefined" for missing lookups

`pickPod()` in `src/lib/kubectl.js:36` already uses `return null` as its sentinel for "no pod available" (line 47). Calling code (e.g. `src/commands/pods.js:39`) does `if (!pod) return;` — checking falsy. Stay consistent: return `null` from `getResource`, not `undefined`. Test must use `toBeNull()`, not `toBeUndefined()`.

### Existing patterns to mirror

- **`src/lib/env.js`** — closest analogue: a small pure-data module exporting constants. Single-file, no async, easy to test. Use the same shape: top-level `export` declarations, no default export.
- **`src/lib/kubectl.js:36-64` `pickPod`** — the function story 6-2 will generalize into `pickResourceInstance(resource, ctx, ns)`. Don't touch it in this story, but design the registry shape so that `pickPod` could one day be re-expressed as `pickResourceInstance(getResource("pod"), ctx, ns)`. That means `kind: "pod"` and `plural: "pods"` are the exact strings that go into `kubectl get pods` / `kubectl describe pod {name}`.
- **`src/commands/pods.js:7-77`** — shows the canonical group label (`group: "Pods"`) currently used for `searchableList` separators in the flat menu. In the registry we have a coarser `group` ("Workloads") since multiple resources share a group. The fine-grained per-resource label is the `displayName` field.

### Display-order rationale (AC #5)

The order matters because story 6-5 will build the resource picker by iterating `getResources()` and rendering `Separator` headers when `group` changes. Stable grouping requires entries pre-sorted by group. Within a group, alphabetical-by-displayName keeps the order predictable as new resources are added (story 6-7 and 6-8).

Final order for this story's eight entries:
1. Pods (Workloads)
2. Deployments (Workloads)
3. ReplicaSets (Workloads)
4. ConfigMaps (Config)
5. Secrets (Config)
6. Ingress (Networking)
7. ServiceAccounts (Networking)
8. Services (Networking)

*(Alphabetical within group: Deployments < Pods < ReplicaSets is alphabetical; D < P < R. Final order above is sorted alphabetically inside each group — verify when writing the test.)*

### What NOT to do (anti-patterns from past stories)

- Don't reach for a `Map`. The epic AC says "array or `Map`" — pick array. Tests assert ordering; arrays make that one-liner.
- Don't add `kubectl` invocations or `shell.run` imports. The registry is pure data. The minute it does I/O, it can't be loaded at the top of `main.js` without paying a startup cost.
- Don't pre-fill `specificVerbs` with guesses. Story 6-3 owns that catalog. Empty arrays now; arrays of strings (e.g. `["logs", "exec"]`) later.
- Don't export a default. Project convention is named exports everywhere (see all `src/lib/*.js`).
- Don't write `// Used by future stories…` comments. The story's existence is the rationale; the comment rots.

### Testing approach

Mockist style is the project's norm (`project-context.md §10.1`), but **this module has no collaborators to mock** — it's pure data. So the test file is the simplest in the repo: import `RESOURCES`, `getResource`, `getResources`, assert on them directly.

Reference for vitest setup: `src/lib/env.test.js` and `src/commands/events.test.js` show the minimal-mock style. Both `import { describe, it, expect } from "vitest"`.

### Source Tree After This Story

```
src/lib/
├── azure.js
├── env.js
├── helm.js
├── kubectl.js
├── output.js
├── ping.js
├── prefs.js
├── resources.js          ← NEW
├── resources.test.js     ← NEW
├── runner.js
└── shell.js
```

### Definition of Done

- [ ] `src/lib/resources.js` and `src/lib/resources.test.js` exist.
- [ ] `npm test` passes (≥334 tests now — was 333, +new resources tests).
- [ ] No file in `src/commands/` or `src/main.js` was modified. (Use `git status` to verify scope.)
- [ ] File is <150 lines.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.1" (lines 867–894).
- Closest existing analogue: `src/lib/env.js` (pure-data module, ~10 lines).
- Generic instance picker target: `src/lib/kubectl.js:36-64` `pickPod` (story 6-2 will generalize).
- Engineering standards: `.product_design/project-context.md` (note: written for a different stack; follow the spirit — SRP, KISS, mockist tests — not the React/TypeScript specifics).
- Current verb-resource catalog this epic targets: `.product_design/kubectl-verbs-reference.md` (if present).

## Dev Agent Record

### Agent Model Used

(to be filled in by dev agent)

### Debug Log References

### Completion Notes List

### File List
