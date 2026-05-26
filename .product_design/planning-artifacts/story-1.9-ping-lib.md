---
epic: 1
story: 9
status: review
---

# Story 1.9: `src/lib/ping.js` — HTTP ping & route discovery

## User Story

As a developer,
I want ping logic and ingress/VirtualService route extraction in one module,
So that they can be tested with mocked `fetch` and mocked kubectl output, without a live cluster or network.

## Context

`pingRoute` uses the native `fetch` API with `AbortController`. `getIngressInfo` and `getVirtualServiceInfo` parse complex Kubernetes JSON objects. Both are well-suited to unit testing with deterministic inputs.

## Acceptance Criteria

**Given** `fetch` is mocked to return `{ status: 200 }` for 3 attempts
**When** `pingRoute(url, 3, 5000)` is called
**Then** it returns 3 result objects each with `ok: true`, a valid `ms`, and `status: 200`

**Given** `fetch` is mocked to throw an `AbortError`
**When** `pingRoute(url, 1, 5000)` resolves
**Then** the result has `ok: false` and `error` contains the string `"timeout"`

**Given** `shell.run` is mocked to return a valid ingress JSON string with one rule and two paths
**When** `getIngressInfo(ctx, ns)` is called
**Then** it returns `{ baseUrl: <expected>, routes: [<de-duplicated paths>] }`

**Given** `shell.run` is mocked to return `null`
**When** `getIngressInfo(ctx, ns)` is called
**Then** it returns `null` (no throw)

**Given** `ping.test.js` is run via Vitest
**When** all tests execute
**Then** all pass with 0 failures

## Exports

```js
export async function pingRoute(url, attempts = 3, timeoutMs = 5000)
export function getIngressInfo(ctx, ns)
export function getVirtualServiceInfo(ctx, ns)
```

## Technical Notes

- Mock `fetch` globally using `vi.stubGlobal('fetch', mockFn)`
- `getIngressInfo` also appends `/liveness` and `/readiness` if not already present — assert this behaviour explicitly
- Test the de-duplication logic: two ingress paths that normalise to the same string should appear once in `routes`
