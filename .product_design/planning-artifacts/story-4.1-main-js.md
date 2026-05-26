---
epic: 4
story: 1
status: review
files:
  - src/main.js
  - src/main.test.js
---

# Story 4.1: `src/main.js` — assemble command groups and main application loop

## User Story

As a developer,
I want all command groups assembled in a single `src/main.js` module with the full startup sequence and interactive command loop,
So that the CLI application can be wired together from its constituent parts and the entry-point can become a thin shebang wrapper.

## Context

This is the integration story that wires together Epics 1–3. `src/main.js` replaces the `main()` function and `buildCommands()` function that currently live inside `kubectl-wizard.mjs`. It imports the 11 command-group builders from `src/commands/` and all supporting modules from `src/lib/` and `src/ui/`, then orchestrates the startup sequence and the interactive command loop.

The startup sequence is:
1. Print header (`kue-ball — kubectl Wizard`, optional app suffix from `APP_NAME`)
2. Check kubectl availability — exit 1 if absent
3. Optionally refresh Azure contexts (`confirm` prompt, default `false`)
4. Context selection: auto-select if one context; `select` picker if many; trigger refresh if none
5. Namespace selection: `select` picker (preferred NS floated to top) or `input` fallback if no namespaces
6. Command loop: `searchableList` with all 11 command group builders, grouped by `cmd.group`, "Exit wizard" appended ungrouped

### Sentinel values from `src/lib/runner.js`

- `RETURN_TO_MENU` — returned by `runLivePipedWithExitKeys`; loop continues without "Run another command?" prompt
- `"change-namespace"` — returned by the Contexts "Change namespace" command; re-fetches namespaces and re-prompts

### Key wiring decisions

- `buildAllCommands(ctx, ns)` is a named export so it can be tested independently of the interactive `main()` function
- The top-level `main().catch(...)` call is the module's side effect — `kubectl-wizard.mjs` exploits this by simply importing the file
- Command names are passed through `styleDeleteCommandLabel` when building the `searchableList` items so "delete" appears in red
- `ExitPromptError` (Ctrl+C anywhere in the prompt chain) is caught at the top level and results in `process.exit(0)` — not an error

## Acceptance Criteria

**Given** `src/main.js` is created
**When** `buildAllCommands("ctx", "ns")` is called
**Then** it calls all 11 `build*Commands("ctx", "ns")` in order (Pods → Logs → Deployments → Services → Config → Events → Resources → Contexts → Exec → Helm → Ping)
**And** returns a single flat array of all their results concatenated in that order

**Given** the `main()` function is invoked
**When** `isKubectlAvailable()` returns `false`
**Then** an error message referencing `brew install kubectl` is printed to stderr and `process.exit(1)` is called before any prompt is shown

**Given** `isKubectlAvailable()` returns `true`
**When** the startup confirm prompt resolves `true`
**Then** `azure.refreshContexts()` is called before context selection proceeds

**Given** context selection
**When** `kubectl.getContexts()` returns exactly `["my-context"]`
**Then** `select` is not called — `"my-context"` is used automatically and `ok(...)` confirms the selection

**Given** context selection
**When** `kubectl.getContexts()` returns `["a", "b", "c"]` and `DEFAULT_CONTEXT` is `"b"`
**Then** `select` is called with `"b"` appearing first in the choices list

**Given** context selection
**When** `kubectl.getContexts()` returns `[]` and `refreshContexts()` also results in no contexts
**Then** `process.exit(1)` is called

**Given** namespace selection
**When** `kubectl.getNamespaces(ctx)` returns a non-empty list containing `DEFAULT_NAMESPACE`
**Then** `select` is called with the `DEFAULT_NAMESPACE` entry floated to the top and labelled `(default)`

**Given** namespace selection
**When** `kubectl.getNamespaces(ctx)` returns `[]`
**Then** `input` is called with `DEFAULT_NAMESPACE` as the default (not `select`)

**Given** the command loop runs one iteration
**When** a command's `run()` resolves to `RETURN_TO_MENU`
**Then** `confirm("Run another command?")` is NOT called and the loop immediately presents the command menu again

**Given** the command loop runs one iteration
**When** a command's `run()` resolves to `"change-namespace"`
**Then** `kubectl.getNamespaces(ctx)` is called again and `select` is presented for namespace re-selection

**Given** the command loop runs one iteration
**When** a command's `run()` throws an error whose message contains `"forbidden"`
**Then** `azure.isPermissionError` detects it and `azure.showPimReminder()` is called

**Given** the top-level `main()` catch handler
**When** the thrown error has `name === "ExitPromptError"`
**Then** `process.exit(0)` is called (clean Ctrl+C exit)

**Given** `src/main.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildAllCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>

// main() is called as a module side-effect — not exported
```

## Dependencies

| Import                                                                                   | Source                      |
| ---------------------------------------------------------------------------------------- | --------------------------- |
| `buildPodsCommands`                                                                      | `./commands/pods.js`        |
| `buildLogsCommands`                                                                      | `./commands/logs.js`        |
| `buildDeploymentsCommands`                                                               | `./commands/deployments.js` |
| `buildServicesCommands`                                                                  | `./commands/services.js`    |
| `buildConfigCommands`                                                                    | `./commands/config.js`      |
| `buildEventsCommands`                                                                    | `./commands/events.js`      |
| `buildResourcesCommands`                                                                 | `./commands/resources.js`   |
| `buildContextsCommands`                                                                  | `./commands/contexts.js`    |
| `buildExecCommands`                                                                      | `./commands/exec.js`        |
| `buildHelmCommands`                                                                      | `./commands/helm.js`        |
| `buildPingCommands`                                                                      | `./commands/ping.js`        |
| `isKubectlAvailable`, `getCurrentContext`, `getContexts`, `getNamespaces`                | `./lib/kubectl.js`          |
| `ok`, `warn`, `CYAN`, `YELLOW`, `DIM`, `RESET`, `BOLD`, `RED`, `styleDeleteCommandLabel` | `./lib/output.js`           |
| `APP_NAME`, `DEFAULT_NAMESPACE`, `DEFAULT_CONTEXT`                                       | `./lib/env.js`              |
| `refreshContexts`, `isPermissionError`, `showPimReminder`                                | `./lib/azure.js`            |
| `RETURN_TO_MENU`                                                                         | `./lib/runner.js`           |
| `searchableList`                                                                         | `./ui/searchableList.js`    |
| `confirm`, `select`, `input`                                                             | `@inquirer/prompts`         |

## Technical Notes

- `buildAllCommands` is exported so `main.test.js` can test the assembly logic in isolation without invoking the interactive `main()` function
- The `main.test.js` focus is `buildAllCommands`: mock all 11 builders, call `buildAllCommands("ctx", "ns")`, assert each builder was called with `("ctx", "ns")` and the return is their concatenated output in the correct order
- The interactive `main()` function is validated end-to-end by Story 4.2's smoke test — unit tests for `main()` are out of scope given the complexity of mocking an async interactive loop
- The `main().catch(...)` top-level call is the ESM entry-point side-effect; this is intentional and is what `kubectl-wizard.mjs` relies on when it imports this file
- File must stay under 150 lines (§4 of engineering standards) — if it exceeds this, extract a `selectContext(allContexts, currentCtx)` and `selectNamespace(ctx)` helper into private functions within the same file
- The `"change-namespace"` sentinel is a plain string literal defined locally; `RETURN_TO_MENU` is imported from `src/lib/runner.js`
- When no namespaces are returned from `getNamespaces`, fall back to `input({ message: "Namespace:", default: DEFAULT_NAMESPACE })` — this mirrors the original behaviour for restricted clusters
