# Story 6.4: Node-specific verbs — cordon, uncordon, drain, taint

Status: ready-for-dev

## Story

As a developer,
I want node-management verbs added to the specific-verb library,
so that node operations are first-class menu actions rather than something users must drop to a shell for.

## Acceptance Criteria

1. **Given** `src/lib/specificVerbs.js` already exports `SPECIFIC_VERBS` (from story 6-3), **When** this story is merged, **Then** four new keys are added to `SPECIFIC_VERBS`: `cordon`, `uncordon`, `drain`, `taint`.
2. **Given** the `cordon` verb, **Then** `cordon.handler(nodeResource, ctx)` calls `pickResourceInstance(nodeResource, ctx, null)` (cluster-scoped — no namespace), and on a non-null pick runs `runLive("kubectl", ["--context=" + ctx, "cordon", name])` (note: no `--namespace` flag).
3. **Given** the `uncordon` verb, **Then** same shape as `cordon`, but `["--context=" + ctx, "uncordon", name]`.
4. **Given** the `drain` verb, **Then** it picks a node, prompts `confirm({ message: \`Drain node "${name}"? This evicts all pods.\`, default: false })`, and on confirm runs `runLivePipedWithExitKeys("kubectl", ["--context=" + ctx, "drain", name, "--ignore-daemonsets", "--delete-emptydir-data"])` so the user can interrupt mid-drain with `q`/Esc.
5. **Given** the `taint` verb, **Then** it picks a node, prompts `input({ message: "Taint spec (e.g. key=value:NoSchedule):" })`, validates the spec matches `/^[\w.-]+(=[^:]*)?:(NoSchedule|PreferNoSchedule|NoExecute)$/`, and on valid input runs `runLive("kubectl", ["--context=" + ctx, "taint", "nodes", name, spec])`. On invalid input, calls `warn` and returns.
6. **Given** any of the four verbs, **Then** the kubectl invocation contains **no `--namespace=` flag**, even if the caller mistakenly passes `ns`. The verbs respect `resource.namespaced === false`.
7. **Given** `specificVerbs.test.js` is extended, **Then** it asserts:
   - `cordon.handler` calls `runLive` with `["--context=ctx", "cordon", "{node}"]` (no namespace flag)
   - `drain.handler` does not call any runner when `confirm` resolves `false`
   - `drain.handler` calls `runLivePipedWithExitKeys` with the documented flags when `confirm` resolves `true`
   - `taint.handler` calls `warn` and does not call `runLive` when the input does not match the regex
   - all four verbs call `pickResourceInstance(nodeResource, ...)` where the test's fixture has `namespaced: false`

## Tasks / Subtasks

- [ ] **Task 1: Add `cordon` and `uncordon`** (AC: #1, #2, #3, #6)
  - [ ] Both are tiny: pick → if null return → `runLive("kubectl", [...baseArgs(resource, ctx, ns), verb, name])`. The existing `baseArgs` helper from story 6-3 already strips `--namespace` for cluster-scoped resources, so re-use it — do not hand-roll a parallel arg builder.
  - [ ] `cordon.displayName = "Cordon"`, `uncordon.displayName = "Uncordon"`.

- [ ] **Task 2: Add `drain`** (AC: #1, #4, #6)
  - [ ] `displayName = "Drain"`.
  - [ ] Pick → confirm → `runLivePipedWithExitKeys` (not `runLive`) so output streams and user can quit mid-drain. The `…WithExitKeys` runner returns the `RETURN_TO_MENU` sentinel which propagates correctly back up the command loop.
  - [ ] Args: `[...baseArgs, "drain", name, "--ignore-daemonsets", "--delete-emptydir-data"]`.

- [ ] **Task 3: Add `taint`** (AC: #1, #5, #6)
  - [ ] `displayName = "Taint"`.
  - [ ] Pick → input → regex validate → if invalid `warn("Invalid taint spec. Format: key=value:NoSchedule (or PreferNoSchedule/NoExecute).")` and return.
  - [ ] On valid: `runLive("kubectl", [...baseArgs, "taint", "nodes", name, spec])`. Note the literal `"nodes"` — `kubectl taint` requires the plural noun, unlike most other verbs.

- [ ] **Task 4: Extend `specificVerbs.test.js`** (AC: #7)
  - [ ] Add a `nodesResource` fixture: `{ kind: "node", plural: "nodes", displayName: "Nodes", group: "Cluster", namespaced: false, universalVerbs: ["list", "describe", "edit"], specificVerbs: ["top", "cordon", "uncordon", "drain", "taint"] }`.
  - [ ] One `describe` block per new verb, four tests minimum (one per AC #7 bullet).
  - [ ] `cordon` test: assert `runLive` called with `["--context=ctx", "cordon", "node-1"]` exactly (no namespace, no extra flags).
  - [ ] `drain` confirm-false test: `vi.mocked(confirm).mockResolvedValueOnce(false)`, then `expect(runLivePipedWithExitKeys).not.toHaveBeenCalled()`.
  - [ ] `taint` invalid-input test: `vi.mocked(input).mockResolvedValueOnce("not-a-valid-taint")`, then `expect(warn).toHaveBeenCalled()` and `expect(runLive).not.toHaveBeenCalled()`.

- [ ] **Task 5: Verify no regressions**
  - [ ] `npm test` — all existing tests + new node-verb tests pass.
  - [ ] No changes outside `src/lib/specificVerbs.js` and its test.

## Dev Notes

### Dependency chain

- **6-4 depends on 6-3** (extends `SPECIFIC_VERBS` in the same file).
- 6-4 does NOT depend on 6-1 having a Nodes entry — fixture resource in tests is enough. The real Nodes registration happens in 6-8.

### Why drain uses the exit-keys runner

`drain` can take a while on a busy node and produces line-by-line eviction logs. The user needs to be able to interrupt without killing the parent process. `runLivePipedWithExitKeys` (`src/lib/runner.js:111-120`) registers `q`/Esc handlers and returns `RETURN_TO_MENU`. Don't use `runLive` (which buffers into the pager) or `runLivePiped` (no exit keys).

### Taint regex — why this exact form

Kubernetes taint specs follow the pattern `key[=value]:effect` where `effect ∈ {NoSchedule, PreferNoSchedule, NoExecute}`. The value is optional. The regex `/^[\w.-]+(=[^:]*)?:(NoSchedule|PreferNoSchedule|NoExecute)$/` accepts:
- `dedicated=gpu:NoSchedule` ✓
- `disk:NoSchedule` ✓ (no value)
- `node-role.kubernetes.io/control-plane:NoExecute` ✓ (dots and slashes in key — wait, slashes aren't in `\w.-`)

**Decision:** the epic doesn't require supporting `/` in keys for this story. Stick with `\w.-` for now. If a user complains about not being able to taint `node-role.kubernetes.io/control-plane`, that's a separate fix. **YAGNI** — keep the regex tight.

### Why `taint nodes` not `taint node`

`kubectl taint` is one of the few verbs that requires the plural noun (`nodes`). Verify by `kubectl taint --help`. Hard-code the literal `"nodes"` rather than `resource.plural`, since this verb is node-specific.

Actually — `resource.plural` will be `"nodes"` when the Nodes entry is registered (story 6-8). So `resource.plural` works. But this verb only makes sense on Nodes, so reading `resource.plural` adds no flexibility and risks confusion if a developer later registers `taint` on a non-node resource (which would be wrong). **Hard-code `"nodes"`** — it documents intent.

### Confirming drain is "destructive enough"

Drain evicts every pod on the node. It's the most disruptive verb in the registry. Confirm prompt should be unambiguous:

```
Drain node "{name}"? This evicts all pods.
```

Not `"Are you sure?"` — that's vague. The wording above tells the user exactly what happens.

### What NOT to do

- Don't add `--force` or `--grace-period` flags to drain. The defaults are sensible; advanced users can drop to a shell.
- Don't add a "drain with timeout" verb. YAGNI.
- Don't register the verbs on any specific resource in this story. Story 6-8 wires them onto the Nodes registry entry.
- Don't add `--delete-local-data` (deprecated alias for `--delete-emptydir-data`).

### File size budget

These four verbs add ~40-60 lines to `specificVerbs.js`. After 6-3 + 6-4, the file should still be under ~310 lines. If it crosses 350, refactor `baseArgs` and the rollout factory to compress.

### Testing approach

- Mock `confirm` and `input` from `@inquirer/prompts` per test with `mockResolvedValueOnce`.
- Mock `warn` from `../lib/output.js`.
- Use the same `pickResourceInstance` mock setup as story 6-3's tests (default to a node name like `"worker-1"`).

### Source Tree After This Story

```
src/lib/
├── specificVerbs.js          ← MODIFIED (+4 verbs)
└── specificVerbs.test.js     ← MODIFIED (+4 verb test blocks)
```

### Definition of Done

- [ ] All four new verbs present in `SPECIFIC_VERBS`.
- [ ] Cluster-scoped argument handling verified (no `--namespace` ever appears).
- [ ] `npm test` passes.
- [ ] No file outside `src/lib/specificVerbs.js` + its test was touched.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.4" (lines 955–976).
- Runner used for drain: `src/lib/runner.js:111-120` (`runLivePipedWithExitKeys`).
- Cluster-scoped argument pattern: see story 6-2's `baseArgs(resource, ctx, ns)` helper.
- Confirm prompt voice: `src/commands/pods.js:62-66`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
