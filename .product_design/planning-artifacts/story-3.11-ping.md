---
epic: 3
story: 11
status: review
files:
  - src/commands/ping.js
  - src/commands/ping.test.js
---

# Story 3.11: `src/commands/ping.js` — ping command group

## User Story

As a developer,
I want the Ping command group isolated in one module,
So that route discovery, multi-attempt HTTP pinging, and result formatting can be tested with mocked network and kubectl calls.

## Context

This is the most complex single command in the codebase. It has a three-stage discovery fallback: (1) try `ping.getIngressInfo(ctx, ns)`, (2) if null try `ping.getVirtualServiceInfo(ctx, ns)`, (3) if both null prompt for a manual URL. Discovered routes are confirmed with the user before pinging begins. Each route is pinged 3 times with a 5 s timeout via `ping.pingRoute(url, 3, 5000)`. Results are printed per-attempt then summarised with ✓/⚠/✗ icons.

All three discovery paths and `pingRoute` are already implemented in `src/lib/ping.js` (Story 1.9). This story only extracts the command wiring.

## Acceptance Criteria

**Given** `buildPingCommands(ctx, ns)` is called
**When** the return value is inspected
**Then** it contains exactly 1 object with `group: "Ping"`

**Given** the "Ping all routes" `run()` is invoked and `ping.getIngressInfo` returns a non-null result
**When** it executes
**Then** `ping.getVirtualServiceInfo` is never called

**Given** the "Ping all routes" `run()` is invoked, `ping.getIngressInfo` returns `null`, and `ping.getVirtualServiceInfo` returns a non-null result
**When** it executes
**Then** `input` is never called for a manual URL

**Given** the "Ping all routes" `run()` is invoked and both `getIngressInfo` and `getVirtualServiceInfo` return `null`
**When** it executes
**Then** `input` is called to prompt for a manual base URL

**Given** a base URL and routes are determined (by any discovery path)
**When** `run()` executes
**Then** `ping.pingRoute` is called exactly once per route with `(url, 3, 5000)`

**Given** `ping.pingRoute` resolves for each route
**When** results are printed
**Then** `output.info` is called with the discovered base URL and `console.log` is called for per-attempt lines and the summary table

**Given** `src/commands/ping.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export function buildPingCommands(ctx, ns)
// returns: Array<{ group: string, name: string, run: () => Promise<any> }>
```

## Dependencies

| Import                                                 | Source              |
| ------------------------------------------------------ | ------------------- |
| `getIngressInfo`, `getVirtualServiceInfo`, `pingRoute` | `../lib/ping.js`    |
| `info`, `warn`                                         | `../lib/output.js`  |
| `confirm`, `input`                                     | `@inquirer/prompts` |

## Technical Notes

- Mock `../lib/ping` to control all three functions independently
- Mock `@inquirer/prompts` `confirm` to resolve `true` (accept discovered URL) in the happy-path tests
- The summary table output (✓/⚠/✗ icons, avg ms) uses `console.log` — spy on `console.log` if you want to assert summary content, but focus tests on the discovery logic and `pingRoute` call count
- Default routes when discovery fails: `["/", "/api/health", "/liveness", "/readiness"]` — assert `pingRoute` is called 4 times in the manual-URL test
