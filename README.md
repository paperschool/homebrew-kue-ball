# kue-ball

<p align="center">
  <img src="docs/main.png" alt="Kue-Ball - Home Interface" height="500px" />
</p>

Interactive `kubectl` wizard CLI for AKS clusters. Pick a context, pick a namespace, and run common operations through a fuzzy-searchable menu — no flags to memorise.

## Requirements

- Node.js ≥ 22
- `kubectl` — `brew install kubectl`
- `az` (Azure CLI) — `brew install azure-cli` *(for context refresh only)*
- `helm` — `brew install helm` *(optional, for Helm commands)*
- `jq` — `brew install jq` *(optional, pretty-prints JSON log output)*

## Install

### Homebrew (recommended)

```bash
brew tap paperschool/kue-ball
brew install kue-ball
```

### npm (global)

```bash
npm install -g .
kue-ball
```

### Run directly (development)

```bash
npm install
npm start
# or
node src/main.js
```

## Configuration

The wizard works out of the box with zero config. Optionally set environment variables to pre-select your app and namespace:

| Variable                   | Purpose                                                | Default   |
| -------------------------- | ------------------------------------------------------ | --------- |
| `KUBECTL_WIZARD_APP`       | App name used for log selectors & deployment shortcuts | *(none)*  |
| `KUBECTL_WIZARD_NAMESPACE` | Namespace pre-selected at startup                      | `default` |
| `KUBECTL_WIZARD_CONTEXT`   | kubeconfig context floated to the top of the list      | *(none)*  |

Example:

```bash
KUBECTL_WIZARD_APP=my-service KUBECTL_WIZARD_NAMESPACE=my-ns kue-ball
```

Or add an alias to your shell profile:

```bash
alias kube-myapp='KUBECTL_WIZARD_APP=my-service KUBECTL_WIZARD_NAMESPACE=my-ns kue-ball'
```

## Features

- **Fuzzy search** across all commands
- **Pods** — list, describe, delete
- **Logs** — stream (with Esc/q to exit), dump to file, previous container logs
- **Deployments** — list, describe, rollout status/history, rollback, restart, delete
- **Services & Ingress** — list/delete services, service accounts, ingresses, VirtualServices
- **Config** — list/inspect ConfigMaps, list secrets
- **Events** — recent events, warnings only
- **Resources** — `top pods`, `top nodes`
- **Contexts** — refresh from Azure (`az aks get-credentials`), list, switch, change namespace
- **Exec** — interactive shell into a pod, one-off commands
- **Helm** — list/delete releases
- **Ping** — auto-discovers routes from Ingress/VirtualService and pings them

## Subscription preferences

When refreshing contexts, the wizard remembers which Azure subscriptions you pick most often and surfaces them first. Preferences are stored in `~/.config/kue-ball/prefs.json`.

## Author

<div align="center">

**Connect with the me:**

Dominic Jomaa • [LinkedIn](https://www.linkedin.com/in/dominicjomaa/) • [Instagram](https://www.instagram.com/ono.sendai.runner/)

</div>