# Story 7.2: README — Windows install path via WSL2

Status: ready-for-dev

## Story

As a Windows user,
I want a clear step-by-step install guide in the README,
so that I can get `kue-ball` running without guessing whether it's supposed to work on Windows in the first place.

## Acceptance Criteria

1. **Given** the README is updated, **When** the user reaches the "Install" section, **Then** a new subsection titled "Windows (via WSL2)" appears alongside the existing Homebrew / npm / dev install methods.
2. **Given** the new Windows subsection, **When** the user reads the opening line, **Then** it explicitly states native Windows (PowerShell, `cmd.exe`) is unsupported and WSL2 + Ubuntu is the supported path.
3. **Given** the new Windows subsection, **When** the user reads the install steps, **Then** numbered steps cover: enable WSL2 (`wsl --install`), install Ubuntu (`wsl --install -d Ubuntu`), open the Ubuntu shell, install Node ≥22, install `kubectl`, install `helm` (optional), install `az` (optional, for context refresh), clone the repo (into the WSL filesystem, NOT `/mnt/c/...`), `npm install`, run `npm start` or `node src/main.js`.
4. **Given** the new Windows subsection, **When** the user finishes reading, **Then** a note clarifies that Windows Terminal (the default WSL host on Win 11) renders the TUI correctly; legacy `conhost.exe` is NOT supported.
5. **Given** the new Windows subsection, **When** the user reads the bottom, **Then** a link to `docs/wsl2-known-caveats.md` is included for terminal-specific quirks (the file produced by Story 7.1).
6. **Given** the README's "Requirements" section, **When** the user reads it, **Then** Windows is listed alongside macOS as a supported platform, with the clarification "via WSL2 — see Install → Windows".
7. **Given** the README's "Upgrading" section, **When** a Windows-on-WSL user reads it, **Then** a note clarifies that the `brew update && brew upgrade` flow does NOT apply on WSL — instead, the user runs `git pull && npm install` in the cloned repo, or re-runs the `npm install -g .` install command.
8. **Given** the README is updated, **When** any user (Mac, Linux, Windows) reads the file, **Then** none of the existing Homebrew / npm / dev install paths are broken or have their wording changed beyond what's necessary to accommodate the new Windows option.

## Tasks / Subtasks

- [ ] **Task 1: Add "Windows (via WSL2)" install subsection** (AC: #1, #2, #3, #4, #5)
  - [ ] In `README.md`, locate the `## Install` section.
  - [ ] After the existing `### Run directly (development)` subsection (and before `## Upgrading`), insert a new `### Windows (via WSL2)` subsection.
  - [ ] Opening line: explicit statement of scope and recommendation — paraphrase: *"Native Windows (PowerShell / `cmd.exe`) is not supported. The supported path on Windows is WSL2 + Ubuntu, which runs `kue-ball` as a Linux binary."*
  - [ ] Add a numbered install list with bash code blocks for each step:
    1. Enable WSL2 and install Ubuntu (run from PowerShell as admin)
    2. Open the Ubuntu shell from the Start Menu
    3. Install Node ≥22 via NodeSource
    4. Install `kubectl` (download binary, install to `/usr/local/bin`)
    5. Install `helm` (optional) via the helm install script
    6. Install `az` (optional) via the Microsoft install script
    7. Clone the repo INTO the WSL filesystem (`~/dev/...`), NOT into `/mnt/c/...`
    8. `npm install`
    9. `node src/main.js` (or `npm start`)
  - [ ] After the install steps: note about Windows Terminal being the default + required TUI host on Win 11; legacy `conhost.exe` is explicitly unsupported.
  - [ ] After the note: link to `docs/wsl2-known-caveats.md` (the file produced by Story 7.1) for caveats and gotchas.

- [ ] **Task 2: Update Requirements section** (AC: #6)
  - [ ] Locate `## Requirements`.
  - [ ] Update the implicit platform statement so Windows users see they're supported. Either:
    - Add a top-line bullet: "**Platforms**: macOS, Linux, Windows (via WSL2 — see Install → Windows)"
    - Or update the existing intro line (currently "Interactive `kubectl` wizard CLI for AKS clusters for use on mac (and possibly linux) devices") to "Interactive `kubectl` wizard CLI for AKS clusters. Runs on macOS, Linux, and Windows (via WSL2)."
  - [ ] Don't add Windows-specific tool install commands here — those belong in the Windows install subsection. Keep `## Requirements` platform-neutral except for the platforms line.

- [ ] **Task 3: Update Upgrading section for WSL users** (AC: #7)
  - [ ] Locate `## Upgrading`.
  - [ ] After the existing Homebrew flow, add a short subsection or note titled "For npm / WSL installs" that explains:
    - The Homebrew upgrade flow above does NOT apply to npm or WSL installs.
    - For a git-clone install: `cd <repo> && git pull && npm install`.
    - For a global npm install: `npm install -g <repo>` again to re-link.

- [ ] **Task 4: Sanity-check the README renders correctly** (AC: #8)
  - [ ] Preview the markdown locally (`grip` or VS Code preview) or visually scan for broken table cells, mis-indented lists, code-block language tags missing.
  - [ ] Confirm no other section's wording changed inadvertently.
  - [ ] Confirm all links resolve (the link to `docs/wsl2-known-caveats.md` may 404 until Story 7.1 lands — that's acceptable; both stories are part of the same epic and will land together).

- [ ] **Task 5: Verify the existing install methods still work end-to-end on Mac** (AC: #8)
  - [ ] Re-read the Homebrew, npm, and dev install sections — confirm the install commands are unchanged.
  - [ ] No behavioural verification needed (just a docs read-through).

## Dev Notes

### This story is documentation-only

No `src/` changes. No tests. The only files modified are `README.md`. If `docs/wsl2-known-caveats.md` needs creating as a placeholder (because Story 7.1 hasn't merged yet), that's fine — the README link can target it; the file is created in Story 7.1.

### Dependency on Story 7.1

The link to `docs/wsl2-known-caveats.md` will 404 until Story 7.1 creates the file. Options:
- **Option A**: Ship Story 7.2 first with a "TBD" placeholder note instead of the link.
- **Option B**: Hold Story 7.2 until Story 7.1 is in `review`, then merge both together.
- **Option C** *(recommended)*: Add the link anyway. The two stories are in the same epic and will land in close succession. A briefly broken link in unreleased work is acceptable.

Document the choice in Completion Notes.

### Why "WSL2 + Ubuntu" specifically

Other WSL distros (Debian, Alpine, openSUSE) will probably also work — they're all Linux. But the install commands differ (Alpine uses `apk` not `apt`, etc.). For docs simplicity, prescribe Ubuntu. Users who know they want a different distro can adapt the steps themselves.

### Why "clone into the WSL filesystem, NOT `/mnt/c/...`"

This is a footgun. Cross-filesystem `npm install` is 5-10× slower in WSL because every fs syscall crosses the Windows↔Linux boundary. It also breaks `process.stdin.setRawMode()` in some Node versions because the tty type is different (DrvFs vs DRVFS). Always work inside the WSL home.

This warning needs to be **explicit and visible** in the docs — don't hide it in a footnote. A `> ⚠️ Note:` block is appropriate.

### Tone

The README is friendly. Keep the new sections in the same voice: short, declarative, code-block-heavy. Don't over-explain why WSL is the choice. One sentence at the top explaining "native Windows is unsupported, use WSL2" is enough — anyone curious about the reasoning can find Epic 7 in `.product_design/planning-artifacts/epics.md`.

### What NOT to do

- Don't add screenshots (would need a Windows machine to capture them; out of scope).
- Don't recommend a specific Windows Terminal version — pin only to Win 11's default (which ships with a sufficiently recent WT). Users on Win 10 may need to manually install WT.
- Don't include `az login` instructions in the README — that's a kubectl/Azure ops thing, not a kue-ball install thing. The user finds `az login` instructions in the Azure docs.
- Don't write a "troubleshooting" subsection. Keep the README focused on the happy path; caveats live in `docs/wsl2-known-caveats.md`.
- Don't change the `## Author` section or any other section beyond Install / Requirements / Upgrading.

### Source Tree After This Story

```
README.md                          ← MODIFIED
docs/wsl2-known-caveats.md         ← REFERENCED (created by Story 7.1)
```

### Definition of Done

- [ ] README has a new "Windows (via WSL2)" install subsection with all 9 install steps.
- [ ] README's "Requirements" section lists Windows as supported via WSL2.
- [ ] README's "Upgrading" section has a note for non-brew installs.
- [ ] Existing Homebrew / npm / dev install paths are unchanged in behaviour.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 7.2" (Epic 7).
- WSL2 install (Microsoft docs): https://learn.microsoft.com/en-us/windows/wsl/install
- Story 7.1 (`docs/wsl2-known-caveats.md` is created there).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
