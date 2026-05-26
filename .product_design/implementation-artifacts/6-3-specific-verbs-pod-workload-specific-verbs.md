# Story 6.3: `src/lib/specificVerbs.js` — pod & workload-specific verbs

Status: ready-for-dev

## Story

As a developer,
I want the resource-specific verbs (logs, exec, scale, rollout, set, restart) implemented once in a shared library,
so that Pods/Deployments/ReplicaSets/StatefulSets/DaemonSets all dispatch into the same code paths instead of each command module re-implementing them.

## Acceptance Criteria

1. **Given** `src/lib/specificVerbs.js` is created, **When** imported, **Then** it exports `SPECIFIC_VERBS`, a mapping from verb name to `{ displayName, handler }`.
2. **Given** `SPECIFIC_VERBS`, **Then** it contains at minimum the following keys: `logs`, `logsPrevious`, `logsToFile`, `exec`, `execOneOff`, `scale`, `rolloutStatus`, `rolloutHistory`, `rolloutUndo`, `rolloutRestart`, `rolloutPause`, `rolloutResume`, `setImage`, `setEnv`, `top`, `portForward`.
3. **Given** every handler in `SPECIFIC_VERBS`, **Then** its signature is `(resource, ctx, ns) => Promise<void>`.
4. **Given** a verb that operates on a single instance (`logs`, `exec`, `scale`, `rolloutUndo`, etc.), **Then** the handler calls `pickResourceInstance(resource, ctx, ns)` from `src/lib/universalVerbs.js` and returns early if it resolves `null`.
5. **Given** the `logs` verb, **Then** it streams logs for the picked pod via `runLivePipedWithExitKeys` with `["logs", "-f", name, "--tail=200"]` — exact behavioural parity with `src/commands/logs.js:36-50` ("Stream logs — specific pod").
6. **Given** the `logsPrevious` verb, **Then** it runs `runLivePiped("kubectl", [..., "logs", name, "--previous", "--tail=300"])` — parity with `src/commands/logs.js:51-66`.
7. **Given** the `logsToFile` verb, **Then** it ports `src/commands/logs.js:67-99` exactly: prompts for tail count, writes to `./logs/{pod}_{timestamp}.log` via `runShell`, with optional `jq` pipe when available, and reports success/failure via `ok`/`warn`.
8. **Given** the `exec` verb, **Then** it picks a pod, presents `select` between `"sh"` and `"bash"`, and calls `runLive("kubectl", [..., "exec", "-it", name, "--", shell])` — parity with `src/commands/exec.js`'s "Shell into a pod".
9. **Given** the `execOneOff` verb, **Then** it picks a pod, prompts `input({ message: "Command (e.g. env):", default: "env" })`, runs `runLive("kubectl", [..., "exec", name, "--", "sh", "-c", cmd])`.
10. **Given** the `scale` verb, **Then** it picks an instance, prompts `input` for replica count (default `"1"`), and runs `kubectl scale {kind}/{name} --replicas=N` via `runLive`. If the replica count is `0`, it confirms first.
11. **Given** the six `rollout*` verbs, **Then** each runs `kubectl rollout {sub} {kind}/{name}` via `runLive` where `sub` is one of: `status`, `history`, `undo`, `restart`, `pause`, `resume`. `rolloutUndo` and `rolloutRestart` prompt `confirm({ default: false })` before executing.
12. **Given** the `setImage` verb, **Then** it picks an instance, prompts `input` for `container=image`, confirms, and runs `kubectl set image {kind}/{name} {container}={image}` via `runLive`.
13. **Given** the `setEnv` verb, **Then** it picks an instance, prompts `input` for `KEY=VALUE`, and runs `kubectl set env {kind}/{name} {KEY}={VALUE}` via `runLive`. No confirm for additive env changes.
14. **Given** the `top` verb, **Then** it runs `kubectl top {plural}` via `runLiveWithOptionalWatch` — omitting `--namespace` when `resource.namespaced === false` (works for both `pods` and `nodes`).
15. **Given** the `portForward` verb, **Then** it picks an instance, prompts `input` for `localPort:remotePort` (default `"8080:80"`), and runs `kubectl port-forward {kind}/{name} {ports}` via `runLivePipedWithExitKeys` so the user can hit `q`/Esc to return.
16. **Given** `specificVerbs.test.js`, **Then** it mocks runner/shell/inquirer and asserts for at least the following representative verbs that the correct kubectl invocation is produced and the `pickResourceInstance` early-return path is honoured:
    - `logs` (stream)
    - `scale` (with replicas input + zero-replicas confirm)
    - `rolloutUndo` (confirm-false skips, confirm-true runs)
    - `setImage` (parses `container=image` correctly)

## Tasks / Subtasks

- [ ] **Task 1: Define verb-handler skeleton** (AC: #1, #3, #4)
  - [ ] Create `src/lib/specificVerbs.js` with `import { pickResourceInstance } from "./universalVerbs.js";` and `import { runLive, runLivePiped, runLivePipedWithExitKeys, runLiveWithOptionalWatch, runShell, isJqAvailable } from "./runner.js";`.
  - [ ] Helper: `function baseArgs(resource, ctx, ns)` returns `["--context=" + ctx, ...(resource.namespaced ? [\`--namespace=${ns}\`] : [])]`. DRY the namespace-flag conditional across every handler.

- [ ] **Task 2: Implement `logs`, `logsPrevious`, `logsToFile`** (AC: #5, #6, #7)
  - [ ] Port the logic from `src/commands/logs.js:36-99` verbatim, but instead of `pickPod(ctx, ns)` use `pickResourceInstance(resource, ctx, ns)`. The `logs` verb is only registered on Pods today (but adding it to a registry-listed `resource` is a 6-7 concern; 6-3 just ships the implementation).
  - [ ] `logs.displayName = "Stream logs"`, `logsPrevious.displayName = "Previous container logs"`, `logsToFile.displayName = "Dump logs to file"`.

- [ ] **Task 3: Implement `exec`, `execOneOff`** (AC: #8, #9)
  - [ ] Port from `src/commands/exec.js`. Names: `"Shell into pod"`, `"Run one-off command"`.

- [ ] **Task 4: Implement `scale`** (AC: #10)
  - [ ] After pick: `const replicas = await input({ message: "Replicas:", default: "1" });`.
  - [ ] If `parseInt(replicas, 10) === 0`, prompt `confirm({ message: \`Scale ${kind}/${name} to 0?\`, default: false })`. If declined, return.
  - [ ] Run `kubectl ${baseArgs} scale ${kind}/${name} --replicas=${replicas}`.
  - [ ] `displayName = "Scale"`.

- [ ] **Task 5: Implement six `rollout*` verbs** (AC: #11)
  - [ ] Helper `function makeRollout(sub, displayName, { requiresConfirm = false } = {})` returns `{ displayName, handler: async (resource, ctx, ns) => { ... } }`. The handler picks an instance, optionally confirms, then `runLive("kubectl", [...baseArgs, "rollout", sub, \`${resource.kind}/${name}\`])`.
  - [ ] `rolloutStatus.displayName = "Rollout status"`, `rolloutHistory = "Rollout history"`, `rolloutUndo = "Rollback rollout"` (confirm), `rolloutRestart = "Restart rollout"` (confirm), `rolloutPause = "Pause rollout"`, `rolloutResume = "Resume rollout"`.

- [ ] **Task 6: Implement `setImage`, `setEnv`** (AC: #12, #13)
  - [ ] `setImage.displayName = "Set image"`. Prompt `input({ message: "container=image (e.g. app=nginx:1.27):" })`. Validate format with a simple regex `/^[\w.-]+=.+/`; if invalid, `warn` and return.
  - [ ] Confirm `Apply new image to ${kind}/${name}?`. If true, `runLive("kubectl", [...baseArgs, "set", "image", \`${resource.kind}/${name}\`, spec])`.
  - [ ] `setEnv.displayName = "Set env var"`. Prompt `input({ message: "KEY=VALUE:" })`. Same regex check. No confirm. `runLive("kubectl", [...baseArgs, "set", "env", \`${resource.kind}/${name}\`, spec])`.

- [ ] **Task 7: Implement `top`** (AC: #14)
  - [ ] `displayName = "Top"`. `runLiveWithOptionalWatch("kubectl", [...baseArgs, "top", resource.plural])`. The `baseArgs` helper already strips `--namespace` for cluster-scoped resources, so `top nodes` and `top pods` Just Work.

- [ ] **Task 8: Implement `portForward`** (AC: #15)
  - [ ] `displayName = "Port-forward"`. Pick → prompt `input({ message: "localPort:remotePort:", default: "8080:80" })` → `runLivePipedWithExitKeys("kubectl", [...baseArgs, "port-forward", \`${resource.kind}/${name}\`, ports])`.

- [ ] **Task 9: Author `src/lib/specificVerbs.test.js`** (AC: #16)
  - [ ] Mock `./universalVerbs.js` (default `pickResourceInstance` to return `"web-1"`; override per-test for null-path coverage).
  - [ ] Mock `./runner.js`, `./shell.js`, `@inquirer/prompts`.
  - [ ] Cover at minimum: `logs`, `scale` (happy + zero-replicas-decline), `rolloutUndo` (confirm-false + confirm-true), `setImage` (happy + invalid input rejected).
  - [ ] Two fixture resources: `podsResource` and `deploymentResource`. Both `namespaced: true`. Use them as args to the handlers.

- [ ] **Task 10: Verify no regressions**
  - [ ] `npm test` — should be ≥333 + new tests.
  - [ ] No changes to `src/commands/*` or `src/main.js`.

## Dev Notes

### Dependency chain

- **6-3 depends on 6-2** (imports `pickResourceInstance`). If 6-2 is not merged, this story is blocked.
- 6-3 does NOT depend on 6-1's full entries (uses fixture resources in tests).

### Why port logs/exec verbatim rather than refactor

The existing `src/commands/logs.js` and `exec.js` are already well-shaped and tested. The point of this story is to **make them reusable** by parameterizing the pod-picker call, not to redesign them. **Match the existing kubectl invocations byte-for-byte** (flag order, flag values, args) so that story 6-6's migration is a delete-the-old-file operation, not a behavioural change.

### Argument-order consistency

`baseArgs(resource, ctx, ns)` returns `["--context=ctx"]` first, then optionally `"--namespace=ns"`. Every handler builds args as `[...baseArgs(...), <verb>, <kind>/<name>, ...flags]`. This matches the order in `src/commands/deployments.js:46-51` and keeps the status bar's "last command" display readable.

### `kind/name` shorthand vs `{kind} {name}` form

`kubectl rollout status deployment/my-app` and `kubectl rollout status deployment my-app` both work, but **the slash form is canonical** in `src/commands/deployments.js:50` (`deployment/${appDeployment}`). Use it for `rollout*`, `scale`, `setImage`, `setEnv`, `portForward`. Use the space-separated form (`describe`, `delete`, `edit`) only where the universal verbs use it — i.e. when the noun follows the verb directly.

### Why not generalize `logs` to all resources

The epic says `logs` is "via the pod the job created — handler resolves it" for Jobs (story 6-7). That resolver lives in 6-7, not here. In 6-3, `logs.handler(resource, ctx, ns)` assumes `resource.kind === "pod"` — i.e. it calls `pickResourceInstance` and uses the returned name as the pod name. Don't try to be clever about "if resource is a Job, find its pod". That's the next story's problem.

### Confirm wording

Existing confirms read naturally: `Delete pod "{name}" in namespace "{ns}"?`, `Roll back "{name}" in "{ns}"?`. Match that voice:
- `rolloutUndo`: `Roll back {kind}/{name} in {ns}?`
- `rolloutRestart`: `Rolling-restart {kind}/{name} in {ns}?`
- `setImage`: `Apply new image to {kind}/{name}?`
- `scale` (to 0): `Scale {kind}/{name} to 0 replicas?`

### Things to NOT do

- Don't add `--record` flags. `kubectl --record` was deprecated in v1.24.
- Don't add a `restart pod` verb. Pods aren't "restartable" via kubectl rollout — you delete them. The existing UX handles that via universal `delete` on Pods.
- Don't introduce a `logs --all-containers` flag — out of scope and not requested.
- Don't try to validate the image spec or env spec beyond the simple regex. `kubectl set` already rejects bad input.

### File size budget

This will be the largest file in `src/lib/` because it ships ~16 handlers. Target: <250 lines, soft limit. If you blow past 300, consider splitting by category (`workloadVerbs.js`, `podVerbs.js`) — but only if it falls out naturally. **Don't preemptively split.**

### Testing approach

Per `project-context.md §10.1` (mockist):
- Mock `pickResourceInstance` once at the file level with `vi.fn().mockResolvedValue("web-1")` as default. Per-test override with `.mockResolvedValueOnce(null)` for the early-return path.
- Use `expect.arrayContaining([...])` for runner-call assertions to keep tests robust against flag reordering — but assert the verb + `kind/name` substring with `toContain`.
- One `describe` block per verb category (logs / exec / scale / rollout / set / top / portForward), one or two `it` blocks each. **You do not need to test every verb** — the AC says "at least four representative verbs" for the test file. Aim for ~6-8 it-blocks total.

### Source Tree After This Story

```
src/lib/
├── ...
├── specificVerbs.js          ← NEW
├── specificVerbs.test.js     ← NEW
├── universalVerbs.js
└── universalVerbs.test.js
```

### Definition of Done

- [ ] All 16 verbs present in `SPECIFIC_VERBS`.
- [ ] `pickResourceInstance` early-return path tested for at least 2 representative verbs.
- [ ] `npm test` passes.
- [ ] No `src/commands/*` changes (those happen in 6-6).

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.3" (lines 926–952).
- Existing logs flow: `src/commands/logs.js` (port verbatim).
- Existing exec flow: `src/commands/exec.js`.
- Existing rollout patterns: `src/commands/deployments.js:46-101`.
- Pick helper: `src/lib/universalVerbs.js` (from story 6-2).
- Runner: `src/lib/runner.js`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
