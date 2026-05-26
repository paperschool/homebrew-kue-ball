# kubectl Verbs Reference

> Reference for potential new kue-ball commands. Captures the common kubectl verbs
> per resource type, the tool's current coverage, and the gaps that could become features.
> Created 2026-05-22.

## Universal verbs (work on almost any resource type)

Apply to pods, deployments, services, configmaps, secrets, ingress, nodes, namespaces,
jobs, PVCs, CRDs, etc.

| Verb | What it does |
|------|--------------|
| `get` | List/show — `-o wide`, `-o yaml`, `-o json`, `--watch` |
| `describe` | Human-readable detail + recent events |
| `create` | Create from file/flags |
| `apply` | Declarative create/update (`-f`) |
| `delete` | Remove |
| `edit` | Open in `$EDITOR`, apply on save |
| `patch` | Targeted field update (strategic / merge / json) |
| `replace` | Replace the whole object (`-f`) |
| `label` / `annotate` | Add/remove labels / annotations |
| `explain` | Show the schema/docs for the type |
| `wait` | Block until a condition (`--for=condition=Ready`) |

## Verbs by resource type (the distinctive ones)

**Pods** — `logs` (`-f`, `--previous`, `-c`), `exec` (`-it`), `attach`, `port-forward`, `cp`, `debug`, `top`

**Deployments** — `scale`, `rollout` (`status` / `history` / `undo` / `restart` / `pause` / `resume`), `set` (`image` / `env` / `resources`), `autoscale`, `expose`, `port-forward`

**StatefulSets** — `scale`, `rollout` (`status` / `history` / `undo` / `restart`), `port-forward`

**DaemonSets** — `rollout` (`status` / `history` / `undo` / `restart`) — no `scale` (one pod per node)

**ReplicaSets / ReplicationControllers** — `scale`, `autoscale`, `expose`

**Services** — `expose` (create one), `port-forward`

**ConfigMaps / Secrets** — `create` (`--from-literal` / `--from-file`); Secrets also `create secret generic|docker-registry|tls`

**Ingress** — mostly universal (`get` / `describe` / `edit`)

**Nodes** — `top`, `cordon`, `uncordon`, `drain`, `taint`, `label`

**Namespaces** — `create`, `delete`; switch via `kubectl config set-context --current --namespace=…`

**Jobs / CronJobs** — `create job --from=cronjob/<name>` (manual trigger), `logs` (via the pod)

**HPA / PVC / PV / ServiceAccounts** — largely universal (`get` / `describe` / `delete`; SA also `create`)

## Compound verbs

- **`rollout`**: `status`, `history`, `undo` (`--to-revision`), `restart`, `pause`, `resume`
- **`set`**: `image`, `env`, `resources`, `serviceaccount`, `selector`
- **`config`** (kubeconfig, not a resource): `get-contexts`, `use-context`, `set-context`, `current-context`

## Current kue-ball coverage

| Area | Commands implemented |
|------|----------------------|
| Pods | list, describe, delete |
| Logs | tail/follow, dump-to-file |
| Exec | interactive shell (`-it`), one-off command |
| Deployments | list, describe, rollout status, rollout history, rollback (undo), restart, delete |
| Services | list, delete; service accounts list/delete; ingress list; VirtualService list |
| ConfigMaps | list, describe (table + YAML); secrets list |
| Events | list |
| Resources (top) | top pods, top nodes |
| Contexts | switch context (`config use-context`) |
| Helm | release listing/management |
| Ping | HTTP probing via ingress/VirtualService discovery |

## Gaps — candidate features

Ordered roughly by likely usefulness:

1. **`scale`** — deployments / statefulsets / replicasets (set replica count)
2. **`port-forward`** — pods / services / deployments (a managed, interruptible session)
3. **StatefulSets** — no commands yet (list / describe / rollout / scale)
4. **DaemonSets** — no commands yet (list / describe / rollout restart)
5. **`rollout pause` / `resume`** — deployments (currently only status/history/undo/restart)
6. **`set image` / `set env` / `set resources`** — quick deployment updates
7. **Node ops** — `cordon` / `uncordon` / `drain` / `taint`
8. **Jobs / CronJobs** — list, trigger (`create job --from=cronjob/…`), logs
9. **`edit`** — open any resource in `$EDITOR` (generic across types)
10. **`cp`** — copy files to/from a pod
11. **`apply -f` / `create -f`** — apply a manifest file
12. **HPA / PVC / PV** — list / describe / delete views

### Notes on implementation fit
- Streaming/interactive verbs (`port-forward`, `attach`, `debug`, `edit`) should follow the
  `exec -it` pattern (`runLive(..., { interactive: true })`) so they own the screen and don't
  capture/page.
- One-shot output verbs (`scale`, `rollout *`, `set *`, node ops) fit the capture+page path
  (`runLive` / `runShell`) and will show in the scrollable content-area pager.
- `edit` needs `$EDITOR` and a real TTY — treat as interactive.
