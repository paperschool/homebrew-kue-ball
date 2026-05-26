---
epic: 5
story: 2
status: review
files:
  - src/ui/chrome.js
  - src/ui/chrome.test.js
  - src/main.js
---

# Story 5.2: Azure identity panel in status bar

## User Story

As a user,
I want to see my active Azure account and subscription name in the status bar,
So that I always know which identity I'm operating as without running a separate command.

## Context

Story 5.1 established the chrome frame with an empty status bar. This story populates the left section of that bar with the Azure identity read from `az account show`. The identity is loaded once on startup — it is a snapshot, not a live feed (the auth poller in Story 5.3 handles ongoing health signalling via the lock indicator).

`az account show --output json` returns a JSON object whose relevant fields are `user.name` (typically an email address) and `name` (the subscription display name). Both are truncated to keep the status bar compact.

## Acceptance Criteria

**Given** `src/ui/chrome.js` is extended with `loadIdentity()`
**When** `loadIdentity()` is called
**Then** it calls `shell.run('az account show --output json', { silent: true })` and attempts to `JSON.parse` the result
**And** on a successful parse, it constructs the identity string: `{truncate(user.name, 28)} · {truncate(name, 20)}` where `truncate(str, n)` returns `str.slice(0, n) + '…'` when `str.length > n`, otherwise `str` unchanged
**And** on any failure path (null result, JSON parse error, missing fields, `az` not installed), it uses the fallback string `Not signed in`
**And** the identity string is stored internally and passed as the first segment to `updateStatusBar` so the existing status bar update path is used

**When** `getIdentitySegment()` is called (a new exported getter)
**Then** it returns the last identity string set by `loadIdentity()`, or `''` if `loadIdentity` has not yet been called — this allows the auth poller (Story 5.3) to compose the full status bar line alongside the lock indicator

**And** `src/main.js` is updated to call `await chrome.loadIdentity()` immediately after `initChrome()` and before entering the command loop

**And** `chrome.test.js` asserts:
- when `shell.run` returns `'{"user":{"name":"dom@contoso.com"},"name":"my-prod-sub"}'`, the segment text is `dom@contoso.com · my-prod-sub`
- when `user.name` is `'first.last@very-long-company-domain.com'` (39 chars), it is truncated to 28 chars + `…` in the segment
- when `name` is `'my-very-long-subscription-name-here'` (36 chars), it is truncated to 20 chars + `…`
- when `shell.run` returns `null`, the segment text is `Not signed in`
- when `shell.run` returns unparseable JSON, the segment text is `Not signed in`
- `getIdentitySegment()` returns `''` before `loadIdentity()` is called

## Technical Notes

- `loadIdentity` is `async` — `main.js` must `await` it before the command loop starts so the identity is present from the first render.
- Do not store the full parsed JSON — only the computed display string needs to be retained.
- The `·` separator character is U+00B7 (middle dot), not a hyphen or pipe.
- The `…` truncation character is U+2026 (horizontal ellipsis), not three periods.
