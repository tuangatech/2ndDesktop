# Decisions: the dated log for 2ndDesktop

One line per decision, with an id (`DEC-n`), the date, who decided, and where the design says it. The design documents describe the current design; this file says when and why it became so. The README keeps a readable summary; if they differ, this log wins. Add new decisions at the end, never rewrite an old line (add a new one that replaces it and say `replaces DEC-n`).

Written 2026-11-23 from the README's lists. Earlier decisions are grouped by the round in which the owner made them (the order inside a round is not meaningful).

## Rounds 1 to 5 (2026-11-22 and 2026-11-23, summarised)

| Id | Decision | Owner or session | Where |
| --- | --- | --- | --- |
| DEC-1 | The name is 2ndDesktop; one scene at a time on the main display; English only, no localisation | owner | README |
| DEC-2 | Scenes may use the network, only through the host (connectors in the main process) | owner | `platform/02`, sections 5 to 6 |
| DEC-3 | The release holds the fish tank and the farm house; more scenes come later | owner | `platform/03`, section 6.1 |
| DEC-4 | Power setting "When the desktop is covered": three values, default "Always pause" | owner | `platform/01`, section 7 |
| DEC-5 | Weather: once an hour from 7:00 to 19:00 local time, one request for 24 hours. **Replaced by DEC-18 on 2026-11-24** | owner | `platform/02`, section 11 |
| DEC-6 | Error report v1: two buttons (Open GitHub issue, Copy report) and a visible support address; no mail button, no mail service | owner | `platform/02`, section 12 |
| DEC-7 | Outside scenes: a catalog of pointers (option C); a shared scenes repository (B) only later | owner | `platform/01`, section 5.4 |
| DEC-8 | Catalog signing key starts as a protected GitHub environment secret; separate `2nddesktop-catalog` repository; bundled scenes stay in the platform repository | owner | `platform/01`, section 5.4 |
| DEC-9 | Accessibility: the system "reduce motion" is honoured; frame rates are per scene | owner | `platform/01` |
| DEC-10 | App update: a link-only notice first, the updater later; scene update by an Update button first | owner | `platform/01`, section 5.6; `platform/03`, section 3 |
| DEC-11 | Tray menu layout: scene items on top, host items below | owner | `platform/01`, section 10.1 |
| DEC-12 | Packaging: first Mac download Apple silicon only; English only on both systems; Electron stays (Tauri only for a measured reason) | owner | `platform/03`, sections 3.1 and 3.4 |
| DEC-13 | Stretch: window on top only, no reminders, no result promises; a small 3D skeleton drawn flat (approach A, prototype first); the words workout, exercise, interval; loop until closed; the tray line "Done today at 14:10" only when done today | owner | `scenes/stretch.md` |
| DEC-14 | The first maintainer is the owner; the second is to be named; the name check (domain, trademark, organisation) is agreed and not done | owner | `platform/03`, section 8 |
| DEC-15 | The new repository starts from the fish-tank code, in three commits | owner | `platform/04` |

## Round 6: the Mac's design review (2026-11-23)

| Id | Decision | Owner or session | Where |
| --- | --- | --- | --- |
| DEC-16 | **Stretch and session scenes are not part of 1.0**; they come in 1.1 (if complicated, later still) | owner | `platform/03`, section 6.1; `scenes/stretch.md` |
| DEC-17 | **A signed public release of the two bundled scenes (0.3) comes before any store**, so that real use shows whether a store is worth building | owner | `platform/03`, section 6.1 |
| DEC-18 | The weather window is dropped: once an hour **while the computer is awake and a weather scene is active**, one request of 24 hours (replaces DEC-5; resolved on 2026-11-24, the Mac's E-13) | owner | `platform/02`, section 11 |
| DEC-19 | **The store is built when there are enough users and developers who want to contribute**; the bar is set when 0.3 is out; until then the store, the desk, connectors, T2/T3, Edit mode and one scene per display are not scheduled | owner | `platform/03`, section 6.1 |
| DEC-20 | **The app update check is separate from the store**: `latest.json` with version numbers only (**changed by DEC-38: electron-builder's `latest.yml`**), once a day from the first run, fixed notice text and a fixed release link, no signature needed, setting "Tell me about updates" | owner, design by the Windows session | `platform/03`, section 3.5; `platform/01`, section 5.6 |
| DEC-21 | **Complex features that need a lot of effort go to later versions** (store, connectors, the declarative language, the second window kind) | owner | `platform/03`, section 6.1 |
| DEC-22 | PixiJS is provided by the host (import map, or `host.pixi`); its major version is part of `apiVersion`; the page is served from `scene://<id>/` with the host runtime at `_host/`; a P1 loader spike proves it | Windows session, from the Mac's E-1 to E-3 | `platform/01`, section 8.6; `platform/02`, section 3 |
| DEC-23 | The bundled scenes stay bundled by Vite in 0.2 (a spike, not a migration, tests the real loader); they move to the loader when the store or the first outside scene is decided | Windows session (partial pushback on E-3) | `platform/01`, section 8.6 |
| DEC-24 | The fallback scene is always the copy bundled in the app package | Windows session, from E-4 | `platform/01`, section 4 |
| DEC-25 | Sound is enforced by the main process (`setAudioMuted` plus `before-input-event`); the table says what is enforced and what only review enforces | Windows session, from E-5 | `platform/02`, section 7.1 |
| DEC-26 | The exfiltration rule includes `place`; scene log lines stay out of the public issue by default; first-catalog scenes use no third-party runtime packages | Windows session, from E-6 to E-8 | `platform/02` |
| DEC-27 | Index expiry 90 days; the bridge rewrite before a second scene runs; parsers of remote content in a utility process from the start; DNS rebinding rule; `data:` in `font-src` only after the Vite check | Windows session, from E-10 | `platform/02`, section 7.1 |
| DEC-28 | Host windows are destroyed on close; `budget.memoryMB` is advisory and may be per system; one settings window is measured once | Windows session, from E-11 and E-12 | `platform/01`, section 7; section 9 |
| DEC-29 | The declarative connector language and T2 scenes wait for at least three real requests | Windows session, from E-14 | `platform/02`, sections 6 and 9 |
| DEC-30 | Pack builds are reproducible; the contract is published as a `.d.ts` file; the bus factor is written down as a risk | Windows session, from E-15 and E-17 | `platform/01`, sections 5.4 and 8.6; `platform/03`, section 8 |
| DEC-31 | The desktop is mostly covered: window mode is a first-class mode; the Windows 11 tray overflow is handled by a first-run hint and a second-instance rule | Windows session, from P-3 and P-4 | `platform/01`, sections 6 and 7 |
| DEC-32 | Success is judged by downloads, stars, issues and an optional survey link; no telemetry | Windows session, from P-5 | `platform/03`, section 6.1 |
| DEC-33 | Electron is upgraded within its three-major support window and at once for a security release (not on a fixed 8-week schedule), with the golden hash and the attach checks after each upgrade | Windows session (partial pushback on the Mac's wording of E-9) | `platform/03`, section 3.5 |
| DEC-34 | `docs/01` and `docs/02` of the old spec are kept under `docs/reference/fishtank-v1/` (document 4 wins) | Windows session, from D-8 | `platform/03`, section 7.2 |

## Round 7 (2026-11-24)

| Id | Decision | Owner or session | Where |
| --- | --- | --- | --- |
| DEC-35 | **The scene store and what it needs (the desk, data kinds, connectors) are put in version 1.2**, so they are not forgotten; built when the bar of DEC-19 is reached (replaces part of DEC-19: the "not scheduled" wording for the store, the desk and connectors) | owner | `platform/03`, section 6.1 |
| DEC-36 | The bar for "enough users and contributors" is set when 0.3 is out, from downloads, stars, issues and requests from people who want to write a scene | owner | `platform/03`, section 6.1 |
| DEC-37 | A request carries 24 hours of forecast, so one missed request does not freeze a scene; on wake, unlock, network change and scene selection the host checks the rule at once | Windows session, owner agreed | `platform/02`, section 11 |
| DEC-38 | The app update check reads the `version:` line of electron-builder's `latest.yml` / `latest-mac.yml` from the latest release, not a separate `latest.json` (replaces part of DEC-20); the Network setting does not govern it, "Tell me about updates" does | Windows session, from the Mac's W-30 point 11 | `platform/03`, section 3.5 |
| DEC-39 | Version 0.5 is open contributions **without bundling outside code**: contributors share folders loaded by Developer mode; maintainers bundle an outside scene only occasionally at review depth C. 1.0 does not wait for an outsider (the third scene is the project's own small scene, loaded from a folder by Developer mode: **decided by the owner on 2026-11-24**) | Windows session, from W-30 point 10 | `platform/03`, section 6.1 |
| DEC-40 | Sound is unmuted by three signals: a tray or menu action, a mouse-down from `webContents` `input-event`, a key from `before-input-event` (replaces the wording of DEC-25) | Windows session, from W-30 point 9 | `platform/02`, section 7.1 |

## Round 8: starting the new repository (2026-11-24)

| Id | Decision | Owner or session | Where |
| --- | --- | --- | --- |
| DEC-41 | The bundle id and Windows app id are `com.tuangatech.2nddesktop`; `productName` is `2ndDesktop` and is set explicitly, so the data folder is `2ndDesktop` (development: `2ndDesktop (dev)`); the first start **copies** `records/fishtank.json` and `settings.json` from the old `fish-tank` folder, never moves them | owner (recommendation accepted), Windows session | `docs/bootstrap/BOOTSTRAP.md` section 2 (Q1, Q2); `platform/04` section 5 |
| DEC-42 | The repository is public (`tuangatech/2ndDesktop`) and fish-tank is private. Commits use the GitHub no-reply address on both machines; the mailbox files stay in the public repository, rules only and no history; no user name, home path, address or token anywhere in it. The first commit on `main` is a bare README pushed directly; after that app code goes through pull requests, with the owner allowed to bypass | owner (recommendation accepted) | `BOOTSTRAP.md` section 2 (Q3, Q4, Q6), section 3 |
| DEC-43 | All old plans and notes (`docs/01` to `06`, the spike and measurement notes) are kept in `docs/reference/fishtank-v1/` (extends DEC-34, which kept only `01` and `02`), because 30 source files cite their numbers and paths | owner (recommendation accepted) | `BOOTSTRAP.md` section 2 (Q5) |
| DEC-44 | From the import on, `docs2/` in fish-tank is frozen; the design set lives in `docs/` of 2ndDesktop, and the old `docs2/` only gets a pointer | Windows session | `BOOTSTRAP.md` appendix C |
