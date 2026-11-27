# Platform 5: What fish-tank already verified, so 2ndDesktop need not measure it again

Status: Draft v0.1, 2026-11-24. Companion docs: `04-reuse-from-fish-tank.md` (what code is reused), `01-platform-architecture.md` (budgets and the contract). This document is the **durable home of the measurements and checks** of the fish-tank project, made by the Windows session (W1) and the Mac session (M1) and by the owner by hand. Most of the Mac results exist only in the mailbox file `TODO-Win.md`, which does not move to the new repository, so they are copied here. The raw files (`docs/perf-notes.md`, `desktop-spike.md`, `edit-mode-spike.md`, `gate-g1.md`) go to `docs/reference/fishtank-v1/` (document 3, section 7.2).

## 1. How to read this document

Every fact has one of four levels. Do not treat them alike.

| Level | Meaning | What 2ndDesktop does |
| --- | --- | --- |
| **Measured** | a number from a run on a named machine, with the method written down | Use it as the baseline. Re-measure only after a change that touches the same part (the sandbox, the page protocol, the preload), with the **same method**, and accept a change of up to 3 MB as noise |
| **Passed** | a test or a hand check by the owner that passed on a named system and build | Keep as a regression test; do not repeat by hand until the code it covers changes |
| **Expected** | someone read the code or the documentation and predicts it; nothing was run | Treat as a risk to be tried in the phase that needs it (section 10) |
| **Open** | asked for, not done | Listed in section 10 |

Machines: **W1** Windows 11 Pro build 26200 (the new desktop structure), Intel Core i7-14650HX, 32 GB, NVIDIA RTX 4070 Laptop plus Intel UHD (Chromium ran on the **Intel** GPU), 2560 x 1600 at 150%. **M1** macOS 27.2.1, Apple M4 Pro, 48 GB (unified memory), built-in 1512 x 982 points at 2x. Electron 45.4.1, Chromium 156, PixiJS 8, Node 24 (the Mac ran Node 26.4 and everything passed). Nothing was measured on an Intel Mac, on Windows older than 24H2, on an integrated-graphics Windows laptop, or on a macOS other than 27.2.

## 2. Which memory number is meant

- **Mac:** the memory footprint (`phys_footprint`, from `footprint -p`) summed over the 4 Electron processes, the number Activity Monitor shows. Electron's `getAppMetrics` working set counts shared pages and reads about **190 MB higher** (the diagnostics text now says so).
- **Windows:** private bytes summed per process type (`app.getAppMetrics()`). W1's own GPU memory is **not** counted by private bytes, so Windows numbers on an integrated-graphics laptop are probably closer to the Mac's. Not measured.
- **Budgets (NFR-4):** 250 MB on Windows, **350 MB on macOS** (the owner's decision of 2026-11-21, because an empty WebGL page is already 245 MB there, section 4).
- **CI runners have no real GPU**: a CI memory number is not a machine number. Compare a scene with the empty scene **in the same run** instead of using a fixed number.
- A development run on the Mac is within about 4 MB of the packaged app (since PR 28 and the Dock-icon fix, section 4.4). **Level: stated by the Mac session, no run behind it** (the only data are the main process rows: 40 to 45 MB in development against 44 MB packaged). Treat it as expected.

## 3. Baselines: the empty host and the tank (Measured)

Method: the built app, a clean data folder, the same drawing resolution cap as the real thing (**a baseline without the cap is wrong**: an empty run drawn at 4.1 million pixels read 50 MB too high), the median of the last samples of a 15-minute run (Mac) or a 40 to 50 second run (Windows).

| State | Windows W1 (private bytes) | Mac M1 (`phys_footprint`) |
| --- | --- | --- |
| Empty host, desktop mode | **196 MB** (browser 39, GPU 107, utility 12, renderer 38) | **258 to 264 MB** (GPU 177, renderer 34, main 44), CPU 1.1% |
| Empty host, window 480 x 320 | **172 MB** | **242 to 249 MB** (GPU 163, renderer 29 to 35, main 43 to 46), CPU 1.4% (it still clears 60 times a second) |
| The tank (8 fish), desktop mode | **229 MB** (GPU 136), CPU 0.6 to 0.7%, 30 fps | **328 to 339 MB**, 336 at 15 minutes, 30 fps, CPU 1.2%; 338 MB at one hour |
| The tank, window mode (default size) | **about 220 MB**, CPU 0.9%, 58 fps | **294 to 303 MB** at 15 minutes (W-14, the baseline for gates), 59 fps, CPU 2.0%. The first 10 to 15 minutes run up to about 8 MB higher. **One hour on current code (W-31, Mac, `main` at 9981f0c, 2026-11-24, sound off, always on top, 8 fish): 272 MB, 271 to 275 MB in 95 of 96 samples after minute 13, no growth; the early high stretch is gone (highest early value 296 MB); one 30-second GPU spike to 354 MB at minute 24.5.** These are lower than the 294 to 303 MB baseline for a reason not found (the code changes since W-14 (b932f16), Step 1b among them, or sound off meaning no audio context); keep 294 to 303 as the conservative gate number until a run with sound on says which. Older rows, not baselines: 317 to 327 MB in a 5-minute run with the far reef added (PR 38 check, window always on top, still in the early high stretch); 341 MB at one hour (338 to 358 during the hour) on the Step 6 code of 2026-11-22, **before PR 26** (antialiasing off, atlas image closed, merged 2026-11-22 13:19), which saved about 35 MB |
| What the tank adds | about **33 MB** (desktop), **48 MB** (window) | about **70 MB** (desktop), **55 MB** (window) |
| **Room left for a second scene under the budget** | about **54 MB** (desktop), **78 MB** (window), under 250 | about **88 MB** (desktop), **100 MB** (window), under 350 |
| Minimized, covered or hidden | CPU 0.0%, nothing drawn (`visibilityState` hidden at once; caught up within one reporting period on restore) | CPU 0.0 to 0.1%, footprint falls to about 160 MB while minimized; 162 to 168 MB while hidden |

- **Windows sizes the scenes:** its room (54 MB) is smaller than the Mac's. The farm house's "forest in one texture of 6 to 8 MB" fits Windows; for the Mac the room is easier.
- **No leak seen:** one-hour runs on the Mac in both modes (Step 4 and Step 6 code), and a 15-minute desktop run. There is an early high stretch: the Mac renderer grows to 60 to 66 MB (80 to 85 before the garbage fix) and the total is over 350 MB for 11 to 15 minutes, by at most 8 MB; it comes down by itself.
- **Start time:** 283 to 371 ms on the Mac, warm starts (the diagnostics). A first start of the arm64 build with a fresh data folder read 654 ms (one run). Not recorded for Windows.
- **Frame rate:** window 58 to 59 fps, desktop mode 29 to 30 fps, on both. The CPU numbers on W1 are a lower bound (strong GPU); M1's are a lower bound too (strong chip).
- **The scene switch** (a page reload by the main process): page loaded 97 to 114 ms, scene ready 150 to 201 ms on the Mac; 177 to 197 ms and 250 to 262 ms on Windows. About 0.3 s in all, which is the "blink".
- **Two scenes cost almost nothing extra when loaded first:** the module loading before the renderer was +3 to +5 MB in window mode and no change in desktop mode (Mac, PR 40); the art move left the atlas **byte-identical**. A later scene that adds 3 to 5 MB is at the noise line, not a leak.
- **Not measured:** 8-hour growth (NFR-4's "less than 20 MB over 8 hours"), memory after one hour on Windows, the active-window fps and CPU on Windows (NFR-3), start time on Windows, 4K, an integrated-graphics Windows laptop.

### 3.1 Measured again on 2ndDesktop, and the 20 switches (work package 7.7, Windows W1 and the Mac M1)

Method: `npm run measure:switch` (`scripts/measure-switch.mjs`), the built app, a clean data folder, Electron 45.4.1, private bytes per process type from `app.getAppMetrics()`, the median of 5 readings a second apart, taken 30 s after the start; the frames are the PixiJS ticker for 20 s (gap = time between two frames; work = the scene's update and the drawing calls, not the GPU). One run each. `desktop` is the real attach behind the icons. The window is the default size (not the 480 x 320 of the old baseline).

| State | Total (MB) | Browser / GPU / renderer / utility | Frames | Before (old baseline) |
| --- | --- | --- | --- | --- |
| `empty`, window | **187.6** | 40.7 / 94.1 / 40.9 / 11.8 | 58.3 fps, gap 17.2 ms, work 0.37 ms (95th 0.70) | 172 |
| `empty`, desktop | **207.0** | 41.1 / 113.6 / 40.2 / 11.9 | 29.5 fps, gap 33.8 ms, work 0.49 ms (95th 0.70) | 196 |
| tank (8 fish), window | **216.2** | 38.2 / 116.8 / 49.3 / 12.0 | 58.3 fps, gap 17.2 ms, work 0.64 ms (95th 1.00) | about 220 |
| tank, desktop | **235.5** | 41.8 / 137.9 / 43.9 / 11.8 | 29.5 fps, gap 33.9 ms, work 0.77 ms (95th 1.10) | 229 |

- **The tank adds** about 29 MB in both modes (216.2 - 187.6 and 235.5 - 207.0); the old note said 48 and 33. **Room for a scene** under 250 MB: about 62 MB (window) and 43 MB (desktop), measured on the empty scene; the old numbers were 78 and 54. The empty host reads **16 MB (window) and 11 MB (desktop) above the old baseline**; this is not explained (the window is bigger than the old one, the empty scene draws a flat fill, and the host has grown since). Single runs; if the next measurement is within 3 MB of this one, these are the baselines to compare with.
- **The scene switch costs 99 ms** from the call to a ready page (largest 134 ms in 20 switches; window mode). The frames after 20 switches are the same as before (58.3 fps; work 0.68 ms before, 0.69 ms after).
- **Twenty switches between the tank and `empty`** (started on the tank, window mode, 8 s settling): the renderer grew from 50.8 to 73.3 MB (total +23.3 MB); with 40 s settling +19.1 MB (total +21.7 MB); 60 switches +46.2 MB (total +48.8 MB). The browser, GPU and utility processes do not move. A reading taken right after a switch, with no settling, was up to 356 MB in total (the start is 221 MB).
- **It is memory waiting for the garbage collector, not a leak.** A page reload alone gives the same: 40 reloads of the same scene (the main process reloads the page, no switch) grew the renderer by 33.9 MB and 40 switches by 41.0 MB, against 3.6 MB for 40 s of doing nothing. After a forced collection of the page (DevTools `HeapProfiler.collectGarbage`; `--gc 1`) the renderer is at +11.4 MB after 20 switches and **+3.7 MB after 100 switches** (total +11.4 MB, of which +7.5 MB are the browser and GPU processes, the early high stretch of section 3); 40 switches left +15.2 MB and 40 reloads +8.6 MB, so the leftover does not grow with the number of switches. Waiting 40 s did not give the memory back, so Chromium collects the old pages when it needs the memory, not on a timer.
- **What it means:** a player who switches a few times will not see it; 20 quick switches hold about 20 MB more in the renderer until a collection. It does not break B-4 (the steady state), but a reader of the memory numbers (the watchdog of `02` section 7, a test) must not take the first minute after a burst of switches for the scene's size. If it ever matters, the host could ask the page for a collection after a switch; nothing is built for it.
- **The Mac (M1, `footprint`, W-17, same method, `--settle 30 --seconds 20`; the memory basis is the footprint of section 2, not the working set):**

| State | Total (MB) | Browser / GPU / renderer / utility | Frames | Old Mac baseline |
| --- | --- | --- | --- | --- |
| `empty`, window | **287.5** | 50.0 / 191.0 / 39.0 / 7.5 | 58.6 fps, work 0.35 ms | 242 to 249 |
| `empty`, desktop | **297.3** | 51.0 / 203.0 / 36.0 / 7.3 | 29.5 fps, work 0.34 ms | 258 to 264 |
| tank, window | **330.3** | 51.0 / 215.0 / 57.0 / 7.3 | 58.6 fps, work 0.60 ms | 294 to 303 |
| tank, desktop | **333.4** | 51.0 / 225.0 / 50.0 / 7.4 | 29.5 fps, work 0.69 ms | 328 to 339 |

  - The empty host reads 35 to 40 MB above the old baseline, mostly in the GPU process; the tank is inside or about 30 MB above the old range. **Against the Mac limit of 350 MB the tank has about 17 MB of room** (window 330.3, desktop 333.4): worth knowing before a second scene is added, not a failure. Which change moved the host (the older Electron and host of the old baseline, or the window size) is not known.
  - **A desktop run on the Mac with the default setting measured a paused scene:** another window covered the desktop, "Always pause" paused the tank, and the same run read 146.4 MB (empty) and 179.4 MB (tank) with no frames. The script now sets "never pause" for `desktop` runs; do not quote a desktop figure that says "no frames".
  - **20 switches on the Mac:** the footprint does not grow (367.5 to 343.4 MB, and 370.5 to 333.3 MB with `--gc 1`; it falls because the first reading, 8 s after the start, still holds the start-up garbage of the first page). The working set shows the Windows pattern: +14.5 MB without a collection, +2.5 MB with `--gc 1`. A reading after each 5 switches shows no rise (466 to 481 MB). Frames are the same before and after (58.6 fps; work 0.51 and 0.56 ms). A switch takes a median of 97 ms (largest 105 to 111 ms), the same as Windows.
  - The Electron working set of the Mac reads 164 to 198 MB above the footprint, as section 2 says.
- **Not measured:** the real GPU memory on Windows (private bytes do not count it, section 4.5), more than one run per state, a window that is covered or in the background.

## 4. What costs memory, and what was tried (Measured, do not retry)

### 4.1 The Mac: a fixed WebGL cost

On macOS this Chromium runs WebGL only on **ANGLE over Metal**, and that costs about **165 to 180 MB in the GPU process** (163 to 177 in the empty-host rows, a little more with a scene) however it is set up. An empty Electron window is 80 MB; an empty page with one WebGL canvas is **245 MB**; an empty PixiJS app is **274 MB**; the tank adds 52 to 81 MB. The cost does not depend on the canvas size (a canvas 3.4 times bigger cost 5 MB more). So **250 MB cannot be met on the Mac by changing a scene**.

Tried on the Mac, all in the full-screen desktop window, 35 seconds each, **none lowers the tank's memory, so none was added** (an older or newer Electron and a 2D canvas were not tried):

| Tried | Result |
| --- | --- |
| `--use-angle=gl`, `--use-angle=swiftshader`, `--disable-gpu`, `--disable-features=SkiaGraphite` | WebGL does not start or Chromium falls back to software: the "low" memory does not count |
| `--disable-gpu-compositing` | worse: +100 MB and 3.7% CPU |
| `--disable-gpu-program-cache`, `--disable-gpu-shader-disk-cache`, `--force-gpu-mem-available-mb=256` | no change |
| WebGPU for an empty canvas | 15 MB less than WebGL |
| **PixiJS on WebGPU** | **87 MB more** than on WebGL: not an option |
| WebGL context `depth: false` | 15 MB less on an empty page, **nothing for PixiJS's own context** |

### 4.2 Windows: what moves it

On W1, real desktop mode, 8 fish, steady: 256 MB before the changes (GPU 151, renderer 52, main 42, utility 11); the renderer's JavaScript heap is only 10 MB and the tank holds 7 textures, 10 MB.

| Change | Effect |
| --- | --- |
| **Pixel count** | about **21 MB per megapixel** of drawing resolution, on top of a fixed 110 to 120 MB (Direct3D device, driver, shaders) that no switch lowered. Cap 1600 x 900: -13 MB; 1280 x 720: -27 MB |
| **Multisampling** | 12 MB at the default window, **97 MB at the largest window**; no visible difference at 480 x 320 |
| Close the decoded atlas `ImageBitmap` after the first upload | -10 MB (a lost graphics context then needs a page reload) |
| `--in-process-gpu` | -8 MB, but a graphics crash takes the app down |
| `NetworkServiceInProcess2`, `--use-angle` d3d9, gl or d3d11on12, Pixi `depth/stencil: false` | no effect or worse |

**Applied and measured together:** antialiasing off in both modes, the atlas image closed after upload, the desktop cap `MAX_DESKTOP_PIXELS` 1600 x 900. Result: desktop **256 to 229 MB**, window at the default size **238 to 218 to 222 MB**. The cap looks nearly the same at the real screen size (only slightly softer sand grain and fish detail at 1280 x 720). **2ndDesktop keeps all three as host defaults.**

### 4.3 Garbage per frame (Mac)

A frame allocated 9.7 KB (about 580 KB a second at 60 fps); after pooling the steering results (`out` objects), removing per-call closures and `Math.hypot`, it is **1.2 KB**. What is left is the once-a-second rules tick and PixiJS. The renderer's early peak fell from 80 to 85 MB to 60 to 66 MB and no longer needs a visibility change to come down. `npm run measure:alloc` is the method. **A new scene should be checked against this** (a scene that allocates per frame will show as a high early renderer).

### 4.4 Pitfalls found while measuring

- A baseline without the resolution cap is 50 MB too high (above).
- On the Mac a development run from the commit that set the Dock icon with a 1024 px image had a main process of 77 to 81 MB instead of 40 to 45; with the image scaled to 256 px first it was 48 MB, and the packaged app never sets it. Do not set a large Dock icon in development.
- One Mac run gave back about 20 MB at a short cover and pause; another did not. Unexplained; not repeated. A contract test could check whether a pause and resume releases memory for every scene.
- The Mac sleeps during a long run: use `caffeinate -d -i -s` or the run is invalid (a one-hour run was invalid for this reason).

### 4.5 Where the Windows GPU memory is not counted

Chromium on W1 used the Intel UHD adapter (vendor 0x8086), not the NVIDIA card, and the diagnostics line does not say which one is active. The Intel driver also uses shared system memory that private bytes do not count.

## 5. Desktop attach: the scene behind the icons

### 5.1 Windows (W1, build 26200) (Measured and passed)

- **The approach is our own module over `koffi`** (find `Progman`, send `0x052C` once, detect the structure from the windows, `SetParent`, `SetWindowPos`). `electron-as-wallpaper` was skipped: its install compiles Rust and its last release is before the 24H2 desktop change.
- **Chromium paints nothing in the attached window unless it was shown as a normal window first.** Variants `base`, `layered`, `layered-transparent`, `opaque` and `in-workerw` all showed only the background colour; the `+show` variants draw. The default is `opaque+show`.
- Fixes found by testing: a display-change event moved the window above the icons, so moving keeps the order (`SWP_NOZORDER`); after an Explorer restart `Progman` did not exist yet, so a failed attach **retries every 3 seconds, up to 10 failures in 60 seconds**, before the fallback to a window. A Bing Wallpaper widget adds its own child window; the attach worked with and without it.
- **Passed (owner):** the tank draws behind the icons, icons and the right-click menu work, it survives Win+D, it pauses when a window is maximized over it, it fills the display to the edges.
- **Open:** the Explorer restart fix is not confirmed by the owner; wallpaper change, scaling change, sleep and wake, 4K, and Windows older than 24H2 (the classic desktop structure) were not tested.

### 5.2 macOS (M1, 27.2) (Measured and passed)

- **Electron's own `type: 'desktop'` window is above the wallpaper and below the icons as it is: no native code and no show-first trick.** It is shown on all Spaces, ignores the mouse, and draws at a steady 29 to 30 fps (14 minutes without a break in the log).
- The app has **no Dock icon**: `app.dock.hide()` needs 2 to 3 tries over 1.0 to 1.5 s, which is why `hideDock` retries every 500 ms.
- **Passed (owner, 2026-11-22):** windows cover the tank; typing in other apps never reaches it; icons stay clickable; wallpaper change; Fn+F11 (Show Desktop) pauses and resumes it; it is on every Space; "Click wallpaper to reveal desktop" resumes it; Stage Manager (the windows in the side strip are reported at their small size, so only the window in front counts); "Show in a window" and back; tray "Collect pellets" saves at once; the primary display changed to a portrait monitor and back across a 3-hour gap and the tank came back at 30 fps (seen in the log only).
- **Not tried:** two windows tiled left and right; a macOS other than 27.2; whether desktop widgets (Sonoma and later) sit above our window; whether a bright scene under the menu bar makes the clock hard to read (the menu bar's text colour follows the system wallpaper, not our window).
- **The player's wallpaper is replaced on every Space, on the primary display only**; a second display stays plain. A scene that is a wallpaper must say so in its first-run text.

### 5.3 The covered pause (Measured and passed)

| System | What reports "covered" |
| --- | --- |
| Windows | Measured with the foreground check of the old project (`decideCovered`, removed in 0.2: DEC-56 lists every visible window instead, as the Mac does); paused when a window was maximized over the desktop. Minimizing the window itself: `visibilityState` becomes hidden |
| macOS, a **full-screen** window in its own Space | **Chromium reports the desktop window hidden** by itself (about 0.1% CPU while paused). This is not a "full-screen detector" of ours |
| macOS, a window that only **fills the screen** (Finder, a maximized editor) | **Chromium does not report it**: the tank kept drawing at 30 fps and 1.3% CPU. Our own check reads the CoreGraphics window list and pauses when other apps' windows hide **96% of the work area**, every 2 seconds; with a maximized editor it paused within 2 seconds (0.3 to 0.5% CPU) and Show Desktop resumed it within 2 seconds |

The first frame-rate line after a resume can show a low number (0 to 3 fps) because it covers only part of the 10-second window: not a problem. Entering and leaving full screen fires one or two `display changed` events with an unchanged size: harmless. Quit is clean in both modes (the log ends with `quitting`).

## 6. Host windows, focus and the scene switch

### 6.1 Edit mode spike (Windows and Mac) (Measured; Edit mode itself is not built)

Question: a window that takes clicks over the attached scene, without a flash or a focus fight. **S** is a second overlay window; **R** re-creates the attached window. Decision D51: **R**, because S needs a second page (about 262 MB against 250 on Windows, 385 to 410 MB against 350 on the Mac, computed from the baselines, not measured).

| | Windows W1 | Mac M1 |
| --- | --- | --- |
| Overlay shown (real renderer) | page 177 to 197 ms, scene ready 250 to 262 ms | page 97 to 114 ms, scene ready 150 to 201 ms |
| Way back in R | 0.4 s for the window plus 0.25 s for the scene | 198 to 204 ms (trivial page), about 0.4 s with the scene |
| Keyboard and mouse reach the overlay | yes (mouse and Esc by script) | yes (`document.hasFocus()` true; clicks not posted: needs the Accessibility permission) |
| After the overlay closes | foreground goes to the taskbar (R) or the shell (S) | **the previous app does not get the focus back by itself; `app.hide()` does** (2 of 3 runs in the later check; once another app came to the front) |
| Extra costs | the taskbar stays usable and no taskbar button appears (`skipTaskbar`); the desktop icons are covered; Win+D leaves the overlay visible | the **Dock icon comes back for about 1 to 1.6 s** when the attached window is made again; `show()` plus `focus()` is enough to take focus, with or without `app.focus({ steal: true })` **in that spike**. Do not drop `steal`: the Stretch window and the Mac's Re W-25 use `app.focus({ steal: true })` because the window is opened from a tray click while another app is in front (measured: the 380 x 560 test window became the key window with the keyboard) |

- **Windows' foreground lock:** with another app in front, `isFocused()` said true but the Windows foreground was still the other app. A process that has just received input may take the foreground; a tray click is input, but the real tray path was not tried. Give any overlay a visible "Done" button and accept Esc.
- Use the **work area**, not the whole display (the taskbar or menu bar stays). R needs the **save handshake** of a scene switch (ask the page for a final `serialize()`, wait with a timeout, `flushSync`, then destroy).
- **Expected, not tried:** `app.setActivationPolicy('accessory')` after each window instead of the `hideDock` retries, to remove the Dock flash; keeping one hidden window alive through the swap.

### 6.2 What the reload-based scene switch must keep (Passed, with fixes)

- `will-navigate` lets only the same URL through, so a page-driven `location` change is cancelled: **the main process does the switch** (`loadRenderer` with the new query), which also keeps the safe start and the stable timer.
- **A reload must not lose host state:** a page that reloaded while the tank was paused started drawing again (the pause is sent only when it changes). Fixed (`fix-pause-after-reload`), and the pause is sent again after the new page loads. Test to keep: switch scenes while covered or minimized, and the new scene stays paused.
- A scene whose atlas file is missing crashes the host at boot; `status()` or `menuItems()` that throw are not caught inside the IPC callback; `sound.play` names are the tank's; `resize(width, height, usable)` has no type; `update(dt)` has no cap in the host; `record.save` has no flush. These are the contract gaps listed in `../scenes/fishtank-migration.md`.

## 7. Packaging, first open and diagnostics

| Fact | Result |
| --- | --- |
| Windows installer (NSIS, x64) | **117 MB**; installed 361 MB (the exe 239 MB, `locales` 49 MB). With English only: **313 MB** (measured 2026-11-24) |
| macOS image | **Measured (Mac, W-28, `main` at 286a4a8, 2026-11-24): arm64 only, English only: `.dmg` 114.5 MB, `.zip` 111.1 MB, installed `.app` 254 MB**; it starts and attaches, and the `koffi` cover check works with the arm64 package only; Resources keeps `en.lproj` and `en_GB.lproj`. Command: `npm run build`, then `npx electron-builder --mac dmg zip --arm64 -c.electronLanguages=en`. For comparison the universal build: `.dmg` 215 MB, installed 487 MB (zip not built) |
| macOS first open | **Measured, with a caveat** (the quarantine tag was set by hand and the app opened with Open Anyway; a real browser download should do the same): a quarantined app runs from a **translocated path** (`/private/var/folders/.../AppTranslocation/<id>/d/<name>.app`), not from `/Applications`. Moving the app in Finder removes the translocation. See section 10 (P5) |
| Packaged app data folder | `fish-tank` on both systems (the `name` in `package.json`; no `productName`); development: `Fish Tank (dev)` |
| Mac dmg window, icon size in the Dock and in Finder | **Passed** (owner, universal ad-hoc signed build, macOS 27): the icon matches its neighbours; the Mac icon is the 896 px square scaled to 824 of 1024 px by `make-icons.mjs` |
| **Gatekeeper on macOS 27, unsigned** | "Fish Tank" **Not Opened**, "Apple could not verify ... free of malware", only **Move to Trash** and **Done**; then System Settings, Privacy & Security, **Open Anyway**, then Touch ID or a password; the next start needs nothing. A local build has no download tag and opens with no question. (Measured with the tag set by hand.) |
| Packaged app first window | draws the tank at 59 fps; the safe start works ("starting in a window: the last desktop attempt did not finish") and "Show on desktop" then attaches in 10 seconds (**Passed**, owner) |
| Copy diagnostics | **Passed** on the Mac: no home folder or user name in the text; the memory line says it is the working set; the GPU line names the vendor ("Apple (vendor 0x106b)"); "Last desktop attach: macOS desktop window"; usage per day; start times |
| Windows frameless window | the 3:2 shape is kept when a corner is dragged (**Passed**, Mac); dragging and resizing with fish on Windows: not tried |
| Tray menu | the owner opened it on the Mac and it works; which mode and build were not stated |

`koffi` must be unpacked from the asar archive (`asarUnpack`); a universal Mac build needs both darwin packages (`scripts/koffi-universal.mjs` fetches the missing one with `npm pack`, so `npm run dist` needs the network). While the Mac release is Apple silicon only this is not used.

## 8. Tests that prove "nothing changed" (Passed, reuse as they are)

- **Golden hash** (`scenes/fishtank/tests/golden.spec.js`): a state hash and a scene-graph hash after 900 steps with a fixed seed and a manual clock. The **same hashes on Windows, Mac and CI**. The graph hash must use a stable node type (`renderPipeId`), not `constructor.name` (the minifier renames classes); the 900 steps should include scripted player actions (collect, drop pellets, feed until full, hatch an egg) so the rules that move are covered; time-stamp keys are a list, not "ends with `At`".
- **`npm run shot`** is reproducible with the seed and the manual clock. **Desktop-mode shots are byte-identical** run to run on both systems. **Window-mode shots on the Mac are not**: the first picture of a series is coloured differently (average red 91 against 111, positions identical; `force-color-profile=srgb` did not remove it). **On the Mac compare the graph hash, not window PNG bytes.**
- **The art pipeline is deterministic:** `npm run assets` gives a byte-identical atlas (18 images, 2048 x 1228) before and after the move; `gen-decor-art.mjs` rewrites the decor SVGs with no change.
- **Counts at the last Mac run:** 341 unit tests (25 files) and 38 end-to-end tests pass, plus lint and format. `app-menu.spec.js` runs on macOS only and expects the scene's name from `scene.json`.
- **A procedural scene must not allocate per frame** (section 4.3) and a ripple or filter on an integrated GPU must be measured on both systems (not yet done).

## 9. Development environment gotchas (Passed)

- npm 11 holds back install scripts (`npm warn allow-scripts`): after `npm install` on a Mac Electron may have no app files; run `node node_modules/electron/install.js`. The other held-back scripts (`koffi`, `electron-winstaller`, `fsevents`) are not needed to run on a Mac.
- Some editors set `ELECTRON_RUN_AS_NODE=1`, which fails with "does not provide an export named BrowserWindow"; `npm start` and `npm run dev` clear it (`scripts/run-electron.mjs`). Use them, not bare `electron`. **The packaged app fails silently with it** (measured on the Mac): it exits at once with code 0, no window and no message, so the symptom is "the app does nothing". `env -u ELECTRON_RUN_AS_NODE` fixes it.
- Env vars set in PowerShell do nothing in zsh and give no error (the app silently starts in window mode).
- Playwright cannot launch the x64 half of a universal build through `arch -x86_64`; start it by hand.
- PixiJS needs `pixi.js/unsafe-eval` under a CSP without `unsafe-eval`; it is imported first in `app/page/main.js` and the end-to-end suite runs it on both systems (**confirmed**). The stricter `style-src 'self'` of the new design is not tried.
- A desktop-mode run started from an editor that fills the screen is paused at once by the cover check; measure desktop minutes with the desktop uncovered.

## 10. Not verified: carry as risks, and what is still open

**Expected (read, not run), to try in the phase named:**

| Risk | Phase |
| --- | --- |
| `safeStorage` on a Mac: the keychain item is tied to the code signature, an unsigned or ad-hoc build changes it after every build, and the first use may open a system dialog that takes focus; call it only when the player enters or removes a token | P3 |
| After sleep and wake the network is not there for a few seconds; wait for `net.isOnline()` plus jitter, and count a failure in that window as no failure | P2 network |
| Never use CoreLocation (it asks for a permission with a dialog); a typed city instead | P2 network |
| Refuse a declared host that resolves to a private or loopback address; use a session with no cookies | P2 network |
| Notarization with koffi (hardened runtime, JIT entitlements, `disable-library-validation` or signing the native file by the same identity) | P5 |
| "Launch at login": a new bundle id is a new Login Items entry (the old W-9 check is still open) | P5 |
| A quarantined app runs from a translocated path, which does not survive a restart; "Launch at login" and any later updater use the app's path. The README steps must say "drag to Applications, then open" (moving it in Finder removes the translocation) | P5 |
| On a Retina Mac the desktop cap draws at about half of the native pixel density (drawing resolution 0.98 on a 1512 x 982 point screen), so small text is soft (the Mac's reasoning, not looked at by eye): draw a desk laptop's text larger or in its own texture | the desk |
| There is no Electron API known for macOS Low Power Mode (there is one for the thermal state) | P1 |
| Custom shaders can hang the GPU for everybody; a frame that takes 2 seconds must be measured against the watchdog | P1 spike |

**Open checks from the fish-tank mailbox (owner or the other machine), still worth doing once on the new build:** W-3 second display; W-5 sleep and wake, lock and unlock, a display change in desktop mode, and the wording of the tray note after a failed attempt; W-6 drawn desktop minutes and tray actions in desktop mode; W-8 politeness (no focus, no Dock bounce, no notification, no sound unprompted; "Always on top" over a full-screen app); W-9 Launch at login; Explorer restart (Windows); Windows older than 24H2; 4K; the 8-hour growth; an integrated-graphics Windows laptop; the active-window frame rate on Windows; start time on Windows.

**New to 2ndDesktop and never measured:** the cost of a second small **scene** window that draws with WebGL (the memory estimate in document 1 is for a full-size page), the `scene://` and `app://` privileged schemes, the new CSP with `style-src 'self'`, WebRTC under `disable_non_proxied_udp`, the Edit menu on macOS (paste in each text field), the Dock flash fix for a visit from desktop mode, a Start with a full-screen app in front on the Mac. The cost of one host settings window (plain HTML, no WebGL) is now measured on the Mac (W-30): about 14 to 20 MB in all, mostly the new renderer (about 16 MB), with the GPU process within the run-to-run spread, and back to the base after `destroy()`. The base was a 480 x 320 page clearing WebGL, not PixiJS. The Windows number is still open.

## 11. What this saves

- **Do not re-measure** the empty host, the tank's cost, the Mac WebGL floor, the Chromium switches (section 4), the covered-pause behaviour, the Windows attach variants, the Edit mode costs, or the Gatekeeper first-open text.
- **Do re-measure, with the same method**, after P0 and P1: the empty host and the tank in both modes (to see whether the new sandbox, preload and page protocols moved the numbers by more than 3 MB), and the golden hash on both systems after every move.
- **Do not retry** WebGPU, ANGLE variants, software GL, program-cache switches or `--force-gpu-mem-available-mb` on the Mac; they were tried and none helps.
