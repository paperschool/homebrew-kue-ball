# kue-ball — Modularisation PRD

## Goal

Split the monolithic `kubectl-wizard.mjs` into logical, testable modules with shared UI components. Every module must have regression tests (kubectl/az commands mocked).

---

## Task Breakdown

### Phase 1 — Project structure & tooling
- [ ] 1. Install Vitest, set up `package.json` scripts, add `src/` folder structure
- [ ] 2. `src/lib/output.js` — colours, `ok`/`warn`/`info`/`header`/`printCommand`/`stripAnsi`

### Phase 2 — Pure logic modules
- [ ] 3. `src/lib/prefs.js` — load/save preferences
- [ ] 4. `src/lib/env.js` — env var constants (`APP_NAME`, `DEFAULT_NAMESPACE`, `DEFAULT_CONTEXT`)
- [ ] 5. `src/lib/shell.js` — `run()`, `spawnInteractive()`, `spawnInteractiveWithExitKeys()`
- [ ] 6. `src/lib/kubectl.js` — `getContexts()`, `getNamespaces()`, `getCurrentContext()`, `isKubectlAvailable()`
- [ ] 7. `src/lib/azure.js` — `listSubscriptions()`, `listAksClusters()`, `refreshContexts()`, permission error helpers
- [ ] 8. `src/lib/helm.js` — `isHelmAvailable()`, `listHelmReleases()`
- [ ] 9. `src/lib/ping.js` — `pingRoute()`, `getIngressInfo()`, `getVirtualServiceInfo()`
- [ ] 10. `src/lib/runner.js` — `runLive()`, `runLivePiped()`, `runLivePipedWithExitKeys()`, watch helpers

### Phase 3 — Reusable UI components
- [ ] 11. `src/ui/searchableList.js` — shared fuzzy `search` with grouped separators (command menu, context picker, cluster picker)
- [ ] 12. `src/ui/searchableMultiSelect.js` — `checkbox` that inherits the same fuzzy filtering
- [ ] 13. `src/ui/resourcePicker.js` — generic "fetch → spinner → pick" used by pods, deployments, services, etc.

### Phase 4 — Command groups
- [ ] 14. `src/commands/pods.js`
- [ ] 15. `src/commands/logs.js`
- [ ] 16. `src/commands/deployments.js`
- [ ] 17. `src/commands/services.js`
- [ ] 18. `src/commands/config.js`
- [ ] 19. `src/commands/contexts.js`
- [ ] 20. `src/commands/exec.js`
- [ ] 21. `src/commands/helm.js`
- [ ] 22. `src/commands/ping.js`

### Phase 5 — Wire up
- [ ] 23. `src/main.js` — entry point, imports all command groups
- [ ] 24. Update `kubectl-wizard.mjs` to just `import './src/main.js'`

---

## Engineering Standards

All development must comply with the standards defined in [`project-context.md`](./project-context.md). Key standards applicable to this project:

- **File size** — no source file exceeds 150 lines of non-test code (§4)
- **Naming** — camelCase functions with verb phrases; SCREAMING_SNAKE_CASE constants; no generic names (`data`, `result`, `temp`) (§3)
- **No magic strings/numbers** — all sentinel values and constants are named exports (§5)
- **Testing** — mockist (London School) approach; mock at the `shell.js` boundary; never touch real I/O in unit tests (§10)
- **Self-documenting code** — no explanatory comments; names communicate intent; no commented-out code (§6)
- **Git** — Conventional Commits; branches scoped to one story; PRs linked to a ticket (§11)

---

## Design Decisions

### UI components
- All searchable lists use `searchableList.js` — fuzzy match + grouped separators are a shared concern
- Multi-select (subscription picker) uses `searchableMultiSelect.js` which wraps `@inquirer/prompts` `checkbox` with the same fuzzy source pattern
- Any "fetch resource then pick from list" flow (pods, deployments, services, etc.) uses `resourcePicker.js` — handles the spinner, empty-state warning, and `select` call consistently
- this is not exhaustive lets keep abstracting

### Testing strategy
- Framework: Vitest
- `execSync` and `spawnSync` are mocked at the `src/lib/shell.js` boundary — nothing below that layer touches the real shell
- UI prompts (`@inquirer/prompts`) are mocked where needed; command `run()` functions are tested by asserting what kubectl/az args they produce, not by running them
- Each module has a co-located test file: `src/lib/kubectl.test.js`, `src/commands/pods.test.js`, etc.
