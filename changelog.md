# Changelog

## v2.0.10 — 2026-05-28

- **Extras submenus (Helm / Ping / Events / Context-Namespace) now loop back to themselves after an action completes**, mirroring how the resource verb menu has always worked. Previously, running a single Helm command would dump the user back to the top-level resource picker — the user had to drill back into "Helm" between each action. New `BACK_TO_MAIN` sentinel returned by `runLegacySubmenu` when the user picks Back; main loop wraps the extras handling in a `while (stayInExtra)` so context/namespace sentinel switches still propagate via `handleSentinel`. Storage resources (HPA / PVs / PVCs) already used the resource-verb loop, so they were already correct.
- **`helm list` / `list pending` / `list failed` no longer silently bounce when there are zero matching releases.** `helm list` with no results emits just a header line, which the pager treats as trivial and prints without waiting — combined with the submenu-loop fix above, the user got teleported back to the menu with nothing on screen. Each list variant now pre-checks via `helm list -o json` with the matching filter; zero hits → `warn("No … releases found in namespace X")` + `info("Press any key to return.")` + `waitForKeypress()`. Same treatment applied to the existing zero-releases path in `Delete a Helm release` (it was warning then silently bouncing). `listHelmReleases(ctx, ns, extraFlags = [])` now accepts an optional flags array so pending/failed filters compose.
- **New network / connectivity error page** for DNS / dial-tcp / VPN failures (`isNetworkError` classifier in `azure.js` matches `no such host`, `dial tcp`, `cluster unreachable`, `unable to resolve`, `i/o timeout`, `connection refused`, `getaddrinfo`, `ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`, etc.). Renders in red with an X-cross ASCII art and a "Are you connected to the network / VPN…?" prompt. Snippet picker pulls the most informative connectivity line from the captured stderr. Wired into `_runCaptured` and the interactive `exec` path. **Network check runs before the permission check** so a kubelogin "failed to get token … no such host" routes to the connectivity page instead of the PIM/auth checklist — sends users to the right fix.
- **Chrome bars now tint to match the active error page**: amber bg for the auth/permission page (`setAlertLevel("warning")`), red bg for the network page (`setAlertLevel("error")`), reverted on dismiss. `_activeBarBg()` / `_activeSep()` route every bar-paint through the alert state, so title bar, status bar, and chrome resize-redraws all stay in sync. Defaults back to dark steel blue when no alert is active.
- **Status bar no longer renders one column short** when the auth-status lock was visible. The lock glyph `🔒` is a UTF-16 surrogate pair (`.length === 2` in JS) but renders as 1 cell in some terminals, so `lockPlain.length` (used to reserve right-side space) over-counted by one. Replaced with `●` (U+25CF) — single-cell across every monospace terminal, conventional status-indicator shape. New regression test ("only emits single-cell glyphs on the right side") fails for any code point above U+FFFF so a future emoji can't reintroduce the same bug.
- **Ctrl+C now shows an exit-confirm interstitial** instead of being silently swallowed or inconsistently dismissing pages. Root cause: in raw mode, Node delivers `\x03` as a regular byte (not a `SIGINT` signal), and each handler decided what to do with it differently — the pager treated it as a quit key, error pages as any-key-dismiss, etc. New `confirmExit()` page in chrome.js renders a green/white emergency-exit pictogram (45×11 ASCII art, per-character colored) with a `${BOLD}${GREEN}` "Exit kue-ball?" header. Enter or a second Ctrl+C confirms; Esc / Backspace / ← cancels. The chrome bars neutralize to default-blue while the confirm is up so an underlying warning/error tint doesn't visually compete (alert level is saved + restored on cancel). The exit-pictogram note is conditional — only renders when there are ≥1 spare rows so the page never overflows into the status bar on 24-row terminals. Wired into:
  - **`pager.js`** — Ctrl+C dropped from `QUIT_KEYS`; new handler detaches its own listener, yields stdin to `confirmExit`, then either exits or redraws the pager (and re-disables line wrap, which the page restored).
  - **`waitForKeypress`** — falls back to any-key dismiss when the user cancels the exit confirm.
  - **`showAuthErrorPage`** / **`showNetworkErrorPage`** — render extracted into local `render()` so they can replay themselves on cancel; alert tint is restored automatically by `confirmExit`.
  - **`main.js`** — new `withExitConfirm()` wraps every `searchableList` call (resource picker, verb picker, legacy-submenu picker, `pickContext`, `pickNamespace`). Verb / extras handlers catch `ExitPromptError` from inner inquirer prompts (`confirm`/`input`/`select`) and step back one level (verb picker / submenu picker) on cancel — re-running the verb from scratch would re-fetch resources, which is the wrong UX for a cancel.
  - Out of scope (deliberate): streaming `kubectl logs -f` / `port-forward` / `drain` still treat Ctrl+C as "kill the child, return to menu". Once back at the menu, another Ctrl+C triggers the confirm.

## v2.0.9 — 2026-05-27

- Fixed "crashes without error" symptom on exit paths from the menu (e.g. after `Refresh contexts`). The chrome's alternate-screen buffer was being restored on shutdown BEFORE error messages could be written to it, so `console.error`/`console.log` output for failures, prompt-cancellations, and other forced exits was silently wiped — the user saw a clean shell prompt with no indication of what went wrong. `main()`'s top-level catch now calls `destroyChrome()` BEFORE printing, so errors land in the terminal's main buffer and survive. `pickContext()`'s two "still no contexts" exit paths and `checkPrerequisites()`'s "kubectl not found" exit get the same treatment.
- Errors now also print the first few stack-trace lines (in dim) when available, so an async-throw failure (e.g. inside `refreshContexts`) is diagnosable rather than just a single-line message.

## v2.0.8 — 2026-05-27

- README gets a "Windows (via WSL2)" install subsection (Story 7-2) with the full 8-step setup, a prominent footgun warning to clone into `~/dev/...` not `/mnt/c/...`, the Windows Terminal note, and a link to `docs/wsl2-known-caveats.md`. Also a new "Run inside Docker (Mac dev shortcut)" subsection pointing at `npm run docker:start`. Intro + Requirements + Upgrading sections all updated to call out Windows-via-WSL2 as supported.
- New `docs/wsl2-known-caveats.md` (Story 7-1, partial) — placeholder caveats file with Docker-proxy verifications documented and explicit "not yet verified" list for items still needing a real Windows + WSL2 host. Story 7-1 stays `in-progress` until someone with a Windows box walks Tasks 1-7 of the smoke test plan.
- sprint-status updates: Story 7-2 → review, Story 7-3 → review, Story 7-1 stays in-progress with a note. Epic 7 → in-progress.

## v2.0.7 — 2026-05-27

- `src/lib/shell.js` `buildEnv()` is now platform-aware via `os.platform()` and `path.delimiter` (Story 7-3). On `darwin` it still prepends `~/.rd/bin` + `/opt/homebrew/bin` + `/usr/local/bin` (unchanged). On `linux` (incl. WSL2 Ubuntu) it prepends only `/usr/local/bin` — no dead Mac paths. On `win32` it returns `process.env` unchanged. Self-contained refactor; +3 tests (376 total).

## v2.0.6 — 2026-05-27

- Fixed the **actual** cause of `npm run docker:start` failing with `/bin/sh: no such file or directory`: the kubelogin install step was unzipping from WORKDIR `/`, so the archive's top-level `bin/linux_<arch>/` directory landed under `/bin/`. The subsequent `rm -rf bin/` then wiped `/bin` entirely (including `/bin/sh`), breaking every later RUN. Moved the extraction to `/tmp` so relative paths resolve safely. The previous v2.0.5 platform-flag removal was a non-fix (correct platform handling, but not the root bug).

## v2.0.5 — 2026-05-27

- Fixed `npm run docker:start` failing mid-build on Apple Silicon with a misleading `/bin/sh: no such file or directory` during the helm install step. Root cause: forcing `linux/amd64` ran the image under Rosetta/QEMU emulation, which flakes on multi-process bash pipes. Dropped the `--platform=linux/amd64` from both `Dockerfile.wsl-test` and the docker run/build commands — now uses the host's native architecture (arm64 on Apple Silicon, amd64 on Intel). The Linux behaviour kue-ball cares about is identical between the two.
- Dockerfile is now arch-aware: kubectl and kubelogin downloads use `dpkg --print-architecture` to pick the right binary. az CLI installs via Microsoft's apt repo (which supports both amd64 and arm64 on jammy) instead of the curl-pipe-bash installer.

## v2.0.4 — 2026-05-27

- New `npm run docker:start` builds and runs kue-ball inside an Ubuntu 22.04 amd64 container with Node 22 + kubectl + kubelogin + helm + az + jq pre-installed. Mounts the repo, `~/.kube`, and `~/.azure` so you can hit real clusters from inside the container. Lets a Mac dev approximate the WSL2 Ubuntu environment for Epic 7 smoke testing without a Windows box (~70% coverage; misses Windows Terminal-specific quirks).
- New `Dockerfile.wsl-test` at the repo root defines the test image; `scripts/docker-start.sh` is the entrypoint that auto-builds on first run and uses a named volume for `node_modules` so the Linux build doesn't clobber the host's macOS one.

## v2.0.3 — 2026-05-27

- Streaming logs (`Stream logs`, `Previous container logs`) now suspends the chrome's alternate-screen buffer during the stream and restores it on exit, so the terminal's native scrollback (mouse wheel, Cmd+scroll, etc.) works while streaming. Arrow keys no longer trigger exit — only bare ESC / `q` / `Q` / Ctrl+C do.
- `Dump logs to file` now holds an interstitial showing the saved path until the user presses any key. Previously the path message was wiped by the next menu render and the user had no idea where the file went.
- Pod `delete` now appends `--timeout=10s` so the menu returns quickly even when `terminationGracePeriodSeconds` (or a stuck finalizer) would otherwise hang the call. The confirm prompt also notes that pods are declarative — the controller recreates them immediately, so "delete pod" is effectively a restart. Non-pod deletes are unchanged.

## v2.0.2 — 2026-05-27

- New Epic 7 in `planning-artifacts/epics.md`: **Windows Support via WSL2**. Adds FR17 / FR18 / FR19 (WSL install, README docs, defensive PATH handling), NFR8 (native Windows console explicitly out of scope), and three stories.
- Three ready-for-dev story files under `implementation-artifacts/`: 7-1 (WSL2 end-to-end smoke test), 7-2 (README — Windows install path via WSL2), 7-3 (defensive cross-platform PATH handling in `shell.js`).
- `sprint-status.yaml` registers Epic 7 (backlog) and its three stories (ready-for-dev).

## v2.0.1 — 2026-05-27

- Forbidden / Unauthorized errors from interactive `kubectl exec` now route to the auth-error warning page instead of being wiped by the menu re-render. Added `spawnInteractiveCapturingStderr` in shell.js (tees stderr to terminal AND captures it) and an `onStderr` option on runLive; exec post-processes the captured text against `isPermissionError` and dispatches to `showAuthErrorPage` when matched.
- Renamed `Change namespace` → `Switch namespace` in the Context / Namespace sub-menu so it aligns with `Switch current context`.
- Renamed top-level `Contexts` → `Context / Namespace` so fuzzy-searching for "namespace" surfaces the entry (its submenu owns the namespace switch).
- New `waitForKeypress()` helper in chrome.js for any-key dismissal, used as the fallback when `exec` exits non-zero without a permission error.

## v2.0.0 — 2026-05-27

**Resource × Verb menu redesign.** The flat command list is gone; the wizard now navigates by resource type first, then verb. A single resource registry drives the menu, so adding a new kubernetes resource is a one-line entry rather than a bespoke command module.

- **Two-level menu.** Pick a resource (Pods, Deployments, ConfigMaps, Nodes, PVCs, etc.), then pick an action. Backspace or `←` steps back. Verb labels are colour-coded: red `delete`, yellow `edit`, blue `logs*`, green `exec*`.
- **17 registered resources** across Workloads / Config / Networking / Cluster / Storage. Cluster-scoped resources auto-omit `--namespace` from every kubectl call.
- **4 universal verbs** (list / describe / edit / delete) and **21 specific verbs** (logs, exec, scale, full rollout family, port-forward, set image/env, top, cordon/drain/taint, triggerNow). Press `e` in the describe pager to launch `kubectl edit`.
- **Authentication error page** — when kubectl fails with Forbidden / 401 / 403 / etc., a yellow warning page replaces the raw stderr with a clear "are you logged into Azure, PIM activated, on the correct network?" prompt.
- **TUI polish** — splash with a slowly revolving white→blue gradient, anchored search bar, prereq output locked to the bottom of the screen.
- Removed 20 legacy `src/commands/*` modules in favour of the registry + universal/specific verb libraries; Helm, Ping, Events, and Contexts preserved as top-level extras.

## v1.13.2 — 2026-05-27

- Rewrote `.github/prompts/version-and-commit.prompt.md` to pick the right Conventional Commits type per change (feat / fix / refactor / style / perf / test / docs / chore) instead of always using `chore(release):`.
- Commits now carry a body of 2-3 bullets mirroring the changelog entry verbatim, so `git log --format=full` and `git show <sha>` are self-explanatory without opening the changelog.
- Added explicit do/don't examples and guidance to NOT default to `chore` (reserve it for genuine tooling-only changes).

## v1.13.1 — 2026-05-27

- Auth-error page swaps the `⚠ ⚠ ⚠` box for a small 4-row ASCII warning triangle (`/\`, `/  \`, `/ !! \`, `‾‾‾‾‾‾`), centred in yellow above the header. Same dismiss flow.

## v1.13.0 — 2026-05-27

- **Authentication / permission error page.** When a captured `kubectl` command exits non-zero and its output matches `isPermissionError` (Forbidden, Unauthorized, 401/403, access denied, etc.), the runner now shows a centred yellow warning page instead of paging the raw stderr. The page displays an ASCII warning box, the salient error line, and a checklist prompt: "Are you logged into Azure, with PIM activated, on the correct network?" Press any key to dismiss.

## v1.12.4 — 2026-05-27

- Splash animation now actually visible at launch: inserted a 300ms idle window between `drawSplash()` and `checkPrerequisites()` so the gradient gets 3-4 smooth frames of motion before the synchronous `execSync` probes start blocking the event loop. Without this, the user only saw a single ~200ms hold per probe and perceived the splash as frozen at startup.

## v1.12.3 — 2026-05-26

- Prereq check output (`✓ kubectl/helm/az found`) is now locked to the bottom of the screen — anchored to `rows() - 4` rather than parked right under the splash. The buffer is exactly large enough that the third trailing `\n` lands on `rows() - 1` (the row directly above the status bar) without crossing the scroll-region bottom, so the splash doesn't get bumped up.

## v1.12.2 — 2026-05-26

- **Splash redesign.** Letter faces now run a four-tier shading gradient — solid white `█` (sparse) → light-blue ▒ (lightest blue, 256-colour 153) → ▓ (lighter blue, 117) → solid █ (light blue, 75). Depth/edge glyphs (`╗ ║ ╚ ═` etc.) shift from dark steel to the same light blue 75 so the dense face fuses with the shadow. The "By Ono Sendai Runner" byline is bright white.
- **Gradient revolves.** The shading axis rotates once every 8 seconds (80ms frames) while the splash is on screen, so the four bands sweep around the letter faces. First frame fires via `setImmediate` so motion is visible immediately. Animation stops automatically on `hideSplash()` / `destroyChrome()`. Cursor is saved/restored each frame so prereq prints below the splash aren't disturbed.
- **Splash holds for ~2 seconds** after startup checks complete so the title actually has a moment to be seen.
- **`checkPrerequisites()` is async** — yields the event loop between each kubectl/helm/az probe via `await new Promise(r => setImmediate(r))`, so the gradient keeps revolving through the (sync `execSync`) prereq checks rather than freezing.
- **No more one-row bump.** Cursor now parks immediately below the art (not anchored to `rows() - 3`), so `console.log("✓ X found")` newlines can't push past the scroll-region bottom and trigger a scroll that shifts the splash. Animation tick also defensively wipes two rows above the splash to clean up any stray remnants.

## v1.12.1 — 2026-05-26

- `exec` and `execOneOff` verb labels now render green (interactive-into-the-container, distinct from blue read-only `logs*`).
- Verb picker drops the redundant `? Action:` inline prompt header — the `step()` title above (`X — choose action`) already names the operation, so the inline prompt is just noise. The list of verbs renders directly below the step header.

## v1.12.0 — 2026-05-26

- **Back-nav by keyboard.** In any sub-picker (verb picker, Helm / Ping / Events / Contexts sub-menus), hitting backspace against an empty search input or left arrow returns to the parent menu. The bottom hint line now reads `↑↓ navigate · ⏎ select · ⌫/← back`.
- **Colour-coded verb labels.** `delete` is red, `edit` is yellow, `logs` / `logsPrevious` / `logsToFile` are blue. Match is on the verb key so renaming `displayName` doesn't break the colouring.
- `← Back` list items in sub-pickers now render dim grey to deemphasise them next to the actual actions.

## v1.11.0 — 2026-05-26

- Resource registry now exposes **Nodes** under a new "Cluster" group and **HPA / PVC / PV** under "Storage". All four use the existing universal/specific verb handlers; cluster-scoped resources (Nodes, PV) auto-omit `--namespace`.
- Nodes deliberately omits `delete` (accidentally deleting a node on a managed cluster doesn't decommission the VM and just causes confusion). PVC deliberately omits `edit` (most fields are immutable post-bind).
- `top nodes` returns — regression from story 6-6's command-module cleanup is now closed.

## v1.10.0 — 2026-05-26

- Resource registry gains **StatefulSets, DaemonSets, Jobs, CronJobs** under the Workloads group; CronJobs picks up a new `triggerNow` verb (`kubectl create job --from=cronjob/...`).
- `logs` verb now resolves a Job's underlying pod via `--selector=job-name=...` before streaming; warns if the pod is gone or if `logs` is invoked on an unsupported kind.
- StatefulSets get the full workload toolkit (scale + rollout family + portForward); DaemonSets omit scale (one-pod-per-node by design); Jobs omit edit (most fields immutable).

## v1.9.0 — 2026-05-26

- Resource registry now carries the full verb sets for all 9 resources (Pods/Deployments/ReplicaSets/ConfigMaps/Secrets/Ingress/ServiceAccounts/Services + the newly added VirtualService). The two-level menu drives every command through the universal/specific verb libraries.
- Deleted 20 legacy `src/commands/*` files (pods, logs, deployments, services, config, events, resources, contexts, exec, replicasets and their tests). Helm and Ping are preserved as top-level extras.
- Events and Contexts surface as inline top-level extras in the main menu; `top nodes` is temporarily unavailable until story 6-8 registers Nodes.

## v1.8.0 — 2026-05-26

- Main menu switched to two-level navigation: pick a resource (from the registry), then pick a verb (universal or specific). `← Back to resources` returns to the resource picker; the resource → verb loop stays on the same resource between actions.
- Helm, Ping, Contexts, and Exit live as top-level extras alongside the resource list (existing `buildHelmCommands`/`buildPingCommands`/`buildContextsCommands` still drive their sub-menus until story 6-6's migration).
- Sentinel handling (`RETURN_TO_MENU`, `change-context`, `change-namespace`) preserved through the new flow.

## v1.7.0 — 2026-05-26

- Added node-management specific verbs to `SPECIFIC_VERBS`: `cordon`, `uncordon`, `drain` (with confirm + exit-keys streaming), and `taint` (regex-validated spec).
- All four omit `--namespace` because they only register on cluster-scoped resources.

## v1.6.0 — 2026-05-26

- Added `src/lib/specificVerbs.js` — 16 workload-specific verb handlers: `logs / logsPrevious / logsToFile`, `exec / execOneOff`, `scale` (with zero-replicas confirm), the six `rollout*` verbs (status / history / undo / restart / pause / resume), `setImage` / `setEnv`, `top`, and `portForward`.
- All verbs accept any registry resource: cluster-scoped resources (e.g. Nodes) auto-omit `--namespace`; `top` works on both pods and nodes.
- Destructive verbs (`scale` to 0, `rolloutUndo`, `rolloutRestart`, `setImage`) prompt before executing.

## v1.5.0 — 2026-05-26

- Added `src/lib/universalVerbs.js` — the generic `list / describe / edit / delete` verb handlers that work against any registered resource, plus `pickResourceInstance(resource, ctx, ns)` (a generic equivalent of `pickPod`).
- Cluster-scoped resources (e.g. Nodes, PVs) are handled correctly: `--namespace` is omitted from every kubectl call when `resource.namespaced === false`.
- `describe` keeps the existing edit-from-pager wiring (`e` key launches `kubectl edit` with `KUBE_EDITOR` honoured).

## v1.4.1 — 2026-05-26

- Pinned Pods first within the Workloads group of the resource registry (most-used kubectl resource); everything else stays alphabetical. Updated story 6-1's AC #5, the ordering test, and story 6-7's Workloads ordering rule to match.

## v1.4.0 — 2026-05-26

- Added `src/lib/resources.js` — the resource registry that will back the upcoming two-level (resource → verb) menu. Ships with the 8 resources currently covered by `src/commands/*` (Pods, Deployments, ReplicaSets, ConfigMaps, Secrets, Ingress, ServiceAccounts, Services), each with kind/plural/displayName/group/namespaced and universal/specific verb arrays.
- Registry is loaded at import time with a duplicate-kind invariant; `getResource(kind)` returns `null` on miss.
- Story 6-1 marked `review`. No menu or command-module changes yet — those land in stories 6-2 through 6-6.

## v1.3.3 — 2026-05-26

- Created enriched story files for Epic 6 stories 6-1 through 6-8 (Resource × Verb Menu Redesign) under `.product_design/implementation-artifacts/`.
- Marked Epic 6 in-progress and flipped all 8 stories to `ready-for-dev` in sprint-status.yaml.

## v1.3.2 — 2026-05-26

- Expanded Epic 6 (Resource × Verb Menu Redesign) breakdown in planning artifacts and seeded sprint-status tracking for stories 6-1 through 6-8.
- Added `.github/prompts/version-and-commit.prompt.md` for repeatable changelog-driven version bumps.

## v1.3.1 — 2026-05-26

- README hero swapped to a side-by-side two-screenshot layout showing the home interface and the list interface, plus added a platform note.

## v1.3.0 — 2026-05-26

- Helm command group now exposes "List pending Helm releases" and "List failed Helm releases" for quick triage of stuck deployments.

## v1.2.0 — 2026-05-26

- New `step()` chrome helper renders titled wizard pages with a clean content area; context picker, namespace picker, and Azure refresh now use it.
- Azure refresh is now a true multi-select cluster picker (toggle clusters, confirm selection) and the subscription picker uses the same live page-size as the main menu.
- Startup probes report detected versions of `kubectl`, `helm`, and `az CLI` alongside the existing availability checks.

## v1.1.0 — 2026-05-26

- Pager `e` keybinding now launches `kubectl edit` for the resource you are describing, with `KUBE_EDITOR` honoured (falls back to `nano`).
- `runLive` and `spawnInteractive` thread an `onEdit` callback / `env` option so any describe command can opt into edit mode.
- Wired Pods, Deployments, ReplicaSets, and ConfigMaps describe commands to the new edit flow.
