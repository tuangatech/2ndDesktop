# Status

Kept current at every merge. A new session reads this right after `CLAUDE.md`.

## Where we are

- Version being worked on: **0.1** (the tank in the new repository, nothing changed), then 0.2.
- Last step done: BOOTSTRAP 7.2 steps 1 and 2. The first commit is on `main`; the import (PR 1, nothing renamed except two fixture names, see below) is merged as `1e2edf3` and tagged `v0.0.0-import`. The ruleset of BOOTSTRAP section 3 and the repository settings are applied.
- Next: step 3 (the rename), one PR, by hand, with the table of BOOTSTRAP 7.2. Then step 4 (the move). Before that the Mac reports on W-1.

## Baseline before any change (Windows, 2026-11-24, source fish-tank at `458922d`)

| Proof | Value |
| --- | --- |
| `npm test` | 25 files, 341 tests pass |
| `npm run test:e2e` | 38 tests pass |
| `npm run lint`, `npm run format:check` | clean |
| Golden hash (`tests/e2e/golden.spec.js`) | state `784820e6e804d032`, graph `5be771c4e5cb12a9` |
| `npm run shot -- base-window 1280x720 window 5` (SHA-256) | `2456E9FAADE866ED7C150A68E2831DD633E3BB9858DD528B171228F0600F35B1` |
| `npm run shot -- base-desktop 1920x1080 desktop 5` (SHA-256) | `231D72E839A6560D8B4FB41EA6295B7A41D02BD00C82EAC4D83AD086F16BE2DC` |

The pictures were taken twice on the Windows machine and the hashes were identical. They are valid for this machine only; the Mac records its own (`shasum -a 256`). Both pictures are written to `docs/screenshots/` (git-ignored).

## Differences from the source

- `tests/unit/diagnostics.test.js`: the fixture names `javat` and `tuan` became `alex` and `jane` already in the import, so that no real user name enters the public history. Test counts are unchanged.
- `docs2/` became `docs/` in the live path references only (`docs/README.md` title, `docs/scenes/fishtank-migration.md`, `docs/platform/03`); lines that describe the move itself or the old repository keep `docs2`.
- `.prettierignore`: the line `docs2/` was removed (`docs/` is already listed).

## Open hand checks

None yet. Step 6 of BOOTSTRAP 7.2 lists them (desktop mode, Win+D, display change, installed build, launch at login; the Mac: menu bar, Dock, first open of an unsigned build).

## Waiting for the owner

- The Mac session: W-1 in `TODO-Mac.md` (baseline, pictures and 7.3 proofs on the Mac, review of PR 1).
- Not done yet: `SECURITY.md`, the PR and issue templates, `CODEOWNERS` (step 5); labels (later).
- Decision for the owner: squash and rebase merging are still enabled on the repository (BOOTSTRAP section 3 says they may stay off); the ruleset requires a PR with both checks and zero approving reviews, with the repository admin role allowed to bypass.
