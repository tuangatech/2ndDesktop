# Fish Tank — Edit mode spike (Windows, 2026-11-22)

Status: **decided: R (re-create the attached window), platform plan D51**, 2026-11-22. Windows part done, Mac part done by the Mac session the same day (section 7). Reviewed by the Mac session (W-17). Nothing here is built in the app: it is a measurement, as the attach test of Phase 1 was (`desktop-spike.md`).
Companion docs: 03-platform-design.md section 6 (the question), 06-implementation-platform.md Step 3 (the plan)

## 1. The question

In desktop mode the tank is attached behind the icons and takes no clicks (D31). 03 section 6 proposes an **Edit mode**: a tray item "Edit" puts the scene in a window on top of the desktop that takes clicks, and "Done" returns to the attached state. Can that be done without a flash, a focus fight or a new taskbar button, and which of two ways is better?

- **S, a separate overlay:** a new frameless window over the work area, always on top; the attached tank stays where it is.
- **R, re-create:** the attached window is destroyed, the overlay is shown, and on Done the attached window is made again (the way a change of display mode works today).

## 2. Method

`spikes/edit-mode/win.mjs` is a throwaway Electron app (run `npx electron spikes/edit-mode/win.mjs` from the repository root). It attaches a window behind the icons with the app's own `electron/desktop-win.js` (the shipped `opaque+show` way), then runs S and R and logs: the time to show the overlay, which window has the Windows foreground before, during and after, and whether simulated mouse clicks and an Esc key reach the overlay (it clicks only when the overlay really is the foreground window, so that no click can land on another app). A second run captured the screen (`desktopCapturer`) and sent Win+D during S; that run is slower (capturing a screen about twice a second), so its timings are not used. The captured frames showed the owner's own windows and were deleted after being looked at; the capture was made when the owner had asked for the test to be run and checked, before the rule "ask before capturing the owner's screen" was written, and is not to be repeated without asking.

Machine W1: Windows 11 build 26200, one 2560 × 1600 display at 150%, Electron 45.4.1.

## 3. Results

The times below are of a page that is only a coloured div, so they are the cost of the window, not of the scene. With the real renderer (the built `dist`, window mode, no preload) as the overlay on Windows, three runs: page loaded in 177 to 197 ms, window shown 8 to 12 ms later, scene ready (`window.__ready`) in 250 to 262 ms. So the way in is about 0.26 s, and the way back in R about 0.4 s for the window plus 0.25 s for the scene, 0.6 s or more.

Clean run (no capture; the foreground before the edit was the desktop itself, `Progman`, so no other app was in front):

| | S: overlay on top | R: re-create |
| --- | --- | --- |
| Overlay shown | 198 ms (page load 165 ms, show 10 ms) | 246 ms |
| Overlay has the foreground and focus | yes | yes |
| Simulated clicks and Esc reach it | 3 sent, 4 counted (the fourth was not sent by the script; most likely a click of the owner during the countdown) and the key | 3 clicks and the key |
| Back to the desktop | the window closes in 514 ms; the tank was attached the whole time | **408 ms** to make and attach the tank again |
| Tank attached afterwards (Win32 check) | yes | yes |
| Foreground after Done | Explorer's shell | the taskbar |

Capture run (another app in front; timings inflated by the capture and not used):

- The overlay covers the work area; the **taskbar stays visible and usable**, and **no taskbar button appears** (`skipTaskbar`): the taskbar shows the same icons before and during the edit. The desktop icons are covered while it lasts.
- **Win+D during the edit:** the overlay stays visible (it is not minimized), and the foreground goes to the desktop; Win+D again brings it back. The attached tank is still attached after the whole edit.
- **No uniform white or black frame** was seen in about 38 frames, but at one frame every 0.5 s a flash of less than 100 ms cannot be excluded.
- **A finding: Windows' foreground lock.** With another app in front, `overlay.isFocused()` said `true` 600 ms after `show()`, but the Windows foreground window was still the other app (`describeForeground()`). The script took this as "do not click". In the clean run, and later in R, the overlay did have the foreground. What is different: a process that has just received input is allowed to take the foreground, and in the clean run the foreground was the desktop shell, and in R the script had just sent keys. In the real app, "Edit" is chosen from the tray menu, which is input to our process, so it is expected to work, but that is not measured.

## 4. What this does not show

- A flash shorter than about 0.1 s, in either variant (the capture was too slow, and the clean run was not watched for it, the person's answers to the questions of the run were not given).
- The real path: "Edit" chosen from the tray menu. It must be tried by hand, with another app in front, to see that the overlay gets the keyboard (Esc) as well as the mouse.
- Focus returning to the app the person was using. The capture run was confounded by Win+D; the clean run started from the desktop.
- An Explorer restart during an edit.
- The memory of S against R (see 5).

## 5. Reading the results

- Both ways work technically: the overlay appears in about 0.2 s, takes mouse and keyboard, leaves the taskbar usable, adds no taskbar button, survives Win+D, and the attached tank survives or is made again.
- **S keeps two pages alive** (the attached tank and the overlay), which means a second renderer and graphics surface. The empty host is 196 MB and the tank 229 MB in desktop mode on W1 (`perf-notes.md`); a second drawing page costs at least what the tank costs over an empty host (33 MB in desktop mode on W1, 70 MB on the Mac, `perf-notes.md`), so S is at least 229 + 33 = 262 MB on Windows against 250, and 328 to 339 + 70 = about 400 MB on the Mac against 350 (the Mac session gives 385 to 410). Both are over the budget while an edit lasts; the sum is not a measurement of S itself. **R has one page at a time**, as mode switching does today.
- R's cost is the way back: 0.4 s, with the same small corner window as every desktop start (the app shows a window small in a corner first so that no full-screen flash is seen).

## 6. Recommendation

1. **R, re-create**, as the way Edit mode works: it costs no extra memory, uses code that already exists (mode switching and the attach), and the 0.4 s on the way back is acceptable for something the player does now and then. Fall back to S with the attached page paused only if R flashes in a live look, and then measure its memory first.
2. **Use the work area, not the whole display**, for the overlay: the taskbar stays usable and the player can always leave.
3. **R needs the save handshake of the scene switch** (platform plan D42): the page that is destroyed holds the tank's latest changes, so ask it for a final `serialize()`, wait with a timeout, `flushSync` the writers, and only then destroy it; the pause state is sent again after the new page loads (PR 32 already does this).
4. **Do not rely on the foreground**: give the overlay a visible "Done" button and also accept Esc, but make a click on the overlay take the focus, so that the foreground lock cannot trap the player.
5. **On the Mac, "Done" must give the focus back** (section 7): call `app.hide()` or `app.dock.hide()`, and keep the Dock icon flash of R short.
6. **Before Edit mode is built** (it is not part of the platform slice): one hand check of the real tray path with another app in front, a live look for a flash, and the Explorer restart case.

These are inputs to the owner's decision. Edit mode is not part of the platform slice (06): its only effect on the plan is that the contract keeps `enterEdit(editor)` and `exitEdit()` optional, and that the host, not the scene, creates the overlay window.

## 7. The Mac (M1, Electron 45.4.1, Mac session, `spikes/edit-mode/mac.mjs`)

Measured by the Mac session without capturing the screen and without posting events to other apps (the script reads state only: who is in front as "this app" or "another app", the window list, whether the overlay is the key window).

| | S: overlay on top | R: re-create |
| --- | --- | --- |
| Attached tank as the app makes it (`type: 'desktop'`, mouse ignored) | shown in 96 to 125 ms; no Dock icon and no Cmd-Tab entry after `app.dock.hide()`, which needed 2 to 3 tries over 1.0 to 1.5 s | |
| Overlay shown (trivial page) | 85 to 109 ms, first drawn frame 117 to 154 ms | 95 to 112 ms, first frame 112 to 147 ms |
| Real renderer as the overlay | page loaded 97 to 114 ms, scene ready 150 to 201 ms | the same |
| Dock icon | hidden during the whole edit | **comes back for about 1 to 1.6 s** when the attached window is made again |
| Done: attached window shown again | the tank was there all the time | 198 to 204 ms (trivial page; about 0.4 s with the real scene) |
| Overlay is the key window and has the keyboard | yes (`isFocused()` and `document.hasFocus()` true 500 ms after `show()`) | yes |
| Front app while the overlay is up | this app (the previous app's menu bar is gone) | this app |
| Front app after Done | **still this app**: the previous app does not get the focus back; `app.hide()` gives it back | the previous app (probably handed back by the `app.dock.hide()` retries; not confirmed) |

- `show()` plus `focus()` is enough to take the focus, with or without `app.focus({ steal: true })`.
- The overlay is a frameless `alwaysOnTop` window ('floating') over the work area, which starts under the menu bar, so the menu bar stays.
- **The order is not clear on the Mac:** R costs no memory but flashes the Dock icon on Done; S has no flash but needs a second page (about 385 to 410 MB against 350). The Mac session recommends R, with `app.dock.hide()` called right after the window is made and again every 500 ms (as `hideDock` does), or one hidden window kept alive through the swap so that the app never loses its accessory state (not tried).
- Not tested (needs an Accessibility permission for posted clicks and keys, or a person): clicks and Esc from a script, the real tray path, Mission Control, a Space change, Stage Manager, full-screen apps, and a flash on the way in and out.
