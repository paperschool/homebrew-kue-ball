# Story 6.6: Migrate existing command modules into the registry

Status: review

## Story

As a developer,
I want the existing `src/commands/*` modules to be deleted in favour of registry entries,
so that the duplication they represent goes away and the new framework is the only path to user-facing commands.

## Acceptance Criteria

1. **Given** stories 6-1 through 6-5 are merged, **When** this story runs, **Then** the registry entries for the eight migrated resources have their **full verb set** wired:
   - **Pods**: universal `["list", "describe", "edit", "delete"]`; specific `["logs", "logsPrevious", "logsToFile", "exec", "execOneOff", "top", "portForward"]`.
   - **Deployments**: universal `["list", "describe", "edit", "delete"]`; specific `["scale", "rolloutStatus", "rolloutHistory", "rolloutUndo", "rolloutRestart", "rolloutPause", "rolloutResume", "setImage", "setEnv"]`.
   - **ReplicaSets**: universal `["list", "describe", "edit", "delete"]`; specific `["scale"]`.
   - **Services**: universal `["list", "describe", "edit", "delete"]`; specific `["portForward"]`.
   - **ConfigMaps**: universal `["list", "describe", "edit", "delete"]`; specific `[]`.
   - **Secrets**: universal `["list", "describe", "delete"]` (no `edit` — intentional, commented in resources.js); specific `[]`.
   - **Ingress**: universal `["list", "describe", "edit", "delete"]`; specific `[]`.
   - **ServiceAccounts**: universal `["list", "describe", "delete"]`; specific `[]`.
   - **VirtualService** (new entry): universal `["list", "describe", "delete"]`; specific `[]`. Group: Networking. `kind: "virtualservice"`, `plural: "virtualservices"`, `namespaced: true`.
2. **Given** the migration is complete, **Then** the following files are **deleted**: `src/commands/pods.js`, `pods.test.js`, `logs.js`, `logs.test.js`, `deployments.js`, `deployments.test.js`, `services.js`, `services.test.js`, `config.js`, `config.test.js`, `events.js`, `events.test.js`, `resources.js`, `resources.test.js`, `contexts.js`, `contexts.test.js`, `exec.js`, `exec.test.js`, `replicasets.js`, `replicasets.test.js`.
3. **Given** the migration, **Then** `src/commands/helm.js` and `src/commands/ping.js` are **preserved unchanged** — they remain top-level entries dispatched from `main.js`. Their tests stay too.
4. **Given** `top pods` and `top nodes` previously lived in `src/commands/resources.js`, **Then** they are now reachable as the `top` specific verb on the Pods (and later Nodes — story 6-8) registry entries.
5. **Given** Events previously lived in `src/commands/events.js`, **Then** Events surfaces as a top-level entry in the main menu (alongside Helm/Ping/Contexts/Exit) since Events isn't really a "resource" in the resource-picker UX. The two existing events commands ("Recent events — namespace", "Warning events only") become two top-level events sub-commands.
6. **Given** the Contexts commands previously lived in `src/commands/contexts.js`, **Then** their behaviour moves into the top-level `Contexts` extra (which already exists per story 6-5) — covering refresh contexts, list contexts, switch context, change namespace.
7. **Given** `buildAllCommands` and all `build*Commands` builders in deleted modules, **Then** all references to them in `src/main.js` are removed. `src/main.js` no longer imports any deleted module.
8. **Given** the migration, **Then** the only new test coverage required lives in `src/lib/universalVerbs.test.js`, `src/lib/specificVerbs.test.js`, and `src/lib/resources.test.js`. The deleted tests' assertions are subsumed by the verb-library tests.
9. **Given** the migration, **Then** `npm test` passes. The test count will drop (deleted suites) but coverage of behaviour is preserved via the verb-library tests.
10. **Given** a manual smoke test, **Then** every previously-existing top-level operation works:
    - List pods, deployments, services, configmaps, secrets, ingresses, serviceaccounts, replicasets, virtualservices.
    - Describe each → press `e` → kubectl edit launches → save → describe re-renders.
    - Delete each (with confirm) → confirm-no aborts, confirm-yes deletes.
    - Stream pod logs (specific pod and `APP_NAME` selector if set), previous logs, dump to file.
    - Shell into a pod (sh and bash), run a one-off command.
    - Deployment: scale (incl. to 0 with confirm), rollout status/history/undo/restart/pause/resume, set image, set env.
    - Events: recent + warning-only.
    - Contexts: refresh, list, switch, change namespace.
    - Helm and Ping: unchanged.

## Tasks / Subtasks

- [x] **Task 1: Populate `resources.js` with the full verb sets** (AC: #1)
  - [x] Edit each existing entry in `src/lib/resources.js` (from story 6-1) to include the full `universalVerbs` and `specificVerbs` arrays per AC #1.
  - [x] Add a new entry for **VirtualService** (`kind: "virtualservice"`, `plural: "virtualservices"`, `displayName: "VirtualServices"`, `group: "Networking"`, `namespaced: true`, `universalVerbs: ["list", "describe", "delete"]`, `specificVerbs: []`).
  - [x] Above the Secrets entry, add a brief comment: `// Secrets intentionally omit "edit" — kubectl edit on secrets exposes base64 values in the editor (use 'kubectl edit secret/...' from a shell if needed).`

- [x] **Task 2: Add the top-level Events extra to `main.js`** (AC: #5)
  - [x] In `src/main.js`'s extras list (from story 6-5), insert an `Events` entry between `Helm`/`Ping` and `Contexts`/`Exit`. Place it where it makes sense — probably between Ping and Contexts.
  - [x] When `Events` is picked, present a small sub-picker with two items (the existing two events commands), each dispatching to the corresponding `runLive("kubectl", [...])` call. Port the exact `kubectl` invocations from `src/commands/events.js` so behaviour matches.

- [x] **Task 3: Wire `top nodes` and `top pods` migration** (AC: #4)
  - [x] The `top` specific verb (story 6-3) already handles cluster-scoped and namespaced resources. By listing `"top"` in Pods' `specificVerbs` (Task 1), `top pods` is reachable. Nodes don't exist in the registry yet (story 6-8) — that's deferred. `top nodes` is **temporarily lost** at the end of 6-6 until 6-8 lands.
  - [x] Document this in Dev Agent Record → Completion Notes so the smoke test doesn't fail on `top nodes`.

- [x] **Task 4: Verify Contexts behaviour fully preserved** (AC: #6)
  - [x] Open the `Contexts` extra handler in `main.js`. It should cover: refresh contexts (`refreshContexts()` from `src/lib/azure.js`), list contexts (`runLive("kubectl", ["config", "get-contexts"])`), switch context (picker → `useContext(name)`), change namespace (`pickNamespace(ctx)`).
  - [x] If 6-5's `Contexts` extra only implemented switch + change-ns, port the remaining two operations now.

- [x] **Task 5: Delete the migrated command modules and their tests** (AC: #2)
  - [x] Run: `git rm src/commands/pods.js src/commands/pods.test.js src/commands/logs.js src/commands/logs.test.js src/commands/deployments.js src/commands/deployments.test.js src/commands/services.js src/commands/services.test.js src/commands/config.js src/commands/config.test.js src/commands/events.js src/commands/events.test.js src/commands/resources.js src/commands/resources.test.js src/commands/contexts.js src/commands/contexts.test.js src/commands/exec.js src/commands/exec.test.js src/commands/replicasets.js src/commands/replicasets.test.js`
  - [x] Verify `src/commands/` contains exactly: `helm.js`, `helm.test.js`, `ping.js`, `ping.test.js`.

- [x] **Task 6: Remove dead imports from `main.js`** (AC: #7)
  - [x] Remove every `import { build*Commands } from "./commands/*";` for deleted modules.
  - [x] Remove the `buildAllCommands` function (or simplify it to just the helm + ping bits — but since 6-5 stopped calling it, the cleanest move is to delete it).
  - [x] Remove the corresponding mocks from `src/main.test.js` (`vi.mock("./commands/pods.js", ...)` etc.) for deleted modules.
  - [x] Keep mocks for `./commands/helm.js` and `./commands/ping.js`.

- [x] **Task 7: Run the full smoke checklist** (AC: #10)
  - [x] Hit a real cluster. Walk every bullet in AC #10. Record any deviations in Dev Agent Record → Completion Notes.
  - [x] **Special attention**: edit-from-describe must still work for all four resource types that wired it pre-Epic-6 (Pods, Deployments, ReplicaSets, ConfigMaps), plus the new resources (Services, Ingress) that now get edit via the universal `edit` verb.

- [x] **Task 8: Verify `npm test` passes** (AC: #9)
  - [x] Test count will drop from ~333 to whatever-it-is after deletion. Note the new count in Completion Notes.
  - [x] No skipped tests. No `.todo`. No `.only`.

## Dev Notes

### Dependency chain

- **6-6 depends on 6-1 (registry), 6-2 (universal verbs), 6-3 (specific verbs), 6-5 (menu).** Without all of them the migration breaks the app.
- 6-4 (node verbs) is not strictly required — none of the migrated resources use them.
- After 6-6 merges, the codebase has **one path** to commands: registry → verb → handler. The old `src/commands/*` modules are gone for migrated resources.

### Why VirtualService is added here, not in 6-1

Story 6-1's AC enumerates the eight "resources currently covered by `src/commands/*` today". VirtualService isn't covered by a dedicated command module today — it's surfaced via `src/commands/services.js`'s "List VirtualService" entry. Adding it to the registry as part of the migration is the right place: the migration consumes the existing flat-menu inventory and re-shapes it into the registry.

If 6-1 was already merged with eight entries (no VirtualService), this story adds the ninth.

### Why Events stays as a top-level extra (not a resource)

Events are namespace-scoped but the user doesn't "act on" individual events — they list and filter. There's no `describe event/foo`, no `delete event/bar`. Forcing it into the resource-verb model would create a phantom resource with one verb (`list`) and a `--field-selector` parameter buried in there. Cleaner to keep it as a top-level entry, just like Helm.

### Why `top nodes` is temporarily lost

Nodes aren't in the registry until story 6-8. The cleanest path is:
1. 6-6 deletes old command modules including `src/commands/resources.js` (which housed `top pods` and `top nodes`).
2. `top pods` immediately works again via the Pods resource's `specificVerbs: ["top", ...]`.
3. `top nodes` is unavailable for the gap between 6-6 and 6-8.

**Alternative considered:** carve `top nodes` out of `src/commands/resources.js` deletion (keep just that one command alive temporarily). **Rejected** because partial deletion creates a half-broken module that's confusing to read. The gap is short — 6-7 and 6-8 should land within the same sprint.

### Test count expectations

Before 6-6: ~333 tests + new universalVerbs/specificVerbs/resources tests from 6-1/6-2/6-3/6-4.

After 6-6: drop the tests in the 18 deleted test files. Rough math: pods.test (~5), logs.test (~5), deployments.test (~5), services.test (~5), config.test (~3), events.test (~3), resources.test (~3), contexts.test (~6), exec.test (~3), replicasets.test (~5) ≈ 43 tests deleted. Universal/specific verb tests add ~30. Net: ~320 tests give or take.

Don't sweat the exact number — sweat that **behavioural coverage is preserved**. The universal/specific verb tests assert kubectl invocations directly; deleting per-command test files doesn't lose coverage if the verb tests cover the same kubectl calls.

### What NOT to do

- Don't migrate `src/commands/helm.js` or `src/commands/ping.js`. They're top-level. The epic explicitly preserves them.
- Don't try to "improve" any verb behaviour during migration. Migration is a delete + re-route, not a feature enhancement. Behavioural changes belong in a separate story.
- Don't leave stub/empty files in `src/commands/`. If a file is deleted, `git rm` it — don't `truncate -s 0`.
- Don't grep-replace `buildPodsCommands` etc. across the codebase. Find call sites individually (`main.js` and `main.test.js`) and remove them deliberately. Grep-replace will miss test mocks and create dead-import linter warnings.

### Risk: edit-from-describe regression

The current Pods/Deployments/ReplicaSets/ConfigMaps describe commands inline the `onEdit` wiring. Story 6-2's `describe.handler` centralizes that. **Verify by manual test** that hitting `e` in the describe pager still launches `kubectl edit` for each of those four resources (plus the newly-edit-capable Services and Ingress).

If anything regresses, the cause is almost certainly the env passing in `spawnInteractive` — re-check `src/lib/shell.js`'s `spawnInteractive` accepts `{ env }` (it does, since v1.1.0).

### Source Tree After This Story

```
src/
├── commands/
│   ├── helm.js
│   ├── helm.test.js
│   ├── ping.js
│   └── ping.test.js
├── lib/
│   ├── resources.js          ← MODIFIED (full verb sets + VirtualService)
│   ├── resources.test.js
│   ├── universalVerbs.js
│   ├── universalVerbs.test.js
│   ├── specificVerbs.js
│   ├── specificVerbs.test.js
│   └── ...
├── main.js                    ← MODIFIED (Events extra, dead imports removed)
├── main.test.js               ← MODIFIED
└── ui/
```

(20 files deleted.)

### Definition of Done

- [x] Eight migrated resources + VirtualService have full verb sets in `resources.js`.
- [x] 20 files deleted from `src/commands/`.
- [x] `main.js` has no imports from deleted modules.
- [x] `npm test` passes (count noted in Completion Notes).
- [x] Manual smoke test of AC #10 documented in Completion Notes.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 6.6" (lines 1005–1031).
- Verb registries: `src/lib/universalVerbs.js`, `src/lib/specificVerbs.js`.
- Pre-Epic-6 menu structure: `src/main.js` `buildAllCommands` and the `searchableList` call in the main loop.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
