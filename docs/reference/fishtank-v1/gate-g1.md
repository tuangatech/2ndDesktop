# Fish Tank — Gate G1 (go / no-go)

The gate runs after Step 3 of `docs/04-implementation-phase-1.md`. The owner decides. All five checks must be yes to continue (with the exception in item 5 of the plan). The decision and the reasons are written at the end of this file.

Status on 2026-11-22: material for the owner is ready on Windows. On the Mac (M1), desktop mode works, the covered pause works, it holds 30 fps, and quitting is clean. The Mac budgets are measured: CPU is within; memory is within the macOS limit of 350 MB set by the owner (desktop mode settles at 326 to 332 MB, the window is at the limit with 347 to 354 MB). On 2026-11-22 the Mac desktop checklist passed (`docs/desktop-spike.md`), and the one-hour run was repeated on the Step 6 code. Still open on the Mac: the frameless window (dragging, resizing, the minimized pause), sharpness, start time, the 8-hour growth, two windows tiled side by side, and any macOS other than 27.2, so the gate is not decided.

## How to look at it

Step 3 is merged into `main`.

macOS (Terminal):

```bash
git fetch && git checkout main && git pull
npm install                      # if node_modules/electron/dist is missing: node node_modules/electron/install.js
npm run build
FISHTANK_DEV=1 npm start         # window mode with the dev panel
FISHTANK_MODE=desktop FISHTANK_DEBUG=1 npm start   # desktop mode with the log
```

Windows (PowerShell):

```powershell
git fetch; git checkout step-3-fish
npm install
npm run build
$env:FISHTANK_DEV='1'; npm start          # window mode with the dev panel (points slider, drowsy, 2 or 8 fish, drop pellet)
```

For desktop mode on Windows: `$env:FISHTANK_MODE='desktop'; npm start`. The PowerShell form does nothing on a Mac (use the Terminal lines above). In desktop mode, feed from the tray icon (the menu bar on a Mac): "Feed a pellet". Quit from the tray.

In window mode a click on the water drops a pellet (10 in the stash; "+10" in the dev panel adds more).

## Material

| What | Where |
| --- | --- |
| The three looks of the tetra (0, 100 and 400 points; a fry, a juvenile and an adult) | `docs/screenshots/stages.png` |
| The default window (480 × 320), a 1080p desktop and an ultrawide desktop with 2 fish | `docs/screenshots/tank-480.png`, `tank-1080p.png`, `tank-ultrawide.png` |
| All art pieces on one sheet | `assets/contact-sheet.png` |
| A recording of a feed | To be made by the owner (Win+G on Windows, Shift+Cmd+5 on a Mac): drop a pellet by a click and from the tray. The automated check below covers the same thing without a picture. |
| Numbers | The results table in `docs/perf-notes.md` and the table below |

## The five checks

### 1. Style (owner)

Look at the screenshots and at the running tank. The scenery was redrawn after the owner found it fake; the fish are new. Questions: is the style calm and pleasant behind desktop icons, are the three stages easy to tell apart, are the fish and the food the right size?

Changes the owner asked for so far: more detailed rocks, corals and weeds (done); smaller food (done, 6 to 3.4 units).

### 2. Budgets (Windows and Mac measured; macOS memory limit raised to 350 MB)

Machine W1 (see `docs/perf-notes.md`), strong GPU, so the CPU numbers are a lower bound.

| State | CPU of one core | Memory | Frame rate | Budget | Result |
| --- | --- | --- | --- | --- | --- |
| Window 480 × 320, 2 fish | 0.9% | 228 to 229 MB | 58 | NFR-2: 3% (not active), NFR-3: 8% (active), NFR-4: 250 MB | within |
| Window 480 × 320, 8 fish | 0.9% | 237 MB | 58 | same | within |
| Desktop scene 1920 × 1080, 2 fish (in an ordinary window) | 0.7% | 233 MB | 30 | NFR-2: 3%, NFR-4: 250 MB | within |
| Desktop scene 1920 × 1080, 8 fish | 0.6% | 239 MB | 30 | same | within |
| Minimized | 0% | not measured with fish | none | NFR-1: 0.5% | within in Step 2; to repeat with fish |

Machine M1 (Apple M4 Pro, unified memory). Memory is the memory footprint that Activity Monitor shows, summed over the 4 processes (details in `docs/perf-notes.md`).

| State | CPU of one core | Memory | Frame rate | Budget | Result |
| --- | --- | --- | --- | --- | --- |
| Empty Electron window, for comparison | | 80 MB | | | |
| Window 480 × 320, 8 fish | 1.4 to 1.5% | 347 to 354 MB | 59 | NFR-2: 3%, NFR-3: 8%, NFR-4: 350 MB on macOS | CPU within, memory at the limit |
| Minimized | 0.0 to 0.1% | 160 MB | none | NFR-1: 0.5% | within |
| Desktop mode 1512 × 982 points (2x), 8 fish | 0.9 to 1.1% | 326 to 355 MB | 29 to 30 | NFR-2: 3%, NFR-4: 350 MB on macOS | CPU within, memory within after the first minutes |
| Desktop mode, 10 minutes | 1.0 to 1.1% | 326 to 332 MB in the last 5 minutes | 29 to 30 | NFR-4 growth: under 20 MB in 8 hours | no sign of a leak so far |
| Window, one hour | about 2.0%, up to 2.4% | 327 MB at one hour (318 to 360 during the hour) | 58 to 59 | NFR-4: 350 MB on macOS after one hour | within, no leak |
| Desktop mode, one hour | about 1.2%, up to 1.5% | 334 MB at one hour (325 to 371 during the hour; over 350 for about 20 minutes early on) | 29 to 30 | same | within, no leak |
| Window, one hour, Step 6 code (2026-11-22) | about 2.0%, up to 3.8% | 341 MB at one hour (338 to 358 during the hour; over 350 for about 11 minutes early on) | 58 to 59 | same | within, no leak |
| Desktop mode, one hour, Step 6 code (2026-11-22) | about 1.2%, up to 1.4% | 338 MB at one hour (334 to 358 during the hour; over 350 for about 15 minutes early on) | 29 to 30 | same | within, no leak |

The memory over the budget is in the GPU process (about 235 MB, against 13 MB for an empty Electron window). Most of it is a fixed cost of WebGL in Chromium on this Mac: an empty page with only a WebGL canvas already uses 245 MB in total (Electron 78 MB, WebGL 167 MB). An empty PixiJS app is 274 MB, and the tank adds 52 to 81 MB on top of that. W1's numbers probably leave out what its own GPU memory holds, so this may also fail on an integrated-graphics Windows laptop. Changing the tank alone cannot bring the Mac under 250 MB, and no Chromium switch, WebGPU or WebGL setting tried lowers the fixed WebGL cost either (on macOS this Chromium allows only ANGLE on Metal; details in `docs/perf-notes.md`). Owner's decision (2026-11-21): NFR-4 is 350 MB on macOS, written into spec 7.3 (v0.8) with this reason. The window's margin is thin, so the one-hour run on the Mac checks the window first; if it goes over, the tank's own 52 to 81 MB is what gets cut.

Not measured yet: a real integrated-graphics laptop, memory after one hour and growth over 8 hours, start time (NFR-5), the active-window frame rate, a true 4K display, and on the Mac the 8-hour growth, and start time (the one-hour run was repeated on the Step 6 code on 2026-11-22). Memory with fish is 25 MB higher than the scene alone, so the margin to 250 MB is about 10 to 20 MB; a long run must confirm that it does not grow.

### 3. Feel (owner and two other people)

Watch the tank for one minute, then say whether it is pleasant and relaxing and whether the food and feeding moment feels good. Write their words here:

- Owner:
- Person 2:
- Person 3:

What was checked by machine (`tests/e2e/feeding.spec.js`, `tests/unit/steering.test.js`):
- Three pellets dropped about 0.35 seconds apart in the middle of the tank, 5 rounds in a test and 24 more in a measurement: none landed on the sand before a fish ate it. With only 2 fish, three pellets dropped at the same moment in three far corners cannot all be reached in 6 seconds; in that case a pellet lands and is eaten from the sand.
- A click on the sand drops nothing and costs no pellet.
- Six fish for two minutes of simulated time: none left the swimming area, each used more than 20% of the depth, the tilt never passed 25 degrees, and fish were rarely on top of each other (under 5% of frames).

### 4. Window and display (owner, both systems)

Dragging and resizing the frameless window, the pause when hidden or covered, and sharp drawing at 100% and 200% scaling.

Windows (done on build 26200 at 150% scaling): the pause when minimized works (Step 2). Dragging and resizing: not yet tried by the owner with the fish. Mac (M1, 2x Retina): the pause when covered works in desktop mode, under a full-screen window and, since D35, under a window filling the screen; Show Desktop resumes it (2026-11-22, also in a packaged arm64 build). The frameless window (dragging, resizing, minimized pause) and sharpness are not tested yet.

### 5. Desktop mode (owner, both systems)

Details are in `docs/desktop-spike.md`.

| System | Result so far |
| --- | --- |
| Windows 11 build 26200 (new desktop structure) | The tank shows behind the icons, icons and the right-click menu work, it survives Win+D, it pauses when a window is maximized over it, and it fills the display to the edges. Still to confirm: an Explorer restart, a wallpaper change, a scaling change, sleep and wake, and 4K. |
| Windows older than 24H2 (classic structure) | Not tested; needs a machine or a virtual machine. |
| macOS 27.2 (M1, Apple M4 Pro) | Works with Electron's `type: 'desktop'` window and no native code: the tank shows behind the icons, icons stay clickable, it pauses under a full-screen window and resumes after, and it draws at 30 fps (steady over 14 minutes in the log). Quitting is clean after the quit fix (the log ends with `quitting`). Since D35 it also pauses under a window filling the screen. Checked by the owner on 2026-11-22: Fn+F11 (Show Desktop), Spaces, Stage Manager, "Click wallpaper to reveal desktop", a wallpaper change, keyboard focus, and "Show in a window" from desktop mode and back all work (`docs/desktop-spike.md`). |

## Decision

**Go (owner, 2026-11-22): "G1 is good".** The platform slice follows: `docs/06-implementation-platform.md`.

The form below was the instruction for the decision: go, or no with the reason and the option chosen from the plan (adjust the style guide and redraw the tetra; tune the motion in `visualConfig.js`; simplify the swimming; lower the effect cost; switch to a framed window on the affected system).
