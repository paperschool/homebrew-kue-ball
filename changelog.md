# Changelog

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
