# Changelog

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
