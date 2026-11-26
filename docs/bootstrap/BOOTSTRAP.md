# Bootstrap: starting the 2ndDesktop repository

Status: Draft v0.1, 2026-11-24. For the owner and for a **new Claude session that has never seen this project** (Windows or Mac). It joins three things that were spread over the design set: what to copy from fish-tank (`platform/04`, `platform/03` section 7, `scenes/fishtank-migration.md`), how to set up a development computer (`reference/fishtank-v1/02-tech-design.md` section 14), and what a fresh session needs to be useful on day one. Where this document and `platform/04` differ, **this one is newer** and says so.

New repository: <https://github.com/tuangatech/2ndDesktop> (public, empty on 2026-11-24). Old repository: `tuangatech/fish-tank`, **private from 2026-11-24**, kept as the archive and as the source of the copy. Product name `2ndDesktop`; in identifiers `2nddesktop`; in environment variables `DESKTOP2_` (a variable name cannot start with a digit).

## 0. Read this first (what a new session does, in order)

1. Read `docs/00-2nddesktop-specs.md` (the one-page product), then this file.
2. Read `docs/platform/04-reuse-from-fish-tank.md` sections 2, 3 and 5 (the method, the leaks, what is easy to break). The rest of the design set is reference: `docs/DECISIONS.md` (why), `docs/platform/01` (contract), `02` (security), `03` (releases and roadmap).
3. The decisions of section 2 are made; **do not ask the owner again**. Anything the document does not settle is a question, but only after you have read `DECISIONS.md` and `platform/04`.
4. Do the steps of section 7 in order. Each step is one small PR, green on both runners, and the proofs of section 7.3 must hold after it.
5. Write what you learned back into `docs/STATUS.md` and, for the other machine, into your mailbox file (section 8).

The plan is the roadmap's version **0.1** (the tank in the new repository, nothing changed) and then **0.2** (platform core and the farm house, offline). Nothing after 0.3 is backlog (`platform/03` section 6.1).

## 1. Where things stand

| Fact | Value |
| --- | --- |
| Source of the copy | the local fish-tank checkout, at a **clean commit on `main`** (the import script refuses a dirty tree). The checks below were run at `7473440` plus the bootstrap files; the real snapshot is the commit that holds this document (the script prints it) |
| Why a local checkout | fish-tank is private now; the owner's `gh` login can read it, but a copy script and the Claude session work from disk. **Keep both machines' fish-tank checkouts until version 0.3 is out** and never delete the old repository |
| Baseline before any change (Windows, 2026-11-24) | `npm test`: **25 files, 341 tests pass**. `npx playwright test`: **38 tests pass**. ESLint, Prettier and `vite build` clean. The state hash of `tests/e2e/golden.spec.js` is the proof that nothing moved |
| Import checked | The script of section 6 was run into an empty folder and that copy passed all of the above: 172 files, 341 unit and 38 end-to-end tests, lint, format and build. The copy is complete |
| Two machines | Windows (Git Bash for the session's tools, PowerShell for the owner) and a Mac (Apple silicon). Only the Windows session's `gh` opens and merges PRs |
| Not copied | node_modules, dist, release, generated atlases and screenshots, `design-comments.md`, the mailbox history, `CLAUDE.md` and `README.md` (rewritten) |

## 2. Decisions (made, 2026-11-24)

The owner asked for these to be settled in the document so that **no session asks them again**; each takes the recommendation. They are in `DECISIONS.md` as DEC-41 to DEC-44. A change later is a new decision, and the ids and folders below cannot be renamed after the first release without losing pinned shortcuts, the open-at-login entry and saved data.

| # | Decision | Value | Why |
| --- | --- | --- | --- |
| Q1 | Bundle id and Windows app id | `com.tuangatech.2nddesktop` (the old one is `com.weekend.fishtank`) | Set once. A label that starts with a digit is allowed by Apple's rules but **not tried**: the first Mac build must open, which is a check in 7.2 |
| Q2 | `productName` and the data folder | `productName: 2ndDesktop`, set explicitly in `electron-builder.yml`. Data folder `2ndDesktop` (Windows `%APPDATA%\2ndDesktop`, Mac `~/Library/Application Support/2ndDesktop`); development uses `2ndDesktop (dev)`. First start copies `records/fishtank.json` and `settings.json` from the old folder `fish-tank` if the new one has no `records/` (a copy, never a move) | Today `package.json` has **no** `productName`, so the folder is named after its `name` (`fish-tank`, measured on both systems); a new name means an empty folder, and the owner's saved tank would not load (`platform/04` section 5, point 1, decided 2026-11-23) |
| Q3 | Commit identity | The GitHub no-reply address (`<id>+tuangatech@users.noreply.github.com`) for `user.email` on **both** machines, and "Block command line pushes that expose my email" switched on | The local git email is a personal mailbox; every commit in a public repository shows it, forever |
| Q4 | The mailbox files in the public repository | Keep `TODO-Mac.md` and `TODO-Win.md`, with rules only and no history. Nothing private is ever written in them (no path with a user name, no address, no token) | They are how the two sessions talk. Public means strangers can read the working notes, so they stay short and clean |
| Q5 | Old documents | Copy **all** old numbered plans and notes to `docs/reference/fishtank-v1/` (01 to 06, desktop-spike, edit-mode-spike, gate-g1, perf-notes), with a `docs/reference/README.md` that says what an old name means. This **replaces** "not copied" for `docs/03`, `05`, `06` in `platform/03` section 7.2 and `platform/04` section 4 (DEC-43) | 30 source files cite `D1`, `D31`, `D38` and so on, and comments point at `docs/desktop-spike.md` and `docs/03-platform-design.md`; without them the references lead nowhere. About 420 KB of text |
| Q6 | Who pushes to `main` | Pull requests for app code, green on both runners. The owner may push to `main` directly (bypass in the ruleset), and the sessions push **only** the mailbox files and `docs/STATUS.md` directly. The first commit on `main` is a bare `README.md` pushed directly (7.2 step 1) | The protocol already says this; the ruleset of section 3 must allow it |

Decided earlier (do not ask again): the name; Apple silicon only for the first Mac download; English only; Electron stays; the new repository starts from a snapshot with no history; three commits (import, rename, move); the old tank's scene id `fishtank` and its record file name stay (`platform/04` section 5); fish-tank is private and 2ndDesktop is public (owner, 2026-11-24).

## 3. Set up the GitHub repository (owner approves each setting)

These change shared settings, so the session proposes and the owner says yes. The Windows session's `gh` does them.

```powershell
gh repo edit tuangatech/2ndDesktop --description "A living scene on your desktop: fish tank, farm house, and more. Windows and macOS. Open source scenes." --delete-branch-on-merge --enable-wiki=false --enable-projects=false --add-topic electron --add-topic pixijs --add-topic desktop --add-topic wallpaper --add-topic windows --add-topic macos
```

Settings that `gh repo edit` does not cover (do in the web page, Settings, or with `gh api`):

- **Actions, General:** workflow permissions "Read repository contents" only; fork pull requests "Require approval for all outside collaborators" (a public repository runs the code of a PR's workflow, so a stranger could burn minutes or try to read secrets). Leave "Allow GitHub Actions to create and approve pull requests" off. Public repositories run CI free on Windows and macOS runners.
- **Code security:** turn on secret scanning with **push protection**, Dependabot alerts and security updates, and **private vulnerability reporting** (it is the contact path that `SECURITY.md` names).
- **Ruleset for `main`:** block force pushes and deletion; **require the two checks `Check (macos-latest)` and `Check (windows-latest)`** for pull requests; add the owner (repository admin) to the **bypass list** ("always"), because the mailbox protocol commits `TODO-*.md` straight to `main`. Without the bypass the first mailbox commit is refused. A check name appears in the list only after the workflow has run once, so create the ruleset after the import PR (7.2 step 2), not before.
- **General:** merge commits allowed (the protocol merges with `--merge`; squash and rebase may stay off), "Automatically delete head branches" on.
- **Labels:** `host`, `scene`, `docs`, `mac-only`, `win-only`, `good first scene` (for 0.5). Add later, not now.
- **Do not** enable Discussions, Pages or a Wiki yet. The download page (GitHub Pages) comes with version 0.3.

## 4. The development environment (Windows and macOS)

Everything in the repository is plain Node or npm scripts, so the commands are the same on both systems. Only the way to set an environment variable for one run differs.

### 4.1 Prerequisites

| Tool | Version | Windows | macOS |
| --- | --- | --- | --- |
| Git | 2.40 or newer | Git for Windows (also gives Git Bash) | Xcode Command Line Tools: `xcode-select --install` |
| Node.js | **24** (the repository pins `>=24 <25` and `.nvmrc`) | `winget install Schniz.fnm`, then `fnm use` | `brew install fnm`, then `fnm use` |
| npm | 11 (comes with Node 24) | | |
| GitHub CLI | current | `winget install GitHub.cli`, then `gh auth login` | `brew install gh`, then `gh auth login` |
| Editor | VS Code with the ESLint and Prettier extensions | | |

No Visual Studio Build Tools, no Python, no Docker, no database: the only native module is `koffi`, which ships prebuilt binaries. A Mac is needed to build and test the macOS installer; a Windows PC for the Windows one (CI builds both, but the look and feel must be checked on real machines).

### 4.2 First time

```powershell
git clone https://github.com/tuangatech/2ndDesktop.git
cd 2ndDesktop
fnm use
npm ci
npm run build
npm test
npm run dev
```

Use `npm ci` (not `npm install`) so the lock file decides the versions. **Use `npm start` and `npm run dev`, never bare `electron`**: both go through `scripts/run-electron.mjs`, which removes `ELECTRON_RUN_AS_NODE` (some editors set it, and then Electron behaves like Node).

If `node_modules/electron/dist` is missing after install (npm 11.17 and later hold back install scripts that are not approved: "allow-scripts"), run `node node_modules/electron/install.js` once. This happened on the Mac. The other held-back scripts (`koffi`, `electron-winstaller`, `fsevents`) are not needed to run.

### 4.3 Commands (the names of today; renamed in step 7.2 only where said)

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite on `localhost:5173` and Electron pointing at it; the page reloads on save, restart after changing the main process |
| `npm run build` then `npm start` | The built app, as the packaged one runs |
| `npm test` | Vitest unit tests (341 at the snapshot) |
| `npm run test:e2e` | Builds, then Playwright for Electron (38). The tests use the **built** `dist/`, so build first when running `npx playwright test` by hand |
| `npm run lint`, `npm run format:check`, `npm run format` | ESLint, Prettier |
| `npm run shot -- <name> [WxH] [window\|desktop] [seconds]` | A reproducible screenshot into `docs/screenshots/` (fixed seed, manual clock, seeded `Math.random`), without touching the real screen. Two runs of the same code on one machine give the same picture |
| `npm run assets` | Renders the SVG art and tray icons, packs one atlas per scene (generated, git-ignored) |
| `npm run sim`, `measure:alloc`, `sounds` | Pacing simulator, garbage per frame, sound lab |
| `npm run attach:lab` (and `:nogpu`, `:swcomp`) | Shows each desktop-attach variant for a few seconds; for diagnosing attach problems on Windows |
| `npm run dist`, `dist:test` | Installer for the current system into `release/`; `dist:test` sets the channel to `test` |

### 4.4 Environment variables for one run (the prefix is `DESKTOP2_` after step 7.2; `FISHTANK_` before)

| Shell | Example |
| --- | --- |
| macOS Terminal (zsh, bash), Git Bash | `DESKTOP2_MODE=desktop DESKTOP2_DEBUG=1 npm start` |
| Windows PowerShell | `$env:DESKTOP2_MODE='desktop'; $env:DESKTOP2_DEBUG='1'; npm start` |

The PowerShell form does nothing in zsh and gives no error (the app starts in window mode); in PowerShell the variables **stay set for the whole session** (clear with `Remove-Item Env:DESKTOP2_MODE`). A variable that forces `MODE` hides the saved display mode, so a dev run never depends on it. The main ones: `USER_DATA` (a separate save folder, so tests never touch a real save), `TEST=1` (test hook and fake clock), `SEED` and `MANUAL_TIME=1` (the end-to-end tests set both: fixed random seed, the scene moves only when the test says), `DEBUG=1`, `DEV=1`, `SAMPLE=1`, `WINDOW_SIZE=WxH`, `SCENE_OPTIONS` (JSON for the scene; replaces `FISHTANK_FISH`). The full list is in section 7.2's table and in `reference/fishtank-v1/02-tech-design.md` 14.4.

### 4.5 Where the dev data is

| System | Dev data folder | Packaged app |
| --- | --- | --- |
| Windows | `%APPDATA%\2ndDesktop (dev)` | `%APPDATA%\2ndDesktop` |
| macOS | `~/Library/Application Support/2ndDesktop (dev)` | `~/Library/Application Support/2ndDesktop` |

It holds `settings.json`, `records/<scene>.json`, `diagnostics.json` and `desktop-spike.log` (a text log of what the main process did; it holds no personal data and a tester can send it back).

### 4.6 Gotchas that cost time before (read once)

- A tank left running **in desktop mode holds the single-instance lock**, so a second `npm start` shows nothing. Quit from the tray menu, or end the process.
- **Desktop mode cannot be tested in CI** (a runner has no real desktop). It is checked by hand on a real Windows PC and a real Mac, and the owner is at the keyboard for it.
- A CI memory number is only a comparison with an empty scene in the same run. Real numbers come from real machines (Windows private bytes, Mac `phys_footprint`; never the Mac "working set").
- If Vitest will not start locally on a machine, `npx vitest run --pool=vmThreads` was the workaround (Windows, 2026-11).
- Paths: `path.join` and `app.getPath` only; file names lowercase with dashes (macOS is case-insensitive, CI is not); LF line endings (`.gitattributes`). On Windows with Git Bash, an `electronDist` path for electron-builder must be `C:/...`, not `/c/...`.
- Never write a test that depends on `Math.random` or on where a fish happens to be: **one macOS CI flake (a floating pellet under the fish took the click) took three runs to find**. Park the objects or use the seed.
- The macOS build is unsigned until 0.3: first open shows "Not Opened"; Privacy & Security, Open Anyway. The README of every build says so.
- Chromium's WebGL on a Mac costs about 245 MB for an empty page (ANGLE over Metal), which is why the Mac memory limit is 350 MB.

## 5. The proposed repository structure

**At commit 1** the layout is the fish-tank layout, unchanged (so the copy can be proven). **After commit 3 and the tank's regrouping** it is:

```
2nddesktop/
  app/
    main/               Electron main process (was electron/): desktop attach, tray, power, store, settings,
                        diagnostics, scene registry; preload.cjs is rewritten later (leak 3)
    page/               the host's page (was renderer/): PixiJS app, loop, art loading, sound engine, host.js
                        (the contract typedefs), index.html
    assets/             the app's own icons and tray images (was build/ and assets/tray/)
  scenes/
    fishtank/           first scene; later regrouped into game/ view/ ui/ data/ assets/ tests/ (scenes/fishtank-migration.md)
    farmhouse/          0.2
    (templates/scene/   at the repository root, copied by `npm run new-scene <id>`: DEC-52)
  shared/               rng.js, what every scene may import
  scripts/              build-assets, shot, make-icons, run-electron, measure-alloc, pacing-sim, sound-lab, koffi-universal
  spikes/               edit-mode (reference); loader spike (P1) goes here first
  tests/
    host/               unit tests of the host (cover, desktop, store, settings, menu, ...)
    e2e/                host end-to-end (smoke, app-menu, window, display-mode, diagnostics)
                        (the tank's own tests live in scenes/fishtank/tests/)
  docs/
    00-2nddesktop-specs.md  README.md  DECISIONS.md  STATUS.md
    platform/ (01 to 05)   scenes/   icon/   bootstrap/ (this file)
    art-style.md        the style guide (was assets/art/STYLE.md)
    reference/          README.md maps old names to files; fishtank-v1/ (old spec, plans, measurements)
  .github/
    workflows/ci.yml  (later release.yml)   PULL_REQUEST_TEMPLATE.md   ISSUE_TEMPLATE/   CODEOWNERS
  .claude/settings.json  (shared permissions; settings.local.json is git-ignored)
  CLAUDE.md  README.md  LICENSE  NOTICE  SECURITY.md  CHANGELOG.md  CONTRIBUTING.md (0.5)
  TODO-Mac.md  TODO-Win.md
  package.json  electron-builder.yml  eslint.config.js  vite.config.js  vitest.config.js  playwright.config.js
  .editorconfig  .gitattributes  .gitignore  .nvmrc  .prettierrc  .prettierignore
```

Rules of the layout: the host never imports from `scenes/`, except the one bundled-scene registry; a scene imports only `shared/` and its own folder (the tank today reaches `assets/spritesheets/` from `textures.js`, which is leak 9 and is fixed with `host.art`); `scenes/*/game/` stays free of Pixi, DOM and Node (ESLint enforces it: **change the glob when the folder moves, or the protection stops silently**).

**Recommendation on the timing of the moves** (this settles `platform/04` section 8, point 4): keep `electron/` and `renderer/` through commits 1 and 2, then do the move to `app/main` and `app/page` as commit 3 in its own PR, as `platform/04` planned. Regroup the tank's folder in a **later, separate PR**, before the farm house is started. Never mix a move with a rename.

## 6. What to copy, and how

The script `docs/bootstrap/import-from-fishtank.mjs` (in this folder) does the whole copy with the **same paths**, writes `NOTICE` and the two mailbox files (rules only), and prints what it did. It has a `--dry-run`, never writes to the source, and refuses a source with uncommitted changes or a target that is not empty.

```powershell
node ..\fish-tank\docs2\bootstrap\import-from-fishtank.mjs ..\fish-tank . --dry-run
node ..\fish-tank\docs2\bootstrap\import-from-fishtank.mjs ..\fish-tank .
```

(Run from the empty clone of 2ndDesktop. On a Mac use forward slashes. The two folders are expected to sit side by side.)

| Copied | To | Notes |
| --- | --- | --- |
| `electron/`, `renderer/`, `shared/`, `scripts/`, `spikes/`, `tests/`, `scenes/` | same paths | 172 files in all. `scenes/fishtank/art/` (19 SVG sources and the generated scenery SVG) comes with the scene |
| `package.json`, `package-lock.json`, `electron-builder.yml`, `eslint.config.js`, `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc`, `.prettierrc`, `.prettierignore`, `LICENSE`, `.github/workflows/ci.yml` | same paths | Renamed in commit 2 |
| `build/app-icon.svg`, `icon.png`, `icon-mac.png`; `assets/app-icon.png`, `assets/tray/`; `assets/art/STYLE.md` | same paths | The icons are replaced by `docs/icon/` drafts in commit 2 or later (keep the output names `trayTemplate.png` and `trayTemplate@2x.png`; macOS adapts the tray icon only for `*Template.png`) |
| `docs2/` | `docs/` | The design set. After the copy, replace the text `docs2/` by `docs/` in these files (a plain search) |
| `docs/*.md` (old plans, notes, spikes) | `docs/reference/fishtank-v1/` | Question Q5. Write `docs/reference/README.md`: "`docs/desktop-spike.md` in a comment means `docs/reference/fishtank-v1/desktop-spike.md`; FR, NFR and D numbers belong to the archived spec" |
| `TODO-Mac.md`, `TODO-Win.md` | root | Only the "why" and "rules" sections, then empty sections. Edit the text for the new project |

**Not copied:** `CLAUDE.md` and `README.md` (rewrite: appendix A and section 9), `design-comments.md` (the Mac's review of the design set; its answers are in `DECISIONS.md`), the mailbox history, `docs/screenshots/`, `assets/spritesheets/` and `contact-sheet-*.png` (generated by `npm run assets`), `dist/`, `release/`, `test-results/`, `node_modules/`, `.claude/settings.local.json`.

## 7. The sequence of PRs

Each step is its own PR, green on both runners, merged by the Windows session, with a review task for the other session in its mailbox file. The Windows session runs it first; the Mac session repeats the checks of 7.3 on its own machine after each merge.

### 7.1 Before commit 1

**The owner, on the Windows computer (about 15 minutes; this is the plan you proposed, reviewed):**

1. In fish-tank: the session commits and pushes this document and the script to `main` first (the script reads the design set from the **committed** tree, and the snapshot hash it prints must be the one with the bootstrap files in it). Note the hash.
2. Put the two folders side by side: `C:\ML-Projects\Weekend-Projects\fish-tank` and, next to it, `git clone https://github.com/tuangatech/2ndDesktop.git` (so `..\fish-tank` is the source).
3. In the new clone, **before any commit**, set the identity of Q3 (this clone only, so no `--global`): `git config user.name "Tuan Tran"` and `git config user.email "90934329+tuangatech@users.noreply.github.com"` (the number is the owner's GitHub id, from `gh api user --jq .id`; the address is shown in GitHub, Settings, Emails). Check it with `git config --show-origin --get-regexp "^user.(name|email)$"`: both lines must come from `.git/config` and show the no-reply address. In the same page switch on "Keep my email addresses private" and "Block command line pushes that expose my email".
4. Do **not** copy `docs2` by hand. The script copies it to `docs/` and brings the committed bootstrap files with it, so there is one path to follow and nothing goes stale. (If you copy it anyway, the script keeps what is there and never overwrites it.)
5. Open the Claude session in the new clone, and **add `..\fish-tank` as an additional folder** of the session (the desktop app asks for a directory; the session reads the script and the source from there and does not change them). Without it the session cannot read `..\fish-tank\docs2\bootstrap\BOOTSTRAP.md` or run the script.
6. Paste the Windows message of Appendix B. Approve the repository settings of section 3 when the session proposes them (all but the ruleset).

**The Windows session:**

1. Confirm the identity of step 3 (`git config user.email` must not be a personal address) and that `..\fish-tank` is clean, on `main`, at the snapshot commit.
2. Run the baseline there: `npm ci`, `npm test` (341), `npm run test:e2e` (38).
3. **Record the pictures** before anything moves: `npm run shot -- base-window 1280x720 window 5` and `npm run shot -- base-desktop 1920x1080 desktop 5`, then `Get-FileHash docs/screenshots/base-*.png` (PowerShell). Keep the hashes for `docs/STATUS.md`. After every step below the same two commands must give the same hashes **on the same machine**.

**The Mac session (later, after the import PR is open; Appendix B):** `git pull` in its old fish-tank checkout (the repository is private, so the Mac's git must be logged in to GitHub: `gh auth login`, or the credential helper it already has), clone 2ndDesktop, **set the same two lines in its own clone** (`git config user.name "Tuan Tran"` and `git config user.email "90934329+tuangatech@users.noreply.github.com"`, no `--global`, then the check of step 3 above), run the baseline of step 2 and the two pictures of step 3 with `shasum -a 256`, and report in `TODO-Win.md`.

### 7.2 The steps

1. **The first commit on `main`.** An empty repository has no `main`, so a pull request cannot be opened yet. The session makes one small commit directly on `main`: a `README.md` of three lines (name, "work in progress", the licence) and nothing else, and pushes it. (The ruleset does not exist yet; that is why this is allowed.) The script accepts this README and a `docs/` folder.
2. **Commit 1, "Import from fish-tank at `<hash>`".** On a branch `import`: run the script (`--dry-run` first), then write the new `CLAUDE.md` (appendix A), replace `docs2/` by `docs/` in the copied design set (a plain search), `git add`, commit, push, open the PR. CI must be green and the proofs of 7.3 hold, with **nothing renamed**. Merge. Tag `v0.0.0-import`. Then, with the owner's yes, create the ruleset of section 3 (the check names exist only after this first run).
3. **Commit 2, "Rename".** One PR, with the table below in the commit message. Do it **by hand, file by file**, never with a blanket search and replace: the scene id `fishtank`, the record file `records/fishtank.json` and the strings inside the tank scene stay. The golden hash must not change; do not update the snapshot to make it pass.

| Old | New | Where |
| --- | --- | --- |
| `com.weekend.fishtank`, `Fish Tank` (product) | per Q1, `2ndDesktop` | `electron-builder.yml` (`appId`, `productName`, `copyright`), `package.json` (`name: 2nddesktop`, `description`, `author` stays), `main.js` (`setAppUserModelId`, the dev data folder name), `menu.js`, `tray.js`, `diagnostics.js`, `index.html`: one `PRODUCT_NAME` constant |
| `FISHTANK_*` (19 names: `TEST`, `MODE`, `DEBUG`, `SEED`, `FISH`, `CHROMIUM_FLAGS`, `USER_DATA`, `WINDOW_SIZE`, `MANUAL_TIME`, `LAB_VARIANTS`, `LAB_SECONDS`, `DEV`, `ATTACH_LAB`, `NO_GPU`, `TEST_RENDER_MODE`, `ID`, `DIAG_MS`, `TEST_MINIMIZE_AT`, `SAMPLE`) | `DESKTOP2_*`; `FISHTANK_FISH` becomes `DESKTOP2_SCENE_OPTIONS` holding JSON such as `{"fish":8}` | `electron/`, `scripts/`, `tests/` (`helpers.js` 7 times, `shot.mjs` 9, `measure-alloc.mjs` 5), `package.json` scripts. Search with `FISHTANK_` after the change: nothing may remain |
| `window.fishtank` (the bridge global) | `window.desktop2` | `preload.cjs`, `renderer/`, tests |
| `window.__tank`, key `fishtank.reloads` | `window.__scene`, a neutral key | `renderer/main.js`, `reloadGuard.js`, tests `feeding`, `game`, `golden`, `smoke`, `step6` |
| `package.json` key `fishtank.channel` | `desktop2.channel` | `package.json`, `electron/` (the `dist:test` switch) |
| `fishtank-csp` (the Vite plugin) | `desktop2-csp` | `vite.config.js` (read the plugin before touching it) |
| `tests/e2e/app-menu.spec.js` expects the literal `'Tank'` on macOS | read the name from the default scene's manifest | the scene is renamed "Fish tank" later |
| Real names in tests (`javat`, `tuan`) | an invented name (`alex`, `jane`) | `tests/unit/diagnostics.test.js` (public repository) |
| `mac.target` universal; no language filter | `arch: arm64`, `electronLanguages: en`; keep the koffi `asarUnpack` and `x64ArchFiles` lines | `electron-builder.yml` (decided in `platform/03` section 3.4) |
| (new) one-time copy of `records/fishtank.json` and `settings.json` from the old data folder (`fish-tank`) when the new one has no `records/` | | `electron/main.js` or `store.js`, with a unit test; about 30 lines; one log line, no question |

4. **Commit 3, "Move into the new layout".** `git mv electron app/main`, `git mv renderer app/page`, tests into `tests/host/` and the tank's own tests into `scenes/fishtank/tests/`. Then fix every path: `package.json` `main`, `electron-builder.yml` `files:`, the Vite roots and `import.meta.glob`, the ESLint globs, the Vitest include (**it must list `scenes/**/tests/`, or tests silently stop running**: count them after: 341 and 38), the CI cache keys. Run `npm run build`, **`npm run dist:test` on both systems and open the installer once**.
5. **Documents.** `docs/README.md` (index), `docs/STATUS.md`, `docs/reference/README.md`, `SECURITY.md`, the PR and issue templates, `.github/CODEOWNERS`. `.prettierignore` already lists `docs/`.
6. **First hand checks on both machines** (owner at the keyboard): desktop mode on and off, Win+D and the display change on Windows, the menu bar and the Dock on the Mac, an installed build opens, launch at login. The old open checks (W-3, W-5, W-6, W-8, W-9 of the old `TODO-Mac.md`) are listed in `docs/STATUS.md`.
7. **Then P1 of the roadmap** (`platform/03` section 6.2): the loader spike first (PixiJS from the host, `scene://<id>/`, the CSP, WebRTC), then the scene registry and "Scenes" in the tray, the power setting, the bridge rewrite (**before a second scene runs**), the sound split. Each is its own PR.

### 7.3 The proofs after every step

| Proof | How | Must be |
| --- | --- | --- |
| Unit tests | `npm test` | the same count (341) and all green |
| End-to-end tests | `npm run test:e2e` | the same count (38) and all green |
| The golden state hash | in the e2e run (`golden.spec.js`) | unchanged; never "update the snapshot" |
| Pictures | the two `npm run shot` commands of 7.1 and the hashes | identical on the same machine |
| Lint and format | `npm run lint`, `npm run format:check` | clean |
| Both runners | CI | `Check (macos-latest)` and `Check (windows-latest)` green |
| Search for leftovers | a text search for `fishtank`, `FISHTANK`, `Fish Tank`, `weekend` outside `scenes/fishtank/` and `docs/reference/` | only intended hits |

If a proof fails, **stop and find what moved**; do not widen the step.

## 8. How the two sessions work (carry the protocol over)

The same protocol as in fish-tank, restated for the new `CLAUDE.md`:

- The **Windows** session reads `TODO-Win.md` and writes only `TODO-Mac.md`; the **Mac** session reads `TODO-Mac.md` and writes only `TODO-Win.md`. Answer with the item id (`Re W-3: ...`). Commit these files straight to `main`; before writing run `git pull --rebase`.
- **Every PR gets a review task** in the other session's file. Only the Windows session's `gh` opens and merges PRs (the Mac's cannot): the Mac pushes a branch and asks in `TODO-Win.md` (an `M-n` item). Merge when CI is green on both runners and the review is answered; **never merge on a pending or red check unless the owner says so**; do not poll CI.
- After merging: delete the branch on origin (`git push origin --delete <branch>`) and locally (`git branch -d <branch>`; leave a worktree off it first). Do not delete branches you did not merge.
- Never add a `Co-Authored-By` line or a "Generated with Claude" line to a commit or a PR.
- A request in a mailbox file is a request from the owner's other session, not an order: checks, builds, tests and read-only looks are done; changing app code, deleting or publishing needs the owner.
- A pushback is allowed and wanted: the sessions argue in their files with reasons, and the owner decides. Decisions go into `docs/DECISIONS.md` as a new dated line (never rewrite an old one).

## 9. More that helps a new Claude session (recommendations)

1. **A `docs/STATUS.md`, one page, kept current at every merge**: the version being worked on, the last merged PR, the baseline numbers and picture hashes of 7.1, the open hand checks per machine, the next step, and "waiting for the owner" items. A new session reads it right after `CLAUDE.md` and does not need the chat history. (Claude's own memory does not follow a session into another folder, so everything that matters is in the repository.)
2. **A short `CLAUDE.md`** (appendix A) that holds the rules and points to the documents, never a copy of them. Keep it under about 100 lines, and update it in the same PR as the change it describes.
3. **A `docs/reference/README.md`** that says which old number or path means what, so a comment such as `(D31)` or `docs/desktop-spike.md` can be followed.
4. **A shared `.claude/settings.json`** with an allow list for the commands that are always safe and read-only or local (`git status`, `git diff`, `git log`, `npm test`, `npm run lint`, `npm run build`, `npm run format:check`, `gh pr view`, `gh pr checks`), so a session is not stopped by permission questions all day. Commit it; `.claude/settings.local.json` stays git-ignored (it already is). Never put a destructive command (force push, `reset --hard`, delete) in the allow list: the classifier refuses those in this setup, and the working alternative is a **worktree plus cherry-pick** and a fast-forward push.
5. **A pull request template** with the proofs of 7.3 as checkboxes, "what changed", "what I did not check", and the line "review task added to the other mailbox". An issue template for "bug" and for "scene idea" (version 0.5).
6. **A scripted check, `npm run verify`** (add in P1): lint, format, unit tests, build and the e2e suite in one command, with the counts printed. Sessions then report the same line every time.
7. **One concern per PR, and a PR under about 400 changed lines** where it can be. A mixed move-and-rename PR cannot be reviewed; the golden hash cannot tell which part broke it.
8. **Spikes before design.** The loader spike (P1) decides how scenes load; the WebRTC question and the `input-event` name for the unmute signal are answered there. Write the result into `docs/platform/05` with a level (measured, passed, expected, open). Do not build the registry on a guess.
9. **Keep the design set honest.** When code and `docs/platform/01` disagree, change one of them in the same PR, and add a line to `DECISIONS.md` if it was a decision. The set has an "open questions" part in each document; a question closed in code is closed there.
10. **Public-repository hygiene.** No user names, home paths, tokens or addresses anywhere (CI can grep for `C:\\Users\\` and `/Users/`); screenshots with no private windows (`npm run shot` is safe because it never touches the real screen); art is original and says it was made by an AI tool (see `platform/03` section 5); keep `THIRD-PARTY-NOTICES` generated.
11. **A code owner file** (`.github/CODEOWNERS`) naming the owner for `app/main/**`, `docs/platform/02-*` and `electron-builder.yml`, so a security-relevant change always asks for a review. The second maintainer is not named yet (a risk in `platform/03` section 8).
12. **Do the first hour on both machines the same day.** The owner can only judge the real desktop on real hardware, and the Mac session found problems the Windows session could not see. Ask the other machine for the 7.3 proofs after commit 1, not after commit 3.
13. **Keep the old checkout** (read-only, pinned) on both machines until 0.3, and tag the old repository's last commit `archive-for-2nddesktop`. The old private repository is the only place with the full history (the PR conversations and the two mailboxes).

## Appendix A: a draft `CLAUDE.md` for the new repository

```markdown
# 2ndDesktop

A living scene on the desktop of Windows and macOS (Electron + PixiJS v8, plain JavaScript ES modules, MIT). The app is a platform: the host does what is the same for every scene (desktop attach, tray, pausing, power, saving, settings); a scene is a folder (`scene.json` + `index.js`) that anyone can write. Bundled scenes: the fish tank and (0.2) the farm house. When a design choice is unclear, the simpler and quieter option wins.

## Read before non-trivial work
- `docs/STATUS.md`: where we are and what is next.
- `docs/00-2nddesktop-specs.md`: the product in one page. `docs/DECISIONS.md`: why things are as they are (the log wins over prose).
- `docs/platform/01` (architecture and the scene contract v0), `02` (security, data, network), `03` (releases and roadmap), `04` (reuse from fish-tank), `05` (what was measured).
- `docs/scenes/<id>.md`: a scene's design. `docs/bootstrap/BOOTSTRAP.md`: how this repository was started.
- `docs/reference/`: the old fish-tank spec and notes; FR, NFR and D numbers in code comments mean those.

## Two sessions (Windows and Mac)
(the rules of section 8 of the bootstrap document, in 8 lines)

## Layout
`app/main/` main process; `app/page/` host page and contract typedefs; `scenes/<id>/` scenes; `shared/` (`rng.js`); `scripts/`; `tests/host`, `tests/e2e`; `docs/`.

## Commands
`npm run dev`, `npm run build && npm start`, `npm test`, `npm run lint`, `npm run format:check`, `npm run test:e2e`, `npm run shot -- <scene> <WxH> <window|desktop> <seconds>`, `npm run assets`. Env vars start with `DESKTOP2_`. Use `npm start` and `npm run dev`, never bare `electron`.

## Rules to keep
- Node 24, Electron pinned exactly, `contextIsolation` on, `nodeIntegration` off, sandbox on. The main process is the security boundary; a scene is never trusted (docs/platform/02).
- A scene never reads the clock (`host.clock`; ESLint enforces it) and never uses `Math.random` where a test needs the same result (`host.seed`).
- Pause everything when the desktop is covered or hidden (setting "When the desktop is covered", default "Always pause"); 30 fps cap in desktop mode; memory 250 MB Windows, 350 MB macOS.
- Desktop mode takes no clicks and shows no HTML: every action also lives in the tray menu.
- Cross-platform: LF, `path.join`/`app.getPath`, no shell-only commands in npm scripts, lowercase-dash asset names.
- All art and sound are original (SVG drawn here, synthesized audio); fonts OFL. No downloaded assets.
- A feature is not built before its version starts (docs/platform/03, 6.1). Nothing after 0.3 is backlog.
- Git: never add a `Co-Authored-By` or "Generated with Claude" line. After merging, delete the branch on origin and locally. Never merge on pending or red CI unless the owner says so; never poll CI.
- No personal data in the repository: no user names, paths with a home folder, addresses, tokens.
```

## Appendix B: the first message for each session

**Windows session** (open it in the new clone of 2ndDesktop; add `..\fish-tank` as an extra folder of the session, at the snapshot commit; section 7.1):

> Read `..\fish-tank\docs2\bootstrap\BOOTSTRAP.md` and `..\fish-tank\docs2\00-2nddesktop-specs.md`. All decisions of section 2 are made; do not ask them again. Do section 7.1 (session part) and then 7.2 step 1 (initial `main`, then the import as the first PR) with the script in that folder. Stop after the PR is green and tell me the baseline numbers, the picture hashes and anything in the document that was wrong or missing.

**Mac session** (its own clone of 2ndDesktop and its old `../fish-tank` at the same commit; send it only after the import PR is open):

> Read `docs/bootstrap/BOOTSTRAP.md` of the new repository and `docs/00-2nddesktop-specs.md`. Do section 7.1 (Mac part) only: update the old checkout to the snapshot commit, run `npm ci`, `npm test`, `npm run test:e2e`, record the two picture hashes, and write the result into `TODO-Win.md` of the new repository. Then wait for the import PR and run the 7.3 proofs on it.

## Appendix C: open points of this document

1. Q1 to Q6 are decided (section 2). Two things inside them are **not tried** and are checked by the first builds: a bundle id whose last label starts with a digit (`com.tuangatech.2nddesktop`), and the copy of the data folder.
2. `platform/03` section 7.2 and `platform/04` section 4 still say that `docs/03`, `05` and `06` are not copied; DEC-43 replaces that. Change both in the first docs PR of the new repository.
3. The 30-line data-folder copy is not written yet; its tests are part of step 7.2.2.
4. `npm run new-scene`, `dev:scene`, `verify` do not exist yet (P1).
5. A Windows number for the cost of one open settings window (the Mac measured about 16 MB).
6. **From the import on, `docs2/` and this folder in fish-tank are frozen.** The design set lives in `docs/` of 2ndDesktop; an edit made in both places diverges. A change needed in the old copy is made in the new repository, and the old `docs2/` gets a one-line pointer in its README.
