# 2ndDesktop: product specification (short)

Status: Draft v0.1, 2026-11-24. Written for the owner and for new contributors as the one-page-ish entry to the design set. It summarises; the detail and the reasons are in `platform/01` to `05`, `scenes/` and the decision log `DECISIONS.md` (the log wins if they differ). Ids such as DEC-19 point to that log.

## 1. Overview

**2ndDesktop** is a small app for Windows and macOS that puts one living scene on the desktop: behind the icons like a living wallpaper, or in a small window. A scene is a picture with its own rules and its own saved progress: a fish tank you feed once a day, a farm house under a mountain that shows today's real season and weather, later a cozy desk, a guided stretch break.

The app is a **platform**: it does everything that is the same for every scene (attach to the desktop, tray menu, pausing, power, saving, settings, updates), so that a scene author writes only the scene. Scenes are folders and are open source. The project grew out of Fish Tank, which becomes the first scene.

**One sentence for a player:** "Your desktop, alive, and quiet about it."

## 2. Goals and non-goals

**Goals**

1. A desktop that is pleasant to look at and costs almost nothing: light on CPU, GPU, memory and battery; no fan noise; never in the way.
2. A small, solid platform. A contributor can write a scene without touching platform code.
3. Safe by construction. A scene cannot harm the computer, read files or leak the player's data. The sandbox is the protection; review is the second layer.
4. Works offline. The network is a service of the host that a scene may ask for, with the player's consent.
5. Honest and private: no accounts, no telemetry, no server in version 1. All player data stays on the computer.

**Non-goals (for now)**: accounts and social features, paid scenes or ads, running unreviewed code from strangers, Linux and mobile, two scenes at once, more than English, one scene per display.

**Tone belongs to the scene.** The tank is calm and quiet by design. The platform does not promise calm for every scene, but it promises politeness for all of them (section 5.4).

## 3. Who it is for

| Who | What they want | What they never do |
| --- | --- | --- |
| **Player** | A scene on the desktop that they leave running; a minute a day at most; a way to switch scenes from the tray | Read documentation, edit files, create an account |
| **Scene author (contributor)** | Write a scene with web skills (JavaScript, PixiJS), test it with a dev kit, share it as a folder or through the catalog | Touch the host code, handle signing, packaging or security |
| **Maintainer** | Keep the platform small, review scenes, ship signed releases | Run a server, moderate an open upload box |

The first maintainer is the owner, Tuan Tran; a second is still to be named (risk: section 8).

## 4. Core concepts

| Concept | Meaning |
| --- | --- |
| **Host** | The app itself: desktop window, tray, pausing, power policy, saving, settings, network, logging, scene loading. Trusted. |
| **Scene** | One living picture: a folder with a manifest (`scene.json`), code, art and sound. Runs in a sandbox. |
| **Record** | A scene's saved progress, one file per scene. Switching scenes never loses it. |
| **Contract** | The rules between host and scene (what a scene may ask, what it gets). **v0** until a third scene is written against it; then published as a `.d.ts` file. |
| **Capability** | Something a scene must declare to use: network hosts, a data kind, the player's place. Denied by default. |
| **Data kind and connector** | A named shape of data (`weather@1`, `tasks@1`) and the host-side code that fills it from a service. Scenes never call services themselves. |
| **Pack and catalog** | A scene as one signed file; the signed list of packs a player can install. Later (1.2). |
| **Desktop mode / window mode** | On the desktop behind the icons (takes no clicks, so every action also lives in the tray) / in a small window (clickable, may stay on top). |

## 5. How people use it

### 5.1 A player

1. **Install.** Download from the GitHub release page (Windows x64 installer; macOS Apple silicon image) and open it. First launch shows the fish tank in a window, with a short hint about the tray icon. No sign-in, no questions.
2. **Live with it.** Move the scene onto the desktop from the tray ("Show on desktop"). The scene follows the clock: fish grow, the farm house changes with the season and the light. After Win+D or a meeting the scene has caught up. The player does nothing else, or spends about a minute a day (feed the fish from the tray).
3. **Switch scenes.** Tray, "Scenes", pick one. Each keeps its own progress. The host reloads the page and keeps a fallback to the bundled copy if a scene fails to load.
4. **Adjust.** "Settings" (one host window): display mode, always on top, launch at login, sound, "When the desktop is covered", reduce motion, network (ask, allow, never), place, "Tell me about updates", the options of the active scene.
5. **Get help.** Tray, Help: check for updates, "Send error report" (a short sanitized text the player reads first; Open GitHub issue, Copy report, and a visible support address), About.

### 5.2 A scene author

1. Copy the template (`npm run new-scene <id>`), write `scene.json` and the factory `create(host)`.
2. Develop with `npm run dev:scene <id>`: a fake host with controls for the clock, season, weather, place, window shape and power state.
3. Pass the contract and capability tests (create, resize, 600 updates, serialize, dispose, no leaks, same state after a pause; runs again with reduced motion).
4. Share the folder; a player loads it by hand in **Developer mode** (0.5). In 1.2 the author registers it in the catalog, and CI builds a signed pack from a pinned commit.

### 5.3 The maintainer

Reviews a scene at depth A, B or C by what it asks for, merges, cuts a release (tag, CI builds installers and attestations, signed) and can revoke a scene after publishing.

### 5.4 What every scene gets, and cannot opt out of (politeness)

Never takes focus or moves above other windows by itself, never takes a click meant for an icon, never flashes the tray, never shows a notification, sound only as a reaction to the player's own action (the main process enforces mute), reduce motion honoured, frame rate asked per scene (tank 30, farm house 15, desk 10) and capped by the host.

## 6. Main features

| Area | What | Version |
| --- | --- | --- |
| **Desktop** | Desktop mode behind the icons and window mode, recovery after Win+D, Explorer restart and display changes; tray / menu bar; single instance; launch at login | 0.1 |
| **Scenes** | Manifest and registry; "Scenes" in the tray; switch with save handshake; fallback scene; the first loader spike decides how scenes load (PixiJS provided by the host, page served from `scene://<id>/`) | 0.2 |
| **Power and pause** | Stops drawing when the screen is locked or asleep, a full-screen app is in front, or the desktop is covered; setting "When the desktop is covered": Always pause (default), Pause on battery only, Never pause. Pause means stop drawing only; the scene catches up from the clock. Budgets: 0.5% of a core when stopped, 30 fps and 3% in desktop mode, 250 MB (Windows) and 375 MB (macOS, DEC-63) after an hour | 0.1 and 0.2 |
| **Saving and settings** | A record per scene (atomic write and backup); host settings in host pages; scene options declared in the manifest and shown by the host | 0.2 |
| **Bundled scenes** | **Fish tank** (built): feed from the tray once a day, nothing dies, no scores. **Farm house**: a stone house under a forested mountain with the real season, time of day and (0.2) simulated weather | 0.1, 0.2 |
| **Public release** | Signed Windows installer and notarized Mac build, download page, first-open README, **app update check separate from the store** (reads `latest.yml`; once a day; a fixed notice and link; setting "Tell me about updates"), the error report | 0.3 |
| **Live weather and place** | The host fetches weather once an hour while the computer is awake and a weather scene is active; one request carries the next 24 hours so a missed one does not freeze the scene; place from the time zone, a typed city, or an IP lookup only with consent | 0.4 |
| **Open contributions** | `CONTRIBUTING.md`, template, dev kit, DCO sign-off, Developer mode ("Load a scene folder", off by default, with a warning) | 0.5 |
| **Contract v1** | A third scene (the project's own small scene, loaded by Developer mode) is written against the contract; `.d.ts` published | 1.0 |
| **Stretch** | Guided 2 to 3 minute desk workouts of 20-second intervals in a small always-on-top window with a drawn instructor; the first scene the player starts instead of living on the desktop (needs "session scenes") | 1.1 |
| **Scene store** | The catalog (signed, in a separate repository), the store window with thumbnails, install, update, revoke; the **desk** scene (tasks on a laptop) and the data kinds and connectors it needs | 1.2 |
| **Not scheduled** | Declarative scenes (T2), isolated script scenes (T3), Edit mode, one scene per display | after real requests |

Only 0.1 and 0.2 are the plan. Everything after 0.3 is design notes, not backlog, until its version starts and the event that unlocks it has happened.

## 7. Quality and safety requirements (the ones that shape the product)

- **Security.** The main process is the security boundary; scene pages have no power it does not hand out call by call. Scene sandbox on, no Node, strict CSP, a bridge that is harmless when abused (validated, size-capped, rate-limited, scoped to the active scene). A scene is never an executable. Contributors never upload binaries; the project's CI builds what players install.
- **Network.** Only the host fetches (connectors in the main process): a fixed host list, size and time limits, no redirects off the list. The setting "Network" governs scenes; the update check is governed by "Tell me about updates".
- **Privacy.** No telemetry, no accounts; success is judged from downloads, stars, issues and an optional survey link. Error reports leave the computer only when the player presses a button, after reading them.
- **Resource budgets** are hard (section 6) and measured on real machines, because CI runners have no real GPU.
- **Accessibility.** The system "reduce motion" is honoured; nothing flashes; the tray and settings are reachable by keyboard.
- **Licensing.** Code MIT; art and sound CC BY 4.0 or CC0; fonts OFL; DCO sign-off; each scene declares its license and CI checks it.

## 8. Success measures and main risks

**How we will know it works** (no telemetry): release downloads, stars, issues, requests from people who want to write a scene, and the optional survey link. These numbers exist from 0.3 and decide whether the store (1.2) is built. The bar is set when 0.3 is out (DEC-36).

| Risk | Answer so far |
| --- | --- |
| **Bus factor**: one person and AI sessions hold the signing keys and accounts | Written down as a risk; an offline rotation key and a recovery note; name a second maintainer |
| A malicious or compromised scene | Sandbox first; pinned commit built by CI; automatic gate; human checklist by depth; revoke after publishing; no third-party runtime packages in the first catalog |
| The desktop is mostly covered, so the scene is rarely seen | Window mode is a first-class mode; a first-run hint for the Windows 11 tray overflow |
| Memory on macOS (an empty WebGL page already costs about 245 MB) | The Mac limit is 375 MB (350 until DEC-63); Windows sizes the scene |
| Building a store nobody needs | Signed public release (0.3) first; the store waits for the bar (DEC-17, DEC-19, DEC-35) |
| Electron security updates | Upgrade within the three-major support window and at once for a security release, with the golden hash and the attach checks after each (DEC-33) |

## 9. Open questions

1. **The name.** Check of the domain, trademark, GitHub organization and spelling is agreed and not done. The domain also decides the support e-mail address.
2. **The second maintainer** and the promised review speed: to be chosen before the first outside scene.
3. **The bar for the store.** Which numbers of downloads, stars, issues and author requests mean "enough"; set after 0.3.
4. **Where later first-party scenes live** (the platform repository or `2nddesktop-scenes`): decided at 1.0; the owner leans to the separate repository for the desk and Stretch.
5. **The loader spike (start of 0.2).** Can PixiJS be provided by the host and the page served from `scene://<id>/` under the strict CSP? Does a scene page open a WebRTC connection despite the mitigations? Until answered, trust relies on review.
6. **Gaps between the old tank and the new contract**: how a scene gets its atlas, where its diagnostics line goes, that `host.seed` gives the same sequence (or the golden hash moves), how a scene brings its own sounds, and a per-system memory budget.
7. **Session scenes (1.1)**: the "visit" rules, a status line for a scene that is not loaded ("Done today at 14:10"), and the cost of a second small window (to measure on both systems).
8. **Measurements still open**: the cost of the host settings window on Windows (about 14 to 20 MB on the Mac); Windows battery saver and macOS Low Power Mode have no known Electron API.
9. **Weather provider**: is a second provider needed as a fallback to Open-Meteo, and is its free limit per address?
10. **Error report endpoint**: does a pre-filled GitHub issue accept field values from the URL, and how long may it be? The one-click Send endpoint comes after the first public release.
11. **DCO or CLA**: decide before the first outside contribution; it cannot be added afterwards without asking everyone.
12. **Optional for the farm house**: a small daily "Scatter hay" action, and what the animals do (owner's call).

## 10. Where to read more

| Question | Document |
| --- | --- |
| How is it built, what is the scene contract, power rules, tray menu? | `platform/01-platform-architecture.md` |
| What can a scene do, sandbox, data, network, secrets, review, error report? | `platform/02-security-data-and-network.md` |
| Releases, updates, the catalog, licensing, versions and phases? | `platform/03-distribution-and-roadmap.md` |
| What is reused from Fish Tank, and what was already measured? | `platform/04-reuse-from-fish-tank.md`, `platform/05-verified-from-fish-tank.md` |
| Each scene | `scenes/fishtank/DESIGN.md`, `scenes/farmhouse.md`, `desk.md`, `stretch.md`; `fishtank-migration.md` |
| Why a thing is the way it is | `DECISIONS.md` |
