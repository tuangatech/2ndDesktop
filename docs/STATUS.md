# Status

Kept current at every merge. A new session reads this right after `CLAUDE.md`.

## Where we are

- Version being worked on: **0.1** (the tank in the new repository, nothing changed), then 0.2.
- Last step done: BOOTSTRAP 7.2 steps 1 to 3. The first commit is on `main`; the import (PR 1) is merged as `1e2edf3` and tagged `v0.0.0-import`; the rename (PR 2) is merged as `902c508`. The ruleset of BOOTSTRAP section 3 and the repository settings are applied.
- Step 4 (the move into the new layout, PR 3) is merged as `ee7cb5b`. Step 5 (the documents, PR 4) is merged as `73abb88`. The README is rewritten (PR 5, merged as `3377802`); CI now skips lint, tests, build and e2e when only `.md` files changed (PR 6, merged as `825a700`; the reduced path has not run on a real docs-only PR yet). Next: step 6 (the hand checks on both machines), then step 7 (P1). The Mac reports on W-1 (the import), W-2 (the rename) and W-3 (the move, with `dist:test`) in parallel.

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

## Small PRs from the Mac session's review (2026-11-25)

- Merged: PR 9 (macOS wording in the README, `SECURITY.md` and templates; `CODEOWNERS` gains `package.json` and the lock file) as `f1dde8e`, PR 10 (the window-with-a-tree icons replace the fish; new Windows tray icon) as `0f00099`.
- Merged after green CI: PR 12 (macOS: Show Desktop no longer pauses the tank, from the Mac session) as `4238774`; PR 7 (`ci.yml`: a very large code change was taken for Markdown-only because of `pipefail` and SIGPIPE) as `d9bc4f1` and PR 8 (the About text) as `24d96fa`. W-7 (the Mac looks at the icons and About on a real build, and the F11 result) is open.
- The window-picture proof on the Mac is "one of the two known hashes"; on Windows it must repeat exactly (working rule, in `TODO-Mac.md`, until the owner decides).
- Dependabot alert 1 (`minimatch`, medium, development scope via `electron-builder`; the fix is a major version) is open, for the owner to leave open or dismiss.
- The reduced CI path (Markdown only) has not run on a real PR yet: PR 9 touched `CODEOWNERS`, which is not a `.md` file, so it ran in full, as it should.

## Host and security review PRs (Mac review, 2026-11-25)

- Review: `docs/reviews/2026-11-25-host-security-review.md` (PR 13). Merged after green CI on both runners: PR 14 (a scene reads and writes only its own record), PR 15 (an installed release ignores the `DESKTOP2_*` and `VITE_DEV_SERVER_URL` switches), PR 18 (log under 1 MB, lines cleaned, page lines limited), PR 19 (the page session refuses permissions and requests outside the app's files), PR 20 (`dist` no longer fetches the x64 koffi package; `dist:universal` does), PR 17 (CI token read-only), PR 13 (the review). On `main`: lint, format and 32 files / 381 unit tests pass.
- Merged by the owner: PR 16 (Copy diagnostics leaves out the install id) as `b08d4cc`; its first macOS job had died for lack of a hosted runner (not code) and was re-run. All of PR 13 to 20 are now merged.
- Merged after green CI: PR 22 as `e2d168e` (About is a small window: the version under the name, the text over the full width; on Windows it had black text on a dark theme because the page's `prefers-color-scheme` stays light, so the page now sets its own colours). Windows hand check of it (tray click, title bar, installed build) is open.
- Merged after green CI: PR 23 (About stays above a tank window that is always on top; found in the owner's check of the installed build). Review for the Mac is W-10.
- Merged: PR 21 as `62ee0ef` (the installed app wrote to `%APPDATA%\2nddesktop`, not `2ndDesktop` as DEC-41 says, because Electron names the folder from `package.json`; adds `productName`, and an uninstall entry without the version). Merged at the owner's word before the Mac answered W-9; the Mac then reported PASS (its `dist:test` app keeps the same `2nddesktop` folder and finds the saved tank; APFS is case-insensitive here, a case-sensitive volume would start empty and is not handled). Windows, by the owner on 2026-11-26 after reinstalling: "Installed apps" shows `2ndDesktop`, `0.0.1`, `tuangatech`, 360 MB, with the new icon. PASS.
- Windows checks passed (see `TODO-Mac.md`, Re M-6): both pictures unchanged, 38 e2e, no `request refused`, no user path in the log, `dist:test` keeps and `dist` ignores `DESKTOP2_USER_DATA`. The `session-policy` unit test was Mac-only (hard-coded `file:///app/...`); fixed in PR 19.
- Decided by the owner (2026-11-26): review finding 1 (Windows cover check reads only the foreground window) moves to 0.2 and finding 4 (Electron fuses) to 0.3 (DEC-45 and DEC-46, in the branch `defer-review-findings`: the log, the roadmap rows and the review's status column). Finding 10a (single-instance lock before the data migration) can now be done, since the branches that touched the same lines are merged.

## Step 7 (P1, the platform core)

- Work packages 7.1 to 7.7 (loader spike, manifest check and the empty scene, main decides the scene, switching, the power setting, the sound split, baselines and the switch memory script); the plan is a scratch file on the Windows machine (`temp/`, not in the repository).
- 7.1 the loader spike: PR 24 is open (`docs/platform/06-loader-spike.md`). On Windows every required check passes; WebRTC leaks without a mitigation and not with any of the three. One correction proposed to `02`: `connect-src 'self'`, not 'none'. Mac run: W-11.

## Mac numbers (Apple silicon, 2026-11-24; details in `TODO-Win.md`, Re W-1 to W-6)

- Same counts as Windows at every step: 341 and 38 at the import, 356 and 38 after the rename and the move (26 e2e in `scenes/fishtank/tests/`). Lint and format clean. `npm run dist:test` builds an unsigned arm64 dmg; the app starts from it, copies the saved tank from `fish-tank`, and leaves the old folder unchanged.
- Desktop picture: `a2e0342be199455d6e3f01c46f59e7637bbc2a746b829d25afbabce922e4be7c`, stable, unchanged by the rename and the move.
- **Window picture: one of two values on this Mac**, not predictable between runs. Import and old checkout: `1d1d14fc…d8cc` or `044576b4…57be`. After the rename and the move (strip says "2ndDesktop"): `a7bc21be9ed5e7493b298e79852427e26b3f6a383f241c32cf58cafec746c245` or `d6fd2e7e8478b812de9a26e1ef4b923769bf3598ea2b93e5aebe3eb21f196367`. The two differ by at most 12 of 255 in nearly every pixel (a tone shift). The proof on the Mac is therefore "one of the two known values". Cause not known.
- Not seen yet (the session has no permission to read the menu bar or the screen): the menu bar title, the tray icon, the unsigned "Not Opened" first open. Owner to look.

## Open hand checks

**Windows, by the owner on 2026-11-25 (`npm start` from `main`, unpackaged):** desktop mode on and off, PASS; a maximized window over the desktop pauses the tank and it resumes when restored, PASS; **Win+D (Show Desktop) does not pause it** (unlike F11 on the Mac), PASS; the new icon in the tray and on the taskbar, light and dark, PASS; the About box opens with the new icon (its text was the old one: that app was started before PR 8 merged; PR 11 rewrote it and is merged as `55834af`).

**The installed build (owner, 2026-11-25, `npm run dist`, ran the installer):** PASS. It starts in desktop mode, the tray menu works, switching between window and desktop works, the Start menu finds it with the window-with-a-tree icon, About has the new text, and the uninstall works. Found: the data folder was `2nddesktop` and "Installed apps" showed "2ndDesktop 0.0.1" (PR 21). By design the uninstall keeps `%APPDATA%\2nddesktop` (saved tank, settings, and about 12 MB of Chromium caches). The installed size is 360 MB (the installer is 117 MB), normal for Electron. The Publisher is `author` (`tuangatech`), left as it is.

**Main display switch (owner, 2026-11-26, three screens, installed build):** after "Make this my main display" in Windows the scene is on the new main screen and the tray menu still works (collecting pellets). PASS. Not yet tried: unplugging a screen, a resolution change, and a scene on a screen that is not the main one (the app uses only the primary display; the cover check also looks only at it).

Still open on Windows: unplugging a display or changing its resolution, launch at login (with the installed build). Open on the Mac: the menu bar and tray icon by eye, the Dock, the first open of a downloaded unsigned build, and the F11 pause (Mac session, W-7).

## Waiting for the owner

- The Mac session has answered W-1 to W-6 in `TODO-Win.md` (see "Mac numbers"). Open from it: a follow-up PR for the CI file (`ci.yml` treats a very large code PR as markdown only), and the owner's look at the Mac menu bar and tray icon.
- Labels (later). Private vulnerability reporting is on (BOOTSTRAP section 3); `SECURITY.md` names it.
- Decision for the owner: squash and rebase merging are still enabled on the repository (BOOTSTRAP section 3 says they may stay off); the ruleset requires a PR with both checks and zero approving reviews, with the repository admin role allowed to bypass.
