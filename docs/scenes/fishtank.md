# Scene: Fish tank (`fishtank`)

Status: Draft v0.1, 2026-11-23. The first scene and the default one. It is built and working in the old Fish Tank repository (Phase 1 done, Step 1b moved it behind the scene contract); this document is its `DESIGN.md` for the new repository. Platform documents: `../platform/01` to `03`. Numbers in brackets such as (FR-22) point to the old functional specification, which is not carried over.

## 1. Summary and vibe

A small, calm aquarium on the desktop. Fish swim, bubbles rise, food sinks, and the player looks after the fish from the tray menu about once a day. Nothing dies, there are no scores, no streaks, no notifications. When a choice is unclear, the calmer, simpler, quieter option wins. **This calm is the tank's own identity, not a rule of the platform.**

- Ambient first: good to look at even if the player never clicks.
- No pressure: missing a day only means the fish grow a little later.
- Quiet: no sound on its own, nothing that takes focus or asks for attention.
- Little effort: about a minute a day.
- Gentle with the computer: low CPU and memory.

## 2. The player's experience

- **First minute:** the scene opens in a window (window mode) with two small fry of different species, four pellets floating, and a short hint that the tank can be moved onto the desktop from the tray icon.
- **A normal day:** open the tray menu, see "2 pellets waiting, 5 in the stash, 1 hungry", choose Collect pellets, then Feed until full, and watch each pellet eaten. The menu says "Everyone is full and happy" and the rest of the day is just watching.
- **After a week away:** pellets have piled up (at most 16), the fish are drowsy (slower, dimmer, low in the water) but fine, and recover at the first meal. A fish grows from fry to juvenile at 100 points (about day 3 of daily feeding) and to adult at 400 points (about day 10). Every 12 pellets fed gives an egg, and the egg hatches into a new fry (up to 8 fish in the tank).

## 3. Interaction

**Desktop mode (no clicks, no HTML).** Everything is in the tray menu:

| Item | What it does |
| --- | --- |
| Status line | for example "2 pellets waiting · 5 in the stash · 1 hungry" |
| Collect pellets | moves all waiting pellets into the stash (stash holds at most 30) |
| Feed a pellet | drops one pellet from the stash near the top |
| Feed until full | drops pellets about 2 seconds apart until every fish is full or the stash is empty; choosing it again stops it |
| Hatch egg | only while an egg is waiting |

An item that cannot be used is greyed out and says why: "Everyone is full and happy", "No pellets in the stash", "Stash is full", "No pellets waiting".

**Fish react to the pointer in both modes.** In desktop mode the host reads the pointer position from the system about 10 times a second while drawing (`pointer(x, y)`); in window mode it comes from the window. About 6 in 10 fish are curious (swim slowly toward it, lose interest after about 8 seconds), the others are shy (swim calmly away). After reacting a fish ignores the pointer for about 20 seconds, and a fish going to eat ignores it. Reactions change no game numbers.

**Window mode only (clicks):** click a pellet to collect it; click an empty spot to drop a pellet; click a fish for a small wiggle and a label for 3 seconds (name or species, stage, hungry or full) with a Rename button (up to 16 characters, private); click an egg to hatch; click a crab or snail (Phase 2) for a small reaction. A click goes to an egg or pellet first, then a fish, then a crab or snail, then the water. The window-mode strip (stash count, a collect button) is the scene's own HTML, mounted in `host.ui`.

**Edit mode** (later, a platform feature): moving decorations. Not in v1.

## 4. Rules and state

All game numbers live in one config file (`config.js`), the visual numbers in another (`visualConfig.js`). The economy is committed at drop time: animations never decide numbers.

| Rule | Value |
| --- | --- |
| Pellet spawn interval | 60 minutes, whether or not the app runs |
| Max floating pellets / stash | 16 / 30 |
| Growth points per pellet | 20 |
| Stages | fry 0 to 99, juvenile 100 to 399, adult 400 and up (growth stops) |
| Size | 50% at 0 points to 100% at 400 points, smooth |
| Fullness | max 2 pellets, drops by 1 every 12 hours; a full fish does not eat |
| Drowsy | after 36 hours without food; recovers at once when fed; fish never die |
| Egg | one for every 12 pellets fed in total; waits when 8 fish are in the tank |
| Start | 2 fry of different species, 4 floating pellets |
| Species | tetra, guppy, angelfish; each has a palette per stage, fixed by species and a seed given at hatching |

A dropped pellet sinks for about 6 seconds from the top to the sand and sways a little; the nearest fish that is not full heads for where the pellet will be, turns, opens its mouth and eats it before it reaches the sand; no other fish takes it. If all fish are full the pellet is not dropped. A pellet is never lost.

Everything that changes over time is computed from `host.clock`: pellets that appeared while the app was closed, fullness decay, drowsiness, and the catch-up at the next start. The pacing was checked with a simulator (`npm run sim`: 30 days, several visit patterns): a player who visits daily at the same hour reaches the adult stage on day 10, one who visits at different hours after about 14 visits.

**Record** (`records/fishtank.json`, `schemaVersion` 1; the fields are in the old `scenes/fishtank/game/repo/` and `game/rules.js`): the fish (species, seed, name, growth points, fullness and its time stamp, created at, last fed), the pellets (floating count and its time stamp, the stash), the eggs and the total fed, the decoration seed, and `savedAt`. The record id never changes, so that the owner's saved tank loads in the new repository. The scene keeps its own "your record was damaged" lines and draws them itself.

**Dropped from the old plan:** accounts, saving on a server, friends, visiting other tanks, hearts, Explore. The new platform is one player on one computer.

## 5. Look and sound

**Layers, back to front (the order does not change between versions):** water with a soft gradient (lighter at the top, deeper at the bottom), a far reef haze, decorations behind the fish (rocks, corals, weeds, sand), the fish, bubbles, food, decorations in front, the surface (Phase 2). Weeds and corals sway (tops move more than bases); rocks and sand stay still. Bubble chains rise from two to four spots on rocks and corals (5 to 12 bubbles, then a pause of 4 to 15 seconds), wobble, grow a little and pop at the surface. The decoration layout is picked from a seed when the tank is created and stays the same, spread across the full width at any shape.

**Fish** bend their bodies as they swim (a wave from head to tail), turn smoothly, tilt up and down by up to about 25 degrees, pick a new spot anywhere in the water every 4 to 10 seconds, and pass in front of or behind decorations. Drowsy fish stay in the lower third.

**Art:** original SVG, drawn in this project, rendered by `npm run assets` (with `resvg`) into one atlas (`fishtank.png` and `fishtank.json`); scenery is generated by a script. The style guide is `art/STYLE.md`. Colour changes at stage thresholds and depth shading never exceeds 15% on fish, so the stage colour stays easy to see.

**Sound:** short, quiet, soft and in one key, synthesized in code: a splash, a pop, and a chime for a new fish. They play only as a reaction to something the player did, and can be switched off.

**Phase 2 effects (planned, not built):** a water ripple and shimmer (the only full-area filter; at half resolution in desktop mode), light shafts from above, moving light on the sand and rocks, depth shading, a waving water surface, fish shadows, bubbles from fish mouths, snails and crabs (scenery, not saved, not counted), and day and night lighting that follows the local time through `host.time`. A "Reduced effects" option (a scene option in the manifest) turns off the ripple, the moving light and the surface wave and cuts bubbles to a third. If time gets tight, cut in this order: fish shadows, then the surface wave animation.

## 6. What it needs from the platform

| Need | Why |
| --- | --- |
| Capabilities | **None.** No network, no data kinds, no place. It needs no consent dialog |
| `host.clock` | every time-based rule |
| `pointer(x, y)` | the fish react to the pointer in both modes |
| `click(x, y)`, `host.ui` | window mode only |
| `host.sound` | the three sounds |
| `status()`, `menuItems()`, `onMenu(id)` | the tray menu |
| `host.record` | the saved tank |
| `host.safeArea` | fish and pellets stay inside the usable area (not under the taskbar, menu bar or Dock) |
| `host.time` | Phase 2 day and night |
| Options in the manifest | Reduced effects, Day and night lighting (Phase 2) |

## 7. Budget and performance

Measured in the old project, 8 fish, one hour:

| | Windows | macOS |
| --- | --- | --- |
| Desktop mode, memory (whole app) | 229 MB (empty host 196, the tank costs about 33) | 328 to 339 MB (empty host 258 to 264, the tank about 70) |
| Window mode, memory | about 220 MB (empty host 172) | 294 to 303 MB |
| Desktop mode, CPU and frames | about 0.6% of a core, 30 fps | about 1.2%, 30 fps |
| Start (first frame) | not recorded in the notes | 290 to 370 ms |

Windows has about 21 MB of the 250 MB left with the tank alone, which is why a second scene is sized by the empty-host baseline. Memory work that mattered: no multisampling in desktop mode (about 70 MB less), a drawing cap of 1600 x 900, the decoded atlas image closed once it is on the graphics card, and gradient textures made once, not on every resize. The scene asks for the standard 30 fps in desktop mode and 60 in an active window.

## 8. Offline behaviour and privacy

Fully offline. No data leaves the machine. The record is a local file in the data folder.

## 9. Tests

- The **golden state hash**: a scripted session (collect, three drops, feed until full, six hours on the clock, hatch if an egg waits) and 900 `update` steps with the seed, the manual clock and a seeded `Math.random`; the hash of `serialize()` plus the scene graph (nodes typed by `renderPipeId`) is recorded on the known-good build and must not change when the tank is moved or refactored.
- About 330 unit tests (rules, repository, layout, steering, palette, species, pointer, sounds) and the end-to-end tests of feeding, the game, display modes, and diagnostics.
- The contract test and the capability test of the platform.
- The pacing simulator.
- Hand checks: a covered desktop pauses; the tray text on both systems; the pointer reactions on the real desktop.

## 10. Open questions and out of scope

- Which Phase 2 effects are worth their battery (measure the ripple at 4K on an integrated GPU).
- A second tank layout or theme (a reef, a pond)? Out of scope.
- Moving decorations in Edit mode: later.
- Out of scope: fish death, penalties, paid items, competition, trading, accounts, a server.
