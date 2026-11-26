# docs: the documents of 2ndDesktop

Written 2026-11-23 from the Fish Tank project and moved into this repository on 2026-11-24 (draft v0.2, kept current from here on: a change to the code that the design says otherwise changes both in the same PR).

2ndDesktop puts a living scene on the desktop of a Windows or macOS computer. Scenes are folders that contributors write and players download from a scene store in the tray menu.

**Start here:** `00-2nddesktop-specs.md`, the short product specification (overview, goals, users, concepts, how people use it, features by version, risks, open questions).

**Working on the repository:** `STATUS.md` (where we are and what is next; read it right after `../CLAUDE.md`), `DECISIONS.md` (the dated log of decisions; it wins over prose), `art-style.md` (the style guide for all art).

**How the repository was started:** `bootstrap/BOOTSTRAP.md` (decisions, GitHub settings, the dev environment on Windows and Mac, the repository structure, the order of PRs, the first message for each session) and `bootstrap/import-from-fishtank.mjs` (the one-time copy script, already run).

**Reviews:** `reviews/` holds dated reviews of the code and the design, with the findings and what became of each (the first: `reviews/2026-11-25-host-security-review.md`).

**The archive:** `reference/README.md` says what an old name, number or path in a comment means; `reference/fishtank-v1/` holds the old Fish Tank spec, plans and measurements.

## Platform (5 documents)

1. `platform/01-platform-architecture.md`: the idea, the words, host and scene, the process architecture, **the whole picture with the scene store, third-party APIs and the GitHub-to-store publishing pipeline (section 5)**, desktop integration, the power and pause policy, budgets, the scene contract v0, assets and the scene folder, the host's services, settings and logging, the dev kit and tests, and the template for a scene's design document.
2. `platform/02-security-data-and-network.md`: the threat model, the sandbox, what the bridge exposes, capabilities and consent, data kinds, connectors and sources, fetching rules, secrets, place and weather, privacy, "Send error report" and its endpoint, and the tiers of trust.
3. `platform/03-distribution-and-roadmap.md`: how players get scenes (the catalog), the pack, signing and updates, the backend pieces, licensing, the roadmap, how to reuse the fish-tank code (new repository or rename), and what else to discuss.
4. `platform/04-reuse-from-fish-tank.md`: what of the fish-tank host code is reused, where the tank leaks into it, the method of three commits for the new repository, the reuse table by file, what is easy to break, the app icon, the order of work. Draft icons are in `icon/`.
5. `platform/05-verified-from-fish-tank.md`: **what fish-tank already measured and checked on Windows and the Mac** (the empty host and the tank, what costs memory and what was tried, desktop attach, the covered pause, Edit mode, the scene switch, packaging and the first open, the tests that prove nothing changed), with a level for each fact (measured, passed, expected, open), so 2ndDesktop does not measure them again.
6. `platform/06-loader-spike.md`: **the P1 loader spike** (`scene://`, the host's PixiJS through an import map, the CSP, WebRTC), with its results and what they mean for documents 01 and 02. Read it with section 8.6 of 01 and section 3 of 02.

## Scenes (3 design documents, each the future `DESIGN.md` of its folder, plus one migration document)

- `scenes/fishtank-migration.md`: moving the built tank into 2ndDesktop: what must not change, the recommended folder structure, the changes it needs for the new contract, the art pipeline, the tests and the steps.
- `scenes/fishtank.md`: built; the first scene.
- `scenes/farmhouse.md`: a proposal: a farm house under a forested mountain with the real season and weather.
- `scenes/stretch.md`: a proposal: guided 2 to 3 minute desk workouts of 20-second intervals (front view, then side view, a counter, a timer ring and an "up next" banner) in a small always-on-top window with a drawn instructor; the player can also loop one chosen exercise; the first scene that is started by the player instead of living on the desktop (needs "session scenes" from the platform, `platform/01` section 13, item 5).
- `scenes/desk.md`: a proposal: a cozy desk with a window, a lamp and a laptop that shows tasks.

## Decisions the owner has made (2026-11-22 and 2026-11-23)

- Scenes may use the network, through the host (weather, place, data from services). The platform is not only calm; calm is the tank's tone.
- Platform and scenes are designed in separate documents; each scene has its own design document.
- The release contains the fish tank and the farm house; more scenes come later (the scene store is version 1.2).
- The power policy: the setting "When the desktop is covered" has three values, and the default is `always`, shown as "Always pause", for less heat and fan noise; the scene keeps living by the clock (`platform/01`, section 7.1).
- Weather is fetched once an hour while the computer is awake and a weather scene is active, one request covering the next 24 hours (owner, 2026-11-24; it replaced the 7:00 to 19:00 window; `platform/02`, section 11).
- The error report starts as a pre-filled GitHub issue, with a Copy button and a visible support address as the other ways out, and no mail button (`platform/02`, section 12).
- The name is 2ndDesktop. One scene at a time on the main display, never two. English only, no localisation.
- **Accessibility:** the system "reduce motion" setting is honoured: the host lowers the frame rate and tells the scene, which cuts particles and sway. Frame rates are per scene (fish tank 30, farm house 15, desk 10): `platform/01`, sections 7.3 and 7.4.
- Scene pictures are shown in the scene store window, not in the tray menu, so every scene must have a thumbnail (`platform/01`, section 5.3).
- All player data stays local; the project has no server in version 1. Players send an error report only if they choose to; it needs one small endpoint (`platform/02`, section 12). "Copy diagnostics" is for developers.
- The catalog signing key starts as a secret of a protected GitHub environment (`platform/01`, section 5.4). Decided in the fourth round: a separate `2nddesktop-catalog` repository, and the bundled scenes kept in the platform repository while the contract is v0 (when to move them is decided later).
- The first versions focus on the platform and the two bundled scenes, offline first. **Version plan (sixth round):** 0.1 the tank in the new repository; 0.2 platform core and the farm house, offline; **0.3 a signed public release of the two bundled scenes, with an app update check that does not depend on the store**; 0.4 live weather and place; 0.5 open contributions without a store; 1.0 the contract leaves v0; 1.1 Stretch; **1.2 the scene store, the desk and connectors** (kept on the plan so it is not forgotten; built when there are enough users and developers who want to contribute, the bar set after 0.3 from downloads, stars, issues and author requests). Only 0.1 and 0.2 are the plan; the rest is **design notes**, not backlog (`platform/03`, section 6.1).
- The order of scenes: the fish tank and the farm house are bundled; Stretch is not part of 1.0 (1.1, if it is complicated); the desk waits for the store (1.2). Where later scenes live (the platform repository, or `2nddesktop-scenes`) is decided when the store is (`platform/01`, section 13, item 3).
- Stretch (version 1.1): window on top only, no reminders, no promises, a 3D skeleton drawn flat, the words workout, exercise and interval, loop until closed, and the tray line "Done today at 14:10" only after a workout that day (`scenes/stretch.md`).
- **The Mac review (`design-comments.md`, answered 2026-11-23):** the answers are in `DECISIONS.md` and in the places they changed. Owner: signed release 0.3 before any store; the store on demand; the app update check separate from the store; complex features to later versions. The owner also chose the simpler weather rule (E-13).
- Outside scenes use pointers in a catalog (option C), after a look at Raycast, Zed, Decky, HACS, Obsidian, Flathub and winget (`platform/01`, section 5.4); one shared scenes repository (option B) stays only as a later home for the owner's own scenes.
- The first maintainer is the owner, Tuan Tran; the second is still to be named. The check of the name (domain, trademark, GitHub organization, spelling) is agreed and not done.
- The error report in version 1 (accepted): two buttons ("Open GitHub issue", "Copy report") and a visible support address, no mail button, no mail service; a dedicated free mailbox; the one-click "Send" endpoint after the first public release (`platform/02`, section 12.1).
- **Packaging (2026-11-23):** the first Mac download is Apple silicon only (an Intel build later, if asked), and the app is English only on both systems (Chromium language packs dropped). Electron stays; a lighter toolkit (Tauri) only for a measured reason (`platform/03`, section 3.4).
- The new repository starts from the fish-tank code (`platform/03`, section 7).

## Accepted by the owner (2026-11-23, third round)

- The release and update plan: a link-only app update notice first, the updater later; an Update button for scenes first, automatic later (`platform/01` section 5.6, `platform/03` section 3).
- The tray menu layout: scene items on top, host items below (`platform/01`, section 10.1).
- The first-party scenes (fish tank, farm house, desk) stay in the platform repository, and the desk is released through the catalog from there; no extra repository (`platform/01`, section 5.4).
- The review rules for scenes from other repositories (`platform/02`, section 8.1).

## The decision log

`DECISIONS.md` is the dated log of decisions, with ids. The lists above stay as the summary; when they differ from the log, the log wins, and it is the place to add a new decision.

## Open decisions to read first

`platform/01` section 13, `platform/02` section 14, `platform/03` section 8, `platform/04` section 8, `scenes/fishtank-migration.md` section 9, and the open questions at the end of each scene document.
