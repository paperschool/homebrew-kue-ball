# Story 6.7: Add new resources — StatefulSets, DaemonSets, Jobs, CronJobs

Status: ready-for-dev

## Story

As a user,
I want StatefulSets, DaemonSets, Jobs, and CronJobs to appear in the resource picker with the verbs that make sense for them,
so that I can manage stateful workloads, daemons, and batch jobs without dropping to a raw shell.

## Acceptance Criteria

1. **Given** `src/lib/resources.js`, **When** this story runs, **Then** the following entries are added to `RESOURCES` (under group `"Workloads"`, namespaced):
   - **StatefulSets**: `kind: "statefulset"`, `plural: "statefulsets"`, `displayName: "StatefulSets"`, universal `["list", "describe", "edit", "delete"]`, specific `["scale", "rolloutStatus", "rolloutHistory", "rolloutUndo", "rolloutRestart", "portForward"]`.
   - **DaemonSets**: `kind: "daemonset"`, `plural: "daemonsets"`, `displayName: "DaemonSets"`, universal `["list", "describe", "edit", "delete"]`, specific `["rolloutStatus", "rolloutHistory", "rolloutUndo", "rolloutRestart"]`. **No `scale`** — daemonsets run one pod per node.
   - **Jobs**: `kind: "job"`, `plural: "jobs"`, `displayName: "Jobs"`, universal `["list", "describe", "delete"]` (no `edit` — most Job fields are immutable), specific `["logs"]` (logs handler must resolve to the Job's pod).
   - **CronJobs**: `kind: "cronjob"`, `plural: "cronjobs"`, `displayName: "CronJobs"`, universal `["list", "describe", "edit", "delete"]`, specific `["triggerNow"]`.
2. **Given** the `logs` specific verb is invoked on a Job (not a Pod), **Then** the handler:
   1. Picks the Job instance via `pickResourceInstance(jobResource, ctx, ns)`.
   2. Resolves the Job's underlying Pod: `kubectl get pods --context=ctx --namespace=ns --selector=job-name={jobName} -o jsonpath='{.items[0].metadata.name}'`.
   3. If no pod found, calls `warn(\`Job "${jobName}" has no running or completed pod yet.\`)` and returns.
   4. Otherwise streams logs via `runLivePipedWithExitKeys("kubectl", [..., "logs", "-f", podName, "--tail=200"])`.
3. **Given** the `triggerNow` specific verb (CronJobs only), **When** invoked, **Then** the handler:
   1. Picks a CronJob via `pickResourceInstance`.
   2. Generates a manual job name: `${cronJobName}-manual-${timestamp}` where `timestamp = Date.now()` (seconds-resolution is fine; epoch ms also fine — just a unique suffix).
   3. Runs `kubectl create job --from=cronjob/{cronJobName} {generatedName}` via `runLive`.
   4. On success, calls `ok(\`Triggered Job "${generatedName}" from CronJob "${cronJobName}".\`)`. On non-zero exit, `warn` and continue.
4. **Given** the `logs` handler in `src/lib/specificVerbs.js`, **Then** it now branches on `resource.kind`: if `"pod"` → existing flow; if `"job"` → Job-resolution flow per AC #2. Other resource kinds raise an internal `warn(\`logs verb is only registered for Pods and Jobs.\`)` and return.
5. **Given** `triggerNow` is added to `SPECIFIC_VERBS`, **Then** it has `displayName: "Trigger now"`, and is unit-tested.
6. **Given** `resources.test.js` is extended, **Then** it asserts:
   - Each of the four new entries exists with the documented field values.
   - StatefulSets has `scale` in `specificVerbs`; DaemonSets does **not**.
   - Jobs has no `"edit"` in `universalVerbs`.
   - CronJobs has `triggerNow` in `specificVerbs`.
   - All four are `namespaced: true` and in `group: "Workloads"`.
7. **Given** `specificVerbs.test.js` is extended, **Then** it covers:
   - `logs.handler` with a Pod resource → existing assertion still holds (regression coverage).
   - `logs.handler` with a Job resource → fetches the pod by selector, then streams logs.
   - `logs.handler` with a Job resource that has no pod → calls `warn`, doesn't call any runner.
   - `triggerNow.handler` runs `kubectl create job --from=cronjob/...` with a manual name suffix.

## Tasks / Subtasks

- [ ] **Task 1: Add four entries to `resources.js`** (AC: #1)
  - [ ] Add entries in the Workloads group block, preserving alphabetical order: CronJobs, DaemonSets, Deployments (existing), Jobs, Pods (existing), ReplicaSets (existing), StatefulSets.
  - [ ] Wait — alphabetical with existing entries would shuffle existing order. **Decision:** keep existing entries in their current positions, append new entries to the bottom of the Workloads block alphabetically among themselves (CronJobs, DaemonSets, Jobs, StatefulSets). Net order: Pods, Deployments, ReplicaSets, CronJobs, DaemonSets, Jobs, StatefulSets.
  - [ ] Adjust the resources.test.js ordering assertion accordingly.

- [ ] **Task 2: Extend `logs` handler for Jobs** (AC: #2, #4)
  - [ ] In `src/lib/specificVerbs.js`, modify `logs.handler` to branch on `resource.kind`:
    - `"pod"` (existing path): pick → stream logs.
    - `"job"`: pick → resolve pod via selector → if no pod, `warn` and return → stream logs from resolved pod.
    - Other kinds: `warn` and return.
  - [ ] Use `run` from `src/lib/shell.js` (silent: true) for the jsonpath lookup. Parse the trimmed string output.

- [ ] **Task 3: Add `triggerNow` verb** (AC: #3, #5)
  - [ ] Add to `SPECIFIC_VERBS` with `displayName: "Trigger now"`.
  - [ ] Handler: pick → generate name → `runLive("kubectl", [...baseArgs, "create", "job", \`--from=cronjob/${cronJobName}\`, generatedName])`.
  - [ ] Use `Date.now().toString()` (epoch ms) as the suffix — short, monotonic, no collisions in practice.

- [ ] **Task 4: Extend `resources.test.js`** (AC: #6)
  - [ ] Add four new it-blocks asserting field values per AC #6.
  - [ ] Update the ordering assertion to expect the post-6-7 order.

- [ ] **Task 5: Extend `specificVerbs.test.js`** (AC: #7)
  - [ ] Add a `jobResource` fixture: `{ kind: "job", plural: "jobs", displayName: "Jobs", group: "Workloads", namespaced: true, universalVerbs: [...], specificVerbs: ["logs"] }`.
  - [ ] Add a `cronJobResource` fixture similarly.
  - [ ] Mock `shell.run` to return a pod name for the Job-logs test, and `null` (or empty) for the no-pod test.
  - [ ] Cover all four bullets in AC #7.

- [ ] **Task 6: Verify**
  - [ ] `npm test` passes.
  - [ ] Manual smoke: against a real cluster with at least one Job and one CronJob in the namespace, exercise:
    - List jobs → describe → delete.
    - Stream logs on a Job that has a completed pod (expect to see the pod's logs).
    - Stream logs on a Job whose pod was garbage-collected → expect `warn`.
    - Trigger a CronJob → verify a new Job appears in `kubectl get jobs`.

## Dev Notes

### Dependency chain

- **6-7 depends on 6-1 through 6-6.** Without the framework, there's nothing to extend.
- 6-7 is independent of 6-8 (which adds Nodes/HPA/PVC/PV).

### Why no `triggerNow` on Jobs

Jobs are one-shot. You don't "trigger" a Job — you create one (and `kubectl create job --from=cronjob/...` is how). There's no "rerun a finished Job" semantic in vanilla kubectl. If a user wants to re-run a Job, they delete the existing one and recreate from manifest. Out of scope for this story.

### Why `--from=cronjob/{name}` literal

`kubectl create job --from=cronjob/{name} {new-name}` is the documented incantation to instantiate a Job from a CronJob template. **Don't** swap to `kubectl trigger` or `kubectl run` — both have different semantics and either don't exist or do the wrong thing.

### Job logs are messy

A Job creates exactly one Pod (typically). That Pod might be Succeeded, Failed, or still Running. The `--selector=job-name={name}` lookup grabs whichever exists. If the Pod was garbage-collected (Jobs default to `ttlSecondsAfterFinished` not being set, so they stick around — but admins can configure cleanup), the jsonpath query returns empty.

The AC #2 flow handles all three: no pod → warn; pod present → stream. We don't try to `kubectl get pod {name} --tail` on a finished pod's log (which would `logs -f` against a stopped container — kubectl just dumps and exits, which is correct behaviour for our pipe).

### Why `Date.now()` not a UUID

Trigger-now job names need to be unique and short. `Date.now()` is 13 digits — keeps the full name under the 253-char kubernetes name limit even for long CronJob names. A UUID would be 36 chars and add zero practical value over an epoch timestamp.

### Why no `edit` on Jobs

Most Job spec fields are immutable once the Job is created (e.g. `spec.template`, `spec.selector`, `spec.completions`). `kubectl edit job/foo` will accept the edit but silently ignore most changes. Better UX: omit the `edit` affordance entirely. If a user wants to change a Job, delete it and create a new one.

### File size budget

`src/lib/specificVerbs.js` will grow by ~20 lines for the `logs` branch + `triggerNow`. Still under 350. If it crosses, the rollout-factory pattern was meant to compress; verify it's actually compressing.

### What NOT to do

- Don't add `triggerNow` for Jobs. Not requested.
- Don't add `scale` for Jobs (Jobs do support `--parallelism` but that's a different command — `kubectl scale job/foo --replicas=N` doesn't work).
- Don't add a "follow Job to completion" verb. YAGNI.
- Don't try to render the Job's pod in the picker label. Keep the picker label simple (status + age). The pod resolution happens inside `logs.handler` only.

### Testing approach

- Mock `run` per test using `vi.mocked(shell.run).mockReturnValueOnce(podName)` for the happy Job-logs path, and `.mockReturnValueOnce(null)` (or empty string) for the no-pod path.
- The `run` call inside `logs.handler` is the only shell interaction the test needs to control beyond what universal/runner mocks already cover.

### Source Tree After This Story

```
src/lib/
├── resources.js              ← MODIFIED (+4 entries)
├── resources.test.js         ← MODIFIED
├── specificVerbs.js          ← MODIFIED (logs branches on kind; +triggerNow)
└── specificVerbs.test.js     ← MODIFIED
```

### Definition of Done

- [ ] Four new resources present in registry with documented verb sets.
- [ ] `logs` handler tested for Pod path (regression), Job-with-pod path, Job-without-pod path.
- [ ] `triggerNow` handler tested.
- [ ] `npm test` passes.
- [ ] Manual smoke against a cluster with Job + CronJob recorded in Completion Notes.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.7" (lines 1034–1053).
- `kubectl create job --from=cronjob/` docs: https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/#creating-a-job-on-a-cron-job

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
