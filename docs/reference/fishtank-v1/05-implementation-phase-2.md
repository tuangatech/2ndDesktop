# Fish Tank — Implementation Plan, Phase 2 (Living tank: light, depth and effects)

Status: Draft v0.3
Companion docs: 01-functional-spec.md (FR-n and NFR-n), 02-tech-design.md (section numbers point to it), 04-implementation-phase-1.md (the phase this builds on)

## 1. Goal and scope

Take the working Phase 1 tank and make it feel alive and beautiful, without changing how the game plays or how much effort it asks of the player. Phase 2 is still fully offline. Claude Code writes the code and draws the extra art (SVG).

Requirements covered: FR-50 to FR-59 (functional spec, sections 6.12 and 11), the Phase 2 budgets in 7.3, plus two new menu items (FR-36): Reduced effects and Day/night lighting. Every effect must work in both display modes (desktop and window, FR-60) and at any display size (FR-63).

| FR | What | Step |
| --- | --- | --- |
| 50 | Ripple, shimmer, and the Reduced effects setting | 1 |
| 51 | Light shafts from above | 2 |
| 52 | Moving light on the sand and rocks | 2 |
| 54 | Water surface | 2 |
| 53 | Depth shading | 3 |
| 55 | Fish shadows | 3 |
| 56 | Fish release bubbles | 3 |
| 57 | Day and night lighting | 5 |
| 58 | Snails crawling on the sand and rocks | 4 |
| 59 | Crabs scuttling on the sand and rocks | 4 |

Moved to Phase 1: fish reacting to the pointer (FR-49) and touching a fish (FR-48). Not in Phase 2: accounts and saved progress (Phase 3), social features (Phase 4), signing and release work (Phase 5).

## 2. Starting point

Phase 2 starts when Phase 1 Steps 1 to 7 are done and the Phase 1 playtest has been run. From Phase 1 this plan relies on:
- `computeLayout` and the unit `height / 320`, desktop mode with its 30 fps cap and drawing resolution cap, and the tray menu built from the single menu list (04, Steps 1, 2 and 6);
- the `TankScene` layer containers for the surface, light shafts, floor light, shadows and depth shading, which exist but are empty (04, Step 2);
- the shared bubble pool with `emit(x, y, size)`, and the fish `mouth` anchor (04, Steps 2 and 3);
- `renderer/game/visualConfig.js`, `settings.json`, and the single menu list in `electron/menu.js` (04, Steps 2 and 6);
- `assets/art/STYLE.md`, `npm run assets` and `npm run shot`;
- the diagnostics sampler and "Copy diagnostics" (04, Step 6);
- the Phase 1 results in `docs/perf-notes.md` and `docs/playtest-notes.md`.

No extra packages are needed: the ripple uses the `DisplacementFilter` that comes with PixiJS.

## 3. Budgets for this phase

From spec 7.3. With all effects on, NFR-2 is at most 5% of one core (visible but not active), NFR-3 at most 10% (active), NFR-4 at most 300 MB. With Reduced effects on, the Phase 1 numbers apply (3%, 8%, 250 MB; 350 MB on macOS). The macOS memory number for all effects on is set in this phase, from measurements. Desktop mode is always "visible but not active" and runs at 30 fps, so its budget is NFR-2 (5% with all effects on, 3% with Reduced effects) and NFR-4, measured at 1080p and at 4K. NFR-1 (hidden, covered: at most 0.5%) and the 60 and 30 frames per second limits do not change. Every step that adds an effect re-measures on both machines before it is called done.

## 4. Decisions made for this plan

| # | Decision | Why |
| --- | --- | --- |
| L1 | Light on the floor is one scrolling caustic texture, drawn additively and masked by a silhouette of the sand and the rock tops that is rendered once per resize. | One extra draw, no filter (tech design 3.3). |
| L2 | Light shafts, the surface and shadows are plain sprites or meshes. The ripple is the only full-area filter, and the only filter in the game. | Filters are the main GPU cost on integrated graphics. |
| L3 | Reduced effects is off by default and is only ever turned on by the player. It changes only the things listed in FR-50, and it must meet the Phase 1 budgets. | Keeps the first impression beautiful; weak computers have an easy switch. |
| L4 | Day/night lighting is on by default and uses the computer's local time of day through a pure `nightness(time)` function. It never uses or changes the game clock. | FR-57: lighting must not affect growth, pellets or drowsiness. |
| L5 | New settings are stored as `reducedEffects` and `dayNight` in `settings.json`. | Same mechanism as the Phase 1 settings. |
| L6 | If time or performance gets tight, cut in this order: fish shadows (FR-55), then the surface wave animation (FR-54, keep a still line). Keep depth shading, light shafts and floor light. | Shadows and the surface wave are the least visible and the easiest to remove; depth shading is almost free and gives the strongest sense of depth. |
| L8 | Effects are sized from `computeLayout` (units of `height / 320`), never from fixed pixels, and are rebuilt on a resize or a display change. In desktop mode the ripple covers the whole display, so the filter runs at a reduced resolution (start at 0.5) and is measured at 1080p and 4K. | The same effects must look right and meet the budgets in the 3:2 window and on a 4K desktop (FR-63). |
| L9 | Reduced effects and Day/night lighting are items in the single menu list, so they appear in the tray menu and the gear menu without extra work. | One definition for every menu (04, Step 6). |
| L7 | Crabs and snails are quiet scenery: they follow walk lines on the sand and rocks, ignore food, fish and the pointer, change no game numbers, and are not saved (FR-58, FR-59). Their count and tint come from the decoration seed. | Matches the calm direction (spec section 1), and keeps them cheap to build, test and run. |

## 5. Order

| Step | Name | Size | Depends on |
| --- | --- | --- | --- |
| 1 | Effects base: ripple, Reduced effects | M | Phase 1 |
| 2 | Light: shafts, floor light, surface | M | 1 |
| 3 | Depth shading, fish shadows and fish bubbles | M | 2 (fish bubbles can start right after Phase 1) |
| 4 | Crawling creatures: snails and crabs | M | Phase 1 (can run in parallel with 2 and 3) |
| 5 | Day and night lighting | M | 2, 3 |
| 6 | Art polish, budgets and playtest | M | 1 to 5 |

---

## Step 1 — Effects base: ripple and Reduced effects

Tasks
- [ ] **Filter spike first.** Apply a `DisplacementFilter` (scrolling noise map) to the `water` container with 8 fish and the full decor. Run it on the Windows laptop with integrated graphics and on the Mac at 2x, in window mode and in desktop mode at 1080p and 4K, and measure against the Phase 2 budgets in section 3. If it is not smooth at the default size, decide now: a smaller `filterArea`, a lower `resolution` for the filter, or a ripple on the background only. Record the result in `docs/perf-notes.md`.
- [ ] **Ripple and shimmer** (FR-50): the filter from the spike, with `filterArea` set to the tank rectangle (tech design 3.3). The displacement map is a tileable noise texture generated in code or drawn as SVG.
- [ ] **`scene.setReducedEffects(bool)`**: removes the ripple filter, caps the bubble pool at about 20 (chains scale to a third), and sets `ticker.maxFPS = 30`. Each later step adds its own part to this function (light shaft animation, caustic scrolling, surface wave).
- [ ] **Settings and menu**: add `reducedEffects` to `settings.json` and a "Reduced effects" checkbox to the menu list (the tray menu and the gear menu get it). Apply it at launch and when it changes.
- [ ] **E2E check**: with `FISHTANK_TEST=1`, toggling the setting changes the `scene.reducedEffects` flag exposed by the test hook.
- [ ] **Measure** both modes against the budgets.

Done when: ripple looks good and meets the budgets on both systems, and the Reduced effects checkbox switches the tank back to its Phase 1 look and Phase 1 cost.

---

## Step 2 — Light: shafts, floor light, surface

Tasks
- [ ] **Light shaft art and layer** (FR-51): an SVG for a tall soft shaft (white, transparent edges, fading toward the bottom). Create 3 to 5 additive sprites at slight angles near the top (more on a wide display, spread across the width); width and brightness follow slow sine cycles of 10 to 30 seconds with different phases.
- [ ] **Floor light** (FR-52, L1):
  - a tileable caustic texture (a net of bright wavy lines), generated in code or SVG; check that it tiles without a visible seam;
  - a silhouette mask of the sand and the upper faces of rocks and corals, rendered into a `RenderTexture` and rebuilt on resize and on a resolution change;
  - two additive `TilingSprite` layers scrolled at different speeds, masked by it.
  Check that it looks like sunlight on a pool floor, stays subtle, and does not wash out the sand.
- [ ] **Surface** (FR-54): a waving bright line along the top edge.
- [ ] **Reduced effects parts**: stop the shaft animation (fixed brightness), freeze the caustic scrolling (a still patch), stop the surface wave.
- [ ] **Visual settings**: all numbers in `visualConfig.js`.
- [ ] **Screenshots**: `npm run shot` the tank with and without each layer; Claude Code reviews them, then the owner does.
- [ ] **Measure** against the budgets after each layer.

Done when: light visibly reaches the sand and the tops of rocks and corals, the shafts breathe slowly, and the surface wave is visible without distracting. All three switch off or freeze correctly in Reduced effects, and the budgets hold.

---

## Step 3 — Depth shading, fish shadows and fish bubbles

Tasks
- [ ] **Depth shading** (FR-53): a vertical gradient overlay (transparent at the top, deep blue at the bottom) above the fish, with at most about 15% effect on fish; back decor gets a paler, bluer tint than front decor.
- [ ] **Fish shadows** (FR-55): a pool of soft dark ellipse sprites on the sand, one per fish, following the fish's x position; scale and alpha shrink as the fish rises. Shadows stay on in Reduced effects.
- [ ] **Fish bubbles** (FR-56): each fish keeps a 10 to 30 second countdown; at zero it calls the bubble pool's `emit` 1 to 3 times at its mouth anchor, 150 ms apart; bubble size follows the fish size. It does not run while the window is hidden. Eating also emits 2 or 3 tiny bubbles.
- [ ] **Check the stage colors**: with depth shading on, set a fish to 99, 100, 399 and 400 points with the dev panel and confirm the color change is still easy to see at the bottom of the tank.
- [ ] **Measure** against the budgets.

Done when: back decor looks farther away than the front, fish colors still read clearly, every fish has a shadow that follows it and shrinks as it rises, and fish blow bubbles at random times.

---

## Step 4 — Crawling creatures: snails and crabs

Tasks
- [ ] **Art** (SVG, in the approved style): a snail (shell, body, eye stalks) and a crab (body, legs, two claws), in light tones with a small seed-based tint. Run `npm run assets` and review the contact sheet.
- [ ] **Walk lines**: add `assets/decor.json` entries with a `walkLine` (a polyline along the top) for every rock and coral kind. Extend `layoutDecor` to return `walkPaths` (the sand line, each placed rock or coral line, and `links` where a rock meets the sand). Unit-test that it is deterministic and that every link joins two paths.
- [ ] **Counts and tint** from `makeRng(decorSeed ^ 0x51ed270b)`: 1 to 2 crabs, 1 to 3 snails. The same seed gives the same counts and tints.
- [ ] **`stepCreature(creature, paths, dt, rng)`** (pure): states `rest` and `move`; snail 4 to 8 px/s with 5 to 20 s rests; crab bursts of about 1 s at 30 to 50 px/s with 2 to 8 s rests and an occasional claw raise; picks a path at a link, turns back at the end of a path; speeds scale with `tankHeight / 320`. Unit tests: never leaves its path, always rests between moves, link crossing works both ways, speeds scale with the tank height.
- [ ] **`Creature` entity**: a few pooled sprites; snail stretch and eye-stalk sway, crab sideways gait with leg bob and claw raise; drawn in the layer of the surface it walks on.
- [ ] **Click reaction** (FR-58, FR-59; window mode only, because the desktop tank gets no clicks): `pointertap` plays a 1 second reaction; hit priority is egg or pellet, fish, creature, water. Check that dropping a pellet near a crab still works.
- [ ] **Pausing and resizing**: creatures stop with the scene when the window is hidden; on resize and on a display change they keep their place along their path (distance fractions), never end up inside a rock or off the tank.
- [ ] **Dev panel**: "spawn crab" and "spawn snail" buttons for testing.
- [ ] **Measure** against the budgets; creatures must add almost nothing.

Done when: 1 to 3 snails and 1 to 2 crabs crawl on the sand and over the rocks, rest between moves, react when clicked, stay the same in number and kind after a restart, and never leave the tank or block feeding.

---

## Step 5 — Day and night lighting

Tasks
- [ ] **`renderer/game/Lighting.js`** (tech design 3.3): the pure function `nightness(date)`: 0 from 07:00 to 18:00, smoothstep up to 1 between 18:00 and 20:00, 1 from 20:00 to 05:00, smoothstep down to 0 between 05:00 and 07:00. Unit-test the boundary times (04:59, 05:00, 06:00, 07:00, 17:59, 18:00, 19:00, 20:00, midnight) and that the output is continuous.
- [ ] **Blending**: the background becomes two gradient sprites (day and night) cross-faded by `nightness`; the shaft color goes from warm to cool and its strength drops at night; the floor-light strength drops; the depth overlay color and strength change; the back-decor tint changes. Fish are touched only through the depth overlay (within 15%).
- [ ] **Update rule**: recompute once a minute from local time, and ease changes over about 2 seconds, so toggling the setting never jumps.
- [ ] **Settings and menu**: `dayNight` (default on) in `settings.json` and a "Day/night lighting" checkbox in the menu list (so it is in the tray menu too). Off forces `nightness = 0`.
- [ ] **Not the game clock**: lighting never reads `LocalTankRepository`'s clock. Add a test that changing the dev game clock does not change `nightness`, and that changing the computer's clock changes only the lighting.
- [ ] **Dev panel**: a time-of-day slider and a "play one day in 30 seconds" button.
- [ ] **Night legibility**: at `nightness = 1`, check that fish, pellets, eggs, the fish label and the HUD are all easy to see, and that the three species and stages are still distinguishable.
- [ ] **Measure** against the budgets at day and at night.

Done when: the tank moves smoothly from day to evening to night to morning when the slider or clock changes, nothing jumps, everything stays readable at night, and turning Day/night lighting off returns to daylight.

---

## Step 6 — Art polish, budgets and playtest

Tasks
- [ ] **Art review pass**: Claude Code takes screenshots of each species at each stage, and of the crabs and snails, in day and at night, at 1x and 3x and on a 1080p desktop, and fixes anything that looks off (proportions, tints that clash, edges that look jagged). The owner reviews the screenshots and lists changes. All art stays in `assets/art/`, so changes are cheap.
- [ ] **Budgets**: measure with all effects on and with Reduced effects on, on both machines, with the release build (Task Manager, Activity Monitor and the diagnostics sampler). Write the results in `docs/perf-notes.md`. A missed budget is fixed (fewer layers, lower filter cost) or loosened with a written reason.
- [ ] **Long run**: leave the app open for several hours across the day and night changes; watch memory and CPU for growth (NFR-4).
- [ ] **Release**: tag `v0.2.0-test.1`; the release workflow builds both installers with `npm run dist:test`.
- [ ] **Playtest**: the same testers as Phase 1 (plus any new ones) play the new build for 7 days. Collect "Copy diagnostics" on day 3 and day 7, read the per-day tables into the same spreadsheet as Phase 1, and compare with the Phase 1 numbers. Ask whether it looks better, and whether anything is distracting (flicker, motion that is too busy). Record in `docs/playtest-notes.md`.
- [ ] **Fix list**: triage and fix.

Done when: all exit criteria in section 8 pass.

---

## 6. Testing summary

| Layer | Tool | What | When |
| --- | --- | --- | --- |
| Unit | Vitest | `nightness` curve, lighting independent of the game clock, `layoutDecor` walk paths, `stepCreature`, the existing Phase 1 tests | Every push, both runners |
| E2E smoke | Playwright (Electron) | Reduced effects and Day/night toggles change the scene flags; the Phase 1 smoke test still passes | Every push, both runners |
| Visual | `npm run shot`, manual | Each layer on and off, day and night, 1x and 2x, both systems | End of Steps 2, 3, 4 and 5 |
| Budgets | Diagnostics sampler, Activity Monitor, Task Manager | NFR-1 to NFR-4 with all effects and with Reduced effects, both machines | End of every step |

## 7. Manual test checklist (run on both systems)

- [ ] Ripple and shimmer visible, not nauseating.
- [ ] Light shafts slant from the top, fade with depth and breathe slowly.
- [ ] Moving light patterns on the sand and the tops of rocks and corals.
- [ ] Surface line waves softly.
- [ ] Back decor looks paler and farther away; fish colors are still easy to read; each fish has a shadow that shrinks as it rises.
- [ ] Fish blow 1 to 3 bubbles every 10 to 30 seconds; eating adds tiny bubbles.
- [ ] 1 to 3 snails and 1 to 2 crabs crawl on the sand and over the rocks, rest between moves, and never leave the tank; clicking one makes it react; the same number and kinds after a restart; dropping a pellet near them still works.
- [ ] Day/night: move the slider through a full day; no jumps; readable at night; "Day/night lighting" off gives daylight; changing the computer's clock changes only the lighting, not pellets or growth.
- [ ] Reduced effects on: ripple, moving light and surface wave are gone, bubbles are fewer, shadows and day/night colors stay; the tank still looks good and meets the Phase 1 budgets.
- [ ] Moving between 1x and 2x displays keeps all light layers aligned and sharp (the floor-light mask is rebuilt).
- [ ] Desktop mode at 16:9 and 4K: every effect is in place, the lights span the whole width, and the budgets hold; Reduced effects from the tray menu works.
- [ ] Resize the window small and large: light and mask follow, no seams or gaps.
- [ ] Hidden, minimized and covered: CPU still falls near zero (NFR-1) with all effects on.
- [ ] The Phase 1 checklist (04, section 8) still passes.

## 8. Exit criteria (from the functional spec, section 11)

- [ ] Same look on both systems at 100% to 200% display scaling, with all effects on, in window mode and in desktop mode at 1080p and 4K.
- [ ] The Phase 2 budgets in section 3 are met with all effects on, and the Phase 1 budgets are met with Reduced effects on, on a Mac and on a Windows laptop with integrated graphics.
- [ ] Light visibly reaches the sand and rocks, fish release bubbles, snails and crabs crawl on the sand and rocks, and the lighting changes smoothly from day to night and back (checked by moving the clock).
- [ ] In a playtest of the same kind as Phase 1, the return and time-open results are no worse than in Phase 1, and most testers say the tank looks better.
- [ ] The Phase 2 acceptance criteria (functional spec section 13) pass.

## 9. Risks specific to this phase

| Risk | Early warning | Response |
| --- | --- | --- |
| Ripple too heavy on integrated GPUs, especially over a whole 4K desktop | The Step 1 spike misses the budget | Smaller `filterArea`, lower filter resolution, ripple on the background only, or make the effect optional (Reduced effects) |
| Too many effects feel busy or distracting | Playtesters say it is noisy | Lower the strengths in `visualConfig.js`; remove fish shadows first (L6) |
| Effects push the tank over the Phase 2 budgets | A step's measurement | Remove or simplify the last layer added; cut in the order in L6 |
| Caustic mask misaligned after resize or a display change | Gaps or double edges in screenshots | Rebuild the mask on every resize and on resolution change; add it to the resize checklist |
| Night too dark to read | Step 4 legibility check fails | Raise the night floor of the lighting; limit overlay strength on fish to 15% |
| Crabs or snails end up inside a rock or float off a surface after a resize | Screenshots at several window sizes | Store distance along a path, not x and y; rebuild paths on resize; clamp to the path |
| Filters behave differently on Mac and Windows GPUs | Screenshot differences in Step 1 | Same WebGL backend; test early on both; fall back to sprite-only effects for the affected one |

## 10. Interfaces to keep intact for Phase 3

Same as Phase 1 (04, section 5): the game talks only to `TankRepository`, `shared/rules.js` stays pure, and the save format is unchanged. Phase 2 adds only settings (`reducedEffects`, `dayNight`) and no tank data, so the one-time import in Phase 3 reads the same save file.
