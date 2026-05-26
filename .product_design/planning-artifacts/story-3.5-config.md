---
epic: 3
story: 5
status: done
---

# Story 3.5: `src/commands/config.js` — config command group

## User Story

As a developer,
I want the Config command group isolated in one module,
So that ConfigMap listing, description, and secrets listing are testable without a live cluster.

## Context

The Config group manages ConfigMaps and Secrets. "List ConfigMaps" and "List secrets" are simple pass-throughs to `runLiveWithOptionalWatch`. "Describe a ConfigMap" is more involved: it fetches all ConfigMaps via `shell.run()`, presents a `select` picker, then presents a second `select` for the display format — "Table" (renders key/value pairs via a `jq` pipeline) or "Describe" (runs `kubectl describe configmap`).

The table format command is a raw shell pipeline: `kubectl ... get configmap {name} -o json | jq -r '.data | to_entries | (["KEY","VALUE"], map([.key,.value])[]) | @tsv' | column -t -s $'\t'`. This is passed directly to `shell.spawnInteractive("sh", ["-c", cmd])`.

## Acceptance Criteria

**Given** `buildConfigCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 3 objects all with `group: "Config"`: "List ConfigMaps", "Describe a ConfigMap", "List secrets"

**Given** "List ConfigMaps" `run()` is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with args including `"get"`, `"configmaps"`

**Given** "List secrets" `run()` is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with args including `"get"`, `"secrets"`

**Given** "Describe a ConfigMap" `run()` is invoked and `shell.run` returns JSON with no ConfigMaps
**When** it executes
**Then** `output.warn` is called and no picker is shown

**Given** "Describe a ConfigMap" `run()` is invoked, ConfigMaps are found, and the "Table" format is selected
**When** it executes
**Then** `shell.spawnInteractive` is called with `"sh"` and `["-c", cmd]` where `cmd` contains `"jq"` and `"column"`

**Given** "Describe a ConfigMap" `run()` is invoked, ConfigMaps are found, and the "Describe" format is selected
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and args including `"describe"`, `"configmap"`, chosenName

**Given** `src/commands/config.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildConfigCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                                | Source              |
| ------------------------------------- | ------------------- |
| `runLive`, `runLiveWithOptionalWatch` | `../lib/runner.js`  |
| `run`, `spawnInteractive`             | `../lib/shell.js`   |
| `warn`                                | `../lib/output.js`  |
| `select`                              | `@inquirer/prompts` |

## Technical Notes

- The two `select` calls in "Describe a ConfigMap" are sequential — first pick the ConfigMap, then pick the format. Mock `select` with `vi.fn().mockResolvedValueOnce(chosenName).mockResolvedValueOnce("table")` for the table-format test
- The `column` command is not available in all environments — the pipeline is constructed as a string and passed to `sh -c` so the test just needs to assert the string contains `"jq"` and `"column"`, not execute it
