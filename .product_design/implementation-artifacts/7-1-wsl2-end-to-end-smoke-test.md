# Story 7.1: WSL2 end-to-end smoke test

Status: ready-for-dev

## Story

As a maintainer,
I want a documented round of empirical testing on a real WSL2 + Ubuntu environment,
so that I know which (if any) flows behave differently from the Mac baseline before promising Windows users that the tool works for them.

## Acceptance Criteria

1. **Given** a Windows 11 (or 10 build 19041+) host with WSL2 enabled, **When** the developer installs Ubuntu 22.04 (or later) under WSL2 and the four CLI prerequisites (`node ≥22`, `kubectl`, `helm`, `az`), **Then** each tool reports a version when invoked and is reachable from the user's `PATH`.
2. **Given** the same WSL2 environment with prerequisites installed, **When** the developer clones the repo into the WSL filesystem (NOT the Windows mount `/mnt/c/...`) and runs `npm install && node src/main.js`, **Then** the splash renders correctly in Windows Terminal with all box-drawing characters (`╔ ║ ═ ╗ ╔ ╚ ╝`), shading blocks (`░ ▒ ▓ █`), and the rotating gradient visible. No mojibake, no replacement characters.
3. **Given** the wizard is on the resource picker, **When** the developer walks the full navigation matrix (fuzzy-search filtering, backspace / left-arrow back navigation, "Exit" returning the terminal cleanly), **Then** every navigation behaviour matches the Mac baseline.
4. **Given** the wizard is on a resource's verb picker, **When** the developer exercises the universal verbs against a real AKS cluster (Pods/Deployments/Services for `list`, a Pod for `describe` + `e`-to-edit, a test resource for `delete` confirm), **Then** every verb produces identical output to the Mac baseline AND the edit-from-describe flow correctly launches `kubectl edit` with `KUBE_EDITOR` honoured (defaulting to `nano`).
5. **Given** the verb picker on Pods, **When** the developer exercises `logs` (stream + `q` to exit), `exec` (both a successful `sh` session AND a deliberately-Forbidden namespace to verify the auth-error warning page renders), and `scale` on a Deployment, **Then** each specific verb completes correctly AND the auth-error page renders properly when permissions are denied (yellow triangle, error snippet, "Are you logged into Azure..." prompt).
6. **Given** the top-level extras, **When** the developer exercises Helm (list / pending / failed), Ping (against an Ingress route), Events (recent + warnings-only), and Context / Namespace (refresh contexts, list, switch context, switch namespace), **Then** every flow completes correctly.
7. **Given** mid-session interactions, **When** the developer resizes the Windows Terminal window AND when the developer hits Ctrl+C at various menu depths, **Then** the chrome re-centres correctly on resize AND Ctrl+C cleanly exits with the alternate screen buffer restored to the parent shell (no lingering escape codes, no scroll-region artefacts).
8. **Given** the smoke test completes, **When** any deviation from the Mac baseline is observed, **Then** it is captured in a new file `docs/wsl2-known-caveats.md` with: terminal app + version, Ubuntu release, kubectl/helm/az versions, repro steps, observed behaviour, and (if known) the underlying cause. If NO deviations: the file is created with a single line stating "No known caveats as of YYYY-MM-DD."

## Tasks / Subtasks

- [ ] **Task 1: Set up WSL2 + Ubuntu environment** (AC: #1)
  - [ ] On Windows 11 host: open PowerShell as admin, run `wsl --install -d Ubuntu` (installs WSL2 + Ubuntu in one shot on modern Win 11).
  - [ ] First-time setup: create a Linux user, set a password.
  - [ ] Update apt: `sudo apt update && sudo apt upgrade -y`.
  - [ ] Install Node ≥22 (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`).
  - [ ] Install `kubectl`: download from `https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl`, `install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl`.
  - [ ] Install `helm`: `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash`.
  - [ ] Install `az`: `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`, then `az login --use-device-code` (device-code flow works inside WSL even when Windows owns the browser).
  - [ ] Verify each tool: `node --version && kubectl version --client && helm version && az version` — all return non-empty output.

- [ ] **Task 2: Clone and run kue-ball inside WSL** (AC: #2)
  - [ ] Clone INTO the WSL filesystem (`~/dev/homebrew-kue-ball`), NOT into `/mnt/c/...` — Windows-mounted paths have ~10× slower fs ops which makes `npm install` painful and `setRawMode` flaky.
  - [ ] Run `npm install` (no global install needed for the smoke test).
  - [ ] Run `node src/main.js`.
  - [ ] Confirm the splash renders without garbled characters. If any character renders as a replacement glyph (`�`), capture which one and note the terminal font setting (default is Cascadia Code on Win 11).
  - [ ] Confirm the rotating gradient animates visibly during the prereq check phase and the 2-second hold.

- [ ] **Task 3: Walk the navigation matrix** (AC: #3)
  - [ ] Resource picker: fuzzy-search for "pods", verify Pods entry shows; clear search, see all 17 resources grouped under Workloads/Config/Networking/Cluster/Storage.
  - [ ] Pick Pods → verb picker opens; hit `⌫` → returns to resource picker (no extra navigation).
  - [ ] Pick Pods → verb picker → hit `←` → returns to resource picker.
  - [ ] Pick Pods → type "lo" in verb search → only `Stream logs` / `Previous logs` / etc. show.
  - [ ] Navigate to Exit at the top level → terminal restores cleanly, prompt returns, no leftover characters.

- [ ] **Task 4: Universal verbs against a real cluster** (AC: #4)
  - [ ] `az aks get-credentials -g <rg> -n <cluster>` to seed kubeconfig (or use Refresh Contexts).
  - [ ] **Pods.list**: confirm output paginates, `q` returns to verb picker, search filter `/` works inside the pager.
  - [ ] **Pods.describe**: pick a real pod, the describe output renders in the pager; press `e` → `kubectl edit pod` launches in nano (or `$KUBE_EDITOR`); save+exit nano → returns to describe view.
  - [ ] **Deployments.list** and **Services.list**: same verification as Pods.list.
  - [ ] **Pods.delete**: pick a disposable test pod (or skip if no safe test target); confirm prompt fires; cancel (don't actually delete unless in a sandbox).

- [ ] **Task 5: Specific verbs incl. the Forbidden path** (AC: #5)
  - [ ] **logs**: pick a pod with multiple replicas → stream logs; hit `q` to exit; verify shell prompt restores cleanly.
  - [ ] **exec — happy path**: pick a pod with `sh` available, pick `sh` → interactive shell opens inside the container; type `ls`, `exit` to leave; back at the verb picker.
  - [ ] **exec — Forbidden path** *(the critical one — verifies the auth-error warning page)*: pick a pod (or switch to) a namespace where the user lacks `pods/exec` RBAC; pick `sh`; kubectl prints "Error from server (Forbidden): pods ... is forbidden ..."; the wizard should display the yellow ASCII warning triangle, the error snippet, and the "Are you logged into Azure, with PIM activated, on the correct network?" prompt; hit any key to dismiss.
  - [ ] **scale**: pick a Deployment, scale to a non-zero replica count and verify the change took effect with `kubectl get deployments`; then scale to 0 and verify the confirm prompt fires.

- [ ] **Task 6: Top-level extras** (AC: #6)
  - [ ] **Helm**: pick "List Helm releases" → output shows for the current namespace; "List pending Helm releases" / "List failed Helm releases" both work.
  - [ ] **Ping**: pick → if the cluster has an Ingress in the current ns, routes auto-discover; HTTP-ping result table renders.
  - [ ] **Events**: pick → "Recent events — namespace" sorts by lastTimestamp; "Warning events only" filters correctly.
  - [ ] **Context / Namespace**: pick → sub-menu shows 4 items; "Refresh contexts" runs `az aks get-credentials` (may prompt for re-auth); "List all contexts" runs `kubectl config get-contexts`; "Switch current context" opens the context picker; "Switch namespace" opens the namespace picker.

- [ ] **Task 7: Resize + Ctrl+C** (AC: #7)
  - [ ] At the splash, resize the Windows Terminal window (drag a corner). The splash should re-centre to the new dimensions within ~80ms.
  - [ ] At the resource picker, resize again. The menu should re-render.
  - [ ] Hit Ctrl+C at the resource picker. The wizard exits with "Cancelled." printed; the parent shell prompt returns to the row where kue-ball started (alternate screen buffer restored).
  - [ ] Re-run kue-ball, navigate into a verb picker, hit Ctrl+C. Same clean exit.

- [ ] **Task 8: Capture caveats** (AC: #8)
  - [ ] Create `docs/wsl2-known-caveats.md`.
  - [ ] Header: terminal app + version (e.g. "Windows Terminal 1.18.x"), Ubuntu release (e.g. "Ubuntu 22.04 LTS via WSL2"), tool versions (node, kubectl, helm, az).
  - [ ] One section per observed deviation, each with: title, repro steps, observed behaviour, expected behaviour (the Mac baseline), and (if known) the underlying cause.
  - [ ] If no deviations: a single line `No known caveats as of YYYY-MM-DD.`

## Dev Notes

### This story is empirical, not code

There's no `src/` change in this story. Everything is hands-on testing on a real Windows machine running WSL2. Allocate ~half a day of focused time on a Windows host. If no Windows host is available, this story is blocked.

### Why test inside WSL's filesystem, not the Windows mount

Cloning into `/mnt/c/Users/<you>/...` makes `npm install` 5-10× slower (`fs` syscalls cross the Windows<->Linux boundary). It also has historically broken `process.stdin.setRawMode()` in some Node versions because the underlying tty type is different. ALWAYS work inside the WSL home (`~/dev/...`).

### Windows Terminal vs `conhost.exe`

WSL launched from a Win 11 Start Menu shortcut opens in Windows Terminal by default. WSL launched from PowerShell via `wsl.exe` MIGHT open in the legacy `conhost.exe` depending on the user's "Default Terminal Application" setting (Settings → Default Terminal Application). For this story, ensure Windows Terminal is the default — confirm in the title bar of the WSL window.

### Expected differences from Mac (predicted, not yet verified)

- **Clipboard**: any flow that prints a URL (the PIM activation link in azure.js) needs a Ctrl+click in Windows Terminal — auto-clickable links work in WT 1.5+ but may need OS-level URL handler config. Note in caveats if broken.
- **az login**: device-code flow is the safe path inside WSL. `az login` without flags tries to open a browser, which works on Win 11 (WSL forwards to the Windows browser) but flaky in some configs.
- **kubeconfig**: WSL's `~/.kube/config` is a separate file from Windows's `%USERPROFILE%\.kube\config`. If the user has set up kubectl on Windows, it doesn't carry over. They need to re-`az aks get-credentials` inside WSL.

### What "behaves identically to Mac baseline" means

Mac baseline = what you see when running `node src/main.js` on macOS. Identical means:
- Same characters render (no `�` replacement chars)
- Same prompt sequences (step header, fuzzy search, prompts)
- Same colours (the white→blue gradient, red `delete`, yellow `edit`, blue `logs*`, green `exec*`)
- Same keyboard responses (Ctrl+C, `q`, `/`, backspace, `←`)
- Same timing (animation isn't dramatically choppy)

Deviation = any of the above is materially different. Small ms-level timing differences are not deviations.

### What NOT to do

- Don't try to make the smoke test "pass" by working around issues. If something is broken, document it. Issues feed Story 7.2 and 7.3 (or future epics).
- Don't test under `cmd.exe` (legacy `conhost.exe`). It's explicitly NFR8 out-of-scope.
- Don't modify any source file to make the smoke test work. Code changes belong in Story 7.3 or a future story; 7.1 reports findings only.
- Don't test against a production cluster. Use a dev/sandbox AKS.

### Source Tree After This Story

```
docs/
└── wsl2-known-caveats.md         ← NEW
```

(No `src/` changes.)

### Definition of Done

- [ ] Every AC bullet exercised on a real Windows + WSL2 + Ubuntu environment.
- [ ] `docs/wsl2-known-caveats.md` exists with either deviation records or the "no known caveats" line.
- [ ] Completion Notes summarise: terminal + Ubuntu versions used, # of deviations found, and any blockers for Story 7.2 / 7.3.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 7.1" (Epic 7).
- WSL2 install: https://learn.microsoft.com/en-us/windows/wsl/install
- Windows Terminal default app setting: https://learn.microsoft.com/en-us/windows/terminal/customize-settings/startup

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
