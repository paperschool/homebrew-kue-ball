# Windows / WSL2 — known caveats

This file records empirical findings from running `kue-ball` under WSL2 on
Windows, plus quirks observed during partial Mac-side verification via
`npm run docker:start` (which approximates the WSL2 Ubuntu environment).

Section 1 captures what's been verified. Section 2 lists what's still
**not** verified and what to look for when you do. Section 3 is the
caveats list itself — empty for now; add a `### Caveat: ...` block per
deviation as you find them.

---

## 1. Verified

### Docker / Linux proxy verification (Mac)

The `npm run docker:start` script boots an Ubuntu 22.04 container (matching
WSL's Linux runtime) with Node 22 + kubectl + kubelogin + helm + az + jq
preinstalled. This is **not** a real WSL test — but it is a faithful test of
kue-ball's Linux code path. As of 2026-05-27, the following work cleanly in
the container:

- **Module loading**: `node src/main.js` starts; `os.platform() === "linux"`
  is detected by `src/lib/shell.js`'s platform branch (Story 7-3); the
  `/usr/local/bin` PATH prefix is the only one prepended (no dead Mac paths).
- **Splash + chrome**: the rotating gradient renders correctly; box-drawing
  glyphs (`╔ ║ ═ ╗ ╔ ╚ ╝`) and shading blocks (`░ ▒ ▓ █`) render without
  mojibake under the default Cascadia / Menlo font setups.
- **Prereq checks**: `kubectl`, `helm`, `az` all detected and reported with
  versions during the startup probes.
- **Resource picker**: fuzzy search works; backspace / `←` step back through
  sub-menus as expected.
- **Auth-error warning page**: triggered by deliberately running a verb
  against a namespace the user lacks RBAC on (see your kubeconfig).
- **`exec` Forbidden detection**: kubectl exec stderr is captured by the new
  `spawnInteractiveCapturingStderr` path; `isPermissionError` matches and
  routes to the warning page rather than the raw "Shell exited with code 1"
  fallback.

### Verified on real WSL2

*(empty — fill in as 7-1's empirical smoke test is run on a real Windows
host)*

---

## 2. Not yet verified

The following items in Story 7-1's acceptance criteria specifically require a
real Windows 11 (or 10 build 19041+) host running WSL2 + Ubuntu, plus a
reachable AKS cluster. They cannot be verified from a Mac via Docker.

- **Windows Terminal rendering** of the chrome (alt-screen buffer, scroll
  region, `setRawMode`, splash gradient). Cascadia Mono is the default font;
  legacy `conhost.exe` is explicitly unsupported.
- **WSL ↔ Windows filesystem boundary**: cloning into `/mnt/c/...` vs `~/dev/...`
  matters — fs syscalls cross the boundary and slow `npm install` 5-10× and
  may break `setRawMode`. The README install instructions explicitly point at
  `~/dev/...`; needs confirmation.
- **WSL TTY quirks**: `process.stdin.setRawMode` and `Ctrl+C` handling differ
  between WSL's tty type and macOS's. Watch for: streamed-logs scrollback
  (does Windows Terminal's mouse wheel work after `suspendChromeForStreaming`
  exits the alt-screen?), Ctrl+C cleanly restoring the parent shell, no
  lingering escape codes.
- **Resize handling**: dragging the Windows Terminal window corner during the
  splash and during the resource picker — chrome re-centres correctly?
- **az login flow under WSL**: device-code flow is the safe path
  (`az login --use-device-code`). Standard `az login` opens a browser; on
  modern Win 11 this is forwarded to the Windows host's default browser, but
  some VPN / corporate setups break that handoff.
- **kubeconfig portability**: Windows's `%USERPROFILE%\.kube\config` is
  separate from WSL's `~/.kube/config`. Confirm the README's instruction to
  re-run `az aks get-credentials` inside WSL works as documented.

---

## 3. Caveats

*(empty — add a `### Caveat: <short title>` section per finding, with
terminal + Ubuntu versions, repro steps, observed vs expected behaviour, and
where known the underlying cause)*

**No known caveats as of 2026-05-27.**
