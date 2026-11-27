# Review of the host, the scene contract and security (2026-11-25)

A read-only review of `app/main/`, `app/page/`, the preload, `electron-builder.yml`, CI and `docs/platform/02`, written by the Mac session at `f918b31`. Nothing was run against a live attacker; the points marked "not verified" below were not checked. The numbers are the ones used in the branch names and in `TODO-Win.md`.

Today only bundled scenes load, there is no network content and there is one window, so nothing here is urgent. Most findings matter when a second scene or any outside content arrives.

## What is solid

- `sandbox`, `contextIsolation` on, `nodeIntegration` off; a preload with a fixed list of functions and no `ipcRenderer` (`app/main/desktop.js`, `app/main/preload.cjs`).
- Input checks in the main process: record ids and size (`app/main/store.js`), scene menu text and ids (`app/main/menu.js`), settings accept known words only (`app/main/settings.js`).
- Atomic writes with a backup; the old-data migration copies and never moves; the cover logic is pure and unit-tested.

## Findings

| # | Finding | Where | Suggested fix | Status |
| --- | --- | --- | --- | --- |
| 1 | The Windows cover check reads only the foreground window. Working on a second monitor while a maximized window covers the main one keeps the tank drawing; two snapped windows never count. The Mac checks every window, so the platforms differ. | `app/main/desktop.js` (Windows branch), `app/main/cover.js` | List all windows on Windows and combine them as on the Mac. Needs a Windows machine to test. | Done in 0.2 (DEC-45, DEC-56): every visible window of the primary display is listed |
| 2 | A scene is not isolated: it can call `window.desktop2.loadRecord(anyId)` or `saveRecord(anyId, ...)` and read or write another scene's save; the main process trusts the id the renderer sends. | `app/main/preload.cjs`, `app/main/main.js` | The main process decides the scene id and ignores the one sent. | Branch `scene-record-binding` |
| 3 | Release builds accept the development and test switches: `DESKTOP2_CHROMIUM_FLAGS` (any Chromium switch, including `no-sandbox`), `DESKTOP2_TEST=1`, `DESKTOP2_USER_DATA`, `?debug=1` (which exposes `window.__scene`). Found while fixing it: `VITE_DEV_SERVER_URL` made an installed app load any address in a window that has the preload. | `app/main/main.js` | Honour them only when the app is not packaged or the channel is `test`. | Branch `gate-dev-switches` |
| 4 | No Electron fuses are set: `ELECTRON_RUN_AS_NODE`, `--inspect` and a non-asar app path stay on, and the app starts at login. | `electron-builder.yml` | Turn those fuses off, enable the asar integrity check. | Deferred to 0.3 (DEC-46); needs a packaged build to check |
| 5 | `platform/02` section 3 says the scene page follows the full checklist. The code has no permission handler, no request filter and no global navigation guard; the CSP is a meta tag with `'unsafe-inline'` styles, loaded from `file://`. | `app/page/index.html`, `app/main/desktop.js` | Add the three handlers, or reword the document to say they are planned. | Branch `session-hardening` (permissions, requests, webviews, new windows; the CSP and `file://` stay as they are) |
| 6 | "Copy diagnostics" includes a permanent install id, to be pasted into public issues; `platform/02` section 12.2 says no install id unless the player ticks a box. | `app/main/usage-log.js` | Leave the line out. | Branch `diagnostics-no-install-id` |
| 7 | The log file has no rotation and gets a frame-rate line every 10 seconds (about 0.4 MB a day, an estimate); a scene's `host.log` lines are not rate-limited although the design says 20 a second; the log is written synchronously on the main thread. | `app/main/main.js` (`log`, `diag:note`) | Cap the file, rate-limit scene lines. | Branch `log-limits` (1 MB with one old file, 20 lines a second for page notes and errors) |
| 8 | The CI workflow has no `permissions:` block (default token rights); the actions are pinned by tag, not by commit. | `.github/workflows/ci.yml` | `permissions: contents: read`; pin by commit. | Branch `ci-permissions` (permissions only) |
| 9 | `scripts/koffi-universal.mjs` fetches the other-architecture native package with `npm pack`, with no check against the lock file, and runs in `npm run dist` although the dmg is arm64 only. | `scripts/koffi-universal.mjs` | Skip it while only arm64 ships. Confirmed on the Mac: the x64 package was in `node_modules` and in the built app. | Branch `koffi-universal-opt-in` (`dist:universal` runs it; `dist` and `dist:test` do not) |
| 10a | The single-instance lock is taken after the data migration, so a second launch still touches the data folder before it quits. | `app/main/main.js` | Take the lock first. | Closed, not needed (no old data exists; DEC-54): the migration only reads when there is nothing to copy, so a second launch writes nothing |
| 10b | `uncaughtException` handlers are registered twice and the app keeps running afterwards. | `app/main/main.js` | One handler. | Not changed: two listeners are harmless, and keeping the app running after an error is a choice for a desktop scene |
| 10c | Crash restart exists on Windows only; a crash on the Mac desktop leaves nothing running. | `app/main/crash-restart.js` | A Mac equivalent, or a line in the docs. | Open |
| 10d | The log comment says paths are never logged, but stack traces contain them; they are cleaned only when diagnostics are copied. | `app/main/main.js` | Clean when the line is written. | Branch `log-limits` |
| 10e | The host knows the fish tank (`fish` option, `__scene.fishtank`, the sound names in the contract). | `app/page/main.js`, `app/page/host.js` | Design debt for 0.2 (the farm house). | Open |

## Not verified

- The renderer process line shows `--allow-file-access-from-files`. Whether Electron adds it by default, and how CSP `'self'` behaves under `file://`, were not checked.
- The development path of `session-hardening` (the dev server address) is covered by a unit test only; run `npm run dev` once and look for `request refused` in the log.
- Anything inside the scene code, `SoundPlayer`, `placement.js` or the rest of `usage-log.js`.
