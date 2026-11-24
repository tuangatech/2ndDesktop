# Fish Tank — Desktop Attach Test (Step 1)

Question: can the tank be shown on the desktop, behind the icons and behind all windows, on macOS and on Windows (spec FR-60, FR-64; tech design 3.8; decisions D27, D29, D32)? This file records the answer for each system. It feeds gate item 5 in `docs/gate-g1.md`.

## Approach

| System | Approach | Why |
| --- | --- | --- |
| Windows | Our own module `electron/desktop-win.js` that calls Win32 through `koffi` (find `Progman`, send `0x052C` once, detect the structure from the windows, `SetParent`, `SetWindowPos`). | The plan said to try the `electron-as-wallpaper` package first. It was skipped: its install step compiles Rust code (`cargo`), which breaks the "no compiler needed" rule, and its last release is from January 2025, before Windows 11 24H2 changed the desktop. `koffi` 3 ships prebuilt binaries in per-platform packages. |
| macOS | Electron's built-in `type: 'desktop'` window, shown on all Spaces, `setIgnoreMouseEvents(true)`, Dock icon hidden. | No native code needed if the level is right. If the window turns out to be hidden behind the wallpaper, the fallback is a native call (decided from the result below). |

## How to run the test

Branch `main` (Step 1 and Step 3 are merged into it). Needs Node 24 and npm 11.

macOS (Terminal, zsh or bash):

```bash
git fetch && git checkout main && git pull
npm install
ls node_modules/electron/dist     # must list Electron.app; if not: node node_modules/electron/install.js
npm run build
FISHTANK_MODE=desktop FISHTANK_DEBUG=1 npm start
```

On a Mac, do not use the PowerShell line below. In zsh, `$env:FISHTANK_MODE='desktop'` sets nothing and gives no error, so the app starts in window mode (the log says `mode is now window`).

npm 11.17 holds back install scripts that have not been approved (`npm warn allow-scripts`). On the M1 test, `npm install` left Electron without its app files, so `npm start` had nothing to run. `node node_modules/electron/install.js` downloads them (or approve the script with `npm approve-scripts electron` before installing). The other held-back scripts (`koffi`, `electron-winstaller`, `fsevents`) are not needed to run on a Mac.

To follow the log while testing (macOS):

```bash
tail -f ~/Library/Application\ Support/Fish\ Tank\ \(dev\)/desktop-spike.log
```

Windows (PowerShell):

```powershell
git fetch; git checkout step-1-skeleton
npm install
npm run build
$env:FISHTANK_MODE='desktop'; $env:FISHTANK_DEBUG='1'; npm start
```

The tank should appear as a blue water gradient with rising bubbles and a text line, filling the main display behind the icons. The fish icon in the menu bar or notification area (it may be in the Windows overflow area) has "Show in a window", "Show on desktop" and "Quit". Quit from there.

The app writes a log of what it did to `desktop-spike.log` in its data folder (macOS: `~/Library/Application Support/Fish Tank (dev)/`, Windows: `%APPDATA%\Fish Tank (dev)\`). The log has no personal data. Paste it into the results.

## Checklist (per system and Windows build)

1. The tank is visible on the desktop, behind the icons (icons are drawn on top of the water).
2. A normal window opened on top of the desktop covers the tank.
3. Clicking an icon, dragging an icon and opening the right-click menu on the desktop still work (the tank must not block them).
4. The tank never takes keyboard focus (type into another app while it is running).
5. Maximize a window: the log says `desktop is covered: pausing`. On macOS a full-screen window (green button) also gives `renderer visibility: hidden`, and a window filled to the screen (double-click its title bar, or Window > Fill) gives `desktop is covered: pausing`. Restore it: the tank resumes. On macOS, "maximize" means the green button (full screen, in its own Space; leave it with the green button again or Ctrl+Cmd+F). While paused, the `renderer frame rate` lines (one every 10 seconds) stop; when it resumes, the log says `renderer visibility: visible` and they come back.
6. Windows: show the desktop with Win+D, then restore; the tank is still there within a few seconds. End `explorer.exe` in Task Manager and start it again (File > Run new task > explorer.exe); the tank comes back.
7. Change the wallpaper in Settings: the tank stays on top of the new wallpaper.
8. Change the display scaling or the resolution: the tank resizes to the main display.
9. Sleep and wake the computer: the tank is still there.
10. macOS: show the desktop with Fn+F11 (the Mac's Win+D; Mission Control's "Show Desktop"), then press it again; the tank is still there behind the icons. Switch Spaces: the tank is on every Space. Try Stage Manager on and off, and "Click wallpaper to reveal desktop" (System Settings > Desktop & Dock) on and off.
11. "Show in a window" brings back a small window and the normal wallpaper; "Show on desktop" again works; Quit restores the normal wallpaper.

## Results

| Machine | System and build | Approach | Checklist items that fail | Verdict |
| --- | --- | --- | --- | --- |
| W1 | Windows 11 Pro build 26200 (new desktop structure) | `koffi` module, window shown first (`opaque+show` and the other +show variants) | Without showing the window first, Chromium painted nothing (only the window background colour). After showing it first, the tank draws behind the icons. Other checklist items (Win+D, Explorer restart, covered pause, scaling) still to be confirmed by the owner. | works, pending checklist |
| W2 | Windows older than 24H2 | `koffi` module | not tested yet | pending |
| M1 | macOS 27.2.1 (26B131), Apple M4 Pro, built-in Retina display at 1512 × 982 points (2x) | `type: 'desktop'`, no native code | None so far. Passed (2026-11-21): 1 (behind the icons, first try), 3 (icons clickable), 5 (green-button full screen pauses, leaving it resumes), 11 partly (tray "Show on desktop" from window mode, three times; Quit, clean since the quit fix). Likely passed, seen only in the log: 8 and 9 (the primary display changed to a 1080 × 1920 monitor and back across a 3-hour gap, and the tank came back at 30 fps). Passed (owner, 2026-11-22, with the cover check of D35): 2 (windows cover the tank), 4 (typing in other apps never reaches the tank), 5 also for Window > Fill, 7 (wallpaper change), 10 (Fn+F11 pauses and resumes; the tank is on every Space; "Click wallpaper to reveal desktop" resumes it while the desktop shows; Stage Manager: the windows in the side strip are reported at their small size, so only the window in front counts, and the fish move around it), 11 ("Show in a window" from desktop mode and back, tray "Collect pellets" saved at once). Not tried: two windows tiled left and right, and any other macOS than 27.2. | passed, with 8 and 9 seen only in the log |

### Notes and problems found

- **Chromium only draws in the attached window if the window was shown as a normal window first.** Variants `base`, `layered`, `layered-transparent`, `opaque` and `in-workerw` all showed only the background colour; the `+show` variants (show first, then move onto the desktop) draw the tank. The default is `opaque+show`.
- Owner's lab result on W1 (2026-11-20): `base+show`, `layered+show`, `opaque+show` and `in-workerw+show` all draw the tank. Win+D survives; icons stay clickable. The covered pause did not show in the first test: the log had no `desktop is covered` line. The monitor now also logs every change of the foreground window (class, size, `zoomed`, and the decision) so the next test explains itself. Explorer restart (2026-11-21): the tank noticed the detach, but `Progman` did not exist yet, the attach failed with `no-progman`, and the app fell back to window mode at once (small window at the bottom right; the tray showed "Show in desktop"). Fixed: a failed attach now retries every 3 seconds, up to 10 failures in 60 seconds, before the fallback; to be confirmed by the owner. To restart Explorer after ending it: Task Manager > Run new task (top right) > type `explorer.exe` > OK.
- A Bing Wallpaper widget (`BingWallpaper_Widget_Visual`) adds its own child window to the desktop layer; the attach worked with and without it.
- A display-change event fired right after the first attach and moved the window to the top of the stacking order, above the icons. Fixed: moving keeps the order (`SWP_NOZORDER`).
- **macOS (M1, 2026-11-21): Electron's `type: 'desktop'` window is above the wallpaper and below the icons as it is.** No native fallback and no show-first trick are needed. It draws a steady 29 to 30 fps at 1512 × 982 points.
- macOS covered pause: the green button (full screen) makes Chromium report the desktop window as hidden (`renderer visibility: hidden`), and the frame-rate lines stop. In the test the tank was paused for 1 minute 40 seconds, and leaving full screen brought `renderer visibility: visible` back at 30 fps. The first frame-rate line after a resume can show a low number (3 fps) because it covers only part of the 10 seconds. That is not a problem.
- macOS, a window as large as the screen (2026-11-22): Chromium does **not** report the desktop window as hidden. A test window filling the screen and a Finder window from the menu bar to the bottom both left the tank at 30 fps and about 1.3% CPU; only a full-screen window in its own Space paused it (about 0.1% CPU). Desktop mode now checks the window list itself (`electron/desktop-mac.js`, tech design 3.8): the log says `windows hide 100% of the desktop; covered=true` and `desktop is covered: pausing`. Show Desktop (Fn+F11) resumes it within 2 seconds (`desktop is visible: resuming`, 30 fps) and pressing it again pauses it (owner, 2026-11-22). The packaged arm64 app does the same.
- macOS: entering and leaving full screen each fire one or two `display changed; resizing to 1512x982` events with an unchanged size. They do no harm.
- Quit is not logged. On quit the log ends with `renderer visibility: hidden` and `desktop window was destroyed; creating it again in 1 second`, and then the process exits normally (code 0). This looked like a crash during recreation, but it was not. Fixed (2026-11-21): `before-quit` now logs `quitting` and tells the desktop controller, which stops the monitor and skips the "creating it again" path, so the log ends with `quitting` and `renderer visibility: hidden` (checked on M1 in both modes).
- macOS log review (2026-11-21, 159 frame-rate lines over four runs): desktop mode held 29 to 30 fps throughout, including 14 minutes without a break after the full-screen test (19:31 to 19:45); the only low values are the 0 and 3 fps lines right after a resume (see above). Window mode (480 × 320) drew at 59 fps. After the quit fix, quitting from desktop mode, from window mode, and right after a tray "Show on desktop" each logged `quitting`, exited with code 0 and left no Electron process. Those quits were started with SIGTERM, which goes through the same `before-quit` path as the tray's Quit. Quit from the tray in desktop mode was then confirmed too (20:08:02): `quitting`, `renderer visibility: hidden`, and the process was gone.
- Desktop mode draws without antialiasing; with it the graphics process used about 70 MB more (see `docs/perf-notes.md`).

- Running the app from some editors fails with "does not provide an export named BrowserWindow" because the editor sets `ELECTRON_RUN_AS_NODE=1`. `npm start` and `npm run dev` remove that variable through `scripts/run-electron.mjs`.
- PixiJS needs `pixi.js/unsafe-eval` under our Content-Security-Policy (no `unsafe-eval`). This is imported in `renderer/main.js`.
