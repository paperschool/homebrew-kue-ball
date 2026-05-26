---
epic: 1
story: 4
status: review
---

# Story 1.4: `src/lib/env.js` — environment constants

## User Story

As a developer,
I want env-var constants exported from one place,
So that `APP_NAME`, `DEFAULT_NAMESPACE`, and `DEFAULT_CONTEXT` are not scattered across modules.

## Context

These three constants are read from `process.env` at startup and used across command definitions, the main loop, and the Azure flow. Centralising them makes the contract explicit and testable.

## Acceptance Criteria

**Given** `src/lib/env.js` exists
**When** `KUBECTL_WIZARD_APP` is not set in the environment
**Then** `APP_NAME` is an empty string `""`

**Given** `KUBECTL_WIZARD_NAMESPACE` is not set
**When** `DEFAULT_NAMESPACE` is read
**Then** it equals `"default"`

**Given** `KUBECTL_WIZARD_CONTEXT` is not set
**When** `DEFAULT_CONTEXT` is read
**Then** it is an empty string `""`

**Given** `env.test.js` is run via Vitest
**When** all tests execute
**Then** all pass — env vars are set/unset per test using `vi.stubEnv`

## Exports

```js
export const APP_NAME         // process.env.KUBECTL_WIZARD_APP ?? ""
export const DEFAULT_NAMESPACE // process.env.KUBECTL_WIZARD_NAMESPACE ?? "default"
export const DEFAULT_CONTEXT   // process.env.KUBECTL_WIZARD_CONTEXT ?? ""
```

## Technical Notes

- Use `vi.stubEnv` (Vitest built-in) to set env vars in tests — no need for `dotenv`
- These are module-level constants evaluated at import time; tests should use `vi.resetModules()` between cases that need different env values
