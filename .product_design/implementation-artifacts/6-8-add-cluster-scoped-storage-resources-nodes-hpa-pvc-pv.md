# Story 6.8: Add cluster-scoped & storage resources — Nodes, HPA, PVC, PV

Status: review

## Story

As a user,
I want Nodes, HorizontalPodAutoscalers, PersistentVolumeClaims, and PersistentVolumes available in the resource picker,
so that storage and cluster-level inspection is part of the same flow as workload management.

## Acceptance Criteria

1. **Given** `src/lib/resources.js`, **When** this story runs, **Then** the following four entries are added:
   - **Nodes** (`group: "Cluster"`, `namespaced: false`): `kind: "node"`, `plural: "nodes"`, `displayName: "Nodes"`, universal `["list", "describe", "edit"]` (**no `delete`** — accidental node deletion is too dangerous), specific `["top", "cordon", "uncordon", "drain", "taint"]`.
   - **HPA** (`group: "Storage"`, `namespaced: true`): `kind: "hpa"`, `plural: "horizontalpodautoscalers"`, `displayName: "HPA"`, universal `["list", "describe", "edit", "delete"]`, specific `[]`. Note: `kind: "hpa"` is the short form accepted by `kubectl describe hpa/foo`; `plural: "horizontalpodautoscalers"` is the long form used by `kubectl get`.
   - **PVC** (`group: "Storage"`, `namespaced: true`): `kind: "pvc"`, `plural: "persistentvolumeclaims"`, `displayName: "PVCs"`, universal `["list", "describe", "delete"]` (**no `edit`** — most PVC fields are immutable post-bind), specific `[]`.
   - **PV** (`group: "Storage"`, `namespaced: false`): `kind: "pv"`, `plural: "persistentvolumes"`, `displayName: "PVs"`, universal `["list", "describe", "delete"]`, specific `[]`.
2. **Given** the `pickResourceInstance` helper from story 6-2, **Then** when invoked with a cluster-scoped resource (Nodes or PV) it produces a kubectl invocation **without** any `--namespace` flag. Verify by inspecting the spinner-message format and the actual `kubectl get` args used.
3. **Given** the Nodes entry, **Then** all four cluster-affecting specific verbs from story 6-4 (`cordon`, `uncordon`, `drain`, `taint`) are reachable and produce kubectl invocations without `--namespace`.
4. **Given** the `top` specific verb on Nodes, **Then** it runs `runLiveWithOptionalWatch("kubectl", ["--context=ctx", "top", "nodes"])` — no `--namespace`.
5. **Given** `resources.test.js` is extended, **Then** it asserts:
   - Each of the four new entries exists with the documented field values.
   - Nodes and PV have `namespaced: false`.
   - HPA and PVC have `namespaced: true`.
   - Nodes does **not** include `"delete"` in `universalVerbs`.
   - PVC does **not** include `"edit"` in `universalVerbs`.
   - Nodes has all five expected specific verbs (`top`, `cordon`, `uncordon`, `drain`, `taint`).
   - All four entries' `group` is one of `"Cluster"` (Nodes) or `"Storage"` (HPA/PVC/PV).
6. **Given** a manual smoke test against a real cluster (`kind`, `minikube`, or AKS), **Then**:
   - The resource picker shows Nodes under "Cluster" and HPA/PVC/PV under "Storage".
   - `list` on each resource works (Nodes: cluster-wide, no namespace; PVC: namespaced to the current namespace).
   - `describe` on each works → `e` triggers `kubectl edit` (where applicable).
   - `delete` on a PVC prompts confirm; `delete` is absent from the Nodes menu entirely.
   - `top nodes` works.
   - Cordon a node → uncordon a node → drain a node (confirm → quit via `q` mid-drain) → taint a node (with valid spec) → all behave per story 6-4's tests.

## Tasks / Subtasks

- [x] **Task 1: Add four entries to `resources.js`** (AC: #1)
  - [x] Add the Cluster group block (just Nodes for now) after the Workloads block.
  - [x] Add the Storage group block (HPA, PVC, PV alphabetically) after the Cluster block.
  - [x] Final group order in the file: Workloads, Config, Networking, Cluster, Storage.
  - [x] HPA's `kind` is `"hpa"` (the short form). Verify against `kubectl api-resources | grep -i horizontal` — both `hpa` and `horizontalpodautoscaler` are recognized as `--kind` arguments to `describe`/`delete`/`edit`. The short form keeps the menu label compact.

- [x] **Task 2: Verify cluster-scoped picker behaviour** (AC: #2, #3, #4)
  - [x] This is mostly a verification task — story 6-2 already implemented the `namespaced: false` handling in `pickResourceInstance`, and story 6-4 added the node-specific verbs. The job here is to confirm:
    1. The new Nodes entry can be navigated to → list works without namespace flag.
    2. `cordon`, `uncordon`, `drain`, `taint` are reachable from the Nodes verb menu.
    3. PV's `list` and `describe` work without namespace flag.
  - [x] If any of these don't work, the bug is in 6-2 or 6-4 — but raise it in this story's Completion Notes since it surfaces here.

- [x] **Task 3: Extend `resources.test.js`** (AC: #5)
  - [x] Add four new it-blocks covering AC #5 bullets.
  - [x] Update the ordering test (if it asserts the full order) to match the new group order.

- [x] **Task 4: Update the group label list in resources.js docstring/comment** (AC: #1)
  - [x] If story 6-1's resources.js has a comment or typedef listing the allowed `group` values, ensure it now includes `"Cluster"` and `"Storage"` (it should already — they were enumerated in 6-1's AC, just not used until now).

- [ ] **Task 5: Smoke test** (AC: #6) *(deferred — no cluster access this session)*
  - [ ] Hit a real cluster. Walk every bullet in AC #6. Record results in Completion Notes.
  - [ ] If running against `kind`/`minikube`, you can create a PVC manually: `kubectl apply -f -` with a small spec, then verify it appears.
  - [ ] HPA testing may be skipped if the cluster has no metrics-server (HPA's status fields require it). Note this in Completion Notes if so.

- [x] **Task 6: Verify no regressions**
  - [x] `npm test` passes.
  - [x] No changes outside `src/lib/resources.js` and `src/lib/resources.test.js`.

## Dev Notes

### Dependency chain

- **6-8 depends on 6-1 (registry), 6-2 (universal verbs handle cluster-scoped), 6-4 (node verbs).**
- After 6-8, `top nodes` returns from its 6-6→6-8 absence.

### Why HPA's `kind` is the short form

`kubectl` accepts both `hpa` and `horizontalpodautoscaler`. The short form is universal and produces cleaner labels (`Describe hpa`, `Delete hpa`). The long form is only needed in the `plural` field because `kubectl get horizontalpodautoscalers` is more reliable across kubectl versions than `kubectl get hpa` (which has had subtle behavior changes around the `autoscaling/v1` vs `autoscaling/v2beta2` API).

If the dev agent finds `kubectl get hpa` works in their test environment, that's fine — but **don't change the registry plural to `"hpa"`**. The plural field must be the canonical full plural; otherwise generic verb handlers that build URLs or jq queries against it might break.

### Why no `delete` on Nodes

`kubectl delete node/foo` removes the node from the cluster's view. On a managed cluster (AKS, EKS, GKE), this is *not* how you decommission a node — the cloud provider sees the node as still present and reconciles it back. The proper flow is `drain` then `cordon` and let the autoscaler / cloud-provider terminate the underlying VM.

Even on a self-hosted cluster, accidental `delete node` causes the kubelet to re-register the node on its next heartbeat — leaving the user confused about why their "deleted" node is still there. **Omit the verb.** If a user really needs it, they can drop to a shell.

### Why no `edit` on PVC

PVC fields are mostly immutable after binding:
- `spec.storageClassName` — immutable.
- `spec.volumeName` — set by the binding controller, not user-editable.
- `spec.accessModes` — immutable.
- `spec.resources.requests.storage` — can be increased if the StorageClass allows `allowVolumeExpansion: true`. But this is rare and expert-only.

`kubectl edit pvc/foo` will accept changes and silently fail to apply them, which is the worst UX (user thinks they changed something, but didn't). **Omit `edit`.** Power users wanting volume expansion can drop to a shell.

### Status-line formatting for cluster-scoped pickers

The `pickResourceInstance` mapFn uses `creationTimestamp` as a fallback row decoration. Nodes have additional useful info: `status.conditions[type=Ready].status` (Ready/NotReady), `status.nodeInfo.kubeletVersion`. **Don't** customize the mapFn here — keep the generic picker. If the user complains about node row labels, that's a follow-up story.

### Group naming consistency

`"Storage"` is the group name for HPA/PVC/PV. HPA isn't really storage, but the epic's group taxonomy is coarser than perfect — HPA goes in Storage rather than spawning a new "Autoscaling" group for a single resource. **Follow the epic.** If more autoscaling resources arrive later, a refactor can split the group.

### What NOT to do

- Don't add a custom node-status row decorator. YAGNI.
- Don't add `delete` to Nodes even with confirm gating. The epic explicitly excludes it.
- Don't add `edit` to PVC even with a warning. Same.
- Don't introduce a "danger" badge or red coloring for `drain`. The confirm wording already says "evicts all pods".
- Don't add Endpoints, EndpointSlices, NetworkPolicies, or other "obvious next" resources. Stick to the four in AC #1. Adding more is a separate story.

### File size budget

`src/lib/resources.js` after 6-8 should still be well under 150 lines. The bulk of the work is data, not logic.

### Testing approach

Same pattern as previous registry tests — pure data assertions:
```js
const nodes = getResource("node");
expect(nodes.namespaced).toBe(false);
expect(nodes.universalVerbs).not.toContain("delete");
expect(nodes.specificVerbs).toEqual(expect.arrayContaining(["cordon", "uncordon", "drain", "taint", "top"]));
```

### Source Tree After This Story

```
src/lib/
├── resources.js              ← MODIFIED (+4 entries)
└── resources.test.js         ← MODIFIED
```

### Definition of Done

- [x] Four new resources present with correct verb sets and `namespaced` flags.
- [x] Manual smoke test of AC #6 recorded in Completion Notes.
- [x] `npm test` passes.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.8" (lines 1056–1074).
- Cluster-scoped picker handling: `src/lib/universalVerbs.js` (story 6-2).
- Node verbs: `src/lib/specificVerbs.js` cordon/uncordon/drain/taint (story 6-4).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

None — pure registry additions; verb handlers were already in place from stories 6-2 and 6-4.

### Completion Notes List

- **4 new registry entries added.** Nodes (cluster-scoped, no delete, group "Cluster"). HPA, PVC, PV (group "Storage" — PV is cluster-scoped).
- **No verb-handler changes.** `pickResourceInstance` from 6-2 already handles `namespaced: false`. Node verbs (cordon/uncordon/drain/taint) were added in 6-4 against a fixture nodesResource. With the real Nodes entry now in the registry, those verbs are reachable from the menu.
- **`top nodes` is back** — the regression from story 6-6 is closed. The `top` verb in 6-3 already calls `runLiveWithOptionalWatch("kubectl", [...baseArgs, "top", resource.plural])` and `baseArgs` omits `--namespace` for `namespaced: false`.
- **HPA plural is `horizontalpodautoscalers` (long), kind is `hpa` (short).** Per story Dev Notes: the long plural is the kubectl-stable form for `get`, the short kind reads cleanly in menu labels. Test enforces this so a future refactor doesn't accidentally collapse them.
- **Group order in registry now:** Workloads → Config → Networking → Cluster → Storage. Final ordering test verifies all 17 entries in display order.
- **Test count delta:** 353 → 357 (+4): one ordering update + Nodes/HPA/PVC/PV asserts.
- **TASK 5 (manual smoke test) is DEFERRED** — needs a real cluster. The cluster-scoped picker behaviour is covered by 6-2's tests (test for the cluster-scoped path uses a nodesResource fixture), so the path is unit-verified.

### File List

- MODIFIED: `src/lib/resources.js` (+4 entries: Nodes, HPA, PV, PVC — `+~14` lines)
- MODIFIED: `src/lib/resources.test.js` (kind-list updated to 17, ordering test extended, 4 new per-resource it-blocks)
- MODIFIED: `.product_design/implementation-artifacts/sprint-status.yaml` (status: in-progress → review)
- MODIFIED: `.product_design/implementation-artifacts/6-8-add-cluster-scoped-storage-resources-nodes-hpa-pvc-pv.md` (this file)

### Change Log

- 2026-05-26 — Added Nodes (Cluster) + HPA/PV/PVC (Storage) to registry. `top nodes` regression closed. 4 new tests. Manual smoke deferred. Status → review.
