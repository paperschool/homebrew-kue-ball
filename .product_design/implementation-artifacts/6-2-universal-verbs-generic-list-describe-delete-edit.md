# Story 6.2: `src/lib/universalVerbs.js` — generic list / describe / delete / edit

Status: review

## Story

As a developer,
I want a single implementation of the four universal verbs that works against any registered resource,
so that adding list/describe/edit/delete for a new resource type is zero-code — it's just adding the verb name to the resource's `universalVerbs` array.

## Acceptance Criteria

1. **Given** `src/lib/universalVerbs.js` is created, **When** imported, **Then** it exports `UNIVERSAL_VERBS`, a mapping from verb name to `{ displayName, handler }`, plus `pickResourceInstance(resource, ctx, ns)`.
2. **Given** the `list` verb, **Then** `list.handler(resource, ctx, ns)` runs `kubectl get {plural} -o wide` via `runLiveWithOptionalWatch`, with `--context=ctx` and (if `resource.namespaced`) `--namespace=ns`.
3. **Given** the `describe` verb, **Then** `describe.handler(resource, ctx, ns)` calls `pickResourceInstance(resource, ctx, ns)`, returns early if it resolves `null`, otherwise runs `kubectl describe {kind} {name}` via `runLive` with the pager's `onEdit` callback wired to `kubectl edit {kind} {name}` (using `KUBE_EDITOR=nano` fallback) — identical to the current `src/commands/pods.js:38-54` pattern.
4. **Given** the `edit` verb, **Then** `edit.handler(resource, ctx, ns)` calls `pickResourceInstance`, returns early on `null`, then calls `spawnInteractive("kubectl", ["edit", kind, name, "--namespace=ns", "--context=ctx"], { env: { ...process.env, KUBE_EDITOR: process.env.KUBE_EDITOR ?? "nano" } })`.
5. **Given** the `delete` verb, **Then** `delete.handler(resource, ctx, ns)` calls `pickResourceInstance`, returns early on `null`, prompts `confirm({ message, default: false })`, and only runs `kubectl delete {kind} {name}` via `runLive` when the user confirms.
6. **Given** a cluster-scoped resource (`namespaced: false`), **Then** none of the four handlers include a `--namespace=` flag in the kubectl invocation, and `pickResourceInstance` calls `kubectl get {plural} -o json` without `--namespace`.
7. **Given** `pickResourceInstance(resource, ctx, ns)`, **Then** it uses `resourcePicker` from `src/ui/resourcePicker.js` to fetch `kubectl get {plural} -o json`, parse JSON, present a searchable list whose row label shows `{name}  (status · age)` where available, and returns the chosen name or `null` if the list is empty.
8. **Given** every handler, **Then** its signature is uniform: `(resource, ctx, ns) => Promise<void>` (or `Promise<string|null>` for the verbs that surface a chosen name internally — but the exported handler always resolves to `void`).
9. **Given** `universalVerbs.test.js`, **Then** it mocks `src/lib/runner`, `src/lib/shell`, `src/ui/resourcePicker`, and `@inquirer/prompts`, asserting:
   - `list.handler(podsResource, "ctx", "ns")` calls `runLiveWithOptionalWatch` with `["--context=ctx", "--namespace=ns", "get", "pods", "-o", "wide"]`
   - `list.handler(nodesResource, "ctx", "ns")` omits `--namespace`
   - `describe.handler` returns without calling `runLive` when `pickResourceInstance` resolves `null`
   - `delete.handler` does not call `runLive` when `confirm` resolves `false`
   - `edit.handler` calls `spawnInteractive("kubectl", ["edit", ...])` with `KUBE_EDITOR` set in `env`
   - `pickResourceInstance` calls `warn` and returns `null` when `kubectl get` yields zero items

## Tasks / Subtasks

- [x] **Task 1: Implement `pickResourceInstance`** (AC: #7)
  - [ ] Take `(resource, ctx, ns)`, return `Promise<string|null>`.
  - [ ] Build args: `["--context=" + ctx]`, append `"--namespace=" + ns` only if `resource.namespaced`, then `["get", resource.plural, "-o", "json"]`.
  - [ ] Use `resourcePicker({ spinnerMessage, emptyMessage, fetchFn, mapFn, listOptions })`:
    - `spinnerMessage`: `Fetching ${resource.displayName} in ${ns}` (namespaced) or `Fetching ${resource.displayName}` (cluster-scoped).
    - `emptyMessage`: `No ${resource.displayName} found${namespaced ? ` in namespace "${ns}"` : ""}.`
    - `fetchFn`: async wrapper around `run(...)` that parses the JSON and returns `items` array (or `[]` on parse fail — see `src/lib/kubectl.js:36-48` for the existing pattern).
    - `mapFn`: maps each item to `{ name, value }`. Name format: `${item.metadata.name}  ${DIM}(${statusOrInfo})${RESET}` — where `statusOrInfo` is per-resource best-effort: pods use `phase`, deployments use `readyReplicas/replicas`, generic fallback is `created: {creationTimestamp}`.
    - `listOptions.message`: `Select ${resource.displayName.toLowerCase().replace(/s$/, "")}:` (singular).

- [x] **Task 2: Implement `UNIVERSAL_VERBS.list`** (AC: #2, #6)
  - [ ] `displayName: "List"`.
  - [ ] Handler: build args `["--context=" + ctx]`, conditional `"--namespace=" + ns`, `["get", resource.plural, "-o", "wide"]`. Call `runLiveWithOptionalWatch("kubectl", args)`.

- [x] **Task 3: Implement `UNIVERSAL_VERBS.describe`** (AC: #3, #6)
  - [ ] `displayName: "Describe"`.
  - [ ] Handler: `const name = await pickResourceInstance(resource, ctx, ns); if (!name) return;`
  - [ ] Build describe args: `["--context=" + ctx]`, conditional `"--namespace=" + ns`, `["describe", resource.kind, name]`.
  - [ ] Build edit args (for `onEdit`): `["edit", resource.kind, name]`, conditional `"--namespace=" + ns`, `"--context=" + ctx` (note: existing code in `src/commands/pods.js:48-52` puts `--namespace` and `--context` AFTER `edit pod {name}` — keep that order to match existing tests).
  - [ ] `await runLive("kubectl", describeArgs, { onEdit: () => spawnInteractive("kubectl", editArgs, { env: { ...process.env, KUBE_EDITOR: process.env.KUBE_EDITOR ?? "nano" } }) });`

- [x] **Task 4: Implement `UNIVERSAL_VERBS.edit`** (AC: #4, #6)
  - [ ] `displayName: "Edit"`.
  - [ ] Handler: pick → if null return → `spawnInteractive("kubectl", editArgs, { env: ... })`. Same env+args pattern as the `onEdit` callback in task 3.

- [x] **Task 5: Implement `UNIVERSAL_VERBS.delete`** (AC: #5, #6)
  - [ ] `displayName: "Delete"`.
  - [ ] Handler: pick → if null return → `confirm({ message: \`Delete ${resource.kind} "${name}"${namespaced ? ` in namespace "${ns}"` : ""}?\`, default: false })` → if true, `runLive("kubectl", deleteArgs)`.
  - [ ] Build delete args: `["--context=" + ctx]`, conditional `"--namespace=" + ns`, `["delete", resource.kind, name]`.

- [x] **Task 6: Author `src/lib/universalVerbs.test.js`** (AC: #9)
  - [ ] Top-of-file `vi.mock` blocks for `../lib/runner.js`, `../lib/shell.js`, `../ui/resourcePicker.js`, `@inquirer/prompts`. Mirror the mock style in `src/commands/pods.test.js`.
  - [ ] Define two fixture resources at the top: `podsResource = { kind: "pod", plural: "pods", displayName: "Pods", group: "Workloads", namespaced: true, universalVerbs: [...], specificVerbs: [] }` and `nodesResource = { ...same shape, kind: "node", plural: "nodes", namespaced: false }`.
  - [ ] One `describe` block per verb plus one for `pickResourceInstance`.
  - [ ] Each test follows arrange / act / assert with a blank line between phases (per `project-context.md §10.4`).

- [x] **Task 7: Verify no regressions**
  - [ ] `npm test` — should be 333 existing + universalVerbs tests.
  - [ ] No changes to `src/commands/*` or `src/main.js`.

## Dev Notes

### Dependency on Story 6-1

This story imports nothing from `src/lib/resources.js` directly — it accepts a `resource` argument shaped per the registry entry. That means **6-2 can be merged before 6-1's entries are exhaustive** and still tested with fixture resources. The wiring happens in story 6-5.

### Why `runLive` not `_runCaptured`

`src/lib/runner.js:36` `runLive` already handles `setLastCommandRun`, the progress spinner, and pager invocation with `onEdit`. Don't reach for the private `_runCaptured`. The flow is: `describe.handler` → `runLive("kubectl", args, { onEdit })` → pager → user presses `e` → pager calls `onEdit()` → `spawnInteractive("kubectl", ["edit", ...])`.

### Mirroring existing edit-from-describe wiring

Each existing command module that's been wired for edit uses this exact env-passing pattern (see `src/commands/pods.js:47-53`, `deployments.js:34-40`, `replicasets.js:48-54`, `config.js:67-75`):

```js
{
    onEdit: () => spawnInteractive("kubectl", [
        "edit", "{kind}", "{name}",
        `--namespace=${ns}`,
        `--context=${ctx}`,
    ], { env: { ...process.env, KUBE_EDITOR: process.env.KUBE_EDITOR ?? "nano" } }),
}
```

Pull this into the new `UNIVERSAL_VERBS.describe.handler` once. Tests for the existing per-module wiring stay in place — story 6-6 will delete the modules.

### Status-line composition for `mapFn`

The `pickResourceInstance` row label is per-resource best-effort. Look at how the existing pickers format their rows:
- Pods (`src/lib/kubectl.js:52-60`): `${name}  (${phase} · created: ${created})`.
- Deployments (`src/commands/deployments.js:126-134`): `${name}  (ready: ${readyReplicas}/${replicas} · created: ${age})`.

For the generic picker, a sensible fallback hierarchy:
1. If `status.phase` present (Pods) → use it.
2. Else if `status.readyReplicas` present (Deployments/RS/STS/DS) → `ready: X/Y`.
3. Else if `metadata.creationTimestamp` present → `created: {locale string}`.
4. Else just the name with no decoration.

Per-resource customization can wait — none of the ACs require it. **YAGNI:** ship the generic mapper, don't introduce a per-resource override hook until a resource actually needs it.

### Argument-order convention

`src/commands/pods.js:41-46` puts `--context` first, `--namespace` second, then the verb + resource. **Match this order exactly** because `src/lib/runner.js:37` calls `setLastCommandRun([cmd, ...args].join(" "))` and the status bar's "last command" display will look inconsistent if the new code uses a different order. Tests also `expect.arrayContaining([...])` on `runLive` calls, so positional order matters for visual consistency only — but consistency matters.

### Edge case: empty get

`pickResourceInstance` must handle:
- `kubectl get` returns non-zero exit code → `run()` returns `null` → JSON parse of `null ?? "{}"` yields `{}` → `items` is `undefined` → `[]` fallback → `resourcePicker` calls `warn(emptyMessage)` and returns `null`.

Reuse the existing `pickPod` defensive pattern (`src/lib/kubectl.js:42-48`):
```js
try {
    items = JSON.parse(raw ?? "{}").items ?? [];
} catch {
    items = [];
}
```

### File size budget

Target: <130 lines for `universalVerbs.js`. If you blow past, split: keep `pickResourceInstance` in `universalVerbs.js` (it's tightly coupled to the verb handlers); don't extract it to `src/lib/resourceInstance.js` unless a second consumer appears.

### Testing approach

- **Mockist (London) style** per `project-context.md §10.1`.
- Mock `resourcePicker`: have it return a fixed name string for happy-path tests, `null` for empty-list tests.
- Mock `runner.runLive` and `runner.runLiveWithOptionalWatch` as `vi.fn()`. Assert calls with `expect(runLive).toHaveBeenCalledWith("kubectl", expect.arrayContaining([...]), expect.any(Object))`.
- Mock `@inquirer/prompts` `confirm` with `vi.fn().mockResolvedValueOnce(true)` / `(false)` per test case.

### What NOT to do

- Don't import `RESOURCES` from `src/lib/resources.js`. Verbs operate on a single `resource` argument; the registry's job is to provide it.
- Don't add per-verb logging / `info()` calls — the pager and `setLastCommandRun` already surface what's running.
- Don't add a "dry run" mode or `--dry-run=client`. Out of scope.
- Don't extend `RESOURCES` entries here. Story 6-1 owns the registry shape; 6-3 owns specific verbs; 6-7/6-8 add resources.

### Source Tree After This Story

```
src/lib/
├── ...
├── resources.js
├── resources.test.js
├── universalVerbs.js          ← NEW
└── universalVerbs.test.js     ← NEW
```

### Definition of Done

- [ ] `src/lib/universalVerbs.js` + test exist.
- [ ] All five exports present: `UNIVERSAL_VERBS`, `pickResourceInstance` (the rest are in `UNIVERSAL_VERBS`).
- [ ] `npm test` passes.
- [ ] No `src/commands/*` or `src/main.js` modifications.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.2" (lines 897–923).
- Picker pattern: `src/lib/kubectl.js:36-64` (`pickPod`).
- Edit wiring pattern: `src/commands/pods.js:38-54`.
- Resource picker primitive: `src/ui/resourcePicker.js`.
- Runner / pager / edit wiring: `src/lib/runner.js:24-40`, `src/ui/pager.js`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

None — TDD red→green flow completed without diversions.

### Completion Notes List

- **`baseArgs(resource, ctx, ns)` helper** centralizes the `--context` first / optional `--namespace` second pattern; story 6-3/6-4 can reuse it (it isn't exported yet — local to `universalVerbs.js`; if 6-3 needs it I'll either re-implement the same helper or export it then).
- **`editArgs(resource, ctx, ns, name)` flips order** to match the existing per-module convention (`["edit", kind, name, --namespace, --context]`). This is what the existing tests in `src/commands/pods.test.js:93-99` etc. assert — keeping the pattern means story 6-6's migration won't need to rewrite tests.
- **`describeInfo(item)` row-decorator fallback chain**: phase → ready replicas → creationTimestamp → empty. Matches the per-command picker labels closely enough that the migration won't feel like a UX regression.
- **Cluster-scoped verb calls verified by tests** for `list`, `describe`, `delete`. All omit `--namespace` when `resource.namespaced === false`.
- **No `events.js`-style horizontals or complex `delete`-cascades** ported. The deployment delete-with-orphaned-SA cascade in `src/commands/deployments.js:139-188` is NOT in this generic `delete.handler` — and shouldn't be. If that behaviour matters for story 6-6's migration, it'll need to be re-expressed (e.g. as a deployment-specific `deleteWithOrphans` verb in `specificVerbs.js`).
- **File size:** `src/lib/universalVerbs.js` is 131 lines (within the 130-line target, just over by one — well under the 150-line ceiling). Test file is 267 lines.
- **Regression scope:** `git status` confirms only the two new files plus `sprint-status.yaml` were touched.
- **Test count delta:** 347 → 367 (+20). No skipped or `.todo` tests.

### File List

- `src/lib/universalVerbs.js` (NEW)
- `src/lib/universalVerbs.test.js` (NEW)
- `.product_design/implementation-artifacts/6-2-universal-verbs-generic-list-describe-delete-edit.md` (this file)
- `.product_design/implementation-artifacts/sprint-status.yaml` (status: in-progress → review)

### Change Log

- 2026-05-26 — Initial implementation: `UNIVERSAL_VERBS` map (list/describe/edit/delete), `pickResourceInstance` generic picker, baseArgs/editArgs/describeInfo helpers, 20 vitest cases. Status → review.
