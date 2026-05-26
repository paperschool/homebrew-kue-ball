---
epic: 3
story: 4
status: done
---

# Story 3.4: `src/commands/services.js` — services & ingress command group

## User Story

As a developer,
I want the Services & Ingress command group isolated in one module,
So that service listing, deletion, and service-account management are testable without a live cluster.

## Context

This group covers all service-layer resources: Services, ServiceAccounts, Ingresses, and VirtualServices. The two list-all commands (`services`, `serviceaccounts`, `ingresses`, `virtualservice`) are thin wrappers over `runner.runLiveWithOptionalWatch`. The two delete commands ("Delete service" and "Delete service account") follow the same spinner → fetch → select → confirm → delete pattern and must handle the empty-list case with an early `output.warn` return.

## Acceptance Criteria

**Given** `buildServicesCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 6 objects all with `group: "Services & Ingress"`

**Given** any of the four list commands is invoked
**When** it executes
**Then** `runner.runLiveWithOptionalWatch` is called with the appropriate `get` sub-command

**Given** "Delete service" `run()` is invoked and `shell.run` returns JSON with no services
**When** it executes
**Then** `output.warn` is called with a message referencing the namespace and no picker is shown

**Given** "Delete service" `run()` is invoked, services are found, and `confirm` resolves `false`
**When** it executes
**Then** `runner.runLive` is never called

**Given** "Delete service" `run()` is invoked, services are found, and `confirm` resolves `true`
**When** it executes
**Then** `runner.runLive` is called with `"kubectl"` and args including `"delete"`, `"service"`, chosenServiceName

**Given** "Delete service account" `run()` is invoked and `shell.run` returns JSON with no service accounts
**When** it executes
**Then** `output.warn` is called and no picker is shown

**Given** "Delete service account" `run()` is invoked, service accounts are found, and `confirm` resolves `true`
**When** it executes
**Then** `runner.runLive` is called with args including `"delete"`, `"serviceaccount"`, chosenSAName

**Given** `src/commands/services.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildServicesCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                                | Source              |
| ------------------------------------- | ------------------- |
| `runLive`, `runLiveWithOptionalWatch` | `../lib/runner.js`  |
| `run`                                 | `../lib/shell.js`   |
| `warn`                                | `../lib/output.js`  |
| `select`, `confirm`                   | `@inquirer/prompts` |

## Technical Notes

- Mock `shell.run` to return JSON strings representing Kubernetes list responses: `JSON.stringify({ items: [...] })`
- The spinner/clear pattern (`process.stdout.write` + `"\r\x1b[2K"`) is inlined in each delete command — test output assertions for `process.stdout.write` are optional; focus on the logic assertions
- `confirm` calls use `{ default: false }` on both delete commands
