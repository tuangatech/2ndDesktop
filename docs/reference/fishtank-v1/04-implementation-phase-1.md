# Fish Tank — Implementation Plan, Phase 1 (Offline tank core, macOS + Windows)

Status: Draft v0.6
Companion docs: 01-functional-spec.md (FR-n and NFR-n), 02-tech-design.md (section numbers like "3.4" or "14.2" point to it), 03-platform-design.md (a proposal for many scenes; D33), 05-implementation-phase-2.md (the next phase)

**Files moved (2026-11-22, platform plan Step 1a):** the tank's code is now in `scenes/fishtank/`; the old-to-new mapping is at the top of `02-tech-design.md`. This document keeps the old paths.

## Progress (updated 2026-11-22)

- Step 0: done. The style guide was approved by the owner.
- Step 1: done on Windows 11 (build 26200): skeleton, window and desktop modes, tray stub, installer, CI green on both runners, desktop attach working with the show-first approach. macOS 27.2 (2026-11-21): desktop mode works with `type: 'desktop'` and no native code for the window; the tank pauses under a full-screen window, and under a window filling the screen through its own check of the window list (D35, 2026-11-22). The macOS desktop checklist passed on 2026-11-22 on macOS 27.2 (items 8 and 9 were seen only in the log, two windows tiled side by side were not tried, and no older macOS was available). Still open: the test on an older Windows build (see `docs/desktop-spike.md`).
- Step 2: done on Windows except the tests that need other hardware: layered scene, water, sand, decor with sway, bubble chains, layout for any display size, asset pipeline and screenshot script, pause reasons, and a first set of measurements (`docs/perf-notes.md`).
- Step 1 and 2 follow-ups done with the owner on Windows: the covered-window pause works, the tank fills the display to the edges, the scenery was redrawn with more detail (a generator script) and the decor has six kinds.
- Step 3: built on Windows on branch `step-3-fish`: the tetra (three art layers, wave, eased turn, pitch, three palettes with a hue shift), steering, sinking food with a solved chase speed, the in-memory repository, the tray item "Feed a pellet", the dev panel, unit tests and an end-to-end feeding test. Measured with 2 and 8 fish. Not done: the Mac, a recording of a feed (the owner makes it), and the checks on other hardware. The gate material is in `docs/gate-g1.md`.
- Step 4: started on Windows (branch `step-4-species`): guppy (round body, fan tail) and angelfish (tall body, long fins, three bands) with art in three layers, `species.json` data (angelfish mid-water and slow, guppy quick and upper water, tetra anywhere), nine palettes, a mixed-species start tank, dev panel and `FISHTANK_FISH` with mixed species, and sheets in `docs/screenshots/species-stages.png` and `species-grayscale.png`. Six decor kinds already existed from Step 2. 8 mixed fish measured on W1 (see `docs/perf-notes.md`). Stress check on the Mac (M1) done: CPU and frame rate within, memory over the old 250 MB (about 330 to 355 MB, mostly a fixed WebGL cost in the GPU process; see `docs/perf-notes.md`), so the owner raised NFR-4 on macOS to 350 MB. Open: the owner's review of the new fish, the 8-hour growth run on the Mac (the one-hour run passed: window 327 MB, desktop 334 MB; Step 4 code), and the Mac for everything else.
- Step 5: built on Windows (branch `step-5-game`): the shared rules and config with tuning, the pacing simulator, the atomic save store and the scene record (`records/fishtank.json`), the local repository, the tray menu with its summary and actions, floating pellets that are collected, feeding through the economy (the meal is counted when the pellet is dropped, the fish grows when it eats), eggs, the fish label with rename, the pointer reaction (window mode and, through the main process, desktop mode), drowsy fish, and the D33 seams (one entry point, a typedef contract, records keyed by scene id, `activeScene` in settings). 150 unit tests and 20 end-to-end tests. See "What Step 5 built differently" below. Not done: the first-launch hint and the sounds (Step 6), and the hand checks: the real tray icon, the pointer reaction on the real desktop, feeding by click with fish gathered around the pointer, resizing the window during a feed, and everything on the Mac. The tasks of Step 5 are ticked on automated evidence (unit and end-to-end tests, screenshots) until those hand checks are done.
- Code review fixes after Step 5 (D34): a damaged record is repaired and its original kept, a failed save write is retried instead of crashing the main process, and a fish never shrinks back when it eats its pellets out of order. Repository events now carry what changed (the fed or hatched fish), and the scene's temporary flags around repository calls are gone; a clicked floating pellet is marked so it is the one that flies to the stash. The water and sand gradients are made once (each resize leaked two textures: 62 after 31 resizes), and a resize to the same size does nothing. The tray feeds the hungriest fish, dropped above it, and fish chasing food keep a little apart (the push fades out near the pellet). Each frame allocates about 1.2 KB instead of 9.7 KB (steering helpers write into objects each fish keeps; `docs/perf-notes.md`). 226 unit tests and 30 end-to-end tests.
- Step 6, first slice (branch `step-6-polish`, 2026-11-21): the settings items in one shared menu (Always on top in window mode, Launch at login, Sound, Copy diagnostics, About), `settings.json` with Always on top and Sound, the sounds (`SoundPlayer`: splash, pop, chime), quiet start at login, and the first-launch hint. Window rules and placement followed (see the Window rules task). Still open in Step 6: display modes (safe start, keep-alive, display changes), the diagnostics log with the per-day table, the app icon, the politeness and pause checks, and the budget measurements. The owner has confirmed Step 5 by hand on Windows (click pellets, rename, pointer reactions in both modes, tray menu).
- Sounds redesigned (branch `better-sounds`, 2026-11-22, D36): `SoundPlayer` rewritten with the same API (`play('splash'|'pop'|'chime')`, `setEnabled`). One shared chain built once per context (dry bus and a send into a 1.1 s generated room, master gain, low-pass at 6.5 kHz, compressor); every voice starts from silence with a 4 to 8 ms attack and an exponential tail and is disconnected when it ends; the splash is a soft dark touch plus two bubbles, the pop one bright rising bubble, the chime three bell notes (F#5, A5, D6) in the room. All notes come from D major pentatonic and never repeat twice in a row. Heard by nobody yet: the owner listens with `npm run sounds` (Windows and Mac) before the PR is merged. Unit tests check the wiring (no click, nodes released, notes in key), not the sound.
- Gate G1 passed (owner, 2026-11-22). The platform slice (`06-implementation-platform.md`) starts; the remaining Step 6 hand checks and the Mac checks in `TODO-Mac.md` go on in parallel and are checked on the platform build.
- Mac hand checks on the packaged build (owner, 2026-11-23, universal `.dmg` built from `main` at 0c7ab71, macOS 27, ad-hoc signed): **W-4 PASS**: the dmg window shows the fish icon next to Applications at the same size as the folder icon; the icon is the right size in the Dock and in Finder (Applications); Gatekeeper text and the Open Anyway steps are in `docs/02-tech-design.md` (distribution); the packaged app starts, draws at 59 fps and keeps its data in `~/Library/Application Support/fish-tank`. **W-5 partly PASS**: a start with `"desktopAttempt":"trying"` in `settings.json` opens in a window (the log says "starting in a window: the last desktop attempt did not finish") and "Show on desktop" then attaches ("desktop attempt: ok" after 10 seconds), with the cover pause and resume working while windows were moved over it. Not yet checked by hand: the wording of the tray note on screen, sleep and wake, lock and unlock, a display change, W-6, W-8, W-9 and the second display of W-3.
- Diagnostics and review notes from the Mac session (branch `diagnostics-wording`, 2026-11-22): "Copy diagnostics" says which memory number it is (private bytes on Windows, the working set on macOS, which counts shared pages), names the GPU vendor (`Apple (vendor 0x106b) (active)`; a device id of 0 is left out) and shows `macOS desktop window` for the attach line on the Mac; the About box shows the save folder as `%APPDATA%...` on Windows and `~...` on macOS, without the user name; a graphics context that is lost again and again stops the reloads after 3 in a minute (`renderer/reloadGuard.js`) and the tank stays paused; a comment says what `releaseAtlasImage` relies on. Unit tests for each.

## 1. Goal and scope

Build a working, pleasant, fully offline tank that runs the same on macOS and Windows, saves to a local file, asks for about a minute a day, stays light on the computer, and can be handed to testers as an unsigned build. Claude Code writes the code, draws the art (SVG) and synthesizes the sounds.

Requirements covered: FR-1 to FR-22, FR-36 to FR-49, FR-60 to FR-64 and NFR-1 to NFR-7 (functional spec, sections 6, 7.3 and 11). The tank can live on the desktop behind the icons and windows (desktop mode) or in a small window (window mode), and the player looks after the fish from a tray menu. In the menu (tray and gear), only the mode switch, Always on top, Launch at login, Sound, Copy diagnostics and About (plus Quit) exist in this phase, together with the tray actions Collect pellets, Feed a pellet, Feed until full and Hatch egg.

Not in Phase 1: ripple, Reduced effects, light from above, depth shading, water surface, fish shadows, fish bubbles, day and night, and the crawling crabs and snails (FR-50 to FR-59, see 05-implementation-phase-2.md). Accounts and saved progress on a server are Phase 3. Social features (hearts and the visit log) are Phase 4.

Phase 1 is built in two parts. Part 1A is a vertical slice (Steps 1 to 3) that ends in a go/no-go gate. Part 1B (Steps 4 to 7) is everything else. Phase 1 is finished when every exit criterion in section 9 passes.

## 2. Decisions made for this plan

Accepted by the project owner on 2026-11-20 ("use the defaults") and in the follow-up answers on the same day. They can still be changed before the step that uses them.

| # | Decision | Why |
| --- | --- | --- |
| D1 | Feeding is committed when the pellet is dropped: the stash, fish fullness and points change at that moment. The fish then swims over and the eating animation plays; the shown size catches up when it eats. | Quitting mid-swim cannot lose or duplicate a pellet, and two quick drops cannot overfeed one fish. |
| D2 | All art is drawn by Claude Code as SVG (tech design 3.3, "Art pipeline"), in a clean vector style with a short style guide in `assets/art/STYLE.md`. Only the tetra is drawn in Part 1A; the other two species are drawn after the gate. | There is no human artist. The gate avoids drawing nine fish in a style the owner dislikes. |
| D3 | The three species are `tetra` (slim, schooling look), `guppy` (round body, fan tail) and `angelfish` (tall, diamond shape). Each species has one shape for all three stages; the stages differ in size and color only (FR-12, FR-13). | Clearly different silhouettes make the species easy to tell apart, and nine art pieces instead of twenty-seven keep the art work small and consistent. |
| D4 | The tank fills the whole window or display. The layout is computed from the width and height (`computeLayout`, one unit = height / 320), and decor positions come from the tank's seed and the aspect ratio (`layoutDecor(seed, aspect)`), so a resize or a different display rearranges nothing but scale and the number of decor slots. | FR-19 resizing, FR-41 fixed layout and FR-63 any display size. |
| D5 | In window mode the window has a slim always-visible strip (22 px, semi-transparent) at the top with the drag area, minimize, close and menu buttons. The canvas below it stays fully clickable. Pellets never spawn in the top 30 px. Desktop mode has no strip. | A CSS drag region swallows mouse events on Windows, so a hover-only strip cannot work reliably. |
| D6 | In window mode, closing the window quits the app on both systems, and minimizing keeps the game running. The tray icon (D28) also has Quit, and in desktop mode it is the only way to quit. The window does not hide in the tray. | Simplest and least surprising; the catch-up on the next launch makes quitting cost nothing. A tray icon is needed anyway for desktop mode. |
| D7 | HUD (stash count, messages, fish label, rename box, hints) is HTML/CSS laid over the canvas, not drawn in Pixi. | Crisp text at any display scale, easy fonts, easy accessibility. |
| D8 | The renderer sends the whole tank state to the main process on every change. Main keeps the latest copy, writes it after 1 second of quiet, and writes synchronously on quit. | Simplest way to meet "debounced, always on quit" (tech design 3.4) without a quit handshake. |
| D9 | If the local clock goes backwards, the timers re-anchor to the new "now". Time that never passed is never counted. | Changing the clock back gains nothing; the game keeps working. |
| D10 | A fish that has never been fed counts hunger from its creation time, so it becomes drowsy 36 hours after it hatched. | Gives `isDrowsy` a defined answer for new fish (FR-10). |
| D11 | The stage-change effect plays only live, when a fish crosses a threshold while the owner is watching. It is not replayed after a restart, and nothing is stored for it. | FR-14; the simplest way, and growth only happens when the owner feeds. |
| D12 | PixiJS uses the WebGL backend only. | Same output on both systems; WebGPU in Electron is not consistent yet. |
| D13 | Points keep counting after 400, but stage and size stop changing. | Adults still eat (fullness, eggs); no information is lost. |
| D14 | Clicking a fish gives a small wiggle and shows an HTML label for 3 seconds: name (or species), stage, and Hungry, Full or Drowsy. The label has a rename button. No timers are shown. | FR-48 and FR-15; the tank stays calm and needs no attention. |
| D15 | App name "Fish Tank", folder name `fish-tank`, app ID `com.weekend.fishtank` (placeholder). | Needed by the installers and the Windows taskbar. Change it before the first tester build; it also decides the save folder. |
| D16 | Bubble sources are part of the decor layout: `layoutDecor` marks 2 to 4 rocks or corals as sources and returns their vent points, so the sources are fixed by the tank seed (FR-41, FR-44). One shared bubble pool serves the chains now and the fish bubbles in Phase 2. | Keeps the layout deterministic and the bubble count bounded. |
| D17 | A dropped pellet sinks at `waterHeight / 6` per second. The chosen fish chases the predicted meeting point at about 140% of its speed, and keeps a queue if several pellets are dropped for it. If the pellet has reached the sand it waits there until eaten. | FR-46 and FR-47: the fish eats before the sand, and no pellet is lost. All numbers come from the visual settings file and are tuned by eye. |
| D18 | Visual numbers (bubble timings, sink speed, depth ranges, pointer distances) live in `renderer/game/visualConfig.js`, separate from the game economy in `shared/config.js`. | The server never needs them, and they will change often while tuning. |
| D19 | Sound effects are synthesized with the Web Audio API (no files): splash, pop and a chime. They play only as a reaction to player actions. | No downloads, licences or file formats to check; NFR-6. |
| D20 | Always on top is off by default and has no full-screen workaround. On macOS it stays on its own space; on Windows it may appear above borderless full-screen windows, which is accepted and documented. | The owner chose to keep the option and keep it simple. Electron cannot detect other apps' full-screen state. |
| D21 | The economy is built for one short visit a day: fullness max 2 with a decay of 1 per 12 hours, 20 points per pellet, a pellet every 60 minutes, 16 floating, an egg per 12 pellets, drowsy after 36 hours, 4 starting pellets (spec 7.1). | A fish fed fully once a day becomes a juvenile on day 3 and an adult on day 10, and the first egg arrives on day 3. |
| D22 | Window rules follow FR-19: 480 × 320 default, 360 × 240 minimum, 1200 × 800 maximum, 3:2 shape, size and position remembered, bottom-right corner on first launch, and placement checked at launch only, by a pure function (tech design 3.7). If the 3:2 lock jitters on Windows it is dropped there. | Caps GPU cost, keeps layout and art simple, and still behaves well with several monitors. |
| D23 | Diagnostics are a local log plus a "Copy diagnostics" menu item whose text includes a short per-day table; the exit-criteria numbers are read from the pasted texts by hand into a spreadsheet. Nothing is sent over the network. | Playtest metrics must be measured, not guessed (spec section 11). |
| D24 | Gate G1 ends Part 1A. Work on the other species and everything in Part 1B starts only after the gate says go. | One species is cheap to change; nine fish and a full game are not. |
| D25 | Test builds (channel `test`) read an optional `tuning.json` that overrides numbers in `shared/config.js`. Release builds ignore it. | Pacing can be adjusted during the playtest without a new build. |
| D26 | Pointer reactions are simplified: curious fish approach and follow, shy fish swim away (faster when the pointer is fast). There is no separate "dart" move. | Fewer states to build and test; still reads as alive. |
| D27 | Two display modes, one app (FR-60): desktop mode puts the tank behind the icons and all windows on the main display; window mode is the small window. The first launch opens window mode with a hint; after that the remembered mode is used. Switching re-creates the window; the mode is stored in `settings.json`. | The owner wants a tank on the desktop, not a frame. Window mode stays as the first-run experience, the fallback and the way to click fish. |
| D28 | The tray icon (Windows notification area, macOS menu bar) exists in both modes and is how the player cares for the fish in desktop mode: Collect pellets, Feed a pellet, Feed until full, Hatch egg, a status line, and the settings items (FR-61, FR-62). The same actions use the same repository calls as clicks. | A tank behind the icons gets no clicks. The owner chose the tray menu for feeding. "Feed until full" keeps the daily visit to two clicks. |
| D29 | Windows attach: try the `electron-as-wallpaper` package first, then our own `koffi` module (tech design 3.8); a native addon only if both fail. macOS uses Electron's `desktop` window type. Nothing reads icon positions or hooks the mouse. | Least native code that can work. The Windows 11 24H2 change in the desktop structure makes this a real risk, so it is tested first (Step 1) and decided at the gate. |
| D30 | The scene is laid out for any size from Step 2 on. Art is rendered at 3x the default-window size, desktop mode draws at most about 1080p of pixels at 30 fps, and sizes and speeds scale with the tank height (FR-63). | A wallpaper must fit 16:9, ultrawide and 4K, and the budgets must hold there. |
| D31 | Desktop mode shows no HTML (no strip, labels, hints or toasts). Messages such as "Everyone is full and happy" appear in the tray menu. Touching a fish, renaming it and clicking crabs and snails need window mode. | The desktop tank receives no clicks, and the calm look is kept clean. |
| D32 | Gate G1 includes a desktop-mode check on both systems. If it fails on one, desktop mode ships on the other and the failing system uses window mode; if it fails on both, the project stays in window mode and the idea is reviewed. | The riskiest part is decided before the art and the rest are built. |
| D33 | Platform seams (see 03-platform-design.md): the saved progress is a record keyed by the id of the scene ("scene"), `fishtank` for now; the tank is written behind one entry point with the contract of 03-platform-design.md section 4 (a typedef only, no loader yet); settings get `activeScene`. No new features. | Keeps the way open to more scenes and to other contributors without building a platform before the first scene is proven. |
| D34 | A saved record that parses but has wrong values is repaired, not replaced: counts are clamped into their caps, missing values get defaults, a fish of an unknown species gets a known one and keeps its growth and name, and only a fish without a usable id is dropped. The original is kept as `records/<scene>-damaged-<time>.json` (written by the main process at once, the newest 5 per scene, and a copy that cannot be kept is logged). Only a record with no tank at all starts a new one, and it is kept the same way. A failed save write stays pending and is retried. | Found in the code review after Step 5: a lowered cap (a later build or `tuning.json`) started a new tank, and the next save replaced the backup too, so the player's fish were lost for good. |
| D35 | On macOS, desktop mode checks the window list itself (CoreGraphics through `koffi`) and pauses when other apps' windows hide 96% of the work area. | Chromium marks the desktop-level window hidden only for a full-screen app in its own Space; a window filling the screen left the tank drawing at 30 fps, against the "pause when covered" budget. The check reads no titles, so it needs no permission, and costs about 0.4 ms every 2 seconds. Tech design 3.8. |
| D36 | The sounds are redesigned (still synthesized, no files, D19): water sounds are small bubbles (a sine that glides up, a quiet octave, a very dark touch of noise), the chime is three bell notes with a glassy overtone, all in one key (D major pentatonic, notes between 500 Hz and 1.5 kHz) through one shared chain with a small generated room, a soft low-pass and a gentle compressor. `npm run sounds` opens a page to audition them. | The first sounds (a noise burst, a falling sine blip, two plain sine notes) were dry, unrelated to each other and "pretty bad" to the owner. |

## 3. Timeline and order

Sizes: S = under a day, M = 1 to 2 days, L = 3 or more days (part-time weekend pace).

| Step | Name | Part | Size | Depends on |
| --- | --- | --- | --- | --- |
| 0 | Preparation | 1A | S | none |
| 1 | Skeleton on both systems, tray and desktop attach test | 1A | L | 0 |
| 2 | Slice scene | 1A | M | 1 |
| 3 | Slice fish: the tetra and sinking food | 1A | L | 2 |
| G1 | Gate: go / no-go | 1A | S | 3 |
| 4 | More species and decor | 1B | M | G1 |
| 5 | Rules, save, feeding and interaction | 1B | L | G1 (5A can start right after Step 1) |
| 6 | Desktop polish and diagnostics | 1B | M | 5 |
| 7 | Playtest and test build | 1B | L (mostly waiting) | 4 to 6 |

Step 5A (the pure rules and the pacing simulator) has no graphics and may start any time after Step 1. It must not delay the gate.

---

## Step 0 — Preparation

Tasks
- [ ] Install the tools in tech design 14.1 on both a Mac and a Windows PC. Check `node -v` prints 24.x and `npm -v` prints 11.x.
- [ ] Confirm the app name and app ID (D15).
- [ ] Create the GitHub repository and run `git init -b main` in `fish-tank/`. The `docs/` folder is already there; commit it as the first commit.
- [ ] Write `assets/art/STYLE.md` (D2): the palette (about 8 colors), outline rule (none, or a thin darker tone of the fill), gradient rule (soft two-stop gradients), light direction (from above), and the neutral-tone rule for tintable parts. The owner approves it.
- [ ] Create `docs/perf-notes.md` with the list of test machines (macOS version, Windows version, integrated or dedicated GPU, display scaling), the budgets NFR-1 to NFR-5 copied from the spec, and an empty results table.

Done when: the repo exists with the docs committed, the style guide is approved and both machines can run `node -v`.

---

## Step 1 — Skeleton on both systems, tray and desktop attach test

Goal: an empty Electron + PixiJS app with a draggable, resizable frameless window that runs from `npm run dev` and from an installer, on both systems, with CI; a tray icon; and a first answer to the biggest technical question: can the tank be shown on the desktop behind the icons on both systems (D27, D29)?

Tasks
- [ ] **Project files.** `npm init`, then add the files in tech design 14.5 (`.nvmrc`, `.gitattributes`, `.editorconfig`, `.gitignore`, `.prettierrc`, `eslint.config.js`). Set `"type": "module"`, `engines`, and `"fishtank": { "channel": "release" }`.
- [ ] **Install** (Electron exact, no caret): `electron`, `pixi.js`, `@fontsource/<chosen font>`; dev: `vite`, `vitest`, `@playwright/test`, `electron-builder`, `eslint`, `prettier`, `cross-env`, `concurrently`, `wait-on`.- [ ] **`vite.config.js`**: `root: 'renderer'`, `base: './'`, `build.outDir: '../dist/renderer'`, `server.port: 5173` with `strictPort`, `server.fs.allow` for the project root.
- [ ] **`electron/main.js`**
  - Single-instance lock; a second launch focuses the existing window.
  - `BrowserWindow`: 480 × 320, `minWidth` 360, `minHeight` 240, `maxWidth` 1200, `maxHeight` 800, `frame: false`, `resizable: true`, `show: false` until `ready-to-show`, a dark-blue `backgroundColor` to avoid a white flash. The full rules (3:2 shape, remembered position) come in Step 6.
  - `webPreferences`: `preload` (the `.cjs` file), `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - Deny `will-navigate` and `window.open`; set the Windows `app.setAppUserModelId`.
  - Load `VITE_DEV_SERVER_URL` when set, otherwise `dist/renderer/index.html` (tech design 14.4).
  - Platform lifecycle per D6 (`window-all-closed` quits the app, except while the display mode is being switched, D27).
  - In development use the separate data folder (`Fish Tank (dev)`), and honor `FISHTANK_USER_DATA`.
- [ ] **`electron/preload.cjs`**: `contextBridge.exposeInMainWorld('fishtank', { ... })` with a fixed list of functions only. Start with `getAppInfo()`; later steps add the rest. No raw `ipcRenderer` is exposed.
- [ ] **Window strip (D5)**: drag area, minimize, close, and a menu (gear) button that is a placeholder until Step 6, styled to match the tank, with `-webkit-app-region: drag` only on the strip and `no-drag` on its buttons. Check edge resizing and dragging on Windows 10, Windows 11 and macOS.
- [ ] **Tray stub (D28)**: `electron/tray.js` creates the tray icon (a temporary icon, a monochrome template image on macOS) and shows a menu with the mode switch and Quit on click. The real menu comes in Steps 5C and 6.
- [ ] **Desktop attach test (D27, D29, tech design 3.8).** Do this before building anything on top of it. `electron/desktop.js` creates the desktop-mode window at the size of the primary display, showing a simple gradient with a moving circle, and the tray item switches between "Show on desktop" and "Show in a window". `FISHTANK_MODE` forces a mode.
  - macOS: `type: 'desktop'`, all Spaces, `setIgnoreMouseEvents(true)`, Dock icon hidden. Check that it shows above the wallpaper and below the icons, on the oldest and the newest macOS available, with Stage Manager on and off and "Click wallpaper to reveal desktop" on and off. If Electron's level is hidden behind the wallpaper, try the `electron-as-wallpaper` package.
  - Windows: try the `electron-as-wallpaper` package first, on Windows 11 24H2 or later and on an older build. If it does not work, write `electron/desktop-win.js` with `koffi` as in tech design 3.8 (find `Progman`, send `0x052C` once, detect the structure from the windows, `SetParent`, place the window). Wrap every call so a failure is a result, not an exception. Do not read icon positions or hook the mouse.
  - On both systems check: icons and windows still get their clicks; the tray menu works; Win+D (Fn+F11 on macOS), an Explorer restart (end `explorer.exe` and start it again), a wallpaper change, a scaling change, unplugging a monitor, and sleep and wake; quitting brings back the normal wallpaper; the window never takes focus; and whether covering the tank with a maximized window is reported as hidden (`visibilitychange`).
  - Write the results in `docs/desktop-spike.md`: one table row per system and Windows build with works, needs a workaround, or fails, the approach used and the problems found. This is the input for gate item 5.
- [ ] **`renderer/index.html`** with a Content-Security-Policy meta tag: `default-src 'self'`; `img-src 'self' data: blob:`; `style-src 'self' 'unsafe-inline'`; no remote origins. If PixiJS needs `unsafe-eval` under this policy, import `pixi.js/unsafe-eval` instead of loosening the policy (check the current PixiJS v8 docs).
- [ ] **`renderer/main.js`**: `await app.init({ preference: 'webgl', resizeTo: window, resolution: devicePixelRatio, autoDensity: true, antialias: true, backgroundAlpha: 0 })`, draw a placeholder rectangle, show an FPS counter in dev mode.
- [ ] **Display changes**: listen for devicePixelRatio changes (moving the window to another monitor, or changing Windows scaling) with `matchMedia('(resolution: <dpr>dppx)')`, and update `renderer.resolution` so the tank stays sharp (FR-43).
- [ ] **Fonts**: import the `@fontsource` CSS, and `await document.fonts.load(...)` before showing text.
- [ ] **Scripts** from tech design 14.3 (`dev`, `build`, `start`, `lint`, `format`, `test`, `test:e2e`, `dist`, `dist:test`). `assets`, `shot` and `sim` are added in later steps.
- [ ] **E2E smoke test** (Playwright `_electron.launch`): the window opens, a `<canvas>` exists, `window.fishtank.getAppInfo()` returns a version. Use `FISHTANK_USER_DATA` pointing at a temp folder.
- [ ] **`electron-builder.yml`**: `appId` (D15), `productName`, `files` (only `dist/`, `electron/`, `shared/`, `assets/` and `package.json`), mac target `dmg` universal, win target `nsis` x64, icons from a temporary 1024 px PNG (the real icon is drawn in Step 6).
- [ ] **`.github/workflows/ci.yml`** (tech design 14.7): lint, unit tests, build, e2e on `macos-latest` and `windows-latest`.
- [ ] Run `npm run dist` on the Mac and on the Windows PC. Install the result and open it.

Done when
- `npm run dev` shows the window on both systems, it can be dragged and resized by its edges, and the placeholder is sharp at 100% and 200% scaling.
- Installers from `npm run dist` run on both systems (after the unsigned-build warnings in tech design section 8). If `koffi` is used, the installers include its unpacked binary; the universal macOS build needs both darwin packages (tech design 14.6).
- CI is green on both runners.
- `docs/desktop-spike.md` says, for each system, whether the tank can be shown behind the icons, with the approach and the known problems. If neither system works, stop and review the idea with the owner before Step 2.

---

## Step 2 — Slice scene

Goal: a lovely empty tank (FR-39 to FR-41, FR-43, FR-44) that is cheap to draw and is measured on real hardware against NFR-1 to NFR-4. Scope is deliberately small: three decor kinds are enough for the slice.

Tasks
- [ ] **Art pipeline script** (tech design 3.3): `npm run assets` renders every SVG in `assets/art/` to 3x PNG (3 times the size in the default window, D30) with `@resvg/resvg-js`, packs spritesheets into `assets/spritesheets/`, and writes `assets/contact-sheet.png`. Add `npm run shot -- <name>`: it launches the app through Playwright, waits a moment, and saves a screenshot to `docs/screenshots/<name>.png`. These two scripts are how Claude Code looks at its own work.
- [ ] **Visual settings file** `renderer/game/visualConfig.js` (D18): the tunable numbers from spec section 6.11 as named constants (bubble chain size and pauses, sink time, depth margins, pointer distances).
- [ ] **Layers.** Build `renderer/game/TankScene.js` with every container from tech design 3.2 in the final order, including the ones Phase 2 will fill (surface, light shafts, floor light, shadows, depth shading). Phase 1 leaves those empty. The layers between the background and the sand lip live in one `water` container.
- [ ] **Water background**: a vertical gradient (light turquoise at the top, deep blue at the bottom), generated once as a texture so it is cheap. Lighter at the top gives the feeling of light from above until Phase 2.
- [ ] **Sand**: a tiling sand texture with noise along the bottom (generated in code or SVG), plus a soft lighter highlight line, and a thin sand lip in front.
- [ ] **Decor art for the slice** (SVG, D2): `rock-large`, `coral-branch`, `weed-tall`. Rocks are sprites; weeds and corals are tall strips for `MeshRope`. Back decor is drawn in paler tones than front decor.
- [ ] **`computeLayout({ width, height, usable })`** in `renderer/game/layout.js` (D4, D30, tech design 3.8): a pure function that returns the water, the sand line, the swimming area, the pellet drop band and the usable area, with one unit = height / 320. Every size and speed in the scene is a number of units. Unit-test it for 3:2, 16:9, 32:9, a 4K display, and a taskbar on any edge.
- [ ] **`layoutDecor(seed, aspect)`** (pure function using `shared/rng.js`): returns decor items with kind, x, y, scale and layer, plus `bubbleSources` (2 to 4 vent points on rocks or corals, D16). Same seed and aspect give the same result; positions are fractions of the width and height (D4); wider tanks get more slots, and the first slots do not move when the aspect grows. Unit-test that it is deterministic, always returns at least 2 sources, and keeps the first slots in place.
- [ ] **Sway**: weeds and corals are `MeshRope` or `MeshPlane` objects; each frame move points by `sin(time × speed + phase) × amplitude × heightFraction` (tech design 3.3). Rocks and sand never move.
- [ ] **Bubbles and chains** (FR-44): one pool of about 60 bubble sprites; each rises with a side wobble, grows about 20%, then fades with a tiny ring at the surface and returns to the pool. A `BubbleEmitter` per source emits a chain of 5 to 12 bubbles about 120 ms apart, then pauses for a random 4 to 15 seconds. Counts scale with the window area. The pool has a public `emit(x, y, size)` so fish can use it in Phase 2. Bubbles and decor are not click targets (`eventMode = 'none'`).
- [ ] **Pausing** (FR-22, NFR-1, tech design 3.7): stop the ticker when `document.visibilityState` is `hidden`; main sends `paused` and `resumed` on hide, minimize, show, restore, screen lock and unlock, suspend and resume. Cap at 30 fps when visible but not active (NFR-2); uncap on focus. **Verify the covered-window case** on both systems by covering the tank with another window and logging `visibilitychange`; write the result, and any fallback used, in `docs/perf-notes.md`.
- [ ] **Resize**: on window resize, rebuild layout from the seed and resize the renderer without restarting the game loop.
- [ ] **Desktop mode scene** (D30): in desktop mode, no HTML overlay; `ticker.maxFPS = 30`; `resolution = min(devicePixelRatio, sqrt(2 073 600 / (width × height)))`; pointer positions arrive from the main process every 100 ms (tech design 3.8) and feed the `PointerTracker`; the main process pauses the tank when a maximized or full-screen window covers the desktop (the Windows foreground check, and `visibilitychange` on macOS). Run the scene in desktop mode at 1920 × 1080 and at 4K and look at texture memory (art at 3x, atlas within 4096 × 4096).
- [ ] **Measure.** Add a dev FPS and frame-time overlay and a first version of the sampler: every 10 seconds in development, log the sum of `cpu.percentCPUUsage` and the memory from `app.getAppMetrics()`. On each test machine, at the default size in window mode and in desktop mode at 1080p and 4K, record: window focused, visible but not focused, hidden or covered, and memory after one hour. Compare with NFR-1 to NFR-4 and write the numbers in `docs/perf-notes.md`. Memory pass or fail is decided with Activity Monitor and Task Manager.

Done when
- The empty tank looks identical on both systems (compare screenshots), including at 100% and 200% display scaling, and it looks right in desktop mode at 16:9 and 4K.
- Bubble chains rise from at least 2 places and repeat with random pauses; weeds and corals sway; back decor looks paler than front decor.
- Resizing is smooth; the layout is the same after quitting and restarting with the same seed.
- Performance numbers are recorded, and NFR-1 to NFR-4 are met or a written reason for loosening one is in `docs/perf-notes.md`.

---

## Step 3 — Slice fish: the tetra and sinking food

Goal: one species that swims up and down, bends, turns, grows and changes color convincingly (FR-11 to FR-14 visuals, FR-21, FR-42, FR-45), plus sinking food that is chased and eaten (FR-46, FR-47). State is in memory only.

Tasks
- [ ] **`assets/species.json` schema.** Per species: `id`, frame names for `body`, `tail` and `accent` (one set for all three stages), `adultLengthPx`, `ropePoints` (8 to 12), `wave` (amplitude, frequency, tail boost), `baseSpeed`, `mouth` (the point where food is eaten, and where bubbles come out in Phase 2), `depthRange` (the preferred depth band, 0 at the surface and 1 at the sand), and three palettes (`fry`, `juvenile`, `adult`), each with 2 or 3 HSL colors (`body`, `fin`, `accent`).
- [ ] **Tetra art** (D2): SVG body, tail and accent (one shape for all three stages), in neutral light tones. The fry, juvenile and adult looks come from size (FR-12) and palette (FR-13) only. Run `npm run assets` and `npm run shot`, look at the contact sheet and the tank, and fix what looks wrong.
- [ ] **`shared/rules.js` starter**: `stageOf(points)` and `sizeOf(points)` only (pure, with tests); the rest of the rules come in Step 5A.
- [ ] **`renderer/game/Fish.js`**
  - Layers per fish: body, accent and tail, each a `MeshRope` sharing one points array, so each can take its own tint.
  - Each frame: a sine wave travels head to tail along the points, with growing amplitude toward the tail; wave speed follows swim speed.
  - Turn: heading changes by a limited angle per frame; the left/right flip eases `scale.x` through zero over about 0.25 s; no snapping (FR-42).
  - Size: `container.scale = sizeOf(points)`.
- [ ] **Steering** in `renderer/game/steering.js` (pure helpers, easy to test): wander in two dimensions, wall avoidance (soft margin around the sides, the surface and the sand line), separation from neighbors, seek toward a target point, and `predictInterceptPoint(fishPos, fishSpeed, pelletPos, pelletVelocity)`. Speed is multiplied by `1 / (0.5 + size)` so larger fish swim slower (FR-21).
- [ ] **Swimming up and down** (FR-45): every 4 to 10 seconds each fish picks a random target point (x and y) inside its species `depthRange`, so it swims sideways and diagonally in all directions; a vertical speed limit keeps climbs and dives gentle. The fish container pitches toward its velocity angle (limited to about ±25°, smoothed). Drowsy fish use the lower third (0.67 to 0.92). Fish never reach the surface band or the sand.
- [ ] **Depth** (FR-42): fish live between the back decor and front decor layers, so they pass in front of back decor and behind front decor.
- [ ] **Color**: `paletteFor(species, stage, seed)` returns three tints; add a hue shift of ±20° from `shared/rng.js` using the fish seed, so the same fish always looks the same (FR-13). `Fish.setStage(stage, animate)` blends the old and new palette over 2 seconds and emits bubbles (`Fish.playStageEffect`, FR-14).
- [ ] **Dropped food and eating** (FR-46, FR-47, D17): a click on the water creates a `DroppedPellet` that sinks at `waterHeight / 6` per second. A click on the sand does nothing. The nearest fish gets the pellet in its `foodQueue`; it stops wandering, turns to face the pellet, and chases `predictInterceptPoint` at about 140% of its speed (clamped above the sand). Within a small radius of the mouth anchor the pellet is removed and the fish plays a mouth pulse and a happy wiggle. If the pellet has reached the sand, it rests there and the fish swims to it.
- [ ] **Slice repository stub**: a tiny in-memory object with the planned `TankRepository` methods (stash starts at 10, no limits, no save), so the same scene code is used later with the real repository.
- [ ] **Slice tray item "Feed a pellet"** (D28): the tray menu gets this one action, which drops a pellet at a random spot near the top through the same code path as a click, so the feeding moment can be judged in desktop mode at the gate.
- [ ] **Unit tests** for the pure helpers in `tests/unit/steering.test.js`: `predictInterceptPoint` for a still pellet, a sinking pellet and a pellet it can never catch (falls back to the pellet position); wall avoidance never produces a target outside the allowed band.
- [ ] **Dev panel**: a points slider from 0 to 450, a drowsy toggle, "spawn 2 and 8 fish", and a "drop pellet" button.
- [ ] **Measure again** with 2 fish and with 8 tetras: NFR-1 to NFR-4, on both systems.
- [ ] **Gate material**: take `npm run shot` screenshots of the tetra at 0, 100 and 400 points, record a short screen recording of the tank (Playwright video or the operating system's recorder) including a feed, and put them with the perf numbers in `docs/gate-g1.md`.

Done when
- The tetra shows three visibly different looks at 0, 100 and 400 points. The change at 100 and 400 is visible without looking at the points number.
- Fish never overlap into a clump, never leave the tank, and never snap when turning.
- Over a minute of watching, every fish visibly swims up and down, tilting as it climbs or dives.
- A pellet dropped from any spot is chased and eaten before it reaches the sand, every time, including three dropped quickly.

---

## Gate G1 — Go / no-go

Run after Step 3. The owner decides; the result and the reasons are written at the end of `docs/gate-g1.md`.

Checklist (all five must be yes to continue, with the exception in item 5)
- [ ] **Style:** the owner approves the art style from the screenshots and the recording.
- [ ] **Budgets:** NFR-1 to NFR-4 are met on one Mac and one Windows laptop, or each missed one has a written reason and an owner-approved new number.
- [ ] **Feel:** the owner and two other people watch the tank for one minute, then say whether it is pleasant and relaxing, and whether the food-and-feed moment feels good. Write down their words.
- [ ] **Window and display:** dragging and resizing the frameless window, the pause when hidden or covered, and sharp drawing at 100% and 200% scaling all work on both systems.
- [ ] **Desktop mode (D32):** with the tetra scene and the tray item "Feed a pellet", the tank shows behind the icons and all windows on macOS and on Windows (Windows 11 24H2 or later, and an older build); icons and windows still get their clicks; it recovers from Win+D and an Explorer restart; it pauses when a maximized window covers it; and it meets the budgets at 1080p and 4K. The results are in `docs/desktop-spike.md` and `docs/gate-g1.md`. If it fails on one system, the other system gets desktop mode and the failing one stays in window mode; if it fails on both, the project continues in window mode only, the desktop idea goes back to the owner, and FR-60 to FR-64 are reviewed.

If the answer is no, fix it before going on, with these options in this order: adjust the style guide and redraw the tetra; tune motion and speeds in `visualConfig.js`; simplify the swimming (fewer rope points, no pitch); lower the effect cost (fewer bubbles, smaller textures); switch to a framed window on the affected system. Re-run the gate.

---

## Step 4 — More species and decor

Goal: the full cast and scenery, in the style approved at the gate (FR-11 to FR-14, FR-40).

Tasks
- [ ] **Guppy and angelfish art**: same process as the tetra (SVG body, tail and accent, one shape each, `npm run assets`, screenshots). Check that the three species are clearly different, even in grayscale.
- [ ] **Remaining decor** (SVG): `rock-small`, `coral-fan`, and `weed-short` or `shell`, so there are at least 5 kinds. Update `layoutDecor` to use all kinds.
- [ ] **Species behavior data**: set `depthRange`, `baseSpeed` and `wave` per species in `species.json` (for example the angelfish mid-water and slower, the tetra anywhere and quicker).
- [ ] **Stress check**: 8 fish of mixed species and stages; confirm NFR-2 and NFR-3 on both systems.
- [ ] **Contact sheet review**: Claude Code reviews every fish at every stage at 1x and 3x and fixes proportions, tints that clash, and rough edges; the owner reviews the contact sheet.

Done when: 3 species × 3 stages and 5 kinds of decor all look right, and 8 mixed fish keep the budgets.

---

## Step 5 — Rules, save, feeding and interaction

Goal: the whole game works from first launch to a grown-up tank (FR-1 to FR-18, FR-46 to FR-49), asks for about a minute a day, and survives quitting.

Step 5A can start as soon as Step 1 is done, because it has no graphics.

### 5A. Shared rules module and the pacing simulator

Tasks
- [x] **`shared/config.js`**: every number from functional spec section 7.1 as named constants, in one exported object `CONFIG`: `SPAWN_INTERVAL_MS` (60 minutes), `MAX_FLOATING` (16), `MAX_STASH` (30), `POINTS_PER_PELLET` (20), `STAGE_JUVENILE_AT` (100), `STAGE_ADULT_AT` (400), `FULLNESS_MAX` (2), `FULLNESS_DECAY_MS` (12 hours), `DROWSY_AFTER_MS` (36 hours), `PELLETS_PER_EGG` (12), `MAX_FISH` (8), plus start values `START_FLOATING` (4) and `START_FISH` (2). The heart number can wait for Phase 4.
- [x] **`shared/rng.js`**: a seeded generator (for example mulberry32): `makeRng(seed)` returning `next()` in [0, 1).
- [x] **`shared/rules.js`**: pure functions. Time is always an argument (`now`, epoch milliseconds), and nothing reads the clock, the disk or a random source.

| Function | Result |
| --- | --- |
| `settlePellets(tank, now, cfg)` | New `floatingPellets` and `pelletsUpdatedAt`, and `spawned`. If `now < pelletsUpdatedAt`, re-anchor to `now` (D9). Adds `floor(elapsed / interval)` pellets up to the cap; if the tank is full afterwards, sets `pelletsUpdatedAt = now` so no spawns are banked (tech design 4.2); otherwise advances it by whole intervals. |
| `settleFish(fish, now, cfg)` | Fish with `fullness` decayed by whole decay intervals, keeping the remainder in `fullnessUpdatedAt`; when it reaches 0, `fullnessUpdatedAt = now`. Same clock-backwards rule. |
| `stageOf(points, cfg)` | `'fry'` below 100, `'juvenile'` below 400, else `'adult'`. |
| `sizeOf(points, cfg)` | `0.5 + 0.5 × min(points / 400, 1)` (FR-12). |
| `isDrowsy(fish, now, cfg)` | True when `now - (lastFedAt ?? createdAt)` is over 36 hours (D10). |
| `isFull(fish, now, cfg)` | True when settled `fullness` equals the maximum. |
| `eggsAvailable(tank, cfg)` | `floor(totalFed / 12) - eggsClaimed`. |
| `collect(state, count, now, cfg)` | Settles pellets, then moves `min(count, floating, free stash room)` pellets to the stash. |
| `feed(state, fishId, now, cfg)` | Settles; needs stash ≥ 1 and the fish not full. Stash −1, fullness +1 (if it was 0, `fullnessUpdatedAt = now`), points +20, `lastFedAt = now`, `totalFed` +1. |
| `hatchEgg(state, newFish, now, cfg)` | Needs an egg and fewer than 8 fish. The caller builds `newFish` from the seeded generator, so this function stays pure. Adds the fish and increases `eggsClaimed`. |
| `renameFish(state, fishId, name)` | Trims; 1 to 16 characters (letters, numbers, spaces), or empty to clear the name. |
| `newTankState(now, rng, cfg)` | The first-launch state: 2 fry of different species, 4 floating pellets, empty stash. |

Every action returns `{ ok: true, state, ... }` or `{ ok: false, reason }`, with `reason` one of `stash_full`, `none_available`, `stash_empty`, `fish_full`, `all_full`, `unknown_fish`, `no_egg`, `tank_full`, `bad_name`. States are never changed in place.

- [x] **Unit tests** (Vitest, `tests/unit/rules.test.js`), with fixed times:
  - Pellets: none before 60 minutes; one at 60 minutes; 5 after 5 hours; capped at 16 after a day (24 spawned); remainder time is kept (150 minutes gives 2 pellets and 30 minutes toward the next); a full tank banks nothing; collecting from a full tank starts the timer at that moment.
  - Clock goes backwards: no pellets gained, timer re-anchors, and normal spawning resumes afterwards.
  - Fullness: decays by 1 per 12 hours; never below 0; a fish at 2 does not eat; feeding a fish at 0 starts a fresh timer.
  - Stage and size at 0, 99, 100, 399, 400, 1000 points (the boundaries from FR-11 and FR-12).
  - Drowsy: just under and just over 36 hours; never-fed fish use the creation time; feeding clears it.
  - Collect: partial collect when the stash has less room; refusal when the stash is full; refusal when no pellets are available.
  - Eggs: none at 11 fed, one at 12, two at 24; hatching blocked at 8 fish and works again when the count allows; `eggsClaimed` never exceeds eggs earned.
  - Rename: trims; rejects 17 characters; empty clears.
  - Immutability: input states are unchanged after every call.
- [x] **Pacing simulator** `scripts/pacing-sim.js` (`npm run sim`, tech design 3.7) and its unit test. Visit patterns: daily at a fixed hour, daily at a random hour, every 12 hours, every 3 days, never; 30 days; the 2 starting fish, and eggs hatched at the next visit. The test asserts the promises of spec 7.2: for a daily visitor, the original fish become juveniles at visit 3 and adults at visit 10, and the first egg is available by visit 3; a player who never visits gets no growth; a player who visits every 12 hours averages at most about 2 pellets per fish per day. A change to the numbers that breaks these promises fails the build.
- [x] Run the same test file later against the server (Phase 3); keep it free of Electron or browser APIs.

### 5B. Repository and save

Tasks
- [x] **`electron/store.js`** (the file-safety piece, used for the tank save, the settings file and the diagnostics log):
  - `readJson(path)` / `writeJsonAtomic(path, data)`: write `name.tmp`, flush, rename over `name.json`, and copy the previous good file to `name.backup.json`.
  - On read: try main file, then backup; if both fail, move the bad file to `name.corrupt-<timestamp>.json` and report "start new".
  - Debounced writer: `queue(data)` writes after 1 second of quiet; `flushSync()` writes immediately (called on `before-quit`).
  - Tests with a temp folder: round trip; atomic replace; falls back to backup when the main file is truncated; moves aside when both are bad.
- [x] **IPC and preload**: add `loadRecord(id)` and `saveRecord(id, state)` to the fixed list in `preload.cjs`, backed by `store.js` (D8, D33; the id is `fishtank`, the file is `records/fishtank.json`).
- [x] **`renderer/repo/TankRepository.js`**: the interface as a JSDoc typedef or abstract class: `load()`, `collect(n)`, `feed(fishId)`, `hatchEgg()`, `renameFish(id, name)`, `tick()` (settle by the clock), `getState()`, `subscribe(listener)`. All action methods return the result object from 5A.
- [x] **`renderer/repo/LocalTankRepository.js`**: constructor takes `{ storage, clock, rng, config }`. `storage` is `{ load(), save(state) }`, which in the app calls `window.fishtank`, and in tests is an in-memory fake. `clock` is `{ now() }`, which the dev panel can offset. Replace the slice stub with it.
- [x] **Save format** (`schemaVersion: 1`; all times in epoch milliseconds):

```json
{
  "schemaVersion": 1,
  "localPlayerId": "uuid",
  "savedAt": 1790000000000,
  "tank": {
    "floatingPellets": 4, "pelletsUpdatedAt": 1790000000000,
    "stash": 0, "totalFed": 0, "eggsClaimed": 0,
    "decorSeed": 482133, "hintShown": false
  },
  "fish": [
    {
      "id": "uuid", "species": "tetra", "seed": 48213, "name": null,
      "growthPoints": 0, "fullness": 0, "fullnessUpdatedAt": 1790000000000,
      "lastFedAt": null, "createdAt": 1790000000000
    }
  ]
}
```

- [x] **Load**: read the save through `storage.load()`; run `settlePellets` and `settleFish` with the clock (this is the catch-up from FR-1: while the app was closed, pellets appeared, up to the cap); repair the values (counts clamped into their caps, defaults for missing values, D34) and keep the original beside it; only a record with no tank at all uses the new-tank path. Unknown newer `schemaVersion`: refuse to overwrite, show a message, and keep the file.
- [x] **Config with tuning**: `loadConfig(override)` merges `shared/config.js` with the optional `tuning.json` (D25): only known numeric keys, within sane ranges, and only in a `test` channel or development; anything else is ignored and logged.
- [x] **Migration hook**: `migrate(save)` that handles `schemaVersion` steps. Only version 1 exists now; add the empty function and a test so later phases have a place to extend.
- [x] **Save on every change**: after each successful action, call `storage.save(state)` (D8). The main process debounces and flushes on quit.
- [x] **Tests** (`tests/unit/repository.test.js`): new tank on empty storage; reload gives the same state; catch-up after a simulated 3 hours closed; a record over a lowered cap is repaired with its fish kept and the original copied; a record with no tank starts a new one; actions persist; `subscribe` fires once per change; dropping a pellet and reloading gives the same stash and fish numbers with nothing left over (D1).

### 5C. Game loop and interaction

Tasks
- [x] **`renderer/game/Pellet.js`**: gentle drift and bob (FR-3), circular hit area, `eventMode = 'static'`, pointer cursor on hover. Click collects (FR-4): call `repo.collect(1)`; on success, animate the pellet to the stash counter and then remove it; on `stash_full`, shake the pellet and show "Stash is full" (FR-5).
- [x] **Pellet entities follow the count**: the repository holds only the number of floating pellets (D8: positions are not saved). The scene keeps the pellet entities in step with that number: on load create that many at random positions (not in the top 30 px, D5); when the count rises (a spawn), fade one in; when it falls (a collect), remove the clicked one.
- [x] **Spawn tick**: once per second call `repo.tick()`, which settles pellets and fullness. Also tick when the window becomes visible again, so a long sleep or hidden period is caught up at once (FR-22).
- [x] **Feeding** (FR-6 to FR-9, FR-46, FR-47): a click on the water calls the scene to choose the nearest fish for which `isFull` is false. If there is none, show "Everyone is full and happy. Come back later!" and drop nothing. Otherwise call `repo.feed(fishId)`; on success, create the `DroppedPellet` and call `fish.queueFood(pellet)` on the chosen fish (Step 3). When the fish eats it, the scene emits `fed`, and the displayed size, stage and fullness update then (D1). If `stash_empty`, show "No food in the stash".
- [x] **Tray actions** (D28, FR-62, tech design 3.8): the renderer answers the tray's summary request with `{ waiting, stash, stashFull, hungry, eggReady, allFull }` from the repository (no ticker needed), and handles the actions from the fixed list `collect`, `feed`, `feedUntilFull`, `stopFeeding`, `hatch`.
  - `collect` calls `repo.collect` for every waiting pellet, up to the stash cap, and plays the collect animation if the tank is visible.
  - `feed` picks a random x inside the usable area under the top edge and goes through the same code as a click on the water (nearest hungry fish, `repo.feed`, `DroppedPellet`, `queueFood`).
  - `feedUntilFull` repeats `feed` about every 2 seconds of scene time until `allFull` or the stash is empty; it stops on `stopFeeding`, a mode switch, Quit or a pause. If the tank is paused when an action arrives, apply the repository changes at once and skip the animation (the economy is committed at drop time, D1).
  - `hatch` hatches the waiting egg as a click would.
  - Unit tests: each action's effect on the repository numbers; `feedUntilFull` stops when everyone is full, when the stash runs out, and never overfeeds; a paused tank ends with the same numbers as a visible one.
- [x] **Click rules** (FR-46): a click on the sand does nothing and spends nothing; decor and bubbles never block clicks.
- [x] **Hit priority** for clicks: egg or pellet first, then fish (FR-48), then water.
- [x] **Resize while food sinks**: store dropped pellet and fish positions as fractions of the water area so they keep their relative place; check by resizing during a feed.
- [x] **Touching a fish** (FR-48, D14; window mode only, D31): `pointertap` on a fish calls `fish.poke()` (a 0.5 second wiggle) and shows the HTML label for 3 seconds: name or species, stage, "Hungry", "Full" or "Drowsy". The rename button opens an inline text box limited to 16 characters (letters, numbers, spaces); Enter saves, Escape cancels (FR-15). Fish names are private (FR-15), so no filter is needed. The label stays where the fish was when touched (a button on a swimming fish is hard to click) and stays open while the pointer is on it.
- [x] **Pointer reaction** (FR-49, D26, tech design 3.3 and 3.8): `PointerTracker` fed by Pixi `pointermove` in window mode and by the main process's cursor position in desktop mode, the `curious` or `shy` personality from the seed, the states `none`, `approach`, `follow`, `flee`, and the 20 second cooldown. The decision is the pure function `chooseReaction(fish, pointer, now, cfg)`. Priority is eating, then the pointer, then wandering. Unit tests (`tests/unit/pointer.test.js`): a curious fish approaches and stops about 40 px away; it gives up after 8 seconds or after 3 seconds of a still pointer; a shy fish flees, faster when the pointer is fast; the cooldown is respected; a fish with food queued never reacts; no reaction when the pointer is absent. Check by hand that clicking to feed still works normally with fish gathered around the pointer.
- [x] **Drowsy and fullness feed the fish**: each tick set the fish's drowsy state from `isDrowsy(...)`.
- [x] **Stage effect** (D11): when a fed fish crosses a threshold, play `playStageEffect` once. It is not replayed after a restart (D11).
- [x] **Eggs** (FR-17, FR-18): `repo.getState()` gives `eggsAvailable`; the scene shows that many eggs resting on the sand (up to the number of free fish slots). Click an egg: `repo.hatchEgg()` with a new fish from the seeded generator; play a small hatch animation and add the fish. At 8 fish the egg stays and a click shows "The tank is full". The egg is drawn as SVG (D2).
- [x] **HUD** (D7, window mode only, D31): stash counter with a pellet icon and `n / 30`, toast messages that fade after 2 seconds, and the first-launch hint (Step 6). In desktop mode the same information is in the tray menu's status line and greyed items. The pellet and egg art is SVG.
- [x] **First launch** (FR-16): no save file creates a tank with `newTankState`; confirm 2 fry of different species and 4 floating pellets.
- [x] **Dev panel (time travel)**: add buttons "+10 min", "+1 h", "+12 h", "+24 h" that offset the dev clock, plus "add 10 pellets to stash", "set all fish points". This is how the pacing and thresholds are tested without waiting.

Done when
- A new player can collect food, feed both fish fully (4 pellets), see "Everyone is full and happy", hatch an egg later and name a fish, with no sign-up (acceptance criterion 1). The same daily routine works from the tray menu alone (Collect pellets, Feed until full) in both modes.
- Quit and relaunch keeps everything: the fish, the stash, the growth, the color stage, the eggs.
- With the app closed for a simulated time (change the clock in dev or edit `pelletsUpdatedAt` in a test save), pellets are present on the next launch, up to 16 (acceptance criterion 3).
- Damaged save file: replace the file with garbage; the backup is used. Delete both: a new tank starts and the bad file is kept aside.
- Dropped food is always eaten by the chosen fish before the sand, including three pellets dropped quickly.
- Using the time-travel buttons as a once-a-day player: the original fish become juveniles on the third day, adults on the tenth, and the first egg is there on the third day.

### What Step 5 built differently

- **Save format.** The file is `records/fishtank.json`, one file per scene id (D33), shaped `{ schemaVersion, savedAt, state }` where `state` is `{ localPlayerId, tank, fish }` as in the example above. Fish ids are random strings from the seeded generator, not UUIDs.
- **Config.** `shared/config.js` holds nested groups (`pellets`, `growth`, `fullness`, `eggs`, `start`) instead of the flat upper-case names; `applyTuning(base, override)` merges `tuning.json` (only known keys inside their ranges). The main process reads `tuning.json` only in development and in a `test` channel build. Listing the active overrides in the diagnostics text comes with the diagnostics in Step 6.
- **Rules.** `settlePellets` also returns `lost` (spawns that did not fit); `newTankState(now, rng, speciesIds, cfg)` takes the species ids, so the rules stay free of the art data; `summarize(state, now, cfg)` gives the tray and HUD numbers.
- **Clicks.** The scene hit-tests clicks itself (`TankScene.click(x, y)`: an egg, then a floating pellet, then a fish, then the water) instead of using the Pixi event system. Pellets, eggs and fish all have `eventMode: 'none'`; the result is the same and it is easy to test.
- **Tray.** `buildTrayTemplate(summary, settings, note, handlers)` is in `electron/menu.js` with 12 unit tests; the summary carries `fishCount`, `eggs` and `feeding` as well. The settings items arrive in Step 6. The action effects (the tray's collect, feed, feed until full, hatch, a paused tank, the stop rules) are tested end to end in `tests/e2e/game.spec.js`, because they need the scene (WebGL), not as Vitest unit tests.
- **Time.** The scene calls `repository.tick()` once a second of scene time and when it becomes visible again. A tick settles pellets and hunger in memory and does not save, because loading settles again from the stored numbers.
- **Not in Step 5.** The first-launch hint and the sounds are in Step 6 (D19, spec section 8). The test hooks are `window.__tank` (`scene`, `repository`, `clock`, `fishtank`) with `FISHTANK_DEBUG=1` or `FISHTANK_DEV=1`, not `window.__fishtankTest`.
- **Pacing finding.** The simulator confirms the spec promises for a player who visits at the same hour every day (juvenile at visit 3, adult at visit 10, first egg at visit 3, 8 fish on day 10). A player who comes at a different hour each day feeds only about 1.5 pellets per fish per day, because a visit less than 24 hours after the last one finds a fish still half full; the original fish become adults after about 14 visits. A player who visits every 3 days gets 0.67 pellets per fish per day. The numbers are left as they are until the playtest (decision D21).

---

## Step 6 — Desktop polish and diagnostics

Goal: it behaves like a good small desktop app on both systems (FR-19, FR-20, FR-22, FR-36 to FR-38, FR-60 to FR-64), stays inside its budgets (NFR-1 to NFR-6), and can report on itself (NFR-7).

Tasks
- [~] **Display modes** (FR-60, FR-64, D27, tech design 3.8): finish `electron/desktop.js` (and `electron/desktop-win.js` if the spike needed it). Built (2026-11-21): the remembered mode and the safe start. `electron/display-mode.js` has the pure `chooseStartMode` and `settingsForMode`; `settings.json` keeps `displayMode` and `desktopAttempt` (`setChoices`); the controller reports `trying` before every attach and `ok` after the renderer is ready (`tank:ready`) and 10 stable seconds; a launch that finds `trying` opens a window, shows the tray note and stores `failed`; giving up at run time is remembered the same way; `FISHTANK_MODE` forces a mode and remembers nothing. 241 unit tests and 31 end-to-end tests. The keep-alive, the retry and the display-change resize were built earlier. Hand-checked on Windows: first launch in a window, the remembered desktop mode, and the safe start after a simulated crash (`trying` in the file). Found: restarting Explorer ends the app (exit code `0xC000041D`; tech design 3.8, "Keeping it attached"), so the keep-alive after an Explorer restart needed a fix: while the tank is on the desktop the app registers with Windows to be started again after a crash (`electron/crash-restart.js`; built 2026-11-21, to be hand-checked: stay on the desktop for over a minute, restart Explorer, the tank should come back within about 15 seconds). Not done: Win+D and display changes by hand, and the same on the Mac.
  - `setMode(mode)`: ask the renderer to save, set the switching flag, destroy the window, create the other one, store `settings.displayMode`.
  - First launch has no stored mode: open window mode with the hint. Later launches use the stored mode.
  - Safe start: write `settings.desktopAttempt = 'trying'` before attaching, `'ok'` after the first frame and 10 stable seconds; if a launch finds `'trying'`, start in window mode, show the tray note "Couldn't show on the desktop, showing in a window" and store `'failed'`.
  - Keep-alive on Windows: a check every 2 seconds while the tank is visible; recreate the window after Win+D, an Explorer restart or a wallpaper change; after 5 failures in 60 seconds switch to window mode.
  - Display changes: debounced `display-metrics-changed`, `display-added` and `display-removed` resize the desktop window to the main display.
  - Tests: the cover decision is a pure function over window rectangles and flags; a test for the settings state machine (first launch, trying, ok, failed).
- [~] **Window rules** (FR-19, D22, tech design 3.7; window mode). Built (2026-11-21): `electron/placement.js` (`fitWindowToDisplays`, `sizeLimitsFor`, `normalizeWindowBounds`), `settings.window` through `setWindow` in `electron/settings.js`, and the window options, the 3:2 lock, the debounced save (500 ms, at once on close and on the switch to desktop mode) and the size limits per display on `moved` in `electron/desktop.js`. 218 unit tests (28 for placement) and 3 end-to-end tests (`tests/e2e/window.spec.js`). The 3:2 lock is macOS only: on Windows `setAspectRatio` made the window lose a few pixels at every start (found by the CI runner), so it was dropped there as the plan allowed (spec FR-19 and tech design 3.7 updated). Not done: the hand check of the 3:2 lock when dragging an edge on the Mac, and a second monitor on real hardware. On Windows at a fractional scale (150%) the system rounded the window outwards, so a restored window grew about 4 px at every start; `settleBounds` in `electron/desktop.js` now corrects the request until the window reports the wanted size (measured at 100% and 150%: the size stays the same over six launches, and the first launch opens at exactly 480 × 320). The end-to-end test checks that the size does not creep.
  - set `setAspectRatio(3 / 2)`, the size limits, and the maximum limited to the display's usable area; if edge resizing jitters on Windows, drop the 3:2 lock on that system (keep the size limits) and update the spec; there is no `will-resize` workaround;
  - `electron/placement.js` with the pure `fitWindowToDisplays(saved, displays, primary)` and its unit tests (one display, two displays, the second removed, mixed scale factors, taskbar or menu bar on any edge, a work area smaller than the minimum, a window half off-screen);
  - save `settings.window` (x, y, width, height; debounced) and restore it; first launch opens in the bottom-right corner of the main display with a 24 px margin;
  - run the placement at launch only. A monitor unplugged while the app runs is left to the operating system, and the next launch places the window again.
- [~] **One menu definition** in `electron/menu.js`, used for the tray menu, the in-window gear menu and, on macOS, the application menu (tech design 3.6). Items: Show on desktop or Show in a window, Always on top (window mode only), Launch at login, Sound, Copy diagnostics, About, Quit. Build it from a list so Phase 2 can add Reduced effects and Day/night lighting with one entry each. `CmdOrCtrl` accelerators where useful. On macOS also set the application menu so Cmd+Q and Cmd+W work. Built in the first slice: `settingsItems` in `electron/menu.js` is the one list, used by the tray and the gear menu. Built later (2026-11-22): `buildAppMenuTemplate` for the macOS menu bar (the application menu with About, Hide, Hide Others and Cmd+Q; a Tank menu with the mode switch and the same shared settings items, without a second About; a Window menu with Cmd+M and Cmd+W; a Developer menu with Reload and Toggle Developer Tools in development runs only). `refreshAppMenu` in `electron/main.js` builds it again when a setting or the mode changes, when the window gains focus (Launch at login can change in System Settings) and 5 seconds after Copy diagnostics. Windows has no menu bar, and `Menu.setApplicationMenu(null)` there (and the macOS menu everywhere else) removes Electron's default menu, which had Reload and Developer Tools shortcuts. Unit tests in `menu.test.js`, e2e `app-menu.spec.js`. Not checked on a Mac yet: the menu bar itself, Cmd+Q, Cmd+W, Cmd+M and the Dock icon of a development run.
- [ ] **Tray menu** (FR-61, FR-62, D28): finish `electron/tray.js` with the pure `buildTrayTemplate(summary, settings, note)`: status line, Collect pellets, Feed a pellet, Feed until full (or Stop feeding), Hatch egg when an egg is waiting, the mode switch, the shared settings items, Quit. Greyed items say why ("Everyone is full and happy", "No pellets in the stash", "Stash is full", "No pellets waiting"). The menu is rebuilt on every click from a fresh summary (wait at most 300 ms), with no timers. Draw the tray icons as SVG and render them with `npm run assets` (macOS template image at 16 and 32 px; Windows 16, 24 and 32 px). No badges, balloons or flashing. Unit-test `buildTrayTemplate` for every state.
- [x] **Settings**: `settings.json` (through `store.js`) with `alwaysOnTop`, `sound`, `window`, `displayMode`, `desktopAttempt`; the preload gains `getSettings()`, `setSetting(key, value)` and `onSettingsChanged(cb)`. Built in the first slice: `electron/settings.js` keeps `alwaysOnTop` and `sound` (and any other key, such as `activeScene`) in `settings.json`; Launch at login is read from the operating system. The preload has `getSettings()` and `onSettingsChanged(cb)` (only the sound flag, the one thing the renderer needs); a change is made by the menu in the main process, so there is no `setSetting` in the preload. `window`, `displayMode` and `desktopAttempt` come with the other Step 6 tasks.
- [~] **Always on top** (FR-20, D20): `setAlwaysOnTop(true, 'floating')` on macOS and `setAlwaysOnTop(true)` on Windows. Off by default; persist the choice. Check the behavior over a full-screen app on each system and write what happens in the README and About. No workaround. Built: the controller applies it when a window-mode window is created and when the menu changes it; desktop mode ignores it. Not checked over a full-screen app yet, and the README note is still to write.
- [~] **Launch at login** (FR-37): off by default. Read the real state with `app.getLoginItemSettings()` rather than storing a copy. Only call `setLoginItemSettings` in a packaged app (`app.isPackaged`), with `args: ['--login']`, so development runs never register `electron`. When started at login (`--login` on Windows, `wasOpenedAtLogin` on macOS) show the window with `showInactive()` so it never takes focus (NFR-6). Test in an installed build. It may behave less reliably for unsigned macOS builds; if it fails, note it as a known Phase 5 item and keep the menu entry. Built: only an installed app registers (the item is greyed in a development run); a start with `--login` or `wasOpenedAtLogin` shows the window with `showInactive()`. Not tested in an installed build yet.
- [x] **Sound** (FR-38, D19): a `SoundPlayer` class that synthesizes the sounds with the Web Audio API: a splash when dropping food, a pop when collecting, a soft three-note chime for a new fish (redesigned on 2026-11-22, see D36). Keep them short and quiet. A mute flag is stored in settings. Create the audio context on the first click. A unit test checks that `play` is never called from a timer or the game tick. Built: `renderer/game/SoundPlayer.js`; splash on a dropped pellet, pop on collecting, chime on a hatch, all only from a click or a menu action. "Feed until full" runs from the tick, so its meals are silent. A paused tank is silent. `autoplayPolicy: no-user-gesture-required` lets a tray action play a sound. An e2e test checks that a minute of ticking and the feeding loop make no sound.
- [ ] **Closing** (D6): in window mode `window-all-closed` calls `app.quit()` on both systems (except while switching modes), and the main process flushes the save before quitting. The tank does not hide in the tray. Minimizing keeps the game running. Quit in the tray menu does the same flush.
- [x] **Onboarding** (spec section 8): on first launch, in window mode, show "Click food to collect it, then click the water to feed. Find the fish icon in your tray (menu bar) to move the tank onto your desktop. Turn on Launch at login to keep it there." until the first successful feed, then set `hintShown`. Desktop mode shows no hint. Built: the hint card at the bottom of the window, until the first successful feed from a click or the tray (`fishtank.js` marks `hintShown`). Screenshot: `docs/screenshots/step6-hint.png`.
- [x] **About**: version, credits (the font), where the save file is, the Always on top note, and where the tray icon is (on Windows it may be in the overflow area). Built as an operating-system message box (version, font credit, save folder, tray icon location, Always on top note).
- [~] **App icon**: the fish icon in `build/app-icon.svg` (water-blue rounded square, white fish, three bubbles; the colors of the style guide). `npm run assets` renders `build/icon.png` (1024 px, Windows) and `build/icon-mac.png` (the same drawing on the macOS icon grid, 824 of 1024 px, set as `mac.icon`), and electron-builder converts them to `.ico` and `.icns`. `assets/app-icon.png` (256 px, in the package) is the window icon and the icon in the About box; a development run on macOS sets the Dock icon from `build/icon-mac.png`. Checked on Windows (2026-11-22): a packaged build has the fish icon in `Fish Tank.exe` (read back at 32 px), the drawing stays readable at 16 px, and `assets/app-icon.png` is inside the package. Not checked: the installed app's taskbar and Start menu entry, and the `.icns` and the Dock on a Mac.
- [~] **Diagnostics** (NFR-7, D23, tech design 3.7): First slice: `electron/diagnostics.js` has `sanitize`, `buildText` and `tailLines` with unit tests (Windows and macOS paths), and "Copy diagnostics" copies the version, system, mode, display, settings and the last 80 lines of the log; the item says "Copied" for 5 seconds. Built later (2026-11-21): `electron/usage-log.js` keeps `diagnostics.json` (opens, desktop and window minutes, active minutes, a sample a minute with CPU, memory and frame rate, errors, start times, the last desktop attach), the main process samples once a minute with `app.getAppMetrics()` (the only timer that runs while the tank is paused), the renderer reports clicks, key presses, frame rate and errors, and "Copy diagnostics" now adds the GPU, all displays, the window size, fish and pellets fed, tuning overrides, the per-day table (tab separated, for a spreadsheet), the measurement summary per state, the start times, the last attach result and recent errors without file paths. 291 unit tests and 2 end-to-end tests. Not done: the numbers in the dev panel (the copied text has them), and the hand check of the copied text on the Mac.
  - `electron/diagnostics.js`: the log file (days, samples, errors, start times), the once-a-minute sampler using `app.getAppMetrics()`, the IPC messages for state changes, clicks, frame rate and errors, and the first-frame start time;
  - `sanitize(text)` and `buildText()`, with unit tests that use Windows and macOS paths and check that the home folder and user name are removed;
  - the "Copy diagnostics" menu item, which writes the text to the clipboard (and shows a short toast in window mode; in desktop mode the menu item briefly changes its label to "Copied"); the text includes the display mode, the display size, the last desktop attach result and a per-day table (date, opens, desktop minutes, window minutes, active minutes, where tray actions count as activity) that can be typed into a spreadsheet;
  - add the diagnostics to the dev panel (live CPU, memory, frame rate).
- [ ] **Politeness check** (NFR-6): confirm the app never takes focus (at launch, at login, when pellets spawn), never shows a notification, makes no sound unless the player did something, and in desktop mode never blocks a click on an icon or window and never flashes the tray icon.
- [ ] **Pause check** (FR-22, NFR-1): minimize the window, cover it with another window, and lock the screen; in desktop mode cover the desktop with a maximized window and with a full-screen video; confirm in Task Manager or Activity Monitor that CPU drops to near zero, and that animation resumes cleanly with the correct catch-up on return.
- [ ] **Measure the budgets** on both machines with the release build: NFR-1 to NFR-5, including one hour and eight hours of memory, and update `docs/perf-notes.md`.

Done when: every menu item works in a packaged build on both systems, the window opens on a visible display after a monitor was unplugged, the picture stays sharp when display scaling changes, desktop mode survives Win+D, an Explorer restart and a display change on Windows and falls back to window mode when attaching fails, and the budgets are met on both machines in both modes.

---

## Step 7 — Playtest and test build

Goal: pass the Phase 1 exit criteria with real testers, using measured numbers.

Tasks
- [ ] **Release workflow**: tag `v0.1.0-test.1`; `release.yml` builds the `.dmg` and the Windows installer with `npm run dist:test` and attaches them to a GitHub Release.
- [ ] **README for testers** (the macOS steps and the exact Gatekeeper text are confirmed, see `docs/02-tech-design.md`, distribution; the data folder of the packaged app is `fish-tank`): how to install the unsigned build on macOS (including the macOS 15 "Open Anyway" step) and on Windows (SmartScreen "More info", "Run anyway"), what the game is and that about a minute a day is enough, where the tray icon is (including the Windows overflow area) and how to move the tank onto the desktop and back, how to feed from the tray menu, where the save file is, how to reset (delete the save folder), what to do if the tank is stuck on the desktop (Quit from the tray menu), the Always on top note, and exactly how to use **Copy diagnostics** (on day 3 and on day 7, paste the text into the shared form or message).
- [ ] **Recruit at least 5 testers**, at least 2 of them not close friends, on both operating systems. Tell them the test lasts 7 days and that nothing is sent automatically.
- [ ] **Manual test pass** on a Mac and a Windows PC, using the checklist in section 8 of this document.
- [ ] **Run the playtest for 7 days.** On day 3 and day 7 collect each tester's diagnostics. Ask each one: Is it fun? Is anything annoying? Would you keep it open? Record answers in `docs/playtest-notes.md`.
- [ ] **Tally** the per-day tables from the pasted diagnostics texts in a spreadsheet and compare with the exit criteria in section 9. Note the numbers in `docs/playtest-notes.md`.
- [ ] **Adjust the pacing if needed.** If testers run out of things to do, or feel nagged, change values in `tuning.json` for the test group first (D25), then update `shared/config.js` and the spec numbers and re-run the pacing simulator test.
- [ ] **Fix list**: triage by severity; fix crashes, save problems and look differences first. Review the thresholds in section 9 with what was measured and adjust them for the next phase.

Done when: all exit criteria in section 9 pass.

---

## 4. Repository and branch practice

- Work on short branches, merge to `main` through pull requests, even when working alone, so CI runs both systems before merge.
- One commit per finished task is plenty. Do not commit `dist/`, `release/`, or any real save files or diagnostics texts from testers.
- Never put a real save file in the repository; tests build their own state.

## 5. Interfaces to keep intact

For Phase 2 (more visuals on top of this tank):
- `TankScene` creates every layer container from tech design 3.2 now, including the empty ones, so Phase 2 only fills them.
- Fish have a `mouth` anchor and a replaceable steering function, so fish bubbles can be added without rewriting `Fish.js`.
- The bubble pool has a public `emit(x, y, size)`.
- Decor kinds are described in a data file (`assets/decor.json`) and `layoutDecor` returns the placed items with their positions, so Phase 2 can add a `walkLine` per rock and coral and the creature walk paths without changing the layout seed or the saved data.
- Menu items come from one list in `electron/menu.js` (used by the tray, the gear menu and the macOS application menu), and settings live in `settings.json`, so Phase 2 adds `reducedEffects` and `dayNight` as new keys.
- Every size and speed in the scene is in units of `height / 320` from `computeLayout`, and nothing is positioned in fixed pixels, so Phase 2 effects work in both modes and at any display size.
- Light shafts, the caustic mask and the other Phase 2 layers read the sizes from `computeLayout`, and a resize or display change rebuilds them (the caustic silhouette is rebuilt then).
- The diagnostics sampler and the budgets stay in place; Phase 2 re-measures with all effects on.

For Phase 3 (a server replaces the local file):
- Game code talks only to `TankRepository`, never to files, `window.fishtank` or `fetch`.
- `shared/rules.js` stays pure: time and randomness are arguments, with no browser, Electron or Node-only APIs.
- All tunable numbers are in `shared/config.js` and nowhere else.
- The save file keeps `schemaVersion`, uses epoch milliseconds, and keeps `localPlayerId`, the fish names and `decorSeed`; Phase 3's one-time import reads exactly this file. Fish names stay private to the owner.
- Stage is always derived from points and never stored.

## 6. Risks specific to this phase

| Risk | Early warning | Response |
| --- | --- | --- |
| Vector art drawn from code looks flat or stiff | The gate says no-go, or fish look wrong in screenshots | Iterate on the tetra with the owner's feedback before drawing the others; adjust `STYLE.md`; keep art swappable through `species.json` |
| The CPU and memory budgets are missed | Step 2 or Step 3 measurements | Fewer bubbles or rope points, smaller textures, lower unfocused frame rate; or loosen a budget with a written reason at the gate |
| The once-a-day pacing is wrong | The simulator test, then playtest numbers (days opened, active minutes) | Adjust numbers in `tuning.json` for the test group, then in `shared/config.js` |
| Frameless window quirks (resize, drag, aspect ratio, snapping) | Step 1, Step 6 and the gate window check | Drop the 3:2 lock on the affected system; fall back to a framed window there if dragging fails; the strip design (D5) is isolated in one component |
| Desktop mode does not attach on one system (Windows 11 24H2 structure, macOS level hidden behind the wallpaper, or a later OS update) | The Step 1 attach test and Gate G1 item 5 | Try the other approach in D29; if it still fails, that system uses window mode (D32); the tray menu and the layout work in both modes, so little is lost |
| Desktop mode is not reported as covered by a maximized window | The Step 1 and Step 2 checks | Use the Windows foreground check (tech design 3.8); on macOS fall back to the 30 fps mode and note the limit |
| Art at 3x and a 1080p or 4K tank use too much texture memory or GPU time | Step 2 measurements | Lower the art scale, lower the desktop drawing resolution, or loosen a budget with a written reason |
| Testers cannot find the tray icon (Windows overflow area) | Day-1 questions from testers | README steps and the first-launch hint; About says where it is |
| Covered-window detection does not work on one system | The Step 2 covered-window test | Fall back to the 30 fps unfocused mode there and note the limit |
| Windows Always on top over full-screen apps | Step 6 check | Accepted (D20); documented in the README and About |
| PixiJS v8 API differences from older examples | Errors or missing classes | Use the current v8 docs; options-object constructors; `MeshRope` (tech design 3.2) |
| Different look on the two systems | Screenshot diff in Step 2 | Same WebGL backend (D12), bundled fonts, no system UI inside the canvas |
| Fish movement or pointer reactions feel mechanical or twitchy | The gate watch test, Step 5 | Tune noise, speed, depth ranges and distances in `visualConfig.js`; this is tuning, not new code |
| Testers forget to send diagnostics | Missing texts on day 3 | Remind them; the log keeps 30 days, so a late paste still works |
| Unsigned-build friction for testers | Testers cannot open the app | README with exact steps; keep the group small; Phase 5 fixes it properly |

## 7. Testing summary

| Layer | Tool | What | When |
| --- | --- | --- | --- |
| Unit | Vitest | `shared/rules.js`, the pacing simulator promises, `rng`, `computeLayout`, `layoutDecor` (including bubble sources), steering helpers, `chooseReaction`, `fitWindowToDisplays`, `buildTrayTemplate`, tray action effects (`feedUntilFull`), the Windows cover decision, the display-mode settings state machine, diagnostics `sanitize` and `buildText`, `store.js`, repository, sound-from-timers check | Every push, both runners |
| E2E smoke | Playwright (Electron) | Launch; canvas present; collect a pellet; feed a fish; quit and relaunch keeps state | Every push, both runners |
| Visual | Screenshots (`npm run shot`), manual | Look is the same on both systems, at 100% and 200% scaling; art reviewed on the contact sheet | Gate G1, end of Steps 4 and 7 |
| Budgets | Diagnostics sampler, Activity Monitor, Task Manager | NFR-1 to NFR-6 on both machines | Step 2, Step 3, Step 4, Step 6, Step 7 |
| Packaged build | Manual | Installer, launch at login, always on top, paths, window placement, tray icon files, the `koffi` binary, desktop mode | End of Steps 1, 6 and 7 |
| Desktop mode | Manual on real machines (CI has no real desktop) | The list in tech design 10: attached behind icons and windows, clicks reach icons, Win+D, Explorer restart, wallpaper change, display change, covered pause, fallback, quitting restores the wallpaper | Step 1, Gate G1, Step 6, Step 7 |

The end-to-end tests need hooks to find pellets and to move time. With `FISHTANK_DEBUG=1` or `FISHTANK_DEV=1` the renderer exposes `window.__tank` with `scene`, `repository`, `clock` (its `offset` moves time forward) and `fishtank`. It does not exist in normal runs.

## 8. Manual test checklist (run on both systems)

First launch
- [ ] Fresh start (empty data folder): a tank with 2 fry of different species and 4 pellets; the hint is shown; the window opens in window mode in the bottom-right corner; the tray icon is there.
- [ ] Click a pellet: it flies to the stash counter; the count goes up.
- [ ] Click empty water: the stash goes down by 1 at once, the pellet sinks slowly, and the nearest hungry fish swims to the place it will be and eats it before it reaches the sand.
- [ ] Drop 3 pellets quickly: the fish eat them all, one after another, and none is left on the sand.
- [ ] Click on the sand: nothing happens and the stash does not change. Click through a weed or a bubble: the pellet drops normally.
- [ ] Feed each fish twice (4 pellets): the next click shows "Everyone is full and happy. Come back later!" and nothing is spent.

Scene and fish
- [ ] Bubble chains rise from at least 2 rocks or corals, with random pauses, and pop at the surface. The same spots after a restart.
- [ ] Weeds and corals sway; rocks and sand stay still; back decor looks paler than front decor.
- [ ] Fish swim up and down with a visible tilt, never touch the sand or surface, bend as they swim and turn smoothly.
- [ ] Click a fish: it wiggles and shows its label (name or species, stage, Hungry or Full); rename it with Enter; Escape cancels.
- [ ] Move the pointer slowly over the tank: curious fish come closer and follow for a few seconds, shy fish swim away; after that they ignore the pointer for a while; a fish going for food ignores it.
- [ ] Resize the window small and large: the number of bubbles looks right at both sizes and the layout keeps its shape.

Growth, color and pacing
- [ ] Use the dev panel to set a fish to 90 points, then feed once: it changes to the juvenile look with the 2-second effect at 100 (and 20 points per pellet).
- [ ] Same at 400 for adult. Restart: the colors are the same.
- [ ] Size at 0, 100, 200 and 400 points matches the formula.
- [ ] As a once-a-day player with the time-travel buttons: juvenile on day 3, first egg on day 3, adult on day 10.
- [ ] A fish not fed for 36+ hours is slower, dimmer and swims low; feeding it recovers it at once.

Eggs and limits
- [ ] After 12 pellets fed in total, an egg appears. Click it: a new fry hatches.
- [ ] With 8 fish, the egg stays and a message shows.
- [ ] Stash at 30: collecting is refused with a message; stash at 0: dropping is refused.

Time
- [ ] Quit, change the clock forward 3 hours, relaunch: 3 more pellets have appeared (up to 16).
- [ ] Change the clock back: no extra pellets, no crash, spawning resumes.

Save
- [ ] Quit and relaunch: everything is as left, including names.
- [ ] Corrupt the save file: the backup is used. Delete both: a new tank starts and the bad file is kept.

Window and desktop
- [ ] Drag by the strip; resize from all edges and corners; the shape stays 3:2 and the size stays between 360 × 240 and 1200 × 800; restart: the position and size are restored.
- [ ] Quit, then set the saved position to a missing display (or unplug the second monitor that held the window) and relaunch: the window opens on the main display with its size kept.
- [ ] Move the window between a 1x and a 2x display, or change Windows scaling: the tank stays sharp.
- [ ] Minimize, hide, cover with another window and lock the screen: CPU falls near zero; show again: animation resumes and catch-up is correct.
- [ ] Always on top works and persists; its behavior over a full-screen app matches the README.
- [ ] Launch at login works in the installed build, starts without taking focus, and is off by default.
- [ ] Sound on and off; sounds play only after a click or a keypress of yours.
- [ ] In window mode, Close quits the app; relaunching catches up on the time that passed; the tank does not hide in the tray; Quit from the menu also quits.
- [ ] Copy diagnostics puts a text with no personal paths on the clipboard and includes the display mode and the per-day table.

Desktop mode and the tray
- [ ] "Show on desktop": the window closes and the tank fills the main display behind the icons and behind every window; other displays keep their wallpaper; relaunch opens on the desktop.
- [ ] Icons, the taskbar or Dock, and windows keep working; a click on the tank area never reaches the tank; nothing takes focus.
- [ ] Tray menu: the status line is right; Collect pellets, Feed a pellet, Feed until full and Hatch egg work in both modes; greyed items say why; "Everyone is full and happy" shows when it should.
- [ ] Feed until full drops pellets about 2 seconds apart and every pellet is eaten before the sand; Stop feeding stops it.
- [ ] Pointer: curious and shy fish react to the pointer over the desktop; the reaction stops when the desktop is covered.
- [ ] Open a maximized window and a full-screen video: CPU drops to near zero; close them: the tank resumes. Use a tray action while covered: the numbers change and nothing is lost.
- [ ] Windows: Win+D, an Explorer restart and a wallpaper change leave the tank on the desktop within a few seconds. macOS: Fn+F11 (Show Desktop) shows the tank behind the icons and pressing it again brings the windows back; switch Spaces; the tank is on every Space. (The macOS part passed on the M1, 2026-11-22; the Windows part is still open.)
- [ ] Change the display scaling or unplug the main display: the tank resizes to the main display and stays sharp.
- [ ] Make attaching fail (dev switch): the app opens window mode and the tray menu shows the note; "Show on desktop" can be tried again.
- [ ] "Show in a window": the window returns, the normal wallpaper is back, and nothing changed in the save.
- [ ] Quit from the tray in desktop mode: the normal wallpaper is back and the save is intact.
- [ ] 16:9, 21:9 and 4K displays: the scene looks right, fish and pellets stay clear of the taskbar or Dock, and the budgets hold.

## 9. Exit criteria (from the functional spec, section 11)

Measured in a playtest of at least 5 people, at least 2 of them not close friends, on both systems, for 7 days, from the per-day tables in the Copy diagnostics texts.
- [ ] Return: at least 80% of testers open the game on 3 or more different days within their first 7 days.
- [ ] Time open: the median tester has the tank visible (desktop or window minutes) at least 2 hours on the days they use it, and at least half leave it running for 4 hours or more on at least one day.
- [ ] Effort: the median tester spends under 3 minutes a day actively using the game (clicking or using the tray menu).
- [ ] Desktop mode: at least 3 of 5 testers keep the tank on the desktop for most of their visible time, and none reports that it blocked a click, hid an icon or stayed on top of a window.
- [ ] Stability: no crash and no lost progress; every damaged save file recovers from its backup.
- [ ] Budgets: NFR-1 to NFR-7 are met on both systems, in the testers' measurements and on the reference laptops.
- [ ] Opinion: at least 4 of 5 testers say they would keep it open on their desktop. Behavior counts for more than opinions.
- [ ] Quality: same look and behavior on a recent Mac and on Windows 10 or 11 (desktop mode where the gate allowed it), sharp on high-resolution screens, with at least 3 species and 5 kinds of decoration, and fish visibly changing size and color at the stage thresholds.
- [ ] The Phase 1 acceptance criteria (functional spec section 13) pass.
- [ ] The thresholds above are reviewed against the measured numbers and written down for Phase 2.

## 10. Confirmed defaults and what is still open

Confirmed on 2026-11-20:
1. App name "Fish Tank" and placeholder app ID `com.weekend.fishtank` (D15). Change the ID before the first tester build, because it decides the save folder.
2. Species `tetra`, `guppy`, `angelfish` (D3).
3. Closing the window quits the app in window mode; a tray icon exists in both modes and has Quit (D6, D28).
4. Slim always-visible top strip in window mode (D5).
5. Art is drawn by Claude Code as SVG and sound is synthesized (D2, D19).
6. Once-a-day pacing (D21), Always on top kept, off by default and simple (D20), window rules (D22), diagnostics and measured exit criteria (D23), the slice and gate (D24).

Confirmed on 2026-11-20 (desktop mode round):
7. The tank lives on the desktop behind the icons and windows (desktop mode) or in a window; feeding in desktop mode is from the tray menu (D27, D28).
8. First launch opens window mode with a hint; Launch at login stays off by default (spec open question 6).

Still open
- The Windows and macOS approach for desktop mode, decided by the Step 1 test and Gate G1 (D29, D32).
- The owner's decision at Gate G1.
- The final values for the exit-criteria thresholds: they are starting points and are reviewed after the first playtest.
- The final pacing numbers: they are confirmed or changed by the pacing simulator and the playtest.
