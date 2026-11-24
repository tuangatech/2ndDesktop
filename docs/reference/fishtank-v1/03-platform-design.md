# Fish Tank — Platform Design (one desktop, many scenes)

Status: Draft v0.4. Section 10 (scene ideas: the mountain, the desk, and the network) is a set of proposals for the owner to review; nothing in it is decided or built. The owner chose the word "scene" and agreed the order of work in section 8 (2026-11-21). Gate G1 was passed on 2026-11-22, so step 2 of section 8 is planned in `06-implementation-platform.md`; the tank now runs behind the contract in section 4 (v0, extracted from the tank, Step 1b); the registry, "Choose scene" and the contract test (Step 2) are not built.
Companion docs: 01-functional-spec.md, 02-tech-design.md, 04-implementation-phase-1.md, 05-implementation-phase-2.md, 06-implementation-platform.md

## 1. Idea

The app becomes a small platform that puts one living scene on the desktop of a Windows or macOS computer. The fish tank is the first scene and the default one. Other people can contribute more scenes (a desk, a mountain, a forest; see section 10) as open source. The player has one scene on the desktop at a time, and each scene keeps its own saved progress.

Goals
- The fish tank keeps working as it does today. The platform is not allowed to make it worse or later.
- A scene is a folder that a contributor can write without touching the platform code.
- One player on one computer. No accounts, no social features for now (this removes most of the old Phases 3 and 4 until they are wanted again).
- Everything in 01 and 02 about desktop mode, budgets, pausing and saving stays true for every scene.

Not goals now: downloading scenes from the internet, running code from strangers, a store, sharing progress between scenes, accounts.

## 2. The words

- **Host**: the app itself. It owns the desktop window, the tray, pausing, saving, settings and the drawing loop.
- **Scene** (the owner's choice, replacing the word "object"): one living picture that the host can show on the desktop. The fish tank is a scene, and so are an office or a mountain. It is the plain word, and it already matches the code: `TankScene` is the fish tank's scene, so the tank is the first scene without a rename.
  - Naming rules, to avoid confusion: the class of a scene is called `<Name>Scene` (`TankScene`); the PixiJS drawing tree inside it is called the "stage" or "layers", never "the scene"; the folder is `scenes/<id>/` and the manifest is `scene.json`.
  - Known overlaps: PixiJS and other engines (Phaser, Three.js) use "scene" for a drawing tree, so a contributor may expect a scene to be a set of sprites, not a whole world with saved progress. Wallpaper Engine has a wallpaper type called "scene", and OBS calls its layouts "scenes". Neither is a conflict in the code, only something to explain in `CONTRIBUTING.md` (one sentence). Phrases in the older docs such as "desktop scene" (the scene drawn at desktop size) are still clear in context.
- **Record**: the saved progress of one scene (one file per scene).
- **Pack**: a scene as a folder that can be copied, shared or (later) downloaded.

## 3. What is host and what is scene

| Host (shared, mostly built) | Scene (the fish tank today) |
| --- | --- |
| Desktop attach on Windows and macOS, window-mode fallback, recovery after Win+D, Explorer restart and display changes | The drawing and behaviour (`TankScene`), fish, food, decor, bubbles |
| Pause when covered, hidden, locked or asleep, the 30 fps cap in desktop mode, budgets | The rules: growth, hunger, feeding (Step 5) |
| Tray menu, single instance, quit, settings, diagnostics | The tray items it adds ("Feed a pellet") |
| The PixiJS app, `computeLayout` and the unit, resolution handling | Art, art generator scripts, `species.json` |
| `store.js`: atomic saves with backup; the list of scenes and which one is active | What is inside the record, and how old records are migrated |

## 4. The scene contract

> **Built (2026-11-22, Step 1b of `06-implementation-platform.md`), contract v0 (D47):** this section is the contract as the tank uses it today. It stays v0 until a third scene exists; nothing in it is promised to contributors before that. The typedefs are in `renderer/host.js`.

A scene is a folder:

```
scenes/<id>/
  scene.json     id, name, version, author, license { code, art }, schema (record version), atlas (a name, or null for a scene drawn in code), fps (optional)
  index.js       default export: `create(host)`
  (the scene's own code, data and styles; its atlas is built into assets/spritesheets/<atlas>.png and .json)
```

The host lists the scenes with Vite (`renderer/scenes.js`, `import.meta.glob`), loads the module of the active one **before** the renderer starts (PixiJS parts register themselves when imported), loads the atlas named in `scene.json` (`renderer/art.js`, D40), and calls `create(host)`. An unknown id starts `fishtank` and logs it. The factory returns:

```js
export default async function create(host) {
  return {
    id, root,                        // the scene id (the record name) and the PixiJS container the host adds to the stage
    resize(width, height) {},        // the size changed (any size, FR-63)
    update(dt) {},                   // called by the host loop; not called while paused
    setVisible(visible) {},          // false while nobody can see it; true again means "catch up from the clock"
    resume(gapMs) {},                // optional: after a pause, with the length of the pause
    pointer(x, y) {},                // the pointer is over the scene; pointer(null) says it left (both modes)
    click(x, y) {},                  // window mode only
    status() { return { line, diagnostics }; },  // line: first line of the tray menu; diagnostics: a line of Copy diagnostics
    menuItems() { return []; },      // tray items { id?, label, enabled? }, in order; no id = a greyed line (D38)
    onMenu(id) {},                   // an item was chosen
    serialize() { return {}; },      // the state that is saved
    dispose() {},
    debug: {},                       // optional: objects for tests, on window.__tank with ?debug=1
  };
}
```

What `host` gives to a scene: `app` (the PixiJS application), `art.textures` (the scene's own atlas), `record` (`load`, `save`, `keepCopy` for its own record only), `sound` (`play`), `clock` (`now()`, the only source of time; ESLint forbids `Date.now()`, `new Date()` and `performance.now()` in `scenes/`), `rng`, `tuning` (numbers a test build may change; the scene checks them against its own ranges), `ui.root` (the element for the scene's own HTML in window mode, `null` in desktop mode), `options` (development switches), `mode`, and `log`. It gives nothing else: no Node, no file access, no window control.

What the host does with it: the tray menu is asked for `{ name, line, diagnostics, items }` when it opens (IPC `scene:menu-request` and `scene:menu`, 300 ms limit, the last answer is used if the renderer is late); the main process cleans it (`sanitizeSceneMenu`: plain text of at most 60 characters, ids of a safe shape, at most 12 items) and forwards only an id from the last menu (`scene:action`). The macOS menu bar has a menu named after the scene (`scene.json` `name`) with the mode switch and the settings; the scene's own items are in the tray menu and the window's gear menu only. The host uses the lower of its frame cap and the scene's `fps`. Not built yet: `enterEdit`/`exitEdit` (section 6), `migrate` and `schemaVersion` (section 5), a contract test (Step 2).

Rules every scene keeps: draw only through `host.app`; stay inside the budgets of 02 (7.3); free everything in `dispose()` (only one scene is loaded at a time, so memory is given back when the player switches); never block a click in desktop mode.

## 5. Records

- One file per scene: `records/<scene-id>.json`, written by the same `store.js` as the tank save in 04 (atomic write, backup, corrupt file moved aside).
- Shape: `{ "schemaVersion": 1, "savedAt": 1790000000000, "state": { ... } }` (built this way in Phase 1 Step 5: epoch milliseconds; `schemaVersion` is the number of that scene's record format, per scene and starting at 1: the tank's records are version 1 today). The scene owns `state` and provides `migrate(record)` for older records.
- `settings.json` has `activeScene` (default `fishtank`). Switching scenes (06, D42): the main process asks the page for a final `serialize()` (with a timeout), flushes the writers, and then loads the renderer again with the new scene, so the old scene is gone with its page; nothing is shared between records.
- A later server (old Phase 3) would store the same records, keyed by the scene id. Nothing in the scene contract needs to change for that.

## 6. Interaction and Edit mode

> **Decided (2026-11-22, D51 in `06-implementation-platform.md`, spike in `edit-mode-spike.md`):** Edit mode is entered by destroying the attached desktop window and showing an overlay window over the work area; "Done" makes the attached window again (the way called R in the spike). It needs the save handshake of D42 and, on the Mac, `app.hide()` on Done.

Today the tank in desktop mode takes no clicks, because the desktop icons must keep theirs (D31). The empty desktop belongs to Explorer on Windows and to the Finder on macOS, so a scene that is attached behind the icons cannot get clicks on it unless the host installs a global mouse hook. We have decided against that (D29, and it is also what antivirus programs flag).

So direct interaction is done with an **Edit mode**: the tray item "Edit" switches the scene into a normal full-screen window on top of the desktop, with a small toolbar (Done, Cancel, Undo). In it the player can drag, place and remove things, and the scene gets all the pointer events. "Done" saves the record and returns to the attached state behind the icons. To the player it feels like editing the desktop itself; for the host it is a third mode next to desktop and window, and switching modes by re-creating the window is already how the host works.

What the scene does in Edit mode (what can be edited) belongs to each scene: for the fish tank it could be moving decor and picking a place for food; an office scene could rearrange furniture.

Update 2026-11-22: tried on Windows, see `edit-mode-spike.md` (an overlay over the work area works; re-creating the attached window is recommended). Still open: the Mac, the real tray path and a live look for a flash.

Open (original text): Edit mode has not been tried. It needs a short spike on both systems (a window that covers the desktop and takes clicks, and the way back, with no flash and no focus problems), like the attach test of Step 1.

## 7. Open source: how contributions come in

Two tiers.

1. **In the repository (now).** A contributor sends a pull request that adds `scenes/<id>/`. The code is reviewed by people before it is merged and is built into the app. CI checks the manifest, the contract (a test that creates the scene, resizes, runs 600 updates, serializes, disposes, and checks that memory and the number of PixiJS objects return to the start), and the budgets. A `CONTRIBUTING.md` explains the contract, the art style guide and `npm run assets` and `npm run shot`.
2. **Downloaded packs (later, after the contract has proven itself).** A pack in the player's data folder is loaded at run time. The code runs in the sandboxed renderer, which has no Node, no network (by the content security policy) and only the host API above, but code from strangers is still a risk (CPU and memory use, hiding things on the desktop), so this tier needs permissions, a warning, size and time limits, and later signing (old Phase 5). A first step is data-only packs (art and JSON, using behaviours that are already in the host), which cannot run code.

### License (proposal; the owner decides, and a lawyer should check it before a public release)

1. **Code: a permissive license, MIT** (Apache-2.0 is the alternative; it adds a patent grant but is longer). The shipped dependencies are permissive too (checked 2026-11-21: Electron, PixiJS and koffi are MIT, and the Nunito font is OFL 1.1), so nothing forces more. A copyleft license (GPL, AGPL) would make it harder for companies and other projects to reuse the host, which is the opposite of "anyone can contribute scenes". `@resvg/resvg-js` is MPL-2.0 (a weak copyleft that covers only its own files); it is a dev dependency used by `npm run assets` and is not shipped in the app, so it does not affect the license. Keep it a dev dependency. The owner chose MIT for the code on 2026-11-21: the `LICENSE` file is in the repository root and `package.json` says `"license": "MIT"`. The art license and the contribution rules (items 2 to 6) are still to be decided.
2. **Art and data: CC BY 4.0** (reuse with credit), or CC0 if the owner wants no conditions at all. Avoid "share-alike" (CC BY-SA) and "non-commercial" (NC) because they make scenes hard to combine and to ship.
3. **Contributions: inbound = outbound, with a DCO sign-off** (`Signed-off-by` on each commit) instead of a contributor license agreement. It is light, and every contributor keeps their rights. Choose a CLA only if the owner may want to change the license later (for example for a paid service); decide this before the first outside contribution, because it cannot be added afterwards without asking everyone.
4. **Every scene declares its license** in `scene.json` (code and art separately) and may use any license on an allowed list (MIT, Apache-2.0, BSD, CC BY, CC0 for the repository tier). CI checks that the field exists and is on the list.
5. **Only rights that can be given.** No images, sounds or fonts copied from elsewhere; fonts must be under the SIL Open Font License (as Nunito is). A `THIRD-PARTY-NOTICES` file is generated from the dependencies. The art of this project is drawn by an AI tool (SVG written by Claude Code); the README should say so and ask contributors to say if their art is AI-made, because the legal status of such art differs between countries. The owner should confirm that they own the output under the terms of the tool they used.
6. **The name is not licensed.** "Fish Tank" and any future product name are not part of the code license; a short note in the README says forks should use another name.

Downloaded packs (tier 2) keep their authors' licenses, and the host shows the license of a scene before it is loaded.

## 8. Order of work

Recommended order (the reasons are in the discussion; the short version is that the contract should exist before Phase 2 writes more effects against the tank):

1. **Now, inside Phase 1 Step 5** (small, no wasted work): write the contract as a typedef; key records by scene id (`loadRecord(id)`, `saveRecord(id, state)` instead of `loadTank` and `saveTank`); keep the tank behind one entry point. No new features.
2. **After the Phase 1 playtest, a short platform slice before Phase 2** (Gate G1 passed 2026-11-22; the step plan, decisions D37 to D45 and exit criteria are in `06-implementation-platform.md`):
   - move the tank into `scenes/fishtank/` behind the contract, with a registry and the tray item "Choose scene" (one loaded at a time);
   - the Edit mode spike on both systems;
   - a second, very small scene (for example a mountain with sky and weather, almost no rules) to prove the contract, and `CONTRIBUTING.md`.
3. **Phase 2 (effects)**, with the parts that are not specific to water done as host services: Reduced effects and day and night lighting (a time of day that any scene can read). Light shafts, depth shading, fish shadows, crabs and snails stay in the fish tank.
4. **Later:** downloadable packs (tier 2), and accounts or social features only if they are wanted again.

If the Phase 1 playtest says the tank is not pleasant, stop before step 2: the platform is only worth building if the first scene works.

## 9. Open questions

- The license: the proposal in section 7 (MIT, CC BY 4.0, DCO) or a CLA.
- Edit mode: full-screen overlay or the small window? (The spike answers this.)
- A budget for one scene. (Updated 2026-11-22, after the memory changes of PR 26 and the empty-host baseline, `docs/perf-notes.md` "The empty host".) On W1 the tank takes 229 MB in desktop mode and about 220 MB in a window against 250 MB; the empty host takes 196 and 172 MB, so a second scene has about 54 MB (desktop) and 78 MB (window) in all, of which the tank uses 33 and 48 MB. On the Mac the limit is 350 MB, the tank takes 328 to 339 MB in desktop mode, and an empty WebGL page is about 245 MB. So a scene budget is set per system, above the measured empty host. The earlier figures (243 and 256 MB, about 7 MB left) were before those changes.
- Should `activeScene` be chosen at first start? (Default: the fish tank, no question asked.)
- The network for scenes (weather, place, APIs): proposed in section 10.4; until the owner decides, the rule "no network" of 01, 02 and the contract in section 4 stands.

## 10. Scene ideas and the network (proposals for review, 2026-11-22)

The owner wants the platform to be more than a calm tank: scenes that show the real weather and season, and scenes that show data from other places (tasks, schedules), written by contributors. This section works out two ideas, the mountain and the desk, and what they need from the host. It is a proposal. It changes three things written elsewhere, and says where: the "no network" rule (01, 02, CLAUDE.md and the contract in section 4), the calm tone as a goal of the whole platform (section 1), and the plan in 06 (Step 4). Those stay as they are until the owner decides.

### 10.1 What a desktop scene is good at

Four facts of desktop mode decide what works:

- **It is seen in short moments.** Desktop mode is covered by windows most of the day and pauses when covered, locked or asleep. The player sees it when they show the desktop. So a scene should change slowly and be worth a glance, and what happened since the last look (`resume(gapMs)`) matters more than constant motion. This also costs less CPU and battery.
- **No clicks and no HTML (D31).** Every action is a tray item. Text input needs a host dialog, because a tray menu cannot take text.
- **The budget is small.** A second scene has about 54 MB in desktop mode on Windows and about 88 MB on the Mac (06, section 3). A scene that fills the whole screen redraws far more pixels than the tank, so the GPU and the battery are measured as well as the CPU (the NFRs only name the CPU), and the scene can ask for a lower frame rate in `scene.json`.
- **Parts of the screen belong to the system.** The icons (left on Windows, right on the Mac), the taskbar, the menu bar and the Dock sit on top of the scene. Faces and focal points stay out of those strips.

### 10.2 The mountain (the second scene)

Reference: a photo the owner supplied (an autumn hillside with a cap of fog, a stone house with a porch and a chimney, a dark fence, a field in front, animals roaming). The photo is not in the repository and is used for the composition only; all art is original (CLAUDE.md), drawn here, not traced.

**Layers, back to front:** sky and cloud layers; the fog bank; the forested mountain, which fills most of the picture; the house (porch, chimney, windows) with its trees and bushes; the fence; the field in front with the animals. Order is fixed like the tank's.

**Each day has its own season.** The season is a continuous curve over the day of the year, not four switches: green in June, first yellow in September, red in October, bare in November, white later. The same function serves the southern hemisphere shifted by half a year. The forest is made of many small tree shapes drawn once with a seeded palette and tinted per day, so there is no art per season and nothing new to load when the season changes. (The question of how the owner meant "each day is a season" is in 10.7.)

**Weather overlays the season.** Clear, partly cloudy, overcast, fog, rain, snow and storm are drawn as overlays that do not depend on the season: fog as gradient bands (the photo is the fog case), clouds as slow shapes, rain and snow as a capped number of particles, a darker and wetter field in rain. The kind of precipitation follows the temperature (no snow in July). Weather comes from `host.weather` (10.5). With no network, no consent or no place, the weather is simulated from the seed and the date, the same on two machines (06 Step 4), so the scene always works offline.

**Life.** Animals walk in the field behind the fence (which kind is the owner's choice), go toward shelter in rain and sleep at night. Windows light at dusk, smoke comes from the chimney in cold weather and bends with the wind. Nothing dies and nothing can go wrong. A daily tray item ("Scatter some hay") would give the same visit loop as feeding the fish; it is optional and the owner decides (10.7).

**Cost.** The forest is the large part. Drawn once to one texture at the resolution cap it is about 6 to 8 MB (06 section 3: 5.8 MB at 1600 x 900, 7.7 MB with mipmaps), so it fits in 54 MB if there are few layers. The numbers are measured in Step 4 before the look is polished.

**In the plan.** Step 4 of 06 stays the first version (procedural, small, weather from the seed and the date) and gets the sky, the mountain, the forest by day and the house. A second version (4b) adds the animals and the live weather through the host (10.4).

### 10.3 The desk

The owner prefers "desk" to "office" and "study": a cozy corner of a desk in front of a window, not a place of work. A side-view cutaway, in the style of the tank.

- **The window** shows the sky, the season and the weather of the mountain. This is the same code (`host.time`, `host.weather`), not a second scene.
- **Life:** a lamp that turns on at dusk (sunset from the date and the place), rain that runs down the glass when it rains (a few slow streaks), steam from a mug, a plant that grows over real days, a blinking cursor on the laptop. All of it is slow, so the scene asks for a low frame rate.
- **The laptop screen** shows up to three lines from a data source. This is the part contributors will extend: tasks, a schedule, an issue list, anything an API gives.

Rules for the screen:

1. The scene draws and the host fetches (10.4). The scene never holds a token or opens a connection.
2. It is read-only in desktop mode (no clicks). The player changes the data in the source, or with a tray item.
3. Privacy: the text can be seen by anyone who sees the screen. A tray toggle "Hide task text" shows blank lines. The host does not log the text.
4. Old data is shown with its age. A failed request is silent: no dialog, no notification (NFR-6).
5. A due or late task never makes noise, flashes or notifies. At most the scene changes how it looks.
6. Text on a drawn screen is small at the resolution cap and blurs on a 4K display, so the laptop is drawn large enough, and this is checked on a 4K screen.

The desk works with no network: the first version reads a plain text file in the data folder (one task per line). The API sources are contributions on top of that.

**Tone belongs to the scene.** The tank stays calm and quiet. The desk is a tool and may show information. The rules every scene keeps are the host's: the budgets, pausing when covered, and the politeness of NFR-6 (no focus stolen, no notification, no badge, no sound unless the player did something, no blocked click).

### 10.4 The network (decision needed)

Proposal for how a scene gets data from the internet. Nothing is built.

- **N1. The host does the network, not the scene.** The renderer keeps its content security policy with no connections. The main process makes the request and gives the scene the parsed data. One place enforces, caches, limits and audits; a token never enters the sandbox; a scene cannot contact a host it did not declare.
- **N2. A scene declares what it needs** in `scene.json`: the hosts (https only) and a reason in one sentence, for example `"network": { "hosts": ["api.open-meteo.com"], "reason": "local weather" }`, and the names of the secrets it uses. The main process refuses any other host, an IP address, a redirect to another host, a large answer or a slow one, and sends no cookies.
- **N3. The player consents.** The first time a scene wants the network, the host shows the hosts and the reason and the player says yes or no; the answer is saved per scene. A global setting (ask, allow, never) can switch all of it off, and then every scene works with simulated data.
- **N4. Secrets are kept by the host.** A token the player enters is stored by the main process with Electron's `safeStorage` (the OS keychain, DPAPI on Windows), never in `settings.json`, never in the diagnostics (they are sanitized), and never given to the scene: the host adds it to the request.
- **N5. Polling is the host's and obeys the pause.** No request while the scene is covered, locked or asleep (NFR-1); on resume the data is refreshed if it is older than its time to live; a floor of minutes between requests per source (weather: 30 minutes) and a back-off on errors. The last good answer is cached in the data folder and shown with its age. A request never delays drawing or the start (NFR-5).
- **N6. Privacy: what leaves the machine is known.** The About box and "Copy diagnostics" list the hosts a scene called. Place is coarse. There are three ways to get it: the player types a city once (the most private, and my recommendation), the time zone gives a country (no request), or a lookup by IP address on consent (the lookup service sees the address). Only coordinates rounded to 0.1 degrees go to a weather service, which still sees the IP address like any web server. Open-Meteo (no key) is an example provider; its terms for an open-source app are checked before anything ships.
- **N7. Only reviewed code gets the network.** Network permissions are for the repository tier of section 7 (code reviewed by people). Downloaded packs (tier 2) need a stronger model first: a visible permission list, signing, limits. The review looks at whether the declared hosts match the stated purpose; a scene that reads private data and has a free-form host is the case to refuse. CI checks that `reason` exists and the hosts are https.
- **N8. What does not change:** NFR-6 for every scene, the budgets, and pausing.
- **Tests:** the network is mocked in the unit and end-to-end tests with a fake provider, and a test runs every scene offline.

Cost: a main-process module, the consent dialog, settings, secrets storage, tests and docs, probably two PRs, none in Step 1b. The weather path lands first with the mountain (the first user); the general `host.net` and secrets land with the desk.

### 10.5 What the host provides (v0, each added only when its first scene needs it)

"Extract, do not design" (06) still holds: none of these is built before a scene needs it.

| Service | What a scene gets | First scene | Network |
| --- | --- | --- | --- |
| `host.time` | the season as a curve over the day of the year, sunrise and sunset (rough, from the date and the place), `nightness` | mountain (Step 4) | no |
| `host.place` | country, region, time zone, coordinates rounded to 0.1 degree, and where it came from (player, time zone, IP) | mountain | optional |
| `host.weather` | kind, precipitation, cloud cover 0 to 1, temperature, wind, day or night, when it was read, live or simulated | mountain (4b) | yes, with a simulated fallback |
| `host.safeArea` | the insets of the taskbar, menu bar and Dock, and the strip where desktop icons sit | mountain, desk | no |
| `host.net`, `host.secrets` | named requests to declared hosts; the host adds the token | desk | yes |
| `host.ui.prompt` | a small host dialog for one line of text (adding a task); window mode and a tray item only | desk | no |
| per-scene options | a list in `scene.json` that the host shows in its menu (place, season override, hide task text) | mountain, desk | no |

### 10.6 Order and what changes in 06

1. **Mountain 4a:** 06 Step 4 as written, with `host.time` and simulated weather; the look is reviewed with the owner.
2. **Network and weather (4b):** the host network module (10.4) with the weather source, the place setting, consent. Animals and the live weather.
3. **Desk:** the third scene. It adds `host.net` for contributors' sources, the safe area and the text dialog. With three scenes the contract can leave v0 (D47).
4. If the owner accepts this: 06 gets Step 4 split into 4a and 4b, a step for the host network module before 4b, new decisions (the network through the host, consent), and its D31 and "no network" notes reworded. 06 is not changed until then.

### 10.7 Open questions for the owner

1. "Each day is a season": is it a continuous curve over the day of the year (assumed above), or a time-lapse where one real day passes through the seasons?
2. Place: typed city, time zone, or IP lookup (10.4 N6)? Which is the default?
3. Network: off until the player allows it per scene (recommended), or on?
4. Animals: which kind, and is there a daily care item or none?
5. The tone: is it right that the platform no longer promises "calm" for every scene (section 10.3), with the tank staying calm?
6. Weather provider, and a second one as a fallback.
7. The desk: a local text file first (recommended) or straight to an API?
8. The photo is used for composition only, with no tracing; is that enough for the owner?
