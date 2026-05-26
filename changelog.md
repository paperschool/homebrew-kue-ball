# Changelog

## v1.1.0 — 2026-05-26

- Pager `e` keybinding now launches `kubectl edit` for the resource you are describing, with `KUBE_EDITOR` honoured (falls back to `nano`).
- `runLive` and `spawnInteractive` thread an `onEdit` callback / `env` option so any describe command can opt into edit mode.
- Wired Pods, Deployments, ReplicaSets, and ConfigMaps describe commands to the new edit flow.
