---
agent: 'agent'
description: Analyze local changes, bump version (patch/minor), update changelog, and commit (no push)
---

Run a full **version-and-commit** flow for this repository.

## Rules

1. **Never push**. Commit only.
2. **Never bump major** unless the user explicitly says `major`.
3. If there are no local changes, stop and report that nothing needs versioning.
4. Use the version in `package.json` as the source of truth.
5. Update/create `changelog.md` with concise entries (**max 2-3 bullets per version entry**).
6. **Never include any co-author trailers** in commit messages.

## Bump decision policy

- Choose **minor** when changes include new user-facing capability or feature surface (for example: new commands, new workflows, new UI capabilities, new import/export behavior).
- Choose **patch** for fixes, refactors, docs-only changes, styling tweaks, tests, chores, and maintenance.
- If unsure between patch/minor, choose **patch**.

## Commit message format

Commits follow Conventional Commits. **Pick the type that genuinely describes the change** — do not default to `chore`. The vast majority of release commits are NOT chores; reserve `chore` for tooling / dependency bumps with no code or behaviour change.

### Pick the type

- `feat` — new user-facing capability or feature surface (typically pairs with a minor bump)
- `fix` — bug fix, regression repair, behavioural correction
- `refactor` — internal restructuring with no behavioural change (renames, file splits, helper extraction, migrations)
- `style` — purely visual / cosmetic (colour palette, ASCII art, prompt wording, spacing)
- `perf` — performance improvement
- `test` — test-only additions or changes
- `docs` — documentation only (README, comments, planning artifacts)
- `chore` — build, CI, dependencies, tooling — no source-code or user-facing change

If the diff spans multiple types, pick the **most significant** type for the subject and let the body bullets cover the rest. E.g. "new feature + small fix + minor style tweak" → `feat:` in the subject.

### Format

```
<type>: <short imperative subject> (vX.Y.Z)

- <changelog bullet 1>
- <changelog bullet 2>
- <changelog bullet 3>
```

- **Subject**: lowercase, imperative mood ("add" not "added"), under ~70 chars including the `(vX.Y.Z)` suffix.
- **Body**: the same 2-3 bullets you write into `changelog.md`, verbatim. This makes `git log --format=full` and `git show <sha>` self-explanatory without opening the changelog. Wrap body lines at 72 chars where natural.
- Blank line between subject and body (Git convention).

### Examples (good)

```
feat: rotating splash gradient with white→blue tiers (v1.12.2)

- Letter faces run a four-tier gradient: solid white █ → lightest blue ▒
  → lighter blue ▓ → light blue █. Depth glyphs shift to matching blue.
- Gradient axis revolves once every 8 seconds (80ms frames). First frame
  fires via setImmediate so motion is visible immediately.
- Splash holds for ~2s after prereq checks so the title is actually seen.
```

```
fix: prereq prints no longer bump splash up one row (v1.12.3)

- Cursor parks at rows()-4 (not rows()-3) so the third trailing \n lands
  on rows()-1 without crossing the scroll-region bottom.
- Animation tick defensively wipes two rows above the splash to clean up
  any stray scroll remnants.
```

```
style: switch warning art to closed-bottom triangle (v1.13.2)

- Auth-error page warning glyph is now a 4-row `/\`, `/  \`, `/ !! \`,
  `/______\` triangle with slashes at the base corners — reads as a
  properly enclosed shape rather than three slash rows above a flat line.
```

```
refactor: migrate command modules into registry (v1.9.0)

- Deleted 20 legacy src/commands/*.{js,test.js} files in favour of the
  resource registry + universal/specific verb libraries.
- Inlined Events and Contexts as top-level extras in main.js so the
  flat menu's last responsibilities are gone.
```

### Examples (avoid)

- `chore(release): v1.12.2` — uninformative; nothing in subject indicates what changed
- `feat: stuff` — vague
- `Update files` — not Conventional Commits, no version, no detail
- `fix: fixed the thing that was broken` — past tense, no specifics

## Steps

1. Inspect local git changes and summarize impacted files.
2. Decide bump type (`patch` or `minor`) using the bump decision policy.
3. Pick the Conventional Commit type that best describes the nature of the change (NOT `chore` unless genuinely tooling/build only).
4. Bump `package.json` version accordingly.
5. Update `changelog.md`:
   - Add a new top entry for the new version and current date.
   - Include 2-3 concise bullets summarizing the actual change set.
6. Commit all relevant modified files using the **subject + body** format above. The body bullets should match the changelog entry verbatim.
7. In your response, include:
   - Chosen bump type and why (patch vs minor)
   - Chosen commit type and why (feat / fix / refactor / style / etc.)
   - New version
   - Commit SHA
   - The exact commit subject AND body (so the user can sanity-check)
   - A clear note that nothing was pushed
