# Platform 4 of 5: Reusing the fish-tank host code in 2ndDesktop

Status: Draft v0.1, 2026-11-23, updated after the Mac review. This is the detailed version of `03-distribution-and-roadmap.md`, section 7 (the short map and the bootstrap steps). Read that section first for the choice "new repository or rename" (recommended: a new repository from a snapshot). The scene's own part is in `../scenes/fishtank-migration.md`.

Facts below come from the fish-tank checkout at `main`, commit `9d18c90` (2026-11-23): file sizes were counted, imports and names were searched. Test files were classified by their names and imports, not read one by one; check that when moving them.

> **Paths in this document** are those of the fish-tank repository, before the move of bootstrap step 4: `electron/` is now `app/main/`, `renderer/` is `app/page/`, the host unit tests are in `tests/host/`, and the tank's own tests are in `scenes/fishtank/tests/`. The text describes the plan and the facts of that day, so it was not rewritten.

## 1. What there is to reuse

| Part | Size | What it is |
| --- | --- | --- |
| `electron/` | 17 files, about 3,000 lines | The main process: window and desktop attach for Windows and macOS (`desktop.js` 585, `desktop-win.js` 320, `desktop-mac.js` 90, `cover.js`, `placement.js`, `frame-fit.js`, `crash-restart.js`), the tray and menu, saving (`store.js`), settings, diagnostics, the usage log and the sampler |
| `renderer/` | 7 files, about 730 lines | The host's page: the PixiJS app and loop (`main.js` 273), the scene registry (`scenes.js`), atlas loading, the reload guard, the sound engine (`SoundPlayer.js` 281), the contract typedefs (`host.js`) |
| `shared/` | 1 file | The seeded random generator |
| `scenes/fishtank/` | 22 source files, about 3,600 lines | The first scene (document `../scenes/fishtank-migration.md`) |
| `scripts/` | 9 files, about 700 lines | Icons, the atlas builder (already per scene), screenshots, the pacing simulator, memory measuring, the sound lab, the universal koffi step |
| `tests/` | 25 unit test files and 9 end-to-end specs | Cover logic, attach logic, settings, store, menus, the golden state hash |
| Root files | `ci.yml` (Windows and macOS runners), `electron-builder.yml`, ESLint, Prettier, Vitest and Playwright configs | |
| `docs/` | `perf-notes.md`, `desktop-spike.md`, `edit-mode-spike.md`, `gate-g1.md` and the numbered plans | Measurements and findings that took real time |

**The main finding:** the host is already almost generic. A search for "fish", "tank" and "aquarium" in `electron/` finds 86 mentions in 13 files and most of them are comments ("the tank is covered") and the product name. In `renderer/` there are 23 mentions in 7 files. The real leaks are few and listed in section 3, and each one is small. The step "move the tank behind the scene contract" (Step 1 and 1b of the old plan) was done for this reason, and its proof is the golden hash test.

## 2. The method: three commits, each one green

Doing the import, the renames and the moves in one commit makes every failure ambiguous. Instead:

1. **Commit 1, "Import from fish-tank at `<hash>`":** the files of section 4 copied with the same paths (`electron/`, `renderer/`, `scenes/`, `shared/`, `scripts/`, `tests/`). Add `NOTICE`. CI must be green and `npm test` and the golden hash must pass. Nothing is renamed yet, so this proves the copy is complete.
2. **Commit 2, "Rename":** product name, ids, data folder, environment variables, window and menu texts, the bridge name (section 3). The golden hash must not change, because no game rule moved.
3. **Commit 3, "Move into the new layout":** `electron/` to `app/main/`, `renderer/` to `app/page/`, tests sorted into host and scene folders, scene subfolders (the other document). Git records most of these as renames, so `git log --follow` and `git blame` still work inside the new repository.

The same way, the first PR of the new repository carries only commit 1 and 2 if CI is slow; the move (3) is its own PR.

**Proof that nothing changed.** Two checks are cheap and strong. The golden test (`tests/e2e/golden.spec.js`) hashes the tank's state at fixed times. And `npm run shot` is reproducible (fixed seed, manual clock, seeded `Math.random`): run it for a window and a desktop picture before commit 1 and after each commit; the pictures must be identical on one machine. A host change that alters one pixel of the tank is found at once.

## 3. The leaks: where the tank is inside the host

These are the places where the host knows about the tank. Each is fixed in commit 2 unless said otherwise.

| # | Where | What is tank-specific | Fix |
| --- | --- | --- | --- |
| 1 | `electron/main.js` (`DEFAULT_SCENE = 'fishtank'`) and `renderer/scenes.js` (`DEFAULT_SCENE`) | The fallback scene is written in two places | One constant from the scene registry (document `01`, section 4): the bundled default scene. It stays `fishtank` |
| 2 | `main.js` (`FISHTANK_FISH` becomes the URL parameter `fish`), `renderer/main.js` (`options: { fish: fishCount, ... }`), the typedef in `renderer/host.js` | The number of fish for measurements is a named option of the host | `host.options` becomes a free bag: one variable `DESKTOP2_SCENE_OPTIONS` holding JSON (for example `{"fish":8}`) that the page passes to the scene untouched. The tank reads `options.fish` itself |
| 3 | `electron/preload.cjs` | The global is `window.fishtank`; the bridge has about 20 calls written for one trusted page; `loadRecord(id)` and `saveRecord(id, ...)` take any scene id from the page | **Rewrite** to the narrow bridge of document 2, section 4: the global is renamed, and the main process **binds the record to the active scene** instead of trusting an id sent by the page. Not a rename: do it in its own PR after commit 3, with its own tests, **before a second scene runs** (the Mac's E-10) |
| 4 | `renderer/SoundPlayer.js` | The engine (audio context, the room reverb, volume, mute) and the **tank's three sounds** (`splash`, `pop`, `chime`, from about line 185) are in one class; `host.js` types `play(name: 'splash'\|'pop'\|'chime')` | Keep the engine in the host. Move the three recipes to `scenes/fishtank/sounds.js`; the scene registers them with the engine (proposal: `host.sound.define(name, recipe)`, then `host.sound.play(name)`). The unit test `sound.test.js` is split the same way. **Done in 7.6 (DEC-51):** `host.sound.define(name, recipe)` with `recipe(voice, at)`; the recipes and the key are in `scenes/fishtank/sounds.js` |
| 5 | `electron/menu.js`, `tray.js`, `diagnostics.js`, `main.js` (About text, `title`, `message`) | The words "Fish Tank" (labels, tooltip, "Fish Tank diagnostics", and on macOS the three items "About Fish Tank", "Hide Fish Tank" and "Quit Fish Tank" in `buildAppMenuTemplate`) | One `PRODUCT_NAME` constant. The diagnostics header also gets the active scene id (document 2, section 11) |
| 6 | `main.js` | `app.setAppUserModelId('com.weekend.fishtank')`, `'Fish Tank (dev)'` as the dev data folder, the single-instance lock, the `FISHTANK_*` variables (used in `main.js`, `desktop.js`, `display-mode.js`, `crash-restart.js` and in tests: `helpers.js` 7 times, `shot.mjs` 9, `measure-alloc.mjs` 5) | Rename to the new product and to `DESKTOP2_*` (a digit cannot start a variable name; document 3, section 8). A table of old and new names goes in the commit message |
| 7 | `renderer/main.js`, `reloadGuard.js` | `window.__tank`, the key `fishtank.reloads` | `window.__scene` and a neutral key. `renderer/main.js` also exposes the scene as `fishtank:` in that object; the tests (`feeding`, `game`, `golden`, `smoke`, `step6`) use `__tank`, so they change in the same commit |
| 8 | `renderer/index.html` | The page title and the window grip text | The product name |
| 9 | `scenes/fishtank/textures.js` | It imports `../../assets/spritesheets/fishtank.json` to read `meta.artScale`: the scene reaches **outside its own folder** into the host's generated files | The host gives `host.art.scale`. This is a scene change; see the scene document |
| 10 | `renderer/scenes.js` | Scenes are found at build time with `import.meta.glob('../scenes/*/index.js')`; fine for bundled scenes, impossible for scenes installed later | Keep the glob for the bundled scenes in 0.2. P1 starts with a loader spike that proves `scene://<id>/` with the host's PixiJS (document 1, section 8.6); installed scenes use that loader when the store is built, and the bundled scenes move to it then. One loader interface, two sources |
| 11 | `electron/menu.js`, `buildAppMenuTemplate` | **No Edit menu** on macOS (app menu, scene menu and Window only): Cmd+C, Cmd+V and Cmd+A do nothing in any text field of any window. The new design has text fields in host windows (a typed city, "What happened?", a token) | Add `{ role: 'editMenu' }` and test paste in each of those windows (Mac session's finding, confirmed: no `editMenu` in the file) |
| 12 | host windows (new: settings, scene store, consent, error report) | In an app with no Dock icon, `show()` plus `focus()` takes the keyboard but closing the window does not give the focus back, and the menu bar stays the app's (Mac Edit mode measurement) | One helper in the main process that opens every host window and, on close, calls `app.hide()` with the Dock-icon retry (document 1, section 6). Not an old leak but a new rule for the new windows |
| 13 | `tests/e2e/app-menu.spec.js` | On macOS it expects the menu bar to contain the literal `'Tank'`, the scene's name from `scene.json`; it fails when the default scene is renamed or another scene is first | Read the name from the default scene's manifest. The scene document proposes the name "Fish tank", which would break this test if it is not changed first |

None of these touches the desktop attach, the cover logic, the placement or the crash restart. That is the expensive part of the old project (it has its own spike and measurement documents: `desktop-spike.md`, `perf-notes.md`), and it moves unchanged.

## 4. The reuse table

**Keep** = copy, no logic change. **Rename** = copy, change names and texts only. **Extend** = copy, then add a feature of the new design. **Rewrite** = write again. **Move** = same code, new place.

| Files | Action | Notes |
| --- | --- | --- |
| `electron/desktop.js`, `desktop-win.js`, `desktop-mac.js`, `cover.js`, `placement.js`, `frame-fit.js`, `display-mode.js`, `crash-restart.js` | Keep (Rename for env names) | The core value of the old project. `koffi` and `scripts/koffi-universal.mjs` come with them. That script fetches the missing `@koromix/koffi-darwin-*` package with `npm pack` at the installed koffi version, so `npm run dist` needs the network and a koffi upgrade means checking the script |
| `electron/main.js` (605 lines) | Rename, then Extend | Add: the scene registry, `powerMonitor` and the setting "When the desktop is covered" (document 1, section 7.1), scene switching by page reload, the tray's "Scenes" and the tray layout of document 1, section 10.1, network and place settings. It is the file that grows; split out `app/main/scenes.js` and `app/main/power.js` as you add, so it does not pass 800 lines |
| `electron/tray.js`, `menu.js` | Rename, Extend | `menu.js` already builds the menu from what the scene reports (`status()`, `menuItems()`). Add the host group and the 300 ms limit |
| `electron/store.js`, `settings.js` | Keep, Extend | The handling of a damaged file (it keeps the bad one aside and starts again) is worth keeping as it is. Add the new settings (`whenCovered`, network mode, place, consent, sound) |
| `electron/diagnostics.js`, `usage-log.js`, `sampler.js` | Keep, Extend | Add the scene id, capabilities and the hosts called; the sanitizer is the base of "Send error report" (document 2, section 12) |
| `electron/preload.cjs` | **Rewrite** (leak 3) | |
| `renderer/main.js` (273 lines), `art.js`, `drawing.js`, `reloadGuard.js` | Rename, Move | Add the capabilities to `host`, the CSP and the `pixi.js/unsafe-eval` import (document 2, section 3) |
| `renderer/SoundPlayer.js` | Split (leak 4) | Engine stays, recipes move to the scene |
| `renderer/host.js` | Keep, Extend | The typedefs become the contract's source of truth; `scripts/` can generate the contract section of document 1 from it |
| `renderer/scenes.js` | Extend (leak 10) | |
| `shared/rng.js` | Keep | The only import every scene may use |
| `scripts/build-assets.mjs` | Keep | Already per scene: it reads `scenes/<id>/art/*.svg`, renders at 3x and packs one atlas per scene. It must learn the new folder name (`assets/art-src/`, scene document) and write into the pack's folder |
| `scripts/shot.mjs`, `measure-alloc.mjs`, `pacing-sim.js`, `sound-lab.mjs`, `seeded-random.mjs` | Keep (Rename env) | `shot` takes a scene id (it already uses the default scene) |
| `scripts/make-icons.mjs` | Keep | Renders the tray and app icons from SVG with `resvg`; only the file names change (section 6) |
| `scripts/run-electron.mjs` | Keep | It clears `ELECTRON_RUN_AS_NODE`; do not remove that |
| `spikes/edit-mode/` | Move to `spikes/` | Reference for the later Edit mode |
| `tests/unit` host tests: `cover`, `crash-restart`, `desktop`, `diagnostics`, `display-mode`, `drawing`, `frame-fit`, `menu`, `placement`, `reload-guard`, `scenes`, `settings`, `store`, `usage-log`, `rng` | Keep, Move to `tests/host/` | |
| `tests/unit` scene tests: `backdrop`, `layout`, `palette`, `pointer`, `repository`, `rules`, `species`, `steering`, `pacing` | Move to `scenes/fishtank/tests/` | They import the scene's files, so they move with it; the pattern list of Vitest must include `scenes/**/tests/` |
| `tests/unit/sound.test.js` | Split | Engine part stays, recipe part follows the sounds (done in 7.6: `tests/host/sound.test.js` and `scenes/fishtank/tests/sounds.test.js`) |
| `tests/e2e/` `smoke`, `app-menu`, `window`, `display-mode`, `diagnostics` | Keep | Host behaviour. `diagnostics.spec.js` and `display-mode.spec.js` use `FISHTANK_*` |
| `tests/e2e/` `golden`, `feeding`, `game`, `step6` | Move to `scenes/fishtank/tests/` or keep as the tank's end-to-end tests | They drive the tank through `__tank` |
| `.github/workflows/ci.yml` | Keep, Extend | Two runners already. Add the contract test, the capability test and the pack check |
| `electron-builder.yml` | Rename, and in the same commit: mac `arch: arm64`, `electronLanguages: en` (document 3, section 3.4) | `appId`, `productName`, `copyright`; the `files:` list names `electron/**`, `dist/renderer/**` and `assets/app-icon.png`, so change it together with commit 3. The koffi `asarUnpack` and `x64ArchFiles` entries are hard-won: keep them |
| `eslint.config.js` | Keep, edit paths | It has path rules: `renderer/**` and `scenes/**` get browser globals, except **`scenes/*/rules.js` and `scenes/*/config.js`, which get Node globals only, so a stray `document` or `window` in the pure rules is an error** (a later server was meant to reuse them). A separate rule bans `Date.now()`, `performance.now()` and `new Date()` in every file under `scenes/`. If the scene's folders change (scene document), these globs change with them, or the "pure rules" protection silently stops |
| `vite.config.js` | Rename | Contains a plugin named `fishtank-csp` (by its name, the Content-Security-Policy of the page; read it before changing it); extend it for the stricter policy of document 2 |
| `.prettierrc`, `.editorconfig`, `.gitattributes` (LF), `.nvmrc` (Node 24), `vitest.config.js`, `playwright.config.js` | Keep | |
| `.prettierignore` | Edit | Lists `docs/`, `assets/`, `build/` and the two `TODO-*.md` files; add `docs2/` until it moves |
| `build/app-icon.svg`, `build/icon*.png`, `assets/tray/*` | Replace | Section 6 |
| `CLAUDE.md` | Rewrite | Keep the working rules (Node 24, Electron pinned, sandbox on, LF, branch deletion after merge, no attribution lines, the two-session mailbox); the tank's tone rules move to the tank's `DESIGN.md` |
| `TODO-Mac.md`, `TODO-Win.md` | Start empty | Keep the rules at the top; no history |
| `docs/perf-notes.md`, `desktop-spike.md`, `edit-mode-spike.md`, `gate-g1.md` | Copy to `docs/reference/` | |
| `docs/01-functional-spec.md`, `docs/02-tech-design.md` | **Copy to `docs/reference/fishtank-v1/`** (changes document 3, section 7.2, which said "not copied") | About 250 matches in 53 source files cite spec or decision numbers (`FR-22`, `NFR-4`, `D31`...; counted by a search, a few may be false matches). Without the old spec they point nowhere, and the old repository will be private. A line in `docs/reference/README.md` says: the numbers belong to the archived spec |
| `docs/03` to `06`, screenshots, `release/`, `test-results/`, `dist/` | Do not copy | Replaced by `docs2/`, or generated |
| `assets/spritesheets/`, `assets/contact-sheet-*.png` | Do not copy | Generated (`.gitignore`) |

## 5. The things that are easy to break

1. **The data folder.** The packaged app's data folder is named after `package.json` `name` (`fish-tank`, because there is no `productName`; measured on both systems; `Fish Tank (dev)` in development). A new product name means a new empty folder, and **the owner's saved tank (`records/fishtank.json`) is not found**, although the scene id is unchanged. Proposal: a one-time **copy** at the first start (never a move): if the new folder has no `records/` and the old one has `records/fishtank.json`, copy that record and `settings.json`, and log one line. It only helps the owner and early testers, and it is about 30 lines with a unit test. **Decided by the owner (2026-11-23): yes, copy it.** On the Mac the folders are `~/Library/Application Support/fish-tank` and the new product's (on Windows `%APPDATA%\fish-tank`); the new folder's name comes from the new `package.json` `name` unless a `productName` is set, so decide which is intended; the Keychain item "Fish Tank Safe Storage" is not copied and need not be, since no secrets exist yet.
2. **The Windows app id** (`com.weekend.fishtank`) and the macOS bundle id change with the rename. Pinned shortcuts, notification identity and the "open at login" entry start fresh. Acceptable for a new product; do not rename again later.
3. **Paths in config.** `package.json` `"main"`, `electron-builder.yml` `files:`, the Vite roots and `import.meta.glob` patterns, the ESLint globs, the Vitest include, the CI cache keys: a moved folder breaks them quietly (the app starts but a glob matches nothing). After commit 3, run `npm run build`, `npm run dist:test` on both systems and open the installer once. The old `dist:test` channel switch (`fishtank.channel` in `package.json`) is worth keeping.
4. **Native code.** `koffi` is unpacked from the asar archive and a universal Mac build needs both halves. Do not touch this in the move. From the first release the Mac build is **Apple silicon only** (owner, 2026-11-23), so only the arm64 half is shipped and `scripts/koffi-universal.mjs` is not run; the script and the `x64ArchFiles` line stay in the repository for a later Intel build. The Windows installer stays x64.
5. **Case and spelling of the new name** in paths: `2nddesktop` in identifiers, `2ndDesktop` for display, `DESKTOP2_` for environment variables (document 3, section 8).
6. **The golden hash** records the tank's state; if commit 2 or 3 changes it, something moved that should not have. Do not "update the snapshot" to make it pass.

## 6. The icon

Today's icon is the fish on a water-blue rounded square (`build/app-icon.svg`, rendered by `scripts/make-icons.mjs` into `build/icon.png` for Windows and `build/icon-mac.png` for the macOS grid, plus the tray images in `assets/tray/`).

**Decided by the owner (2026-11-23): the icon is a window with a tree outside.** The app is a platform, so its icon is not a fish, a farm house or a desk: a window is what every scene is, a view from the desktop, and the tree outside says that something alive is out there. Draft 2 is in `docs2/icon/`:

- `2nddesktop-app-icon.svg`: 1024 by 1024 on the same grid as today's icon (a rounded square of 896 px with a 64 px margin). A deep-blue square (the room), a cream window frame with four panes and a sill, and in the panes a dusk sky, a pale sun, two green hills and a tree with a brown trunk. Flat colours, no outlines, all drawn here as SVG.
- `2nddesktop-tray-template.svg`: the tray icon in one colour on transparency (macOS template image; Windows shows it in the system colour): a window outline, a tree as three circles on a thick trunk, and a sill line. A first try with a thin trunk and a centre bar looked like a keyhole, so the tree is bigger and the bar is gone.
- `*-draft1-stacked.svg`: the first idea (stacked windows with a sun and hills), kept for reference; it could be mistaken for a photo-gallery icon.

What is not checked: the tray icon at 16 px on a real macOS menu bar and a Windows taskbar, light and dark; the app icon at 16 and 32 px in a window title and the taskbar. `scripts/make-icons.mjs` renders PNGs from SVG with `resvg`, so the files only need to take the place of `build/app-icon.svg` and the two tray SVGs. Two rules from the Mac session's review: keep the **output names** `trayTemplate.png` and `trayTemplate@2x.png` (macOS adapts a tray icon to a light or dark menu bar only for files named `<name>Template.png`; with other names the icon turns black on a dark menu bar), and keep the **896 px rounded square on the 1024 canvas** in the SVG: the script already derives the macOS icon from it at 824 of 1024 px (`MAC_SCALE` in `scripts/make-icons.mjs`), so the Mac version is never drawn separately.

The fish stays in the product: today's fish icon becomes the base of the **fish tank scene's store thumbnail** and its window icon. Draft 2 is enough for P0 to P4; polish it before the first installer (P5).


## 7. Order of work for the bootstrap

This refines document 3, section 7.3 and the roadmap rows P0 and P1.

1. Wait for the snapshot point: the Step 1b work is merged (it is, PR 40), the owner's decisions of the first round are done, and the old repository has no open PR that matters (PR 41 merged 2026-11-23).
2. Create the new repository (`2nddesktop` under the chosen owner or organization); protect `main`; enable the same two-runner CI.
3. Commit 1 (import), PR, green, merge. Tag `v0.0.0-import`.
4. Commit 2 (rename) with the table of old and new names; the data-folder copy of section 5, point 1 (decided: yes). PR, green, merge.
5. Commit 3 (move into `app/main`, `app/page`, scene folders); update the config paths of section 5, point 3; run both installers by hand. PR, green, merge.
6. Move `docs2/` to `docs/` in the same PR or the next one; add `docs/reference/` with the copied measurements and the old spec.
7. Write the new `CLAUDE.md` and the two `TODO-*.md` files; the first task for both sessions is the hand check of the installer on their own machine.
8. The old repository: add the pointer to its README, then make it private (document 3, section 7.3, step 6). Not before steps 3 to 5 are green: until then it is the safe copy.
9. Then P1 of the roadmap: the scene registry, the power policy, the bridge rewrite (leak 3), the sound split (leak 4).

## 8. Open points

1. ~~Copy the data folder at first start?~~ Decided: yes, copy (section 5, point 1). Still to settle in the code: which files (`records/fishtank.json` and `settings.json`), and whether it asks first (recommended: no question, one log line).
2. Copy `docs/01` and `docs/02` as the tank's archived spec (section 4)? Recommended: yes, 170 KB.
3. `host.sound.define(...)` as the way a scene brings its own sounds (leak 4) is a proposal; the sound capability in document 2 may want a different shape.
4. Does the new repository keep the folder names `electron/` and `renderer/` for now (fewer broken paths) and rename only when P1 is done? The method of section 2 works either way; commit 3 can simply be postponed.
