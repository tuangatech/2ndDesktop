# Scene: Farm house (`farmhouse`)

Status: Draft v0.1, 2026-11-23. A proposal from the owner, not built. It replaces the "mountain" of the old platform plan. It is the second scene of the first release (version 0.2 with simulated weather and no network; live weather in 0.4) and the first user of the host's time, place and weather services. Platform documents: `../platform/01` to `03`.

## 1. Summary and vibe

A stone farm house at the foot of a forested mountain, with a fence and a field in front where animals roam. It shows the real day: the season of today's date, the weather where the player lives (cloud, rain, sun, fog, snow), and the time of day. It is a view to leave on the desktop, not a game: slow, soft, and worth a glance after a gap ("the fog has lifted", "it is raining there too").

Reference: a photograph the owner supplied (not in the repository, used for composition only; all art is original and drawn for this project, never traced). It shows an autumn hillside covered in thousands of small trees in reds, oranges and yellows with dark green pines, a cap of fog on the top, a stone house with a porch, a dormer and a chimney, trees and rounded bushes around it, a gravel drive, a long dark fence, a bright green field in front, and a pick-up truck at the house.

**Tone:** calm and pretty, like the tank, but it carries no care rules. Nothing can go wrong.

## 2. The player's experience

- **First minute:** a morning picture in today's season with today's weather. The tray menu says the weather source ("Live weather for Hanoi" or "Simulated weather") and offers to set the place.
- **A normal day:** the sky follows the sun, the windows light at dusk, smoke rises from the chimney when it is cold, the animals graze and wander, clouds drift, rain falls when it rains at the player's place. The player does nothing.
- **After a gap** (Win+D, the end of a meeting): the scene settles what happened (`resume(gapMs)`): the light and the weather are right at once, the animals are in new places.
- **Over the year:** the forest goes through the seasons day by day, from the fresh green of spring to the reds of October, to bare trees and snow.

## 3. Interaction

- **Desktop mode: none needed.** Clouds and fog drift away from the pointer (the host gives the pointer position in both modes); this stresses the contract with a pointer-aware scene.
- **Tray items (scene items, built from `menuItems()`):**
  - Weather: Live, Simulated, and a preview list (Clear, Cloudy, Fog, Rain, Snow, Storm). A preview lasts for the session and is not saved.
  - Season: Auto, or a preview of a month. Not saved.
  - Optional, the owner decides: "Scatter hay", a small daily visit like feeding the fish, which makes the animals gather for a minute. It has no rules and no consequence.
- **Host settings pages** (from the manifest options; **0.4**, DEC-57: in 0.2 there is no settings page, so the weather and season previews are the tray items above and the hemisphere comes from the time zone): the place (a typed city, the time zone, or an IP lookup), the hemisphere (Auto from the place, or North, South), "Weather: live or simulated".
- **Window mode:** the same picture in a window; clicking an animal gives a small reaction (optional).

## 4. Rules and state

There are no game rules. The state is small and mostly derived:

- **Season:** a continuous curve over the day of the year, not four switches (owner's reading of "each day is a season"; see the open questions). `season(date, hemisphere)` gives a palette position from 0 to 1 and a snow cover amount. Example (northern hemisphere):

  | About | Look |
  | --- | --- |
  | March | bare branches, first green on the field |
  | April to May | fresh green, blossom on a few trees |
  | June to August | deep green, long light |
  | September | first yellow at the top, the field still green |
  | October | red, orange and yellow canopy at its peak (the photo) |
  | November | leaves falling, brown and bare, dark conifers stand out |
  | December to February | bare, snow cover grows with cold and snowfall |

  The southern hemisphere is shifted by half a year (from the sign of the latitude of the place, or the setting). Snow cover follows the weather and the temperature as well as the date, so a warm January does not look like a snow field, and snow never appears in July.
- **Weather overlays the season.** From `weather@1`: clear, partly cloudy, cloudy, fog, drizzle, rain, snow, storm. Two numbers set the strength: cloud cover (0 to 1) and precipitation. The type of precipitation follows the temperature. With no live weather, the weather is **simulated** from the seed, the date and the climate of the month at the place: deterministic, so two machines show the same weather, and it changes a few times a day.
- **Time of day:** from `host.time` (sunrise and sunset from the date and the place, or a rough default from the time zone): night, dawn, day, golden hour, dusk.
- **Animals:** wander, graze, and sleep by simple rules; their positions are not saved. Nothing dies and nothing needs feeding.
- **Record** (`records/farmhouse.json`, `schemaVersion` 1): `lastSeenAt`, the animals (kind, seed, a name if the owner wants names), and the last weather kind shown (so the first frame after a reload does not jump). Everything else is derived from the clock, the seed and the data.

## 5. Look and sound

**Layers, back to front:**

1. Sky: a gradient from the sun's position, stars at night, a moon.
2. Far clouds and the **fog bank**: slow, wide, soft sprites; low cloud lowers the fog over the mountain top (the photo is this case).
3. The **mountain forest**: a hill silhouette with a noisy ridge, filled with thousands of small tree shapes in seeded positions, coloured by the season palette with variation, with a few dark pines that stay green all year. It is drawn **once** to one texture at the resolution cap (about 6 to 8 MB), and drawn again only when the day's palette has moved enough (at most once a day while the scene is drawing). No art per season.
4. The mid hill, bushes and the house's trees (a small atlas, with a few seasonal variants chosen by tint).
5. The **house**: stone walls, porch, dormer, chimney with smoke (bent by the wind), windows that light at dusk.
6. The drive and the truck (still).
7. The **field**: grass colour from the season (green, golden, frosted, snow), darker and wetter in rain, with puddles.
8. The **fence**: dark rails in front of the field.
9. **Animals** behind and in front of the fence: two kinds (for example horses and sheep; the owner chooses), three to five in all.
10. Weather: rain and snow as a capped number of particles, a mist layer near the ground, a faint lightning dim (no flash: a short darkening, never a bright flash), light from the sun through clouds.
11. A grade over everything: sun colour, dusk, night, storm.

**Art:** the forest, sky, clouds, weather and the fence are procedural (code); the house, the truck, the animals and the bushes are small hand-made or SVG sprites in an atlas (about 4 MB at the drawing size). The style guide is the project's (`STYLE.md` of the tank, extended): soft, flat colours, no outlines. All original.

**Sound:** none in v1. A soft rain sound only after a player action is not planned.

## 6. What it needs from the platform

| Need | Why |
| --- | --- |
| Capabilities | `data: ["weather@1"]`, `place: "coarse"`; **no `net`** (the host's weather connector does the request, so the scene declares no host) |
| `host.time` | the season curve, sun position, `nightness` (first user; shared with the desk) |
| `host.place` | hemisphere, the climate for simulated weather, sunrise and sunset |
| `host.data` (`weather@1`) | live weather, with `updatedAt` and `source` |
| `host.safeArea` | the house and the animals stay out of the icon column and the Dock |
| `pointer(x, y)` | clouds and fog drift from the pointer |
| `resume(gapMs)` | settle after a gap |
| `fps` in the manifest | ask for 15 and measure (12 to 20); clouds, grass and a few walking animals read fine at a low rate [owner: it does not need many frames] |
| Options | weather mode, season preview, hemisphere, optional hay |

First-user cost: this scene is why `host.time`, `host.place` and `host.data` exist, and it is the first scene to need the network module and the consent dialog (document 2).

## 7. Budget and performance

- Target: at most 30 MB over the empty host (Windows desktop mode allows about 54 MB for a second scene; the Mac about 88 MB). The forest texture is 5.8 MB at 1600 x 900 (7.7 MB with mipmaps); overlays are small; the atlas about 4 MB.
- A full-screen scene redraws many pixels. Everything static is one texture; only sprites move; clouds drift slowly; the frame-rate hint is 15 to start (10 with reduced motion); the GPU and battery are measured on an integrated GPU at 4K as well as the CPU.
- Weather refresh: done by the host, once an hour while the computer is awake and the farm house (a weather scene) is active, and each request carries the next 24 hours, so a missed request never freezes the sky (document 2, section 11). The scene gets "the weather now" and `updatedAt`; by default the covered scene is not drawn at all (document 1, section 7.1).
- Measure on both systems before the look is polished; if it does not fit, the answer is less art, not a higher limit.

## 8. Offline behaviour and privacy

- With no network, no consent, or no place, the weather is simulated from the seed, the date and the month's climate, and the menu says "Simulated weather".
- With consent: rounded coordinates (0.1 degree) go to the weather provider once an hour while the farm house is active; nothing else leaves the machine. The player chooses how the place is known (a typed city is the most private).
- The scene never sees the IP address or the exact place.

## 9. Tests

- Golden state hash: with the seed and the manual clock at fixed dates (one per season) and fixed weather, the state and the scene graph hash.
- A season test: 365 days of palette values change smoothly (no jumps above a threshold) and the southern hemisphere is the same curve shifted by half a year.
- A weather test: every `weather@1` kind draws; snow is never chosen above a temperature; the simulated weather is the same for the same seed, date and place.
- The contract test (including `resume(gapMs)` after an hour) and the capability test (no data: it draws simulated weather).
- Dev kit: a time slider for day and season, a weather picker.
- Hand checks: dusk lights, fog on the mountain top, rain on both systems; the scene next to desktop icons on Windows (left) and the Mac (right).

## 10. Open questions

1. **"Each day is a season":** a continuous curve over the day of the year (assumed here), or a time-lapse where one real day runs through the seasons?
2. Which animals, how many, and is there a daily "Scatter hay" visit or none?
3. Place: a typed city, the time zone, or an IP lookup? Which is the default?
4. Should the truck move (leave and return) or stay?
5. Two or three layers of mountain, or the one dense hill of the photo? (The one hill is cheaper and truer to the photo.)
6. Does the scene need names for the animals or a record of them?
7. The weather provider and its terms.
