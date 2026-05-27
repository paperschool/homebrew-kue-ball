---
stepsCompleted: ["step-01", "step-02", "step-03-epic-2", "step-03-epic-3", "step-03-epic-4", "step-03-epic-5"]
inputDocuments:
  - .product_design/base_prd.md
  - .product_design/project-context.md
---

# homebrew-kue-ball — Epic Breakdown

## Overview

Decomposition of the modularisation PRD into epics and stories. The goal is to take the monolithic `kubectl-wizard.mjs` and produce a clean, tested, modular codebase without any behavioural regressions.

---

## Requirements Inventory

### Functional Requirements

- **FR1** Split `kubectl-wizard.mjs` into logical modules under `src/`
- **FR2** All searchable lists share a common `searchableList` component with fuzzy matching and grouped separators
- **FR3** Multi-select (checkbox) inherits the same fuzzy filtering pattern
- **FR4** Any "fetch resource → spinner → pick" flow uses a shared `resourcePicker` component
- **FR5** Every module has co-located regression tests (`*.test.js`)
- **FR6** Shell commands (`kubectl`, `az`, `helm`) are mocked at the `shell.js` boundary — tests never hit a real shell
- **FR7** `kubectl-wizard.mjs` remains the entry-point binary but becomes a thin wrapper over `src/main.js`
- **FR8** The CLI renders a persistent title bar at the top of the screen showing "kue-ball"
- **FR9** A persistent status bar at the bottom shows the active Azure identity (truncated email · subscription name) and is populated on startup
- **FR10** A background health poller updates an auth indicator (🔒 green/red) in the status bar every 15 seconds without blocking foreground interactions
- **FR11** During fuzzy-match interactions, the search input anchors above the status bar; the result list scrolls in the content area above it
- **FR12** The command menu is two-level: first a resource-type selector, then a verb selector scoped to the chosen resource
- **FR13** A single resource registry (`src/lib/resources.js`) is the source of truth for resource types, their kubectl identifiers, display names, and supported verb sets
- **FR14** Universal verbs (list, describe, edit, delete) have a single generic implementation that works for any registered resource type
- **FR15** New resource types can be added by registering them in `src/lib/resources.js` without touching menu navigation or universal verb-handler code
- **FR16** Helm and Ping remain top-level entries alongside the resource picker — they are not bound to a kubernetes resource type
- **FR17** `kue-ball` installs and runs end-to-end inside Ubuntu running on WSL2, with no source modifications required at install time
- **FR18** The README documents a Windows install path that walks the user through enabling WSL2, installing Ubuntu, installing prerequisites (Node ≥22, kubectl, helm, az), and running `kue-ball`
- **FR19** `src/lib/shell.js` uses `path.delimiter` and platform-aware extra PATH entries, so the Mac-specific Homebrew/Rancher Desktop paths do not pollute environments where they don't exist (Linux/WSL without Homebrew)

### Non-Functional Requirements

- **NFR1** Zero behavioural regressions — the CLI must work identically before and after the refactor
- **NFR2** Test framework: Vitest
- **NFR3** ESM (`"type": "module"`) preserved throughout
- **NFR4** Each story is independently mergeable without breaking the running app
- **NFR5** The chrome layer is additive — existing `@inquirer/prompts`-based prompts require no changes in Stories 5.1–5.3
- **NFR6** The background poller is non-blocking; it never delays or interrupts foreground command execution
- **NFR7** On any exit path (normal, Ctrl+C, uncaught error), the terminal is fully restored to its pre-launch state
- **NFR8** Native Windows (PowerShell, `cmd.exe`) is explicitly out of scope; the supported Windows path is WSL2 → Ubuntu → run as a Linux binary. No platform-detection branches for win32 are added to runtime code paths beyond defensive PATH handling (FR19)

### FR Coverage Map

| FR   | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 | Epic 6 | Epic 7 |
| ---- | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| FR1  | ✓      | ✓      | ✓      | ✓      |        |        |        |
| FR2  |        | ✓      |        |        |        |        |        |
| FR3  |        | ✓      |        |        |        |        |        |
| FR4  |        | ✓      |        |        |        |        |        |
| FR5  | ✓      | ✓      | ✓      | ✓      |        | ✓      |        |
| FR6  | ✓      | ✓      | ✓      |        |        | ✓      |        |
| FR7  |        |        |        | ✓      |        |        |        |
| FR8  |        |        |        |        | ✓      |        |        |
| FR9  |        |        |        |        | ✓      |        |        |
| FR10 |        |        |        |        | ✓      |        |        |
| FR11 |        |        |        |        | ✓      |        |        |
| FR12 |        |        |        |        |        | ✓      |        |
| FR13 |        |        |        |        |        | ✓      |        |
| FR14 |        |        |        |        |        | ✓      |        |
| FR15 |        |        |        |        |        | ✓      |        |
| FR16 |        |        |        |        |        | ✓      |        |
| FR17 |        |        |        |        |        |        | ✓      |
| FR18 |        |        |        |        |        |        | ✓      |
| FR19 |        |        |        |        |        |        | ✓      |

---

## Epic List

| #   | Title                                 | Goal                                                                                                        |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Foundation — Tooling & Core Utilities | Test harness, folder structure, and all pure-logic modules extracted and tested                             |
| 2   | Reusable UI Components                | Shared UI primitives that command groups depend on                                                          |
| 3   | Command Groups                        | Each command group extracted into its own module                                                            |
| 4   | Wire-up & Integration                 | `src/main.js` assembled, entry-point thinned, CLI verified end-to-end                                       |
| 5   | TUI Chrome & Persistent Status Bar    | Persistent title bar, status bar frame, Azure identity panel, auth health poller, and anchored search input |
| 6   | Resource × Verb Menu Redesign         | Two-level menu (resource → verb) backed by a single resource registry and reusable universal-verb handlers  |
| 7   | Windows Support via WSL2              | Officially supported install path for Windows users running Ubuntu on WSL2 — smoke-tested, documented, with defensive PATH handling so the Mac-isms don't bite on a clean WSL install |

---

## Epic 1: Foundation — Tooling & Core Utilities

**Goal:** Establish the Vitest harness and `src/` folder layout, then extract every pure-logic utility from `kubectl-wizard.mjs`. No UI or command-group logic moves in this epic. All extracted modules must have passing tests before Epic 2 begins.

### Story 1.1: Vitest setup & folder scaffold

As a developer,
I want a working test harness and `src/` folder structure in place,
So that every subsequent story has a consistent home and can be verified immediately.

**Acceptance Criteria:**

**Given** the repo has no `src/` folder or test config
**When** story 1.1 is merged
**Then** `src/lib/`, `src/ui/`, `src/commands/` directories exist
**And** `npm test` runs Vitest and exits 0 (no tests yet = pass)
**And** `package.json` has `"test"`, `"test:watch"`, and `"test:coverage"` scripts

---

### Story 1.2: `src/lib/output.js` — colours & logging helpers

As a developer,
I want all ANSI colour constants and logging helpers in one module,
So that every other module can import them without duplicating colour codes.

**Acceptance Criteria:**

**Given** `src/lib/output.js` is created
**When** imported by any module
**Then** it exports: `CYAN`, `YELLOW`, `GREEN`, `RED`, `DIM`, `BOLD`, `RESET`, `ok()`, `warn()`, `info()`, `header()`, `printCommand()`, `stripAnsi()`, `styleDeleteCommandLabel()`
**And** `output.test.js` verifies `stripAnsi` strips escape codes and `styleDeleteCommandLabel` colours the word "delete"

---

### Story 1.3: `src/lib/prefs.js` — preference persistence

As a developer,
I want preference load/save logic isolated in one module,
So that it can be tested in isolation and the config path is a single source of truth.

**Acceptance Criteria:**

**Given** `src/lib/prefs.js` is created
**When** imported
**Then** it exports `loadPrefs()` and `savePrefs(prefs)`
**And** `CONFIG_DIR` resolves to `~/.config/kue-ball`
**And** `prefs.test.js` mocks `fs` and asserts load returns `{ subFrequency: {} }` on missing file, and save calls `mkdirSync` before `writeFileSync`

---

### Story 1.4: `src/lib/env.js` — environment constants

As a developer,
I want env-var constants exported from one place,
So that `APP_NAME`, `DEFAULT_NAMESPACE`, and `DEFAULT_CONTEXT` are not scattered across modules.

**Acceptance Criteria:**

**Given** `src/lib/env.js` is created
**When** imported
**Then** it exports `APP_NAME`, `DEFAULT_NAMESPACE`, `DEFAULT_CONTEXT` reading from `process.env`
**And** `env.test.js` verifies each constant falls back to the documented default when the env var is absent

---

### Story 1.5: `src/lib/shell.js` — process execution

As a developer,
I want `run()`, `spawnInteractive()`, and `spawnInteractiveWithExitKeys()` in one module,
So that all child-process logic — including PATH augmentation — is in a single mockable boundary.

**Acceptance Criteria:**

**Given** `src/lib/shell.js` is created
**When** imported
**Then** it exports `run(cmd, opts)`, `spawnInteractive(cmd, args)`, `spawnInteractiveWithExitKeys(cmd, args)`
**And** `run()` augments `PATH` with `~/.rd/bin`, `/opt/homebrew/bin`, `/usr/local/bin`
**And** `shell.test.js` mocks `execSync` and asserts `run()` returns trimmed stdout, returns `null` on error, and passes the augmented PATH

---

### Story 1.6: `src/lib/kubectl.js` — kubeconfig helpers

As a developer,
I want all kubeconfig-querying functions in one module,
So that kubectl interactions are testable without a live cluster.

**Acceptance Criteria:**

**Given** `src/lib/kubectl.js` is created
**When** imported
**Then** it exports `isKubectlAvailable()`, `getCurrentContext()`, `getContexts()`, `getNamespaces(ctx)`, `pickPod(ctx, ns)`
**And** each function delegates process execution to `shell.run()`
**And** `kubectl.test.js` mocks `shell.run` and asserts correct kubectl arguments and return-value parsing for each function

---

### Story 1.7: `src/lib/azure.js` — Azure CLI helpers

As a developer,
I want all Azure CLI interactions in one module,
So that subscription/cluster discovery and credential refresh are testable without a live Azure tenant.

**Acceptance Criteria:**

**Given** `src/lib/azure.js` is created
**When** imported
**Then** it exports `isAzCliAvailable()`, `listSubscriptions(opts)`, `listAksClustersForSub(subId)`, `listAllAksClusters(subs)`, `refreshContexts()`, `isPermissionError(msg)`, `showPimReminder()`
**And** `azure.test.js` mocks `shell.run`/`spawnSync` and asserts: `isPermissionError` detects all documented error strings; `listSubscriptions` returns `[]` on bad JSON; `listAksClustersForSub` parses stderr for useful error lines

---

### Story 1.8: `src/lib/helm.js` — Helm helpers

As a developer,
I want Helm availability check and release listing in one module,
So that Helm interactions are testable independently.

**Acceptance Criteria:**

**Given** `src/lib/helm.js` is created
**When** imported
**Then** it exports `isHelmAvailable()` and `listHelmReleases(ctx, ns)`
**And** `helm.test.js` mocks `shell.run` and asserts `listHelmReleases` returns `[]` on bad JSON

---

### Story 1.9: `src/lib/ping.js` — HTTP ping & route discovery

As a developer,
I want ping logic and ingress/VirtualService route extraction in one module,
So that they can be tested with mocked `fetch` and mocked kubectl output.

**Acceptance Criteria:**

**Given** `src/lib/ping.js` is created
**When** imported
**Then** it exports `pingRoute(url, attempts, timeoutMs)`, `getIngressInfo(ctx, ns)`, `getVirtualServiceInfo(ctx, ns)`
**And** `ping.test.js` mocks `fetch` and asserts `pingRoute` records status, ms, and error for each attempt
**And** mocks `shell.run` to assert `getIngressInfo` correctly extracts `baseUrl` and de-duplicated route paths from JSON ingress output

---

### Story 1.10: `src/lib/runner.js` — command runner helpers

As a developer,
I want `runLive`, `runLivePiped`, `runLivePipedWithExitKeys`, and watch-mode helpers in one module,
So that command groups can invoke them without knowing about `jq` detection or shell piping.

**Acceptance Criteria:**

**Given** `src/lib/runner.js` is created
**When** imported
**Then** it exports `runLive(cmd, args)`, `runLiveWithOptionalWatch(cmd, args)`, `runLivePiped(cmd, args)`, `runLivePipedWithExitKeys(cmd, args)`, `isJqAvailable()`
**And** `runner.test.js` mocks `shell.spawnInteractive` and asserts `runLiveWithOptionalWatch` calls `spawnInteractive` with `--watch` appended when the user presses `w`

---

## Epic 2: Reusable UI Components

**Goal:** Build the three shared UI primitives. Every command group in Epic 3 must use these rather than inlining its own `select`/`search`/`checkbox` calls.

**FRs covered:** FR2, FR3, FR4, FR5, FR6

---

### Story 2.1: `src/ui/searchableList.js` — fuzzy-filtered grouped list

As a developer,
I want a shared fuzzy-searchable list primitive,
So that any command group can present a searchable, grouped selection without reimplementing search or `Separator` logic.

**Acceptance Criteria:**

**Given** `src/ui/searchableList.js` is created
**When** imported
**Then** it exports `fuzzyMatch(query, text)` and `searchableList({ message, items, pageSize })`
**And** `fuzzyMatch` strips ANSI from `text` before matching, and returns `true` when every character of the lowercased `query` appears in order in the lowercased stripped text (character-subsequence algorithm)
**And** `searchableList` wraps `@inquirer/prompts` `search`, building its `source` function with `fuzzyMatch` to filter on every keystroke
**And** when items carry a `group` property, matching items are grouped under `Separator` headers styled `  ${CYAN}${DIM}── {group} ──${RESET}`; items without a `group` are rendered flat with no separator
**And** each item in the choices array is `{ name: item.name, value: item.value }`; the resolved return value is the raw `item.value`
**And** `searchableList.test.js` mocks `@inquirer/prompts` and asserts:
- `fuzzyMatch("pod", "my-pod-abc")` returns `true`
- `fuzzyMatch("xyz", "pod")` returns `false`
- ANSI escape sequences in the text argument are stripped before matching
- when `source` is invoked with a query, only items whose name fuzzy-matches are included in the returned choices
- when items have a `group`, matching items are preceded by a `Separator` with the group name
- when the query is empty, all items are returned

---

### Story 2.2: `src/ui/searchableMultiSelect.js` — grouped checkbox with pre-selection

As a developer,
I want a shared multi-select primitive that supports pre-selection and group separators,
So that the subscription picker (and any future multi-select flow) does not inline its own `checkbox` construction or separator layout.

**Acceptance Criteria:**

**Given** `src/ui/searchableMultiSelect.js` is created
**When** imported
**Then** it exports `searchableMultiSelect({ message, items, pageSize, validate })`
**And** `items` is an array of `{ name, value, checked, group }` objects
**And** it builds the `choices` array by: placing all `checked: true` items first, inserting a `Separator` between the checked and unchecked groups when both are present, then appending the remaining items — preserving the original order within each group
**And** it delegates to `@inquirer/prompts` `checkbox` passing `message`, `choices`, and `pageSize`
**And** `validate` defaults to `(v) => v.length > 0 || "Select at least one."`; a caller-supplied `validate` overrides the default
**And** the function returns the array of selected `value`s exactly as `checkbox` resolves them
**And** `searchableMultiSelect.test.js` mocks `@inquirer/prompts` and asserts:
- the `choices` array passed to `checkbox` has checked items before unchecked items, with a `Separator` between them when both groups are non-empty
- when all items are unchecked (or all checked) no separator is inserted
- the default `validate` function returns a non-empty string when called with `[]` and returns `true` when called with a non-empty array
- a caller-supplied `validate` function is forwarded to `checkbox` unchanged

---

### Story 2.3: `src/ui/resourcePicker.js` — spinner + fetch + pick flow

As a developer,
I want a shared "spinner → fetch → pick" primitive,
So that any command that loads remote resources before presenting a list does not inline its own spinner, error guard, or `searchableList` call.

**Acceptance Criteria:**

**Given** `src/ui/resourcePicker.js` is created
**When** imported
**Then** it exports `resourcePicker({ spinnerMessage, emptyMessage, fetchFn, mapFn, listOptions })`
**And** calling it writes `  ${DIM}{spinnerMessage}…${RESET}` to `process.stdout` (no newline) via `process.stdout.write`, then awaits `fetchFn()`
**And** after `fetchFn()` resolves, the spinner line is cleared with `process.stdout.write("\r\x1b[2K")`
**And** `mapFn` is called on each item returned by `fetchFn()` to produce `{ name, value, group? }` objects; if `mapFn` is omitted the raw items are used as-is
**And** if the mapped array is empty, `warn(emptyMessage)` is called and the function returns `null`
**And** if items are present, `searchableList` is called with `{ ...listOptions, items }` and its resolved value is returned
**And** `resourcePicker.test.js` mocks `searchableList`, `warn`, and `process.stdout.write`, asserting:
- `spinnerMessage` is written to stdout before `fetchFn` is awaited
- the spinner line is cleared after `fetchFn` resolves
- when `fetchFn` returns `[]`, `warn` is called with `emptyMessage` and `null` is returned
- when `fetchFn` returns items, `searchableList` is called with the mapped items and the resolved value is returned
- `mapFn` transforms each item before items are passed to `searchableList`

---

## Epic 3: Command Groups

**Goal:** Extract each command group into `src/commands/`, importing only from `src/lib/` and `src/ui/`.

**FRs covered:** FR1, FR5, FR6

---

### Story 3.1: `src/commands/pods.js` — pods command group

As a developer,
I want the Pods command group isolated in one module,
So that pod listing, description, and deletion can be imported and tested independently.

**Acceptance Criteria:**

**Given** `src/commands/pods.js` is created
**When** `buildPodsCommands(ctx, ns)` is called
**Then** it returns 4 command objects each with `{ group: "Pods", name, run }`
**And** the commands are: "List pods", "List pods — all namespaces", "Describe a pod", "Delete a pod"
**And** "List pods" calls `runner.runLiveWithOptionalWatch("kubectl", ["--context=ctx", "--namespace=ns", "get", "pods", "-o", "wide"])`
**And** "List pods — all namespaces" calls `runner.runLiveWithOptionalWatch("kubectl", ["--context=ctx", "get", "pods", "-A", "-o", "wide"])` with no namespace flag
**And** "Describe a pod" calls `kubectl.pickPod(ctx, ns)` then `runner.runLive("kubectl", [..., "describe", "pod", pod])`; returns early if `pickPod` returns `null`
**And** "Delete a pod" calls `kubectl.pickPod(ctx, ns)`, prompts `confirm({ default: false })`, and only calls `runner.runLive("kubectl", [..., "delete", "pod", pod])` when confirmed; returns early if `pickPod` returns `null`
**And** `pods.test.js` mocks `src/lib/kubectl`, `src/lib/runner`, and `@inquirer/prompts` and asserts:
- `buildPodsCommands` returns exactly 4 commands all with `group: "Pods"`
- "List pods" `run()` calls `runLiveWithOptionalWatch` with `get pods -o wide` and the correct context/namespace flags
- "Delete a pod" `run()` does not call `runLive` when `confirm` resolves `false`
- "Delete a pod" `run()` calls `runLive` with `delete pod {pod}` args when `confirm` resolves `true`
- "Describe a pod" and "Delete a pod" return without calling `runLive` when `pickPod` resolves `null`

---

### Story 3.2: `src/commands/logs.js` — logs command group

As a developer,
I want the Logs command group isolated in one module,
So that log streaming, previous-container logs, and log-to-file can be tested in isolation.

**Acceptance Criteria:**

**Given** `src/commands/logs.js` is created
**When** `buildLogsCommands(ctx, ns)` is called
**Then** it returns command objects each with `{ group: "Logs", name, run }`
**And** when `APP_NAME` is set, a "Stream logs — latest pod" command is included that calls `runner.runLivePipedWithExitKeys` with `logs -f --selector=app={APP_NAME} --tail=100 --max-log-requests=5`
**And** when `APP_NAME` is empty, the selector-based stream command is omitted
**And** "Stream logs — specific pod" calls `kubectl.pickPod(ctx, ns)` then `runner.runLivePipedWithExitKeys` with `logs -f {pod} --tail=200`; returns early if `pickPod` returns `null`
**And** "Previous container logs" calls `kubectl.pickPod(ctx, ns)` then `runner.runLivePiped` with `logs {pod} --previous --tail=300`; returns early if `pickPod` returns `null`
**And** "Dump logs to file" calls `kubectl.pickPod(ctx, ns)`, prompts `input` for line count, constructs a shell command writing to `./logs/{pod}_{timestamp}.log` (with optional jq pipe when jq is available), then calls `shell.spawnInteractive("sh", ["-c", shellCmd])`; calls `output.ok()` on exit code 0, `output.warn()` otherwise
**And** `logs.test.js` mocks `src/lib/kubectl`, `src/lib/runner`, `src/lib/shell`, `src/lib/env`, `src/lib/output`, and `@inquirer/prompts` and asserts:
- when `APP_NAME` is non-empty, `buildLogsCommands` includes the selector-based stream command
- when `APP_NAME` is empty, `buildLogsCommands` omits the selector-based command
- "Stream logs — specific pod" calls `runLivePipedWithExitKeys` with `logs -f {pod} --tail=200`
- "Previous container logs" calls `runLivePiped` with `--previous --tail=300`
- all commands that call `pickPod` return without calling any runner function when `pickPod` resolves `null`

---

### Story 3.3: `src/commands/deployments.js` — deployments command group

As a developer,
I want the Deployments command group isolated in one module,
So that listing, rollout management, rollback, restart, and deployment deletion are testable independently.

**Acceptance Criteria:**

**Given** `src/commands/deployments.js` is created
**When** `buildDeploymentsCommands(ctx, ns)` is called
**Then** it returns command objects each with `{ group: "Deployments", name, run }`
**And** "List deployments" always appears and calls `runner.runLiveWithOptionalWatch("kubectl", [..., "get", "deployments"])`
**And** when `APP_NAME` is set, 5 app-specific commands are included: "Describe deployment", "Rollout status", "Rollout history", "Rollback deployment", "Restart deployment"
**And** when `APP_NAME` is not set, those 5 commands are omitted
**And** "Rollback deployment" and "Restart deployment" each prompt `confirm({ default: false })` before calling `runner.runLive`
**And** "Delete a deployment" always appears, uses `shell.run()` to fetch deployments as JSON, presents a `select` picker, then checks for orphaned ServiceAccounts sharing the same `meta.helm.sh/release-name` annotation and deletes them alongside the deployment after `confirm`
**And** `deployments.test.js` mocks `src/lib/shell`, `src/lib/runner`, `src/lib/env`, and `@inquirer/prompts` and asserts:
- when `APP_NAME` is empty, `buildDeploymentsCommands` returns exactly 2 commands
- when `APP_NAME` is non-empty, `buildDeploymentsCommands` returns exactly 7 commands
- "Delete a deployment" does not call `runLive` when `confirm` resolves `false`
- "Delete a deployment" calls `runLive` for the deployment and for each orphaned ServiceAccount sharing the Helm release-name annotation
- "Delete a deployment" calls `output.warn` and returns when `shell.run` returns JSON with no deployments

---

### Story 3.4: `src/commands/services.js` — services & ingress command group

As a developer,
I want the Services & Ingress command group isolated in one module,
So that service listing, deletion, and service-account management are testable without a live cluster.

**Acceptance Criteria:**

**Given** `src/commands/services.js` is created
**When** `buildServicesCommands(ctx, ns)` is called
**Then** it returns 6 command objects each with `{ group: "Services & Ingress", name, run }`
**And** the commands are: "List services", "Delete service", "List service accounts", "List ingresses", "List VirtualService", "Delete service account"
**And** list commands call `runner.runLiveWithOptionalWatch`
**And** "Delete service" uses `shell.run()` to fetch services as JSON, presents a `select` picker, prompts `confirm({ default: false })`, then calls `runner.runLive("kubectl", [..., "delete", "service", chosen])` when confirmed
**And** "Delete service account" follows the same pattern but for ServiceAccounts
**And** both delete commands call `output.warn(emptyMessage)` and return early when the fetched list is empty
**And** `services.test.js` mocks `src/lib/shell`, `src/lib/runner`, `src/lib/output`, and `@inquirer/prompts` and asserts:
- `buildServicesCommands` returns exactly 6 commands all with `group: "Services & Ingress"`
- "Delete service" calls `runLive` with `delete service {name}` when confirmed
- "Delete service" does not call `runLive` when `confirm` resolves `false`
- "Delete service" calls `output.warn` and returns without prompting when no services are found
- "Delete service account" calls `output.warn` and returns without prompting when no service accounts are found

---

### Story 3.5: `src/commands/config.js` — config command group

As a developer,
I want the Config command group isolated in one module,
So that ConfigMap listing, description, and secrets listing are testable without a live cluster.

**Acceptance Criteria:**

**Given** `src/commands/config.js` is created
**When** `buildConfigCommands(ctx, ns)` is called
**Then** it returns 3 command objects each with `{ group: "Config", name, run }`
**And** the commands are: "List ConfigMaps", "Describe a ConfigMap", "List secrets"
**And** "List ConfigMaps" and "List secrets" call `runner.runLiveWithOptionalWatch`
**And** "Describe a ConfigMap" uses `shell.run()` to fetch ConfigMaps as JSON, presents a `select` picker to choose one, then a second `select` for format ("Table" or "Describe")
**And** when "Table" is chosen, it calls `shell.spawnInteractive("sh", ["-c", cmd])` where `cmd` pipes through `kubectl get configmap {name} -o json | jq` to render key/value pairs as a TSV table
**And** when "Describe" is chosen, it calls `runner.runLive("kubectl", [..., "describe", "configmap", chosen])`
**And** "Describe a ConfigMap" calls `output.warn` and returns early when no ConfigMaps are found
**And** `config.test.js` mocks `src/lib/shell`, `src/lib/runner`, `src/lib/output`, and `@inquirer/prompts` and asserts:
- `buildConfigCommands` returns exactly 3 commands all with `group: "Config"`
- "Describe a ConfigMap" calls `shell.spawnInteractive` with a shell command containing `jq` when "Table" format is selected
- "Describe a ConfigMap" calls `runner.runLive` with `describe configmap {name}` when "Describe" format is selected
- "Describe a ConfigMap" calls `output.warn` and returns without showing any pickers when no ConfigMaps are found

---

### Story 3.6: `src/commands/events.js` — events command group

As a developer,
I want the Events command group isolated in one module,
So that namespace event listing and warning filtering are testable without a live cluster.

**Acceptance Criteria:**

**Given** `src/commands/events.js` is created
**When** `buildEventsCommands(ctx, ns)` is called
**Then** it returns 2 command objects each with `{ group: "Events", name, run }`
**And** the commands are: "Recent events — namespace" and "Warning events only"
**And** "Recent events — namespace" calls `runner.runLive("kubectl", ["--context=ctx", "--namespace=ns", "get", "events", "--sort-by=.lastTimestamp"])`
**And** "Warning events only" calls `runner.runLive("kubectl", ["--context=ctx", "--namespace=ns", "get", "events", "--field-selector=type=Warning", "--sort-by=.lastTimestamp"])`
**And** `events.test.js` mocks `src/lib/runner` and asserts:
- `buildEventsCommands` returns exactly 2 commands both with `group: "Events"`
- "Recent events — namespace" `run()` calls `runLive` with `get events --sort-by=.lastTimestamp` and the correct context/namespace flags
- "Warning events only" `run()` calls `runLive` with `--field-selector=type=Warning` and `--sort-by=.lastTimestamp`

---

### Story 3.7: `src/commands/resources.js` — resource usage command group

As a developer,
I want the Resources command group isolated in one module,
So that CPU/memory usage commands for pods and nodes are testable independently.

**Acceptance Criteria:**

**Given** `src/commands/resources.js` is created
**When** `buildResourcesCommands(ctx, ns)` is called
**Then** it returns 2 command objects each with `{ group: "Resources", name, run }`
**And** the commands are: "Top pods" and "Top nodes"
**And** "Top pods" calls `runner.runLiveWithOptionalWatch("kubectl", ["--context=ctx", "--namespace=ns", "top", "pods"])`
**And** "Top nodes" calls `runner.runLiveWithOptionalWatch("kubectl", ["--context=ctx", "top", "nodes"])` with no namespace flag
**And** `resources.test.js` mocks `src/lib/runner` and asserts:
- `buildResourcesCommands` returns exactly 2 commands both with `group: "Resources"`
- "Top pods" `run()` calls `runLiveWithOptionalWatch` with a namespace flag matching `ns`
- "Top nodes" `run()` calls `runLiveWithOptionalWatch` without any `--namespace` flag

---

### Story 3.8: `src/commands/contexts.js` — contexts command group

As a developer,
I want the Contexts command group isolated in one module,
So that kubeconfig context management and namespace switching are testable without live Azure or cluster connections.

**Acceptance Criteria:**

**Given** `src/commands/contexts.js` is created
**When** `buildContextsCommands(ctx, ns)` is called
**Then** it returns 4 command objects each with `{ group: "Contexts", name, run }`
**And** the commands are: "Refresh contexts", "List all contexts", "Switch current context", "Change namespace"
**And** "Refresh contexts" calls `azure.refreshContexts()` and calls `output.ok("Contexts updated — restart the wizard to use a new context.")` when it returns `true`
**And** "List all contexts" calls `runner.runLive("kubectl", ["config", "get-contexts"])`
**And** "Switch current context" calls `kubectl.getContexts()`, calls `output.warn` and returns early if the list is empty, otherwise presents a `select` picker then calls `runner.runLive("kubectl", ["config", "use-context", target])`
**And** "Change namespace" returns the sentinel string `"change-namespace"` so the main command loop can handle namespace switching
**And** `contexts.test.js` mocks `src/lib/azure`, `src/lib/kubectl`, `src/lib/runner`, `src/lib/output`, and `@inquirer/prompts` and asserts:
- `buildContextsCommands` returns exactly 4 commands all with `group: "Contexts"`
- "Refresh contexts" `run()` calls `azure.refreshContexts()` and calls `output.ok` when it returns `true`
- "Refresh contexts" `run()` does not call `output.ok` when `azure.refreshContexts()` returns `false`
- "Switch current context" calls `runLive` with `config use-context {target}` after selection
- "Switch current context" calls `output.warn` and returns without showing a picker when `getContexts` returns `[]`
- "Change namespace" `run()` resolves to the string `"change-namespace"`

---

### Story 3.9: `src/commands/exec.js` — exec command group

As a developer,
I want the Exec command group isolated in one module,
So that interactive shell and one-off command execution can be tested with mocked pod selection.

**Acceptance Criteria:**

**Given** `src/commands/exec.js` is created
**When** `buildExecCommands(ctx, ns)` is called
**Then** it returns 2 command objects each with `{ group: "Exec", name, run }`
**And** the commands are: "Shell into a pod" and "Run a one-off command in a pod"
**And** "Shell into a pod" calls `kubectl.pickPod(ctx, ns)`, presents a `select` picker with choices `sh` and `bash`, then calls `runner.runLive("kubectl", [..., "exec", "-it", pod, "--", shell])`; returns early if `pickPod` returns `null`
**And** "Run a one-off command in a pod" calls `kubectl.pickPod(ctx, ns)`, prompts `input({ message: "Command (e.g. env):", default: "env" })`, then calls `runner.runLive("kubectl", [..., "exec", pod, "--", "sh", "-c", cmd])`; returns early if `pickPod` returns `null`
**And** `exec.test.js` mocks `src/lib/kubectl`, `src/lib/runner`, and `@inquirer/prompts` and asserts:
- `buildExecCommands` returns exactly 2 commands both with `group: "Exec"`
- "Shell into a pod" calls `runLive` with `exec -it {pod} -- bash` when bash is selected
- "Shell into a pod" calls `runLive` with `exec -it {pod} -- sh` when sh is selected
- both commands return without calling `runLive` when `pickPod` resolves `null`

---

### Story 3.10: `src/commands/helm.js` — helm command group

As a developer,
I want the Helm command group isolated in one module,
So that release listing and deletion are testable with a mocked helm lib.

**Acceptance Criteria:**

**Given** `src/commands/helm.js` is created
**When** `buildHelmCommands(ctx, ns)` is called
**Then** it returns 2 command objects each with `{ group: "Helm", name, run }`
**And** the commands are: "List Helm releases" and "Delete a Helm release"
**And** both commands call `helm.isHelmAvailable()` first and call `output.warn("helm not found — install it with: brew install helm")` and return early if Helm is absent
**And** "List Helm releases" calls `runner.runLive("helm", ["list", "--namespace", ns, "--kube-context", ctx])`
**And** "Delete a Helm release" calls `helm.listHelmReleases(ctx, ns)`, calls `output.warn` and returns early if the list is empty, otherwise presents a `select` picker, prompts `confirm({ default: false })`, then calls `runner.runLive("helm", ["uninstall", "--namespace", ns, "--kube-context", ctx, chosen])` when confirmed
**And** `helm.test.js` mocks `src/lib/helm`, `src/lib/runner`, `src/lib/output`, and `@inquirer/prompts` and asserts:
- `buildHelmCommands` returns exactly 2 commands both with `group: "Helm"`
- when `helm.isHelmAvailable()` returns `false`, both commands call `output.warn` and do not call `runLive`
- "Delete a Helm release" calls `runLive` with `uninstall --namespace {ns} --kube-context {ctx} {release}` when confirmed
- "Delete a Helm release" does not call `runLive` when `confirm` resolves `false`
- "Delete a Helm release" calls `output.warn` and returns without showing a picker when `listHelmReleases` returns `[]`

---

### Story 3.11: `src/commands/ping.js` — ping command group

As a developer,
I want the Ping command group isolated in one module,
So that route discovery, multi-attempt HTTP pinging, and result formatting can be tested with mocked network and kubectl calls.

**Acceptance Criteria:**

**Given** `src/commands/ping.js` is created
**When** `buildPingCommands(ctx, ns)` is called
**Then** it returns 1 command object with `{ group: "Ping", name: "Ping all routes...", run }`
**And** the `run()` function calls `ping.getIngressInfo(ctx, ns)` first; if it returns `null`, falls back to `ping.getVirtualServiceInfo(ctx, ns)`; if both return `null`, prompts `input` for a manual base URL and uses default routes `["/", "/api/health", "/liveness", "/readiness"]`
**And** when an ingress or VirtualService is found, `output.info` is called with the discovered base URL and route count, then `confirm` is presented to accept or override the URL
**And** it calls `ping.pingRoute(url, 3, 5000)` for each route and prints per-attempt results (status code, latency, error) and a summary table with ✓/⚠/✗ icons to `console.log`
**And** `ping.test.js` mocks `src/lib/ping`, `src/lib/output`, and `@inquirer/prompts` and asserts:
- `buildPingCommands` returns exactly 1 command with `group: "Ping"`
- when `getIngressInfo` returns a non-null result, `getVirtualServiceInfo` is not called
- when `getIngressInfo` returns `null` and `getVirtualServiceInfo` returns a non-null result, `input` is not called for a manual URL
- when both return `null`, `input` is called to prompt for a manual URL
- `pingRoute` is called once per discovered route

---

## Epic 4: Wire-up & Integration

**Goal:** Assemble `src/main.js`, thin out `kubectl-wizard.mjs`, and validate the CLI works end-to-end.

**FRs covered:** FR1, FR5, FR7

---

### Story 4.1: `src/main.js` — assemble command groups and main application loop

As a developer,
I want all command groups assembled in a single `src/main.js` module with the full startup sequence and interactive command loop,
So that the CLI application can be wired together from its constituent parts and the entry-point can become a thin shebang wrapper.

**Acceptance Criteria:**

**Given** `src/main.js` is created
**When** imported
**Then** it exports `buildAllCommands(ctx, ns)` which calls all 11 `build*Commands(ctx, ns)` builders in order — Pods, Logs, Deployments, Services, Config, Events, Resources, Contexts, Exec, Helm, Ping — and returns their results concatenated into a single flat array
**And** it imports `isKubectlAvailable`, `getCurrentContext`, `getContexts`, `getNamespaces` from `src/lib/kubectl.js`
**And** it imports `ok`, `warn`, `CYAN`, `YELLOW`, `DIM`, `RESET`, `BOLD`, `RED`, `styleDeleteCommandLabel` from `src/lib/output.js`
**And** it imports `APP_NAME`, `DEFAULT_NAMESPACE`, `DEFAULT_CONTEXT` from `src/lib/env.js`
**And** it imports `refreshContexts`, `isPermissionError`, `showPimReminder` from `src/lib/azure.js`
**And** it imports `RETURN_TO_MENU` from `src/lib/runner.js`
**And** it imports `searchableList` from `src/ui/searchableList.js`
**And** it imports `confirm`, `select`, `input` from `@inquirer/prompts`

**Given** the `main()` function is invoked
**When** `isKubectlAvailable()` returns `false`
**Then** an error message is printed to stderr and `process.exit(1)` is called

**Given** `isKubectlAvailable()` returns `true`
**When** the startup `confirm` prompt resolves `true` (refresh contexts)
**Then** `refreshContexts()` is called before context selection

**Given** context selection
**When** `getContexts()` returns exactly one context
**Then** `select` is not called — the single context is used automatically and `ok(...)` is called to confirm

**Given** context selection
**When** `getContexts()` returns multiple contexts
**Then** `select` is called with choices where contexts matching `DEFAULT_CONTEXT` are sorted to the front and the current context (from `getCurrentContext()`) is labelled `(current)` in its display name

**Given** context selection
**When** `getContexts()` returns `[]`
**Then** `refreshContexts()` is called; if it returns `false` or contexts are still empty after refresh, `process.exit(1)` is called

**Given** namespace selection
**When** `getNamespaces(ctx)` returns a non-empty list
**Then** `select` is called with the `DEFAULT_NAMESPACE`-matching (or `APP_NAME`-matching) namespace floated to the top of the choices list and labelled `(default)`

**Given** namespace selection
**When** `getNamespaces(ctx)` returns `[]`
**Then** `input` is called with `DEFAULT_NAMESPACE` as the default value (not `select`)

**Given** the command loop
**When** iterating
**Then** `buildAllCommands(ctx, currentNamespace)` is called and results are presented via `searchableList` — each command's `name` is passed through `styleDeleteCommandLabel`, each command retains its `group` for separator rendering, and an "Exit wizard" item (no group) is appended at the end

**Given** the command loop
**When** a command's `run()` resolves to `"change-namespace"`
**Then** `getNamespaces(ctx)` is called again and `select` is called for namespace re-selection; `currentNamespace` is updated and the loop continues without prompting "Run another command?"

**Given** the command loop
**When** a command's `run()` resolves to `RETURN_TO_MENU`
**Then** the loop continues immediately without prompting "Run another command?"

**Given** the command loop
**When** a command's `run()` resolves to any other value
**Then** `confirm({ message: "Run another command?", default: true })` is called; if the user declines, the loop exits

**Given** the command loop
**When** a command's `run()` throws an error
**Then** the error message is printed; if `isPermissionError(err.message)` returns `true`, `showPimReminder()` is also called

**Given** the top-level `main()` call
**When** the user presses Ctrl+C (throwing `ExitPromptError`)
**Then** `"Cancelled."` is printed and `process.exit(0)` is called (not `process.exit(1)`)

**Given** `src/main.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures, asserting:
- `buildAllCommands("ctx", "ns")` calls all 11 `build*Commands` mocks with `("ctx", "ns")` and returns their concatenated results in Pods → Ping order
- `buildAllCommands` returns a flat array (not nested arrays)

---

### Story 4.2: Thin entry-point (`kubectl-wizard.mjs`)

As a developer,
I want `kubectl-wizard.mjs` to delegate entirely to `src/main.js`,
So that the binary entry-point is a shebang-only thin wrapper and all application logic lives under `src/`.

**Acceptance Criteria:**

**Given** Story 4.1 is complete and `src/main.js` exists
**When** `kubectl-wizard.mjs` is updated
**Then** its entire content is exactly two lines: `#!/usr/bin/env node` on line 1 and `import './src/main.js';` on line 2 — no other code

**And** running `node kubectl-wizard.mjs` invokes `src/main.js` and launches the wizard identically to before the refactor

**And** `npm test` passes without modification to the test suite

**And** FR7 is satisfied: the entry-point binary contains no application logic and delegates entirely to `src/main.js`

*(No dedicated test file — correctness is verified by the existing passing test suite and a manual smoke-test of `node kubectl-wizard.mjs`.)*

---

## Epic 5: TUI Chrome & Persistent Status Bar

**Goal:** Layer a persistent visual chrome over the CLI without modifying any existing prompt or command logic. The chrome renders a fixed "kue-ball" title bar at the top, a status bar at the bottom carrying the active Azure identity and a live 🔒 auth indicator, and (in the final story) pins the fuzzy-search input above the status bar.

**FRs covered:** FR8, FR9, FR10, FR11

**NFRs covered:** NFR5, NFR6, NFR7

**Dependency:** Epic 4 complete.

---

### Story 5.1: `src/ui/chrome.js` — TUI chrome foundation

As a developer,
I want a chrome module that manages the terminal screen layout with a persistent title bar and status bar,
So that every kue-ball session runs inside a visually bounded shell that is reliably restored on exit.

**Acceptance Criteria:**

**Given** `src/ui/chrome.js` is created
**When** `initChrome()` is called
**Then** the terminal switches to the alternate screen buffer (`\x1b[?1049h`) so the user's prior terminal content is preserved and restored on exit
**And** a title bar reading `kue-ball` is rendered on row 1, bold and centred, with a horizontal divider on row 2
**And** an empty status bar row is reserved at the bottom of the screen (last row), rendered with a contrasting background or colour to visually separate it from the content area
**And** the content area is implicitly rows 3 through `(rows - 2)` — nothing enforces this boundary in this story, but `initChrome` exposes `getContentRows()` returning that count for consumers
**And** a SIGINT handler and `process.on('exit', ...)` listener are registered so `destroyChrome()` is called automatically on any exit path

**When** `destroyChrome()` is called (manually or via exit handler)
**Then** the terminal is restored to the normal screen buffer (`\x1b[?1049l`) and the cursor is made visible (`\x1b[?25h`)

**When** `updateStatusBar(segments)` is called with an array of `{ text, color? }` objects
**Then** the cursor is saved, positioned to the bottom row, the row is cleared (`\x1b[2K`), the segments are written left-to-right with their optional ANSI colour, and the cursor is restored to its prior position
**And** `updateStatusBar` is safe to call before and after `initChrome()` — it is a no-op when chrome is not active

**And** `chrome.test.js` mocks `process.stdout.write` and asserts:
- `initChrome()` emits `\x1b[?1049h` (alternate screen enter)
- `initChrome()` writes a row containing `kue-ball` at row 1
- `destroyChrome()` emits `\x1b[?1049l` (alternate screen exit)
- `updateStatusBar([{ text: 'hello' }])` saves and restores the cursor, clears the bottom row, and writes `hello`
- `updateStatusBar` called before `initChrome()` does not throw and writes nothing

**Technical Notes**

- Prefer direct ANSI escape codes (`process.stdout.write`) over a full TUI library for this story — the approach must not conflict with `@inquirer/prompts` rendering. If the developer determines a thin library is needed (e.g. `ansi-escapes`), the library must be a utility helper only, not a rendering engine that owns the event loop.
- `\x1b[s` / `\x1b[u` or `\x1b[?1049h` save/restore strategies both acceptable; document the choice in a comment.
- The exit handler must guard against double-invocation (`destroyChrome` is idempotent).

---

### Story 5.2: Azure identity panel in status bar

As a user,
I want to see my active Azure account and subscription name in the status bar,
So that I always know which identity I'm operating as without running a separate command.

**Acceptance Criteria:**

**Given** `src/ui/chrome.js` is extended with `loadIdentity()`
**When** `loadIdentity()` is called (by `src/main.js` immediately after `initChrome()`)
**Then** it calls `shell.run('az account show --output json', { silent: true })` and parses the result as JSON
**And** on success, the status bar left section is updated to: `{user.name truncated to 28 chars} · {name truncated to 20 chars}` where `user.name` is the account email and `name` is the subscription name
**And** on failure (null result, JSON parse error, or `az` unavailable), the status bar left section displays `Not signed in`
**And** truncation appends `…` when the source string exceeds the character limit (e.g. `first.last@very-long-…`)
**And** `loadIdentity` calls `updateStatusBar` internally — no direct stdout writes outside the `updateStatusBar` path

**And** `chrome.test.js` asserts:
- when `shell.run` returns a JSON string with `user.name: "dom@contoso.com"` and `name: "my-prod-sub"`, `updateStatusBar` is called with a segment containing `dom@contoso.com · my-prod-sub`
- when `shell.run` returns `null`, `updateStatusBar` is called with a segment containing `Not signed in`
- a `user.name` of 35 characters is truncated to 28 chars + `…` in the rendered segment

**Technical Notes**

- `loadIdentity` is `async` — `main.js` should `await` it before entering the command loop.
- The identity is read once on startup. The auth poller (Story 5.3) handles ongoing freshness signalling via the lock indicator — it does not re-read or re-render the identity string.

---

### Story 5.3: `src/ui/authPoller.js` — background auth health poller

As a user,
I want a 🔒 indicator in the status bar that turns green when Azure auth is healthy and red when it is not,
So that I can see at a glance whether my credentials are still valid throughout my session.

**Acceptance Criteria:**

**Given** `src/ui/authPoller.js` is created
**When** `startAuthPoller(onStatusChange)` is called
**Then** it immediately performs one auth check by calling `shell.run('az account show', { silent: true })`
**And** sets a `setInterval` of 15 000 ms for all subsequent checks
**And** each check is performed asynchronously (wrapped in a Promise / using `setImmediate`) so the Node.js event loop is never blocked

**When** a check returns a non-null result
**Then** `onStatusChange('ok')` is called

**When** a check returns `null` or throws
**Then** `onStatusChange('error')` is called

**When** `stopAuthPoller()` is called
**Then** the interval is cleared and no further `onStatusChange` calls are made

**And** `src/main.js` wires the poller by passing a callback that calls `chrome.setAuthStatus(status)`:
- `setAuthStatus('ok')` renders `🔒` in green (ANSI colour 32) in the status bar right section
- `setAuthStatus('error')` renders `🔒` in red (ANSI colour 31) in the status bar right section
- `setAuthStatus('checking')` renders `🔒` in dim/grey while the initial check runs

**And** `stopAuthPoller()` is called inside `destroyChrome()` (or `main.js` calls it before exit) so no interval outlives the process

**And** `authPoller.test.js` uses `vi.useFakeTimers()` and mocks `shell.run`, asserting:
- on start, the callback is called with `'ok'` synchronously after the first check when `shell.run` returns non-null
- on start, the callback is called with `'error'` when `shell.run` returns `null`
- advancing fake timers by 15 000 ms triggers exactly one additional check
- after `stopAuthPoller()`, advancing the timer does not trigger further callbacks

**Technical Notes**

- The poller must not stack calls: if a check is still in-flight when the interval fires, skip that tick.
- Use a module-level `let intervalId = null` guard and clear before reassigning on `startAuthPoller` to prevent double-start.

---

### Story 5.4: Anchored search input

As a user,
I want the fuzzy-search text input to always appear at the bottom of the screen (just above the status bar) when I'm picking from a list,
So that my eye and cursor position are stable and predictable regardless of result count.

**Acceptance Criteria:**

**Given** `src/ui/searchableList.js` is modified
**When** `searchableList` is invoked while chrome is active (`chrome.isActive()` returns `true`)
**Then** the `pageSize` passed to `@inquirer/search` is calculated as `Math.max(4, chrome.getContentRows() - 3)` — reserving rows for the search label, search input, and the title/divider bar
**And** before invoking `@inquirer/search`, the terminal cursor is positioned to `(totalRows - 3, 1)` so the prompt label renders directly above the status bar and the input field sits at `(totalRows - 2, 1)`
**And** the result list scrolls upward from the input row into the content area

**When** `chrome.isActive()` returns `false`
**Then** the existing `Math.max(8, (process.stdout.rows ?? 24) - 4)` `pageSize` calculation is used unchanged and no cursor repositioning is performed

**And** `searchableList.test.js` asserts:
- when `chrome.isActive()` returns `true` and `process.stdout.rows` is `30`, `pageSize` is `Math.max(4, 30 - 5 - 3)` = `22`
- when `chrome.isActive()` returns `false`, the original `pageSize` calculation is used
- the `source` fuzzy-match callback behaviour is unchanged in both paths

**Technical Notes**

- This story carries the highest implementation risk: `@inquirer/search` positions its own prompt at the current cursor row. Cursor pre-positioning before the `search()` call is the simplest approach and is likely sufficient, but if the library re-homes the cursor on each render cycle, a more involved intercept will be needed. The developer should prototype the cursor approach first and flag to the PM if a deeper change is required before completing the story.
- `chrome.isActive()` is a simple boolean getter exported from `src/ui/chrome.js` — add it in this story if not already present.

---

## Epic 6: Resource × Verb Menu Redesign

**Goal:** Replace the current flat command menu with a two-level navigation: pick a resource type, then pick a verb scoped to that resource. A single resource registry is the source of truth, and universal verbs (list, describe, edit, delete) have one generic implementation that works for any registered resource — eliminating the per-resource-type copy-pasta that dominates `src/commands/*` today. New resource types become a one-line registry entry, and the gaps from `.product_design/kubectl-verbs-reference.md` (StatefulSets, DaemonSets, Jobs, CronJobs, Nodes, HPA, PVC, plus `scale`, `port-forward`, `set image`, node ops, etc.) plug into the framework instead of each requiring a bespoke command builder.

**FRs covered:** FR12, FR13, FR14, FR15, FR16

**NFRs covered:** NFR1 (no regression of existing flows post-migration), NFR4 (each story is independently mergeable: the framework can land before any migration, and migrations are per-resource)

**Dependency:** Epic 5 complete. Epic 6 also depends on the `step()` / `clearContent()` chrome helpers (added post-Epic 5) to render the two-level wizard cleanly.

**Reference:** `.product_design/kubectl-verbs-reference.md` enumerates the verb-per-resource catalog this epic targets.

---

### Story 6.1: `src/lib/resources.js` — resource registry

As a developer,
I want a single registry that maps resource types to their kubectl identifiers, display labels, and supported verbs,
So that menu navigation, verb dispatch, and future-resource additions all read from one source of truth instead of being scattered across command modules.

**Acceptance Criteria:**

**Given** `src/lib/resources.js` is created
**When** imported
**Then** it exports a `RESOURCES` array (or `Map`) of resource entries, plus `getResource(kind)` and `getResources()` helpers
**And** each resource entry has the shape `{ kind, plural, displayName, group, namespaced, universalVerbs, specificVerbs }` where:
- `kind` is the singular kubectl name (e.g. `"pod"`, `"deployment"`)
- `plural` is the kubectl plural (e.g. `"pods"`, `"deployments"`)
- `displayName` is the user-facing label (e.g. `"Pods"`, `"Deployments"`)
- `group` is the menu grouping label (e.g. `"Workloads"`, `"Config"`, `"Networking"`, `"Cluster"`, `"Storage"`) used by `searchableList` separators
- `namespaced` is `true` for namespace-scoped resources, `false` for cluster-scoped (Nodes, ClusterRoles, PVs)
- `universalVerbs` is an array of strings naming verbs from the universal-verb library (subset of `["list", "describe", "edit", "delete"]`)
- `specificVerbs` is an array of strings naming verbs from the specific-verb library (e.g. `["logs", "exec", "scale", "rolloutStatus", "cordon"]`)

**And** the registry includes entries for Pods, Deployments, ReplicaSets, Services, ConfigMaps, Secrets, Ingress, ServiceAccounts (the resources currently covered by `src/commands/*`)
**And** `resources.test.js` asserts:
- every entry has all required fields
- `getResource("pod")` returns the Pods entry
- `getResource("nonexistent")` returns `null` (or `undefined`)
- `getResources()` returns the array in display-order
- no two entries share the same `kind`

---

### Story 6.2: `src/lib/universalVerbs.js` — generic list / describe / delete / edit

As a developer,
I want a single implementation of the four universal verbs that works against any registered resource,
So that adding list/describe/edit/delete for a new resource type is zero-code — it's just adding the verb name to the resource's `universalVerbs` array.

**Acceptance Criteria:**

**Given** `src/lib/universalVerbs.js` is created
**When** imported
**Then** it exports `UNIVERSAL_VERBS`, a mapping from verb name to `{ displayName, handler }`:
- `list` → `displayName: "List"`, handler runs `kubectl get {plural}` (with `-o wide` for namespaced resources where it adds value), via `runLiveWithOptionalWatch`
- `describe` → `displayName: "Describe"`, handler picks a resource instance, then runs `kubectl describe {kind} {name}` via `runLive` and wires the `onEdit` callback so the pager's `e` key triggers `kubectl edit`
- `edit` → `displayName: "Edit"`, handler picks a resource instance, then runs `kubectl edit {kind} {name}` via `spawnInteractive` with `KUBE_EDITOR=nano` (respecting an existing `KUBE_EDITOR` env var)
- `delete` → `displayName: "Delete"`, handler picks a resource instance, prompts `confirm({ default: false })`, then runs `kubectl delete {kind} {name}` via `runLive` when confirmed

**And** it exports `pickResourceInstance(resource, ctx, ns)` — a generic equivalent of `pickPod` that uses `resourcePicker` to fetch `kubectl get {plural} -o json`, present a searchable list with helpful per-row metadata (status/age/owner where available), and return the chosen name
**And** for cluster-scoped resources (`namespaced: false`) the `--namespace` flag is omitted from kubectl calls
**And** each handler signature is `(resource, ctx, ns) => Promise<void>` — same shape across all verbs
**And** `universalVerbs.test.js` mocks `src/lib/runner`, `src/lib/shell`, `src/ui/resourcePicker`, and `@inquirer/prompts`, asserting:
- `list.handler(podsResource, "ctx", "ns")` calls `runLiveWithOptionalWatch` with `["--context=ctx", "--namespace=ns", "get", "pods", "-o", "wide"]`
- `list.handler(nodesResource, "ctx", "ns")` omits `--namespace` (cluster-scoped)
- `describe.handler` calls `pickResourceInstance` and returns early when it resolves `null`
- `delete.handler` does not call `runLive` when `confirm` resolves `false`
- `edit.handler` calls `spawnInteractive("kubectl", ["edit", ...])` with `KUBE_EDITOR` set
- `pickResourceInstance` warns and returns `null` when `kubectl get` produces zero items

---

### Story 6.3: `src/lib/specificVerbs.js` — pod & workload-specific verbs

As a developer,
I want the resource-specific verbs (logs, exec, scale, rollout, set, restart) implemented once in a shared library,
So that Pods/Deployments/ReplicaSets/StatefulSets/DaemonSets all dispatch into the same code paths instead of each command module re-implementing them.

**Acceptance Criteria:**

**Given** `src/lib/specificVerbs.js` is created
**When** imported
**Then** it exports `SPECIFIC_VERBS`, a mapping from verb name to `{ displayName, handler }`, that contains at least:
- `logs` — streams logs for a picked pod via `runLivePipedWithExitKeys` (port of the existing logs commands; respects `APP_NAME` for selector-based tailing)
- `logsPrevious` — `--previous` log dump for a picked pod
- `logsToFile` — dumps logs to a timestamped file under `./logs/`
- `exec` — interactive shell into a picked pod (`sh`/`bash` selector)
- `execOneOff` — one-off command in a picked pod (prompts for the command)
- `scale` — prompts for replica count then runs `kubectl scale {kind}/{name} --replicas=N` (works for Deployments, ReplicaSets, StatefulSets)
- `rolloutStatus`, `rolloutHistory`, `rolloutUndo`, `rolloutRestart`, `rolloutPause`, `rolloutResume` — six dispatchers around `kubectl rollout *` for the picked workload
- `setImage` — prompts for `container=image` and runs `kubectl set image {kind}/{name} {container}={image}`
- `setEnv` — prompts for `KEY=VALUE` and runs `kubectl set env {kind}/{name} {KEY}={VALUE}`
- `top` — `kubectl top {plural}` (works for pods and nodes)
- `portForward` — picks a resource, prompts for `localPort:remotePort`, runs `kubectl port-forward` via the interactive-with-exit-keys runner

**And** each handler has the same `(resource, ctx, ns) => Promise<void>` signature; handlers that operate on a single instance call `pickResourceInstance` internally
**And** confirm/destructive verbs (`scale` to 0, `rolloutUndo`, `setImage`) prompt before executing
**And** `specificVerbs.test.js` mocks runner/shell/inquirer and asserts, for at least four representative verbs, that the correct kubectl invocation is produced and that the pickResourceInstance early-return path is honoured

---

### Story 6.4: Node-specific verbs — cordon, uncordon, drain, taint

As a developer,
I want node-management verbs added to the specific-verb library,
So that node operations are first-class menu actions rather than something users must drop to a shell for.

**Acceptance Criteria:**

**Given** `src/lib/specificVerbs.js` is extended
**When** the registry surfaces a Node resource (`namespaced: false`)
**Then** the following verbs are added to `SPECIFIC_VERBS`:
- `cordon` — picks a node, runs `kubectl cordon {node}`
- `uncordon` — picks a node, runs `kubectl uncordon {node}`
- `drain` — picks a node, prompts `confirm` (drain is disruptive), runs `kubectl drain {node} --ignore-daemonsets --delete-emptydir-data` via `runLivePipedWithExitKeys` so the user can interrupt
- `taint` — picks a node, prompts `input` for the taint spec (e.g. `key=value:NoSchedule`), runs `kubectl taint nodes {node} {spec}`

**And** these verbs honour `resource.namespaced === false` (no `--namespace` flag)
**And** `specificVerbs.test.js` asserts:
- `cordon.handler` calls `runLive` with `["--context=ctx", "cordon", "{node}"]`
- `drain.handler` does not call any runner when `confirm` resolves `false`
- all four verbs use `pickResourceInstance` against a cluster-scoped resource

---

### Story 6.5: Resource → verb menu navigation in `src/main.js`

As a user,
I want the main menu to show a list of resource types first and then a list of verbs for the resource I pick,
So that I can navigate by "what" then "how" — which is how I actually think about kubectl operations — instead of scrolling a flat list of every `{verb} {resource}` combination.

**Acceptance Criteria:**

**Given** `src/main.js` is modified
**When** the command loop iterates
**Then** the flat `buildAllCommands(ctx, ns)` call is replaced with a two-level picker:
1. `step("Choose resource", "Pick a kubernetes resource type to act on.")` followed by a `searchableList` whose items come from `getResources()` grouped by their `group` field (Workloads, Config, Networking, Cluster, Storage)
2. The list also includes top-level entries for **Helm**, **Ping**, **Contexts**, and **Exit** — these are not resource-bound and route to their existing handlers (or sentinel returns like `"change-context"` / `"change-namespace"`)
3. When a resource is chosen, `step("{Resource displayName} — choose action", "...")` shows a `searchableList` of the verbs in `resource.universalVerbs.concat(resource.specificVerbs)`, plus a "← Back to resources" item
4. Choosing a verb invokes its handler; choosing "← Back" returns to the resource picker without exiting the loop
5. After a verb's handler completes, the user is returned to the verb picker for that resource (so multiple operations on the same resource don't require re-picking it). A "← Back" or `q` brings them up to the resource picker.

**And** error handling continues to use `isPermissionError` / `showPimReminder` exactly as before
**And** `main.test.js` is updated to assert:
- the top-level picker is built from `getResources()` plus the Helm/Ping/Contexts/Exit entries
- selecting a resource then a verb calls the verb's handler with `(resource, ctx, ns)`
- the "← Back" sentinel returns the user to the resource picker
- `buildAllCommands` is removed (or no longer used by the main loop)

---

### Story 6.6: Migrate existing command modules into the registry

As a developer,
I want the existing `src/commands/*` modules to be deleted in favour of registry entries,
So that the duplication they represent goes away and the new framework is the only path to user-facing commands.

**Acceptance Criteria:**

**Given** Stories 6.1–6.5 are complete and merged
**When** the migration story runs
**Then** the following resources in the registry are wired with their full verb set, matching today's behaviour or improving on it:
- **Pods** — universal: `list, describe, edit, delete`; specific: `logs, logsPrevious, logsToFile, exec, execOneOff, top, portForward`
- **Deployments** — universal: `list, describe, edit, delete`; specific: `scale, rolloutStatus, rolloutHistory, rolloutUndo, rolloutRestart, rolloutPause, rolloutResume, setImage, setEnv`
- **ReplicaSets** — universal: `list, describe, edit, delete`; specific: `scale`
- **Services** — universal: `list, describe, edit, delete`; specific: `portForward`
- **ConfigMaps** — universal: `list, describe, edit, delete` (the existing "table vs YAML" toggle moves into the describe handler as a sub-prompt, or is dropped if redundant with the pager filter)
- **Secrets** — universal: `list, describe, delete` (no edit by default — flag in a comment that it's intentional)
- **Ingress** — universal: `list, describe, edit, delete`
- **ServiceAccounts** — universal: `list, describe, delete`
- **VirtualService** — universal: `list, describe, delete` (Istio CRD — same generic handlers work)

**And** `src/commands/pods.js`, `logs.js`, `deployments.js`, `services.js`, `config.js`, `events.js`, `resources.js`, `contexts.js`, `exec.js` are deleted along with their tests (the registry + universal/specific verbs now cover the same behaviour)
**And** `src/commands/helm.js` and `src/commands/ping.js` are preserved — they remain top-level entries
**And** `src/commands/events.js` and `src/commands/resources.js` (`top pods` / `top nodes`) are folded into the verb layer: Events shows as a top-level entry (it's namespace-scoped but not really a "resource" in this UX), and `top` becomes a specific verb on Pods and Nodes
**And** `npm test` passes — coverage is preserved or rewritten in `universalVerbs.test.js` / `specificVerbs.test.js` / `resources.test.js`
**And** a manual smoke test of every previously-existing command confirms behavioural parity

---

### Story 6.7: Add new resources — StatefulSets, DaemonSets, Jobs, CronJobs

As a user,
I want StatefulSets, DaemonSets, Jobs, and CronJobs to appear in the resource picker with the verbs that make sense for them,
So that I can manage stateful workloads, daemons, and batch jobs without dropping to a raw shell.

**Acceptance Criteria:**

**Given** the framework from Stories 6.1–6.5 is in place
**When** the registry is extended
**Then** the following resources are added:
- **StatefulSets** — universal: `list, describe, edit, delete`; specific: `scale, rolloutStatus, rolloutHistory, rolloutUndo, rolloutRestart, portForward`
- **DaemonSets** — universal: `list, describe, edit, delete`; specific: `rolloutStatus, rolloutHistory, rolloutUndo, rolloutRestart` (no `scale` — daemonsets run one pod per node)
- **Jobs** — universal: `list, describe, delete`; specific: `logs` (via the pod the job created — handler resolves it)
- **CronJobs** — universal: `list, describe, edit, delete`; specific: `triggerNow` (runs `kubectl create job --from=cronjob/{name} {name}-manual-{timestamp}`)

**And** each new resource is grouped sensibly (StatefulSets/DaemonSets/Jobs/CronJobs under `Workloads`)
**And** existing verb handlers in `specificVerbs.js` are extended only where new behaviour is required (e.g. `triggerNow` is genuinely new; `scale` already works for any `{kind}/{name}`)
**And** `resources.test.js` is extended to cover the new entries

---

### Story 6.8: Add cluster-scoped & storage resources — Nodes, HPA, PVC, PV

As a user,
I want Nodes, HorizontalPodAutoscalers, PersistentVolumeClaims, and PersistentVolumes available in the resource picker,
So that storage and cluster-level inspection is part of the same flow as workload management.

**Acceptance Criteria:**

**Given** the framework and the node-specific verbs from Story 6.4 are in place
**When** the registry is extended
**Then** the following resources are added:
- **Nodes** (cluster-scoped) — universal: `list, describe, edit`; specific: `top, cordon, uncordon, drain, taint` (no `delete` — accidental node deletion is too dangerous)
- **HPA** — universal: `list, describe, edit, delete`
- **PVC** — universal: `list, describe, delete` (no edit — most PVC fields are immutable post-bind)
- **PV** (cluster-scoped) — universal: `list, describe, delete`

**And** each is grouped under `Cluster` (Nodes) or `Storage` (HPA/PVC/PV)
**And** the `pickResourceInstance` helper handles cluster-scoped pickers correctly (no `--namespace` flag in the underlying `kubectl get` call)
**And** `resources.test.js` is extended to assert the new entries' `namespaced` flag and verb sets

---

## Epic 7: Windows Support via WSL2

**Goal:** Officially support Windows users running `kue-ball` under WSL2 (Ubuntu). The CLI itself runs as a Linux binary; WSL handles the kernel and filesystem translation. No native Windows console (PowerShell / `cmd.exe`) work is in scope — that path is explicitly deferred per NFR8.

The work is intentionally small: one round of empirical smoke testing on real WSL, a documentation update so Windows users have a clear install path, and a defensive refactor of `src/lib/shell.js` so the Mac-specific Homebrew/Rancher Desktop PATH additions don't cause confusion or noise on a clean WSL Ubuntu (and don't actively misbehave when, say, `process.env.HOME` is set but no Homebrew is installed).

**FRs covered:** FR17, FR18, FR19

**NFRs covered:** NFR1 (no regression on Mac/Linux), NFR4 (each story independently mergeable), NFR8 (no native Windows)

**Dependency:** Epic 6 complete (the registry/verb architecture is the user-facing surface being verified).

**Out of scope:**

- Native Windows console support (PowerShell 7, Windows Terminal without WSL, `cmd.exe`). The shell pipeline assumptions in `runShell` / `logsToFile`, the chrome's ANSI escape codes, the alternate-screen-buffer dance, and the `setRawMode` keypress handling are all assumed to be tested only inside WSL's Ubuntu environment.
- Windows-specific config directory (`%APPDATA%`). On WSL the existing `~/.config/kue-ball/prefs.json` works because WSL exposes a real Linux filesystem.
- Homebrew tap installation. Linuxbrew on WSL is a separate ecosystem; we recommend `npm install -g .` or `git clone + npm start` for WSL users.

---

### Story 7.1: WSL2 end-to-end smoke test

As a maintainer,
I want a documented round of empirical testing on a real WSL2 + Ubuntu environment,
So that I know which (if any) flows behave differently from the Mac baseline before promising Windows users that the tool works for them.

**Acceptance Criteria:**

**Given** a Windows 11 (or 10 build 19041+) host with WSL2 enabled
**When** the developer installs Ubuntu 22.04 (or later) under WSL2 and runs:
  ```
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
  ```
**Then** all three CLIs (`kubectl`, `helm`, `az`) report a version and the binaries are on `PATH`

**Given** the same WSL2 environment with prerequisites installed
**When** the developer clones the repo and runs `npm install && node src/main.js`
**Then** the splash renders correctly in Windows Terminal (the default WSL host) with all box-drawing characters (`╔ ║ ═`), shading blocks (`░ ▒ ▓ █`), and the rotating gradient visible

**Given** the wizard is at the resource picker
**When** the developer walks the following matrix end-to-end against a real AKS cluster reachable from the WSL environment:
  - **Picker navigation**: fuzzy-search resources, hit `⌫`/`←` to step back from sub-menus, "Exit" cleanly restores the terminal
  - **Universal verbs**: `list` on Pods/Deployments/Services, `describe` on a Pod with `e` to launch `kubectl edit`, `delete` on a test resource with confirm prompt
  - **Specific verbs**: `logs` on a Pod (stream + `q` to exit), `exec` into a Pod (both success and Forbidden paths to verify the auth-error page renders), `scale` on a Deployment
  - **Top-level extras**: Helm list, Ping (against an Ingress route), Events recent, Context / Namespace switch
  - **Auth flow**: at least one verified Forbidden error from a namespace the user lacks RBAC on, confirming the auth-error warning page renders correctly
**Then** every flow behaves identically to the Mac baseline, OR each deviation is documented as a known caveat in story Completion Notes

**Given** the smoke test runs cleanly
**When** the developer also exercises:
  - Resize: resize the Windows Terminal window mid-session; chrome re-centres splash/menus
  - Ctrl+C: exits cleanly with alternate screen restored, prompt returns
  - Foreground vs background WSL tabs: behaviour identical
**Then** no terminal corruption, lingering escape codes, or scroll-region artefacts are observed when returning to the parent shell

**And** any deviations are captured in `docs/wsl2-known-caveats.md` (created if needed) with terminal version, Ubuntu version, and steps to reproduce. If no deviations: the file is created with a single line stating "no known caveats as of {DATE}".

---

### Story 7.2: README — Windows install path via WSL2

As a Windows user,
I want a clear step-by-step install guide in the README,
So that I can get `kue-ball` running without guessing whether it's supposed to work on Windows in the first place.

**Acceptance Criteria:**

**Given** the README is updated
**When** the user reaches the "Install" section
**Then** a new subsection titled "Windows (via WSL2)" appears alongside the existing Homebrew / npm / dev install methods, with:
  - A one-sentence statement that native Windows (PowerShell, cmd) is not supported and WSL2 is the supported path
  - Numbered install steps: enable WSL2 (`wsl --install`), install Ubuntu from the Microsoft Store or `wsl --install -d Ubuntu`, open the Ubuntu shell, install Node ≥22, install `kubectl`, install `helm` (optional), install `az` (optional, for context refresh), clone the repo and `npm install`, run `npm start` or `node src/main.js`
  - A note that Windows Terminal (the default WSL host on Win 11) renders the TUI correctly; legacy `conhost.exe` is not supported
  - A link to `docs/wsl2-known-caveats.md` (from Story 7.1)

**Given** the README's "Requirements" section
**When** the user reads it
**Then** Windows is listed alongside macOS as a supported platform, with the clarification "via WSL2 — see Install → Windows"

**Given** the README's "Upgrading" section
**When** a Windows-on-WSL user reads it
**Then** the section notes that the Homebrew upgrade path does not apply on WSL — instead, `git pull && npm install` in the cloned repo, or re-run the `npm install -g .` install command

**And** none of these additions break the existing Homebrew / npm / dev install paths or change their wording beyond what's necessary to add the Windows option.

---

### Story 7.3: Defensive cross-platform PATH handling in `src/lib/shell.js`

As a developer,
I want `buildEnv()` in `src/lib/shell.js` to use platform-aware path delimiters and only add extra PATH entries that actually exist,
So that a clean WSL Ubuntu install (where Homebrew and Rancher Desktop don't exist) doesn't accumulate dead path entries — and so a future native-Windows attempt has one fewer hard-coded POSIX-ism to remove.

**Acceptance Criteria:**

**Given** `src/lib/shell.js` is modified
**When** `buildEnv()` runs on macOS (the existing baseline)
**Then** the resulting `PATH` contains `~/.rd/bin`, `/opt/homebrew/bin`, and `/usr/local/bin` prepended (separated by `:`), exactly as today — zero behavioural change on Mac

**Given** `src/lib/shell.js` is modified
**When** `buildEnv()` runs on Linux (including WSL2 Ubuntu)
**Then** the resulting `PATH` contains only `/usr/local/bin` (the one POSIX entry that's actually relevant on Linux), prepended with `:`. The Mac-specific `~/.rd/bin` and `/opt/homebrew/bin` entries are NOT added (their absence has no negative effect, and their presence as dead paths is a minor lint-level smell)

**Given** the implementation
**When** the developer inspects `shell.js`
**Then** the path delimiter is read from `node:path`'s `path.delimiter` (NOT a hard-coded `:`), so a hypothetical future Windows port would only need to extend the platform branch, not re-find the separator

**Given** the implementation
**When** `buildEnv()` runs on win32 (a future maintainer's hypothetical run)
**Then** the function returns `process.env` unchanged with no extra paths prepended — i.e. it doesn't actively break, but doesn't add Mac-specific paths either

**Given** `src/lib/shell.test.js` is updated
**When** the test suite runs
**Then** the existing macOS expectations still pass (test runs on macOS in CI), and new test cases assert:
  - When `os.platform()` is mocked to `"linux"`, only `/usr/local/bin` is prepended
  - When `os.platform()` is mocked to `"win32"`, no extra paths are prepended (PATH equals process.env.PATH)
  - When `os.platform()` is mocked to `"darwin"`, the existing three entries are prepended in the documented order

**And** no other file in `src/lib/` needs modification — this story is intentionally contained to `shell.js` + its test.

**Technical Notes**

- The change is small (~10 lines). The point is the test surface and the documented intent, not the runtime delta.
- `node:os.platform()` returns `"darwin" | "linux" | "win32"` reliably. Don't over-engineer with a feature-detection approach — a switch on platform is correct here.
- Don't add the Windows path branch as part of this story. Story 7.3's goal is to make `buildEnv()` *safe* on win32 (returns env unchanged), not to enable win32 — that's NFR8 territory and would be a follow-up epic.

---
