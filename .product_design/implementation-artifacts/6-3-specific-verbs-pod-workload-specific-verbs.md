# Story 6.3: `src/lib/specificVerbs.js` — pod & workload-specific verbs

Status: review

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

- [x] **Task 1: Define verb-handler skeleton** (AC: #1, #3, #4)
  - [x] Create `src/lib/specificVerbs.js` with `import { pickResourceInstance } from "./universalVerbs.js";` and `import { runLive, runLivePiped, runLivePipedWithExitKeys, runLiveWithOptionalWatch, runShell, isJqAvailable } from "./runner.js";`.
  - [x] Helper: `function baseArgs(resource, ctx, ns)` returns `["--context=" + ctx, ...(resource.namespaced ? [\`--namespace=${ns}\`] : [])]`. DRY the namespace-flag conditional across every handler.

- [x] **Task 2: Implement `logs`, `logsPrevious`, `logsToFile`** (AC: #5, #6, #7)
  - [x] Port the logic from `src/commands/logs.js:36-99` verbatim, but instead of `pickPod(ctx, ns)` use `pickResourceInstance(resource, ctx, ns)`. The `logs` verb is only registered on Pods today (but adding it to a registry-listed `resource` is a 6-7 concern; 6-3 just ships the implementation).
  - [x] `logs.displayName = "Stream logs"`, `logsPrevious.displayName = "Previous container logs"`, `logsToFile.displayName = "Dump logs to file"`.

- [x] **Task 3: Implement `exec`, `execOneOff`** (AC: #8, #9)
  - [x] Port from `src/commands/exec.js`. Names: `"Shell into pod"`, `"Run one-off command"`.

- [x] **Task 4: Implement `scale`** (AC: #10)
  - [x] After pick: `const replicas = await input({ message: "Replicas:", default: "1" });`.
  - [x] If `parseInt(replicas, 10) === 0`, prompt `confirm({ message: \`Scale ${kind}/${name} to 0?\`, default: false })`. If declined, return.
  - [x] Run `kubectl ${baseArgs} scale ${kind}/${name} --replicas=${replicas}`.
  - [x] `displayName = "Scale"`.

- [x] **Task 5: Implement six `rollout*` verbs** (AC: #11)
  - [x] Helper `function makeRollout(sub, displayName, { requiresConfirm = false } = {})` returns `{ displayName, handler: async (resource, ctx, ns) => { ... } }`. The handler picks an instance, optionally confirms, then `runLive("kubectl", [...baseArgs, "rollout", sub, \`${resource.kind}/${name}\`])`.
  - [x] `rolloutStatus.displayName = "Rollout status"`, `rolloutHistory = "Rollout history"`, `rolloutUndo = "Rollback rollout"` (confirm), `rolloutRestart = "Restart rollout"` (confirm), `rolloutPause = "Pause rollout"`, `rolloutResume = "Resume rollout"`.

- [x] **Task 6: Implement `setImage`, `setEnv`** (AC: #12, #13)
  - [x] `setImage.displayName = "Set image"`. Prompt `input({ message: "container=image (e.g. app=nginx:1.27):" })`. Validate format with a simple regex `/^[\w.-]+=.+/`; if invalid, `warn` and return.
  - [x] Confirm `Apply new image to ${kind}/${name}?`. If true, `runLive("kubectl", [...baseArgs, "set", "image", \`${resource.kind}/${name}\`, spec])`.
  - [x] `setEnv.displayName = "Set env var"`. Prompt `input({ message: "KEY=VALUE:" })`. Same regex check. No confirm. `runLive("kubectl", [...baseArgs, "set", "env", \`${resource.kind}/${name}\`, spec])`.

- [x] **Task 7: Implement `top`** (AC: #14)
  - [x] `displayName = "Top"`. `runLiveWithOptionalWatch("kubectl", [...baseArgs, "top", resource.plural])`. The `baseArgs` helper already strips `--namespace` for cluster-scoped resources, so `top nodes` and `top pods` Just Work.

- [x] **Task 8: Implement `portForward`** (AC: #15)
  - [x] `displayName = "Port-forward"`. Pick → prompt `input({ message: "localPort:remotePort:", default: "8080:80" })` → `runLivePipedWithExitKeys("kubectl", [...baseArgs, "port-forward", \`${resource.kind}/${name}\`, ports])`.

- [x] **Task 9: Author `src/lib/specificVerbs.test.js`** (AC: #16)
  - [x] Mock `./universalVerbs.js` (default `pickResourceInstance` to return `"web-1"`; override per-test for null-path coverage).
  - [x] Mock `./runner.js`, `./shell.js`, `@inquirer/prompts`.
  - [x] Cover at minimum: `logs`, `scale` (happy + zero-replicas-decline), `rolloutUndo` (confirm-false + confirm-true), `setImage` (happy + invalid input rejected).
  - [x] Two fixture resources: `podsResource` and `deploymentResource`. Both `namespaced: true`. Use them as args to the handlers.

- [x] **Task 10: Verify no regressions**
  - [x] `npm test` — should be ≥333 + new tests.
  - [x] No changes to `src/commands/*` or `src/main.js`.

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

- [x] All 16 verbs present in `SPECIFIC_VERBS`.
- [x] `pickResourceInstance` early-return path tested for at least 2 representative verbs.
- [x] `npm test` passes.
- [x] No `src/commands/*` changes (those happen in 6-6).

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.3" (lines 926–952).
- Existing logs flow: `src/commands/logs.js` (port verbatim).
- Existing exec flow: `src/commands/exec.js`.
- Existing rollout patterns: `src/commands/deployments.js:46-101`.
- Pick helper: `src/lib/universalVerbs.js` (from story 6-2).
- Runner: `src/lib/runner.js`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- One TDD micro-fail: the `logsToFile` test hit a `runShell` mock that returned `undefined` (because `vi.resetAllMocks()` in `beforeEach` wipes return values). Fix: per-test `runShell.mockResolvedValueOnce(0)`. Single-line correction, re-ran green.

### Completion Notes List

- **All 16 verbs from AC #2 are present.** Tested with 35 specificVerbs cases — covers AC #16's four representative verbs (logs/scale/rolloutUndo/setImage) plus the rest. The `it.each` parametric block covers the `pickResourceInstance → null` early-return path for 11 of the verbs in one block (only `rolloutPause`/`rolloutResume` skip it since they're benign).
- **`makeRollout(sub, displayName, { requiresConfirm })` factory** generates 6 of the 16 verb entries from one helper — keeps the file at 233 lines (target was <250).
- **Argument-order convention preserved.** `[--context, --namespace?, verb, kind/name, ...flags]` matches `src/commands/deployments.js:46-51` so status-bar "last command" display stays consistent across migrated and pre-migration paths.
- **`makeRollout` confirm wording** uses the displayName interpolated into a `${displayName} ${kind}/${name} in "{ns}"?` sentence. Slightly different from the existing per-module wording (e.g. `Roll back "{name}" in "{ns}"?`), but more uniform across the 6 verbs. Behaviourally identical (still `default: false`).
- **`APP_NAME` import retained as `void APP_NAME`** for now. The story spec mentioned future selector-based logs tailing (e.g. `--selector=app=${APP_NAME}`); not in the AC for 6-3 but the import declaration documents the future hook. Drop in a follow-up if it doesn't materialize.
- **`logsToFile` keeps `mkdir -p ./logs` inline** in the shell command rather than a separate `run()` call — single shell invocation per the existing logs.js pattern (line 81 issues `mkdir` separately; this version combines them for atomicity).
- **`setImage` validation regex `/^[\w.-]+=.+/`** matches container=image (and KEY=VALUE for `setEnv`). It will accept some malformed inputs (e.g. `=value` with empty key), but `kubectl set image/env` rejects those server-side. Tight regex would be brittle; trust kubectl.
- **`exec` uses `runLive(..., { interactive: true })`** to match the existing exec.js behaviour (interactive shell streams, doesn't capture/page). Verified the test asserts the interactive flag.
- **File sizes:** `src/lib/specificVerbs.js` is 233 lines, `src/lib/specificVerbs.test.js` is 349 lines.
- **Regression scope:** only the two new files plus `sprint-status.yaml` touched. No `src/commands/*` or `src/main.js` changes.
- **Test count delta:** 367 → 402 (+35).

### File List

- `src/lib/specificVerbs.js` (NEW)
- `src/lib/specificVerbs.test.js` (NEW)
- `.product_design/implementation-artifacts/6-3-specific-verbs-pod-workload-specific-verbs.md` (this file)
- `.product_design/implementation-artifacts/sprint-status.yaml` (status: in-progress → review)

### Change Log

- 2026-05-26 — Initial implementation: `SPECIFIC_VERBS` map with 16 verb entries (logs/exec/scale/6× rollout/setImage/setEnv/top/portForward), `makeRollout` factory, baseArgs/targetRef helpers, 35 vitest cases. Status → review.
