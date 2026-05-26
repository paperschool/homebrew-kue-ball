# Changelog

All notable changes to this project are documented in this file.
This project uses [Keep a Changelog](https://keepachangelog.com/) conventions and
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-05-26

- Persistent TUI chrome (alternate screen): title bar with `ctx:` / `ns:` labels, two-line `Last command:` block showing both the menu label and the actual kubectl command wrapped in light blue, a `Search:` line, dividers, and a status bar with az identity, an animated (async) auth-check spinner, and a footer progress bar that fills the gap during streaming commands.
- Splash screen with two-tone ANSI-Shadow art (bright faces, darker shadow edges), re-centred on terminal resize.
- Searchable list prompt built on `@inquirer/core` with reactive `pageSize`, query mirrored to the header `Search:` line, and live resize reflow.
- Built-in scrollable pager for command output — vertical and horizontal scroll, `/` grep filter with a sticky column header, full reflow on resize; auto-engages for any multi-line output.
- Capture-and-page wiring across the runner (get/describe/logs/configmap/etc.); live streaming preserved for `exec -it`, watch, and `logs -f`.
- Round-based ping: hits every discovered ingress/VirtualService route once per round with a 1s delay, streams per-attempt results, shows the full URLs, and records the kubectl discovery in the header.
- Context handling: refresh saves every cluster under a collision-safe unique name and persists its subscription; live `Switch context` re-prompts namespace and updates the footer subscription without restarting; the footer subscription now tracks the current cluster.
- Startup setup phase: kubectl (required), helm, and az CLI probes — the Azure refresh prompt is gated on `az` being present.
- New menu commands: ReplicaSets (list/describe/scale/delete); Resources additions — per-container top sorted by CPU/memory, pod requests & limits, and a pod usage-vs-requests join.
- 333-test vitest suite covering the chrome, pager, searchable list, runner, ping, contexts and resource views; reference doc at `.product_design/kubectl-verbs-reference.md`.
