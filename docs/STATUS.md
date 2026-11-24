# Status

Kept current at every merge. A new session reads this right after `CLAUDE.md`.

## Where we are

- Version being worked on: **0.1** (the tank in the new repository, nothing changed), then 0.2.
- Last step done: BOOTSTRAP 7.2 steps 1 to 3. The first commit is on `main`; the import (PR 1) is merged as `1e2edf3` and tagged `v0.0.0-import`; the rename (PR 2) is merged as `902c508`. The ruleset of BOOTSTRAP section 3 and the repository settings are applied.
- Step 4 (the move into the new layout, PR 3) is merged as `ee7cb5b`. Step 5 (the documents, PR 4) is merged as `73abb88`. Next: step 6 (the hand checks on both machines), then step 7 (P1). The Mac reports on W-1 (the import), W-2 (the rename) and W-3 (the move, with `dist:test`) in parallel.

## Baseline before any change (Windows, 2026-11-24, source fish-tank at `458922d`)

| Proof | Value |
| --- | --- |
| `npm test` | 25 files, 341 tests pass (after the rename PR: 28 files, 356 tests, the 15 new ones test the data copy, the scene options and the product names) |
| `npm run test:e2e` | 38 tests pass |
| `npm run lint`, `npm run format:check` | clean |
| Golden hash (`tests/e2e/golden.spec.js`) | state `784820e6e804d032`, graph `5be771c4e5cb12a9` |
| `npm run shot -- base-window 1280x720 window 5` (SHA-256) | `2456E9FAADE866ED7C150A68E2831DD633E3BB9858DD528B171228F0600F35B1`; after the rename PR `B7FDD3D19C951F717BB447BF6A801E9812ECBD0B56E1CA452EEB3DA295E38251` (see below) |
| `npm run shot -- base-desktop 1920x1080 desktop 5` (SHA-256) | `231D72E839A6560D8B4FB41EA6295B7A41D02BD00C82EAC4D83AD086F16BE2DC` |

The pictures were taken twice on the Windows machine and the hashes were identical. They are valid for this machine only; the Mac records its own (`shasum -a 256`). Both pictures are written to `docs/screenshots/` (git-ignored).

## Differences from the source

- `tests/unit/diagnostics.test.js`: the fixture names `javat` and `tuan` became `alex` and `jane` already in the import, so that no real user name enters the public history. Test counts are unchanged.
- `docs2/` became `docs/` in the live path references only (`docs/README.md` title, `docs/scenes/fishtank-migration.md`, `docs/platform/03`); lines that describe the move itself or the old repository keep `docs2`.
- `.prettierignore`: the line `docs2/` was removed (`docs/` is already listed).

## The rename PR (BOOTSTRAP 7.2 step 3)

- Golden hash unchanged (state `784820e6e804d032`, graph `5be771c4e5cb12a9`), 38 e2e tests green. The desktop picture is byte-identical to the baseline.
- **The window picture changed on purpose**: the strip at the top of the window says "2ndDesktop" instead of "Fish Tank". A pixel comparison with the import picture finds 904 different pixels, all inside the box x 12 to 109, y 10 to 26 (the title text); nothing else moved. The new hash was the same on two runs. The Mac records its own pair.
- `FISHTANK_ID` is not an environment variable: it is the exported scene id constant of the tank (`scenes/fishtank/index.js`) and stays. The key `fishtank` inside `window.__scene` (the tank's scene object, used by the tests) also stays until the tank's folder is regrouped.

## The move PR (BOOTSTRAP 7.2 step 4)

- `git mv`: `electron/` to `app/main/`, `renderer/` to `app/page/`; the host unit tests to `tests/host/`; the tank's own tests (9 unit, 4 end-to-end: `backdrop`, `layout`, `palette`, `pacing`, `pointer`, `repository`, `rules`, `species`, `steering`; `feeding`, `game`, `golden`, `step6`) to `scenes/fishtank/tests/`. Git sees every file as a rename. `build/` and `assets/` stay where they are (they move with the tank regrouping).
- Counts unchanged: 28 files, 356 unit tests; 38 e2e tests (26 of them in `scenes/fishtank/tests/`). The golden hash is unchanged and the file differs from before only in its import paths and one comment. Both pictures give the same hashes as after the rename PR (`B7FDD3D1…8251` and `231D72E8…E2DC`).
- Paths fixed: `package.json` `main`, `electron-builder.yml` `files:`, Vite root and out dir (the build still goes to `dist/renderer/`), the glob paths of `art.js` and `scenes.js`, the ESLint globs (the tests of a scene are outside the scene clock rule), the Vitest include and the Playwright `testMatch`.
- `npm run dist:test` built the Windows installer; the unpacked app starts in window mode, saves its records and settings, and its asar holds `app/main/`, the page and the tray images. The installer itself was not run (a hand check). The Mac has not built anything yet.

## The documents PR (BOOTSTRAP 7.2 step 5)

- New: `SECURITY.md`, `.github/PULL_REQUEST_TEMPLATE.md` (the proofs of 7.3 as checkboxes), `.github/ISSUE_TEMPLATE/` (bug report, scene idea), `.github/CODEOWNERS` (`app/main/`, `electron-builder.yml`, `platform/02`, `.github/`, `SECURITY.md`: the owner), `docs/reference/README.md`. `docs/README.md` is the current index; `assets/art/STYLE.md` moved to `docs/art-style.md`.
- The design set: the live path references (`platform/01`, `02`, `05`, `scenes/fishtank-migration.md`) now name the new paths. `platform/03` section 7.2 and `platform/04` are plans written against the fish-tank tree, so each got a note saying which old path is which new one instead of a rewrite; the `docs/03`, `05`, `06` row of `platform/03` now says "copied" (Q5).
- Not in this PR: `CHANGELOG.md` and `CONTRIBUTING.md` (0.5), the labels, the `.claude/settings.json` allow list and `npm run verify` (recommendations 4 and 6 of BOOTSTRAP section 9).

## Open hand checks

None yet. Step 6 of BOOTSTRAP 7.2 lists them (desktop mode, Win+D, display change, installed build, launch at login; the Mac: menu bar, Dock, first open of an unsigned build).

## Waiting for the owner

- The Mac session: W-1 in `TODO-Mac.md` (baseline, pictures and 7.3 proofs on the Mac, review of PR 1).
- Labels (later). Private vulnerability reporting is on (BOOTSTRAP section 3); `SECURITY.md` names it.
- Decision for the owner: squash and rebase merging are still enabled on the repository (BOOTSTRAP section 3 says they may stay off); the ruleset requires a PR with both checks and zero approving reviews, with the repository admin role allowed to bypass.
