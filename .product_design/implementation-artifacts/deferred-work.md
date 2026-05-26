# Deferred Work

## Deferred from: code review of stories 1.1–1.10 (2026-05-21)

- `shell.js:run()` silently returns null on all errors — intentional per story 1.5 AC; consider adding a debug-mode logging hook in a future story if silent swallowing causes operational blind spots.
- `prefs.js:savePrefs()` silent I/O failure (`/* non-fatal */`) — accepted design for a non-critical preference store; a future story could add a `warn()` call so the user knows if preferences failed to save.
- `ping.js` hardcodes `/liveness` and `/readiness` probe paths appended to every route list — explicitly spec'd in story 1.9 AC; revisit in a future story to make the probe path list configurable per deployment.
- `shell.js:buildEnv()` is reconstructed on every `run()` call (copies `process.env` each time) — micro-optimisation; extract to module-level constant in a future refactor story.
- `kubectl.js:isKubectlAvailable()` uses `which kubectl` instead of a kubectl-native probe (`kubectl version --client`) — behavioural inconsistency with `isAzCliAvailable` and `isHelmAvailable`; low risk, address in a future quality story.
- `ping.js:getVirtualServiceInfo` scheme detection assumes `https` for any non-localhost host — Istio VirtualServices do not carry TLS config at VS level (it lives at the Gateway); accepted limitation for the current story scope.
- `ping.js:pingRoute` with `attempts <= 0` or `timeoutMs <= 0` returns empty array or immediate timeout — no AC covers these boundary values; add input validation in a future story if the function is exposed via a public API.
- `runner.js:withWatchFlag` with null/undefined args — internal function always called from `runLiveWithOptionalWatch` which guarantees an array; guard not required by current AC.

## Deferred from: code review of stories 2.1–2.3 (2026-05-21)

- `searchableList.js`: `items` param not guarded against `null`/`undefined` — internal CLI module; callers always supply a valid array; YAGNI applies.
- `searchableMultiSelect.js`: `items` param not guarded against `null`/`undefined` — same rationale as above.

## Deferred from: code review of stories 3.1–3.10 (2026-05-21)

- `config.js`: `spawnInteractive` result not checked in "Describe a ConfigMap" table path — no AC requires exit-code handling for this command; spec gap; add `output.ok`/`output.warn` in a future story if feedback on jq/column failure is desired.
- `helm.js`: `listHelmReleases(ctx, ns)` called without `await` — correct for the current synchronous implementation; if the function is ever made async, the empty-list guard (`releases.length === 0`) would silently fail and the select/uninstall path would throw. Add a comment or JSDoc marking the sync contract.
