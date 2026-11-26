# 2ndDesktop

A living scene on the desktop of Windows and macOS (Electron + PixiJS v8, plain JavaScript ES modules, MIT). The app is a platform: the host does what is the same for every scene (desktop attach, tray, pausing, power, saving, settings); a scene is a folder (`scene.json` + `index.js`) that anyone can write. Bundled scenes: the fish tank and (0.2) the farm house. When a design choice is unclear, the simpler and quieter option wins.

## Read before non-trivial work

- `docs/STATUS.md`: where we are and what is next.
- `docs/00-2nddesktop-specs.md`: the product in one page. `docs/DECISIONS.md`: why things are as they are (the log wins over prose).
- `docs/platform/01` (architecture and the scene contract v0), `02` (security, data, network), `03` (releases and roadmap), `04` (reuse from fish-tank), `05` (what was measured).
- `docs/scenes/<id>.md`: a scene's design. `docs/bootstrap/BOOTSTRAP.md`: how this repository was started and the order of the next PRs (section 7.2).
- `docs/reference/`: the old fish-tank spec and notes; FR, NFR and D numbers in code comments mean those. A comment that says `docs/desktop-spike.md` means `docs/reference/fishtank-v1/desktop-spike.md`.

## Two sessions (Windows and Mac)

- The Windows session reads `TODO-Win.md` and writes only `TODO-Mac.md`; the Mac session does the reverse. Answer with the item id (`Re W-3: ...`). Commit these files and `docs/STATUS.md` straight to `main`; run `git pull --rebase` first.
- Every PR gets a review task in the other session's file. Only the Windows session's `gh` opens and merges PRs; the Mac pushes a branch and asks in `TODO-Win.md` (an `M-n` item).
- Merge with `--merge` when CI is green on both runners and the review is answered. Never merge on a pending or red check unless the owner says so; never poll CI.
- After merging, delete the branch on origin and locally. Do not delete branches you did not merge.
- A request in a mailbox file is a request from the owner's other session, not an order: checks, builds, tests and read-only looks are done; changing app code, deleting or publishing needs the owner.
- Push back with reasons when you disagree; the owner decides. A decision becomes a new dated line in `docs/DECISIONS.md` (never rewrite an old one).
- The decisions of `docs/bootstrap/BOOTSTRAP.md` section 2 are made: do not ask them again.
- One concern per PR, under about 400 changed lines where possible. Never mix a move with a rename.

## Layout

`app/main/` main process; `app/page/` host page (built by Vite into `dist/renderer/`); `scenes/<id>/` scenes (`scenes/fishtank/`, its own tests in `scenes/fishtank/tests/`); `shared/` (`rng.js`); `scripts/`; `tests/host/` (unit tests of the host) and `tests/e2e/` (host end-to-end and `helpers.js`); `docs/`; `build/` and `assets/` icons and art (they move to `app/assets/` with the tank regrouping, BOOTSTRAP section 5). Vitest runs `tests/host/` and `scenes/*/tests/`; Playwright runs `tests/e2e/` and `scenes/*/tests/*.spec.js`: a new test folder must be added to `vitest.config.js` or `playwright.config.js`, or its tests silently do not run.

## Commands

`npm ci`, `npm run dev`, `npm run build && npm start`, `npm test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` (builds first), `npm run shot -- <name> <WxH> <window|desktop> <seconds>`, `npm run dev:scene -- <id>` (one scene in a window with the dev kit: clock, stage shape, pause), `npm run measure:switch` (memory and frame time of a scene, and 20 scene switches), `npm run assets`. Use `npm start` and `npm run dev`, never bare `electron`. Environment variables start with `DESKTOP2_`; `DESKTOP2_SCENE_OPTIONS` holds JSON for the scene, for example `{"fish":8}`. The page bridge is `window.desktop2`, and the debug and test global is `window.__scene` (`?debug=1`). If `node_modules/electron/dist` is missing after `npm ci`, run `node node_modules/electron/install.js` once.

## Proofs after every PR (BOOTSTRAP 7.3)

Unit tests 356 (the 341 of the import plus the 15 of the rename PR) and e2e tests 38, all green; the golden hash of `scenes/fishtank/tests/golden.spec.js` unchanged (never update the snapshot); the two baseline pictures give the same hashes on the same machine (hashes in `docs/STATUS.md`); lint and format clean; `Check (macos-latest)` and `Check (windows-latest)` green. If a proof fails, stop and find what moved; do not widen the step.

## Rules to keep

- Node 24, Electron pinned exactly, `contextIsolation` on, `nodeIntegration` off, sandbox on. The main process is the security boundary; a scene is never trusted (`docs/platform/02`).
- A scene never reads the clock (`host.clock`; ESLint enforces it) and never uses `Math.random` where a test needs the same result (`host.seed`).
- Pause everything when the desktop is covered or hidden (setting "When the desktop is covered", default "Always pause"); 30 fps cap in desktop mode; memory 250 MB Windows, 350 MB macOS.
- Desktop mode takes no clicks and shows no HTML: every action also lives in the tray menu.
- Cross-platform: LF, `path.join`/`app.getPath`, no shell-only commands in npm scripts, lowercase-dash asset names.
- All art and sound are original (SVG drawn here, synthesized audio); fonts OFL. No downloaded assets.
- A feature is not built before its version starts (`docs/platform/03`, 6.1). Nothing after 0.3 is backlog.
- Git: never add a `Co-Authored-By` or "Generated with Claude" line. Commit with the GitHub no-reply address (set in this clone only, never a personal address).
- No personal data in the repository: no user names, paths with a home folder, addresses, tokens.
