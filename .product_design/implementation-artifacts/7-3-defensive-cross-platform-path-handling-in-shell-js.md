# Story 7.3: Defensive cross-platform PATH handling in `src/lib/shell.js`

Status: ready-for-dev

## Story

As a developer,
I want `buildEnv()` in `src/lib/shell.js` to use platform-aware path delimiters and only add extra PATH entries that actually apply,
so that a clean WSL Ubuntu install (where Homebrew and Rancher Desktop don't exist) doesn't accumulate dead path entries — and so a future native-Windows attempt has one fewer hard-coded POSIX-ism to remove.

## Acceptance Criteria

1. **Given** `src/lib/shell.js` is modified, **When** `buildEnv()` runs on `darwin` (macOS, the existing baseline), **Then** the resulting `PATH` contains `~/.rd/bin`, `/opt/homebrew/bin`, and `/usr/local/bin` prepended in that order (separated by `:`), exactly as today — zero behavioural change on Mac.
2. **Given** `src/lib/shell.js` is modified, **When** `buildEnv()` runs on `linux` (including WSL2 Ubuntu), **Then** the resulting `PATH` contains only `/usr/local/bin` (the one POSIX entry that's relevant on Linux), prepended with `:`. The Mac-specific `~/.rd/bin` and `/opt/homebrew/bin` entries are NOT added.
3. **Given** the implementation, **When** the developer inspects `shell.js`, **Then** the path separator is read from `node:path`'s `path.delimiter` (NOT a hard-coded `:`).
4. **Given** the implementation, **When** `buildEnv()` runs on `win32`, **Then** the function returns `process.env` unchanged with no extra paths prepended — i.e. it doesn't actively break, but doesn't pretend to add Mac-specific paths to a Windows PATH.
5. **Given** `src/lib/shell.test.js` is updated, **When** the test suite runs, **Then** the existing macOS expectations still pass (test currently runs on macOS in CI), AND new test cases assert:
   - When `os.platform()` is mocked to `"linux"`, only `/usr/local/bin` is prepended.
   - When `os.platform()` is mocked to `"win32"`, no extra paths are prepended.
   - When `os.platform()` is mocked to `"darwin"`, the existing three entries are prepended in the documented order, separated by `path.delimiter`.
6. **Given** the implementation, **When** the developer inspects the rest of `src/lib/`, **Then** no other file is modified — this story is intentionally contained to `shell.js` + its test.
7. **Given** the implementation, **When** all tests are run, **Then** the test count remains green (no regressions in any other test file).

## Tasks / Subtasks

- [x] **Task 1: Refactor `buildEnv()` to be platform-aware** (AC: #1, #2, #3, #4)
  - [x] Add `import { platform } from "node:os";` and `import { delimiter as pathDelimiter } from "node:path";` to `src/lib/shell.js`.
  - [x] Replace the existing `buildEnv()` body with a platform branch:
    ```js
    function buildEnv() {
        const plat = platform();
        let extraPaths;
        if (plat === "darwin") {
            extraPaths = [
                `${process.env.HOME}/.rd/bin`,
                "/opt/homebrew/bin",
                "/usr/local/bin",
            ];
        } else if (plat === "linux") {
            extraPaths = ["/usr/local/bin"];
        } else {
            // win32 (or any other) — don't add anything; PATH stays as-is.
            return { ...process.env };
        }
        return { ...process.env, PATH: `${extraPaths.join(pathDelimiter)}${pathDelimiter}${process.env.PATH}` };
    }
    ```
  - [x] Keep the rest of `shell.js` unchanged (the exported functions, no signature changes).

- [x] **Task 2: Update `shell.test.js`** (AC: #5, #7)
  - [x] Identify the existing test(s) that assert `PATH` contents. They currently expect the three Mac paths to be present.
  - [x] Add a top-of-file `vi.mock("node:os", ...)` setup that lets each test stub `platform()` per-case. Or use `vi.spyOn(os, "platform").mockReturnValue(...)` inside each test.
  - [x] Three new test cases:
    1. `buildEnv() on darwin prepends ~/.rd/bin, /opt/homebrew/bin, /usr/local/bin in that order separated by path.delimiter`
    2. `buildEnv() on linux prepends only /usr/local/bin`
    3. `buildEnv() on win32 returns process.env unchanged (no extra paths)`
  - [x] The existing tests that exercise `run()`, `captureCommand()`, `spawnInteractive()` etc. via stubbing `execSync`/`spawn` — verify they still pass without modification. (`buildEnv()` is internal; those tests probably don't care about its internals beyond "env is set".)

- [x] **Task 3: Verify scope and run tests** (AC: #6, #7)
  - [x] `git status` — confirm ONLY `src/lib/shell.js` and `src/lib/shell.test.js` are modified.
  - [x] `npm test` — confirm all 370+ tests pass (the count will go up by 2-3 from the new platform tests).

## Dev Notes

### Why this story exists in Epic 7

Epic 7's scope is "support Windows via WSL2." WSL2 IS Linux, so technically the current `buildEnv()` works there (it just adds dead path entries `~/.rd/bin` and `/opt/homebrew/bin` that don't exist on a clean Ubuntu). This story isn't strictly necessary for the WSL path to function — it's defensive cleanup that:

1. Removes harmless-but-confusing dead paths from WSL users' resolved PATH (good hygiene).
2. Makes the platform branch explicit, so a future native-Windows attempt has a clear place to add a Win32 path tier (without having to rewrite the hard-coded `:` delimiter and POSIX-style paths).
3. Makes the developer intent visible: "we know Mac has Homebrew at `/opt/homebrew/bin`, Linux doesn't."

### Why NOT add a win32 branch with Mac-equivalent paths

Don't do it in this story. The point is to leave `buildEnv()` *safe* on win32 (returns env unchanged, no harm), not to enable win32 (NFR8 says native Windows is out of scope). When/if a future epic decides to enable native Windows, that epic adds the win32 branch with appropriate paths (e.g. `C:\Program Files\Kubernetes\` or wherever kubectl actually lives on Windows). For now, `win32` returns a clean `process.env` and the user is responsible for having kubectl on `PATH` themselves.

### Why use `node:os.platform()` and not `process.platform`

Functionally identical. Conventionally, `node:os.platform()` is preferred in modern Node code (matches the broader `os` module). `process.platform` is also acceptable. **Use `node:os.platform()`** for consistency with the rest of `src/lib/` (which already imports from `node:os` in `prefs.js` via `homedir()`).

### Test mocking pattern

Look at `prefs.test.js` for the existing `node:os` mock pattern:

```js
vi.mock("node:os", () => ({
    homedir: vi.fn().mockReturnValue("/test-home"),
    platform: vi.fn().mockReturnValue("darwin"),
}));
```

For `shell.test.js`, add `platform` to the mock and use `vi.mocked(platform).mockReturnValueOnce("linux")` per-test to override.

If the existing `shell.test.js` doesn't mock `node:os`, add it. The mock should default to `"darwin"` so existing tests don't break.

### Anti-patterns to avoid

- **Don't try to detect WSL specifically.** Detecting WSL ("is `/proc/version` mentioning Microsoft?") is fragile and unnecessary. WSL Ubuntu reports `os.platform() === "linux"`, which is correct — it IS Linux from Node's perspective.
- **Don't use a `process.env.WSL_DISTRO_NAME` check.** Same reason: WSL-specific detection adds complexity for no behavioural gain.
- **Don't add a "platform" helper module.** This story is contained to `shell.js`. If future stories also need platform branching, THAT story extracts the helper. Rule of three.
- **Don't change the existing exported functions' signatures.** `buildEnv()` is internal (not exported). The change is invisible to callers.

### What NOT to do

- Don't add the `node:fs.existsSync` check for whether `/opt/homebrew/bin` actually exists. The current code doesn't check; this story doesn't add it. Existence-checking each path is a separate concern and arguably belongs in a different story (or never — extra paths in `PATH` are cheap).
- Don't introduce `env-paths` or other dependencies. Use only `node:os` and `node:path` (both stdlib).
- Don't move the Mac paths to a config file or env var. They're hard-coded for a reason: this is a developer-tool shim that needs to "just work" on developer Macs with standard Homebrew installs.

### Source Tree After This Story

```
src/lib/
├── shell.js              ← MODIFIED (platform branch in buildEnv)
└── shell.test.js         ← MODIFIED (+3 platform test cases)
```

### Definition of Done

- [x] `buildEnv()` branches on `os.platform()` with darwin / linux / fallback cases.
- [x] Path delimiter sourced from `node:path.delimiter`, not hard-coded `:`.
- [x] `shell.test.js` has 3 new platform test cases AND all existing tests still pass.
- [x] `npm test` reports all green.
- [x] No file outside `src/lib/shell.js` and its test is modified.

### References

- Story spec: `.product_design/planning-artifacts/epics.md` §"Story 7.3" (Epic 7).
- Existing `buildEnv()`: `src/lib/shell.js:4-11`.
- Existing tests asserting Mac paths: `src/lib/shell.test.js:33-49`, `:82`, `:127`.
- Node `os.platform()`: https://nodejs.org/api/os.html#osplatform
- Node `path.delimiter`: https://nodejs.org/api/path.html#pathdelimiter

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
