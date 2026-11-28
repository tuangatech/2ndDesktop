# Scene: Fish tank (`fishtank`)

Status: the first scene and the default one. Decision DEC-69 (2026-11-28): fish have no names and no fullness, and a fish can eat at any hour up to a daily limit. This document is the master design of the scene; the short overview in `docs/scenes/fishtank.md` points here. Until the two pull requests of DEC-69 are merged, the code on `main` still has fullness and names (delete this sentence when they are). Platform documents: `docs/platform/01` to `03`. Numbers in brackets such as (FR-22) point to the old functional specification in `docs/reference/fishtank-v1/`. The code move and the contract gaps are in `docs/scenes/fishtank-migration.md`.

## 1. Summary and vibe

A small, calm aquarium on the desktop. Fish swim, bubbles rise, food sinks, and the player looks after the fish from the tray menu about once a day. Nothing dies, there are no scores, no streaks, no names, no notifications. When a choice is unclear, the calmer, simpler, quieter option wins. **This calm is the tank's own identity, not a rule of the platform.**

- Ambient first: good to look at even if the player never clicks.
- No pressure: missing a day only means the fish grow a little later.
- Quiet: no sound on its own; nothing takes focus or asks for attention.
- Little effort: about a minute a day.
- Gentle with the computer: low CPU and memory.

## 2. The player's experience

- **First minute:** the scene opens in a window with two small fry of different species, four pellets floating in the water, and a short hint in the window that the tank can be moved onto the desktop from the tray icon. The hint stays until the first successful feed.
- **A normal day:** open the tray menu, read the status line ("2 pellets waiting · 5 in the stash"), choose Collect pellets, then Feed everyone, and watch each fish take a pellet. After that the rest of the day is just watching.
- **After a week away:** pellets have piled up (at most 16), the fish are drowsy (slower, low in the water) but fine, and recover at the first meal. Nothing is lost except pellets beyond the cap.
- **Growth:** a fry becomes a juvenile at 100 points (5 pellets) and an adult at 400 points (20 pellets); the size grows smoothly between them, the colours change at the stage thresholds, and a short burst of bubbles marks a new stage. Every 12 pellets fed to the tank give an egg, and a hatched egg is a new fry, up to 8 fish.
- **What the player never sees:** a fish's name, a hunger bar or a "hungry" count. The fish are told apart by species, size and colour.

## 3. Interaction

**Desktop mode** takes no clicks and shows no HTML; everything is in the tray menu (`menu.js`, built from `getSummary()`):

| Item | What it does |
| --- | --- |
| Status line | "2 pellets waiting · 5 in the stash"; "Nothing to do right now" when both are zero |
| Collect pellets | moves all waiting pellets into the stash (it holds at most 30) |
| Feed a pellet | drops one pellet from the stash just under the surface above the fish that has waited longest since its last meal |
| Feed everyone | one pellet for each fish that may still eat, the fish that has waited longest first, one pellet about every 2 seconds; it ends when every such fish has had one or the stash is empty; while it runs the item is Stop feeding |
| Hatch egg | only while an egg is waiting |

An item that cannot be used is a grey line that says why: "The fish have eaten enough for today", "No pellets in the stash", "Stash is full", "No pellets waiting", "An egg is waiting (the tank is full)". When the tank is not visible, an action changes the numbers at once without animation.

**Fish react to the pointer in both modes.** In desktop mode the host reads the pointer position from the system about 10 times a second while drawing (`pointer(x, y)`); in window mode it comes from the window. About 6 in 10 fish are curious (they swim slowly toward the pointer and hover about 40 units away; they give up after 8 seconds, or when the pointer has been still for 3), the others are shy (they swim away, faster when the pointer is fast). A fish notices the pointer within 120 units if it moved in the last 2 seconds, and after reacting it ignores the pointer for 20 seconds. A fish going to eat ignores the pointer. Whether a fish is curious or shy comes from its seed. Reactions change no game numbers.

**Window mode only (clicks).** A click goes, in this fixed order, to an egg (it hatches), a floating pellet (it is collected), a fish, then the water.
- A fish wiggles for half a second. Nothing else happens: no label, no name.
- The water drops a pellet from the stash for the nearest fish that may still eat (the way it has to swim for pellets it already has queued counts); nothing happens on the sand.
- The window's HTML (`ui/hud.js`, mounted in `host.ui`) holds the stash counter, a toast line that fades after 2 seconds, and the first-launch hint. Messages: "No food in the stash", "Stash is full", "No pellets waiting", "The tank is full", "The fish have eaten enough for today. Come back later!".

**Edit mode** (moving decorations) is a later platform feature and not part of the tank.

## 4. Rules and state

All game numbers are in `game/config.js`; the visual numbers (bubbles, sway, decor, swimming, pointer) are in `view/visualConfig.js`. The rules in `game/rules.js` are pure functions of a state and a time; every action returns `{ ok, state }` or `{ ok: false, reason }` and never changes a state in place. The economy is committed when a pellet is **dropped**: animations show it but never decide it. The clock rule holds: nothing reads `Date.now()`; time comes in as an argument from `host.clock`.

| Rule | Value |
| --- | --- |
| Pellet spawn | one every 60 minutes, whether or not the app runs, up to 16 floating; a full tank banks nothing (the timer restarts) |
| Stash | up to 30 |
| Growth per pellet | 20 points |
| Stages | fry 0 to 99, juvenile 100 to 399, adult 400 and up (growth stops); the stage is derived from the points and never stored |
| Size | 50% of the adult size at 0 points to 100% at 400, smooth |
| Meals | **a fish may take at most 2 pellets in any 24 hours** (`meals.perFishPerDay`, `meals.windowMs`), at any hour; there is no fullness level and no hunger |
| Drowsy | no food for more than 36 hours (a never-fed fish counts from its creation); recovers at the first meal; fish never die |
| Egg | one for every 12 pellets fed in total; waits while 8 fish are in the tank |
| Start | 2 fry of different species, 4 floating pellets, an empty stash |
| Species | tetra, guppy, angelfish (`data/species.json`): length, swim speed, depth band, a colour set per stage |

**A meal.** `feed(fishId)` fails with `unknown_fish`, `stash_empty` or `enough_today` (the fish already has 2 meals in its last 24 hours). Otherwise the stash goes down by one, the fish gets 20 points, its time of this meal is added to `mealsAt`, `lastFedAt` is set and `totalFed` goes up. A meal leaves `mealsAt` 24 hours after it was taken; a fish therefore never has to wait for a particular hour, only for its oldest meal to age out. The pellet then sinks for about 6 seconds from the top to the sand, swaying a little, and the fish it was given to heads for where the pellet will be, turns, opens its mouth and eats it before it reaches the sand; no other fish takes it. The points are shown when the pellet is eaten, and pellets eaten out of drop order never move a fish's growth backwards. If no fish may eat, no pellet is dropped and nothing is spent.

**Who gets a pellet.** Click on the water and Feed a pellet differ: a click gives it to the nearest fish that may eat; the tray gives it to the fish that has waited longest since its last meal (or since it hatched), because the player cannot aim from the tray.

**Time.** Everything that changes over time is computed from `host.clock`, never from the sum of frame times: the pellets that appeared while the app was closed, the meals that have aged out, drowsiness, and the catch-up at the next start. A once-a-second tick settles the numbers. A clock that goes backwards re-anchors to now.

**Pacing.** The pellet supply (24 a day) is always larger than the fish may eat (2 each a day, 16 for 8 fish), so the daily limit sets the pace and a visit rarely finds the fish short of food. It is held by `tests/pacing.test.js` and checked with `npm run sim` (30 days, several visit patterns): a player who visits daily at the same hour sees juvenile fish at visit 3 and adults at visit 10, and 8 fish within 20 days; one who visits at a different hour each day needs up to 15 visits for adults; one who visits every 12 hours still feeds each fish at most 2 pellets a day; a player who never visits gets no growth and no eggs; visiting every 3 days still makes progress, only slower.

**Record** (`records/fishtank.json`, `schemaVersion` 1, written through `host.record`; the id and the version never change, so the owner's saved tank always loads):

| Part | Fields |
| --- | --- |
| `localPlayerId` | a random id (a leftover of the old online plan; only the rules and the repository touch it) |
| `tank` | `floatingPellets`, `pelletsUpdatedAt`, `stash`, `totalFed`, `eggsClaimed`, `decorSeed`, `hintShown` |
| `fish[]` | `id`, `species`, `seed`, `growthPoints`, `mealsAt` (up to 2 epoch times), `lastFedAt`, `createdAt` |

Loading repairs a damaged record field by field (clamps counts, gives an unknown species a known one, drops a fish with a duplicate id, adds the first fry if none is left), keeps a copy of the original before a repair is saved, and refuses to overwrite a record written by a newer version (the tank then shows a fresh, unsaved tank and says so in window mode). A record from before DEC-69 loads: the fields `name`, `fullness` and `fullnessUpdatedAt` are dropped without a message, and a fish with no `mealsAt` has no meals counted. A test build can change a few numbers through `tuning.json`; each has a range (`applyTuning` in `config.js`).

**Dropped from the old plan:** accounts, saving on a server, friends, visiting other tanks, hearts, Explore, names, fullness. The tank is one player on one computer.

## 5. Look and sound

**Layers, back to front (the order does not change between versions):** `background` (the water gradient: lighter at the top, `#9be8e4` to `#14507c`; the far reef of three flat layers), `water` (surface, light shafts, back decor, haze, sand, floor light, shadows, bubbles, fish, pellets and eggs, front decor), `sandLip`, `depthShading`, `ui`. The surface, light shafts, floor light, shadows and depth shading are empty until Phase 2 fills them. Everything in `water` is one container so that one ripple filter can cover it later.

**Decor.** Weeds and corals sway (tops move more than bases); rocks and sand stay still. The layout comes from the tank's seed: slots are made for the widest tank and a narrower one uses the first of them, so nothing moves when the window changes shape, and a wider tank only adds slots (about 6 at 3:2, up to 14 at 32:9). The first slots are fixed in kind (a rock, a coral, a weed), so every tank has all three; each item is in the back row (paler and bluer, under one veil of water colour) or the front row. Bubble chains rise from two to four spots on rocks and corals (5 to 12 bubbles, then a pause of 4 to 15 seconds), wobble, grow by 20% and pop at the surface.

**Fish** (`view/Fish.js`) are three drawn pieces (tail and fins, body, accent stripe) on one rope of points, tinted from a palette per species and stage. A sine wave runs from head to tail (more swing at the tail, faster when the fish swims faster, bigger after a meal); the body tilts up and down by up to 25 degrees; a turn eases through zero over a quarter of a second. A wandering fish picks a new spot in its species' depth band every 4 to 10 seconds, keeps a little apart from the others and away from the walls. A fish that has a pellet queued swims to where the pellet will be at 1.4 times its normal speed, and faster, up to 3.2 times, to catch one that is about to land; it eats when its mouth is within reach, with a small wiggle, a swell, and two or three bubbles. A drowsy fish swims at 55% speed and stays in the lower third. A hatched fish fades in where its egg lay. Fish are drawn in front of or behind decorations by the layers, never by their own depth.

**Food and eggs.** Floating pellets are bigger than dropped ones so they are easy to click; they bob and drift, never in the top strip, and fly to the stash counter when collected in window mode. Up to four eggs are drawn on the sand; the rest wait. A hatch makes a few bubbles.

**Art:** original SVG drawn in this project (19 files in `art/`), rendered by `npm run assets` into one atlas; rocks, corals and weeds come from a generator script whose output is committed; the sand texture is made in code. The style guide is `docs/art-style.md`. Stage colours are easy to tell apart, and depth shading never exceeds 15% on fish.

**Sound** (`sounds.js`): three short, quiet sounds in one key (D major pentatonic, 500 Hz to 1.5 kHz, since laptop speakers do not reproduce much below that), synthesized in code from recipes for the host's sound engine: a splash (food lands), a pop (a pellet is collected) and a chime (a new fish). They play only as an answer to a click or a menu action; the feed loop and the tick make no sound, and a test checks that.

**Phase 2 effects (planned, not built):** a water ripple and shimmer (the only full-area filter), light shafts, moving light on sand and rocks, a waving surface, fish shadows, bubbles from fish mouths, snails and crabs (scenery, not saved), and day and night lighting from `host.time`, with a "Reduced effects" option that turns off the ripple, the moving light and the surface wave and cuts bubbles to a third. If time gets tight, cut fish shadows first, then the surface wave.

## 6. What it needs from the platform

| Need | Why |
| --- | --- |
| Capabilities | **None.** No network, no data kinds, no place; it needs no consent dialog |
| `host.clock` | every time-based rule |
| `host.rng` (to become `host.seed`) | the species, seeds and ids of new fish; `Math.random` only for effects |
| `host.record` | the saved tank |
| `host.art` | the atlas, loaded and uploaded by the host (the proposal in `fishtank-migration.md` section 4) |
| `host.sound` | `define` and `play` for the three sounds |
| `host.ui` | window mode only: the HTML over the canvas |
| `host.options`, `host.tuning` | measurement and test switches (`DESKTOP2_SCENE_OPTIONS`, for example `{"fish":8}` gives a mixed tank that is never saved; `dev` shows the development panel) |
| `pointer(x, y)`, `click(x, y)` | pointer reactions in both modes; clicks in window mode only |
| `status()`, `menuItems()`, `onMenu(id)` | the tray menu |
| Not built yet | `resume(gapMs)`, `host.safeArea` (the layout already takes a `usable` area), `host.time`, `onSettings` (reduced motion), `migrate` exported from `index.js` (it exists inside the repository), the manifest fields of contract v0 (`fishtank-migration.md` sections 4 and 5) |

The manifest today is the old form: `{ id, name: "Tank", version, author, license, schema: 1, atlas: "fishtank" }`.

## 7. Budget and performance

Measured in the old project, 8 fish, one hour (`docs/platform/05`):

| | Windows | macOS |
| --- | --- | --- |
| Desktop mode, memory (whole app) | 229 MB (empty host 196; the tank costs about 33) | 328 to 339 MB (empty host 258 to 264; the tank about 70) |
| Window mode, memory | about 220 MB (empty host 172) | 294 to 303 MB |
| Desktop mode, CPU and frames | about 0.6% of a core, 30 fps | about 1.2%, 30 fps |
| Start (first frame) | not recorded | 290 to 370 ms |

The platform limits are 250 MB on Windows and 375 MB on macOS (DEC-63), 30 fps in desktop mode, and drawing stops when the desktop is covered (by default). Memory work that mattered: no multisampling in desktop mode (about 70 MB less), a drawing cap of 1600 x 900, the decoded atlas closed once it is on the graphics card, gradient textures made once and not on every resize, no garbage made per frame in the fish update. The tank asks for 30 fps in desktop mode and 60 in an active window. Removing names and fullness changes none of these.

## 8. Offline behaviour and privacy

Fully offline. No data leaves the computer. The record is a local file in the data folder; the tank has no network capability and holds no personal text (there are no names).

## 9. Code map

```
scenes/fishtank/
  scene.json       the manifest
  index.js         create(host): the one entry point; builds repository, scene and HUD; returns the scene object
  menu.js          tray status line and items (pure)
  sounds.js        the three sound recipes
  game/            PURE: no Pixi, no DOM, no Node
    rules.js         the rules (collect, feed, hatch, settle, summarize)
    config.js        the game numbers and the tuning ranges
    repo/            TankRepository.js (the interface), LocalTankRepository.js (state, saving, repair, migrate)
  view/            everything drawn with Pixi
    TankScene.js     layers, update loop, clicks, drop and feed logic
    Fish.js Food.js Pellet.js Egg.js Bubbles.js SwayMesh.js
    layout.js backdrop.js palette.js pointer.js steering.js textures.js visualConfig.js
  data/            species.json, decor.json
  ui/              hud.js, hud.css, devPanel.js (window mode only; the dev panel needs the `dev` option)
  art/             SVG sources; gen-decor-art.mjs makes the rocks, corals and weeds
  tests/           see section 10
```

`art/`, the generator and the split of `tests/` into `unit/` and `e2e/` are still flat (`fishtank-migration.md` section 3).

## 10. Tests

- The **golden state hash** (`tests/golden.spec.js`): a scripted session (collect, three drops, Feed everyone, six hours on the clock, hatch if an egg waits) and 900 `update` steps with a fixed seed, the manual clock and a seeded `Math.random`; one hash of the saved state and one of the scene graph. It must not change when the tank is moved or refactored. A change of the rules on purpose, like DEC-69, changes it: the new values are recorded in the same commit with the reason, as the header of the test says.
- Unit tests in the scene (10 files): rules (including the meal limit and the 24-hour window), repository (repair, loading a record from before DEC-69), pacing, species, steering, layout, palette, backdrop, pointer, sounds.
- End-to-end tests in the scene (4 files): feeding, the game (a new player's first day, Feed everyone, the meal limit message, eggs, the stash), the golden hash, and sounds and menu details (`step6`).
- The platform's contract test and capability test run on the tank like every scene.
- `npm run sim` (the pacing table), `npm run shot` (the reproducible picture), `npm run measure:switch` (memory and frame time).
- Hand checks: a covered desktop pauses; the tray text on both systems; the pointer reactions on the real desktop.

## 11. Open questions and out of scope

- Which Phase 2 effects are worth their battery (measure the ripple at 4K on an integrated GPU).
- The contract gaps of the tank (`fishtank-migration.md` section 9): where a diagnostics line goes, how a scene gets its atlas, the manifest name ("Fish tank" or "Tank") and author, `budget.memoryMB` for two systems, the thumbnail encoder.
- The daily limit is 2 meals; 3 would bring adults in about a week instead of 10 days. It is one number in `config.js`.
- A second tank layout or theme (a reef, a pond): out of scope. Moving decorations in Edit mode: later.
- Out of scope for good: fish death, penalties, paid items, competition, trading, accounts, a server, naming fish.
