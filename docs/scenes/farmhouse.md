# Scene: Farm house (`farmhouse`)

Status: v0.2, built (PRs 53 to 67). The changes of the evening of 2026-11-27 (DEC-64: a red barn, hay by day only, small things that follow the clock, a blue and white C10 style truck, the horse's home, sun times) are marked "DEC-64" below and are built in their own PRs. The owner's decisions of 2026-11-27 (animals, truck, season menu, porch, fence, flowering trees, lights) are in sections 4.1, 4.2 and 5. The concept picture is `docs/scenes/farmhouse/farmhouse-autumn.svg` (and a PNG preview next to it) (a concept picture of an autumn evening, drawn by a seeded script; it is not the final art). It replaces the "mountain" of the old platform plan. It is the second scene of the first release (version 0.2 with simulated weather and no network; live weather in 0.4) and the first user of the host's time, place and weather services. Platform documents: `../platform/01` to `03`.

## 1. Summary and vibe

A two-floor stone farm house with a full-width front porch (the look of a Georgia farm house) at the foot of a forested mountain, with a white fence and a field in front where seven animals roam, and a red barn at the left edge where they spend the night (DEC-64). It shows the real day: the season of today's date, the weather where the player lives (cloud, rain, sun, fog, snow), and the time of day. It is a view to leave on the desktop, not a game: slow, soft, and worth a glance after a gap ("the fog has lifted", "it is raining there too").

Reference: a photograph the owner supplied (not in the repository, used for composition only; all art is original and drawn for this project, never traced). It shows an autumn hillside covered in thousands of small trees in reds, oranges and yellows with dark green pines, a cap of fog on the top, a stone house with a porch, a dormer and a chimney, trees and rounded bushes around it, a gravel drive, a long dark fence, a bright green field in front, and a pick-up truck at the house.

**Tone:** calm and pretty, like the tank, but it carries no care rules. Nothing can go wrong.

## 2. The player's experience

- **First minute:** a picture of the real time of day in today's season with today's weather. The tray menu says the weather source ("Live weather for Atlanta, GA" or "Simulated weather") and, from 0.4, offers to type the player's city.
- **A normal day:** the sky follows the sun, the windows light at dusk, light smoke rises from the chimney for two minutes at every full hour, the truck drives out and home every quarter hour, the animals graze and wander and go into the red barn at dusk (and come out at dawn), clouds drift, rain falls when it rains at the player's place. The player does nothing.
- **After a gap** (Win+D, the end of a meeting): the scene settles what happened (`resume(gapMs)`): the light and the weather are right at once, the animals are in new places.
- **Over the year:** the forest goes through the seasons day by day, from the fresh green of spring to the reds of October, to bare trees and snow.

## 3. Interaction

- **Desktop mode: none needed.** Clouds and fog drift away from the pointer (the host gives the pointer position in both modes); this stresses the contract with a pointer-aware scene.
- **Tray items (scene items, built from `menuItems()`):**
  - Weather: Live, Simulated, and a preview list (Clear, Cloudy, Fog, Rain, Snow, Storm). A preview lasts for the session and is not saved.
  - Seasons: **Calendar** (the default: the real date) or **Fast** (each real day runs through one month, with simulated weather; section 4.3). This is a setting and is saved.
  - Season preview: Spring, Summer, Autumn, Winter, and "Back to the setting". A preview pins the scene to the middle of that season (rule R2) and is not saved: the next start follows the setting again.
  - **Scatter hay** (decided 2026-11-27): the animals walk to a spot in front of the fence, gather and eat for about a minute, then wander again. No fullness and nothing to manage. After a use there is a **pause of half a minute** before the next one (decided), so it cannot be repeated without end. **By day only** (DEC-64): at night and in a storm the animals are in the barn and the item is greyed ("Scatter hay (the animals are in the barn)").
- **Host settings pages** (from the manifest options; **0.4**, DEC-57: in 0.2 there is no settings page, so the weather and season items above are tray items, and the place is the default one): the place (a **typed city**; with none typed the scene uses "Atlanta, GA" in the background for the weather and the season), "Weather: live or simulated", "Seasons: Calendar or Fast". There is no hemisphere setting: a typed city gives its latitude, and the default place is in the north.
- **Window mode:** the same picture in a window; clicking an animal gives a small reaction (optional).

## 4. Rules and state

There are no game rules. The state is small and mostly derived:

- **Season:** a continuous curve over the day of the year, not four switches. In **Calendar** mode (the default) the day is the real date; in **Fast** mode it is the fast date of section 4.3. `season(date, latitude)` gives a palette position from 0 to 1 and a snow cover amount; the hemisphere is the sign of the latitude of the place (the default place, Atlanta, is in the north). Example (northern hemisphere):

  | About | Look |
  | --- | --- |
  | March | bare branches, first green on the field |
  | April to May | fresh green, blossom on a few trees |
  | June to August | deep green, long light |
  | September | first yellow at the top, the field still green |
  | October | red, orange and yellow canopy at its peak (the photo) |
  | November | leaves falling, brown and bare, dark conifers stand out |
  | December to February | bare, snow cover grows with cold and snowfall |

  The southern hemisphere is shifted by half a year (a typed city south of the equator). Snow cover follows the weather and the temperature as well as the date, so a warm January does not look like a snow field, and snow never appears in July.
- **Weather overlays the season.** From `weather@1`: clear, partly cloudy, cloudy, fog, drizzle, rain, snow, storm. Two numbers set the strength: cloud cover (0 to 1) and precipitation. The type of precipitation follows the temperature. With no live weather (before 0.4, with no network or no consent, or in Fast mode) the weather is **simulated** from the seed, the date and the climate of the month at the place: deterministic, so two machines show the same weather, and it changes a few times a day.
- **Time of day:** always the real clock of the computer, from `host.time`: night, dawn, day, golden hour, dusk. Solar noon comes from the computer's time zone **at its standard (non-daylight-saving) offset**, taken as the smaller of the January and July offsets of the zone (with the current offset, noon would be an hour late all summer), and the length of the day from the latitude of the place and the date, so a player in another time zone with the default place sees their own noon and a day as long as Atlanta's. (Atlanta's sunset on that player's clock would be nonsense, so the place never moves the clock.) **DEC-64:** when the place lies within 15 degrees of longitude of the meridian of the computer's zone (the player is in the place's own region), solar noon also moves by 4 minutes for each degree the place lies west (later) or east (earlier) of that meridian: Atlanta, 9.4 degrees west of the Eastern meridian, gets its sun about 38 minutes later than the plain zone rule gave. Further away the zone's meridian is used, as before.
- **Animals:** seven, in three kinds (two horses, two cows, three sheep), by the rules R6 to R8 below; their positions are not saved. Nothing dies and nothing needs feeding.
- **Record** (`records/farmhouse.json`, `schemaVersion` 1): `lastSeenAt`, the last weather kind shown (so the first frame after a reload does not jump) and, in Fast mode, the moment it was switched on. The animals have no names and no record (decided 2026-11-27); everything else is derived from the clock, the seed and the data.

### 4.1 Rules of the scene

"Owner" means decided on 2026-11-27; "proposal" means the owner can still change it (section 10).

| Id | Rule | Status |
| --- | --- | --- |
| R1 | **Everything follows the real clock** through `host.time` (a scene never reads the clock itself); in Fast mode only the date is the fast one (4.3), the time of day stays real. After a gap the scene is right at once: every item below is a function of the time, not of a timer. | Owner |
| R2 | **Season:** Calendar mode uses the real date and the latitude of the place (the default place is Atlanta, in the north). A tray preview pins the scene to the middle of its season (northern hemisphere: Spring 5 April, Summer 15 July, Autumn 20 October, Winter 15 January; southern: half a year later) and is not saved. The change between days is a smooth curve, never a jump. | Owner (anchor dates proposal) |
| R3 | **Window lights.** The windows are lit when it is dark, and "dark" is not a fixed clock time: it is from sunset (the length of the day from the date and the latitude of the place, solar noon from the computer's time zone) and in a storm or thick fog by day. Each of the six lit windows (three upstairs, two downstairs, the door glass) comes on at its own time in the 20 minutes after sunset, with a fade of about 30 seconds. **Upstairs windows go out between 22:00 and 22:30, downstairs between 23:00 and 23:30; the lamp in the door glass stays on all night.** No light by day in fair weather. A fixed 7 PM would be wrong at both ends of the year (sunset is about 17:30 in December and 20:30 in June). | Owner (accepted 2026-11-27; the exact times can still be tuned) |
| R4 | **Chimney smoke:** light smoke at every exact full hour of the computer's clock (9:00, 10:00 ...) for two minutes (from hh:00:00 to hh:02:00), fading in over about 10 seconds and out over about 20; it bends with the wind. It also shows after a gap if the time is inside the two minutes. **Only in the cool part of the year**: when the temperature at the place (live, or simulated for that day) is 15 °C or lower, so there is rarely smoke in summer. The 15 °C is a number to tune. | Owner (smoke, cool part only) |
| R5 | **The truck** (an old farm truck with a wooden stake bed and a hay bale) is parked at the drive, drives out to the right of the screen and comes home **once every 15 minutes**, and it drives **forward and backward**: it backs out of its place a few metres (nose still to the left), turns (the sprite is mirrored) and drives off forward; it comes back forward from the right, nose to the left, and parks. The trips start at :07, :22, :37 and :52 (not on the hour, so it does not meet the smoke); a trip is about 20 seconds out, 5 minutes away, 20 seconds back; by day only (the truck stays parked at night, and in a storm or deep snow). Its place and direction are a function of the minute of the quarter hour. | Owner (all confirmed 2026-11-27) |
| R6 | **Animals: seven in three kinds:** two horses (one brown, one beige), two cows and three sheep, no more. They have no names and no record. They live **only in the field in front of the fence**, never behind it or on the drive, and inside the safe area; **at night and in a storm they are in the barn (R13), and the count is still seven**. | Owner; DEC-64 for the barn |
| R7 | **Near and far:** an animal moves across the depth of the field as well as left and right. Its size follows its depth, from about half size at the fence to about 1.5 times at the bottom of the screen; animals are drawn back to front. Proposal: they face left or right only (no front or back views), so the depth is crossed on slow diagonal walks. | Owner (depth), proposal (facing) |
| R8 | **Behaviour (DEC-66):** the animals graze (head down), walk and stand, and they are not in step. Each roams a wide zone of the field, left and right, near and far and both at once (diagonally), at a steady pace with a gentle start and stop, and spends most of its time standing or grazing: stops last from a quarter of a minute to about five minutes, and an animal walks about a fifth of the time. The two horses keep to the back and middle of the field and the two cows to the middle and front; one of each kind has the left half and one the right, so two of a kind never meet; a horse, a sheep and a cow that come side by side are kept apart in depth (horses behind sheep behind cows) by a smooth push. The three sheep stay in a loose flock whose centre roams the field slowly, and when it moves every sheep walks. At night they are in the barn (R13). Positions come from the seed and the clock, and nothing is saved. | Owner (DEC-66); DEC-64 for the night |
| R9 | **Weather overlays the season** (section 4): snow never above its temperature and never in July (in Fast mode: never in a summer month); the simulated weather is the same for the same seed, date and place. | Owner |
| R10 | **Flowering trees change with the season** (table 4.2): their blossom, leaves and bare branches follow the date, each species at its own pace. **The dates come from the typed city** (4.2), not from one climate for everyone. | Owner |
| R11 | **The host's rules apply:** the scene is not drawn when the desktop is covered or hidden; the frame rate is the manifest's `fps` hint (15 to start, the host cap is 30), and the truck, the smoke and the animals are interpolated by time, never by frame, so 15 and 30 look the same; nothing in desktop mode takes a click. | Platform |
| R12 | **Scatter hay** (tray item): the animals walk to a spot in front of the fence, gather and eat for about a minute, then wander again; no fullness is kept. The item can be used again half a minute after the last use. **Only by day (DEC-64):** while the animals are going to the barn, in the barn or a storm is on, the item is greyed. | Owner; DEC-64 for "by day" |
| R13 | **The red barn (DEC-64).** A red barn stands at the left edge of the field, with a door facing the viewer. From sunset the animals go in one by one, spread over about 40 minutes (the sheep first, the horses last), each walking to the door and fading out in it; they come out again after sunrise in the same way, and in a storm they go in when the storm builds (the cross-faded wind) and come out when it eases. Nobody is drawn inside; the door shows a dark opening with a warm glow at night, and a lantern by it follows the window rule R3. All of it is a function of the clock and the weather, with no steps (the walk in is continuous, the fade is a ramp). | Owner (DEC-64) |
| R14 | **Fireflies:** a few slow points of warm light over the field on summer evenings, from sunset to about midnight, when the temperature at the place is 18 °C or higher and it is not raining. They fade in and out with the dark. | Owner (DEC-64) |
| R15 | **Rainbow:** a faint rainbow opposite the sun for about ten minutes after rain stops, while the sun is up and low enough to make one. It fades in and out. | Owner (DEC-64) |
| R16 | **Owl:** on clear nights an owl shows at the loft window of the barn for a stretch of about half an hour at a time, at times that come from the seed and the date, with eyes that blink. | Owner (DEC-64) |
| R17 | **Breath puffs:** small soft puffs by the heads of the horses and cows when the temperature at the place is 0 °C or colder and they are in the field. | Owner (DEC-64) |
| R18 | **Weathervane:** a vane on the barn roof that turns with the wind. | Owner (DEC-64) |
| R19 | **Shooting stars:** on clear nights, now and then a short streak across the sky at times that come from the seed (about one an hour; a few an hour on 11 to 13 August, the Perseids). | Owner (DEC-64) |
| R20 | **Seasonal touches, on for everyone, no tray toggle:** pumpkins on the porch from 25 to 31 October and a string of lights along the porch in December (lit when it is dark, like the windows). | Owner (DEC-64) |
| R21 | **The animals walk on four legs of two pieces (DEC-65, DEC-67).** Each leg is an upper and a lower piece that bend at a knee (forward on a fore leg, back on a hind leg). The four legs take turns as in a real walk (near hind, near fore, far hind, far fore); the phase of the walk follows the ground covered, so a foot on the ground stays where it was put and nothing slides; the body is lowered until every foot reaches the ground, so an animal never floats, and each has a soft shadow. One pure module (`game/gait.js`) serves every kind from a rig; a new animal is a new rig and its pictures. | Owner (DEC-65, DEC-67) |

### 4.2 Season items

One table of items for each season. The art is the same, the table gives the tint, the variant and the amount; the day of the year blends two neighbouring seasons. The dates below are for the default place, Atlanta (latitude 33.7 degrees north). **For a typed city (0.4, decided 2026-11-27) they move with the place:** the spring events (blossom, first green) come about 4 days later for each degree of latitude further from the equator than Atlanta and earlier for each degree nearer, the autumn colour the opposite way (a rough rule of thumb, to be tuned by eye and not a climate model), and a city in the southern hemisphere is shifted by half a year. Before 0.4 there is no typed city, so everyone sees the Atlanta dates.

| Group | Spring (March to May) | Summer (June to August) | Autumn (September to November) | Winter (December to February) |
| --- | --- | --- | --- | --- |
| Forest (one dense hill, the pines stay green) | bare to fresh light green, a few white blossoms | deep green | yellow, orange and red at the peak in October, then brown and bare | bare brown-grey; snow on the pines when it snows |
| Field and grass | bright fresh green, small yellow flowers | deep green, golden in a dry spell | green with straw patches | pale and frosted; snow follows the weather |
| **Redbud** | March to April: magenta-pink blossom on bare branches; May: heart-shaped green leaves | green | October: yellow; November: bare | bare |
| **Cherry** (flowering) | late March to April: pink and white blossom, petals falling | dark green with a bronze tint | bronze, then orange-red; bare in November | bare, dark bark |
| **Dogwood** | April: white blossom in flat tiers | green | October to November: deep red leaves and red berries | bare, with small buds |
| **Peach** | March: pink blossom; May: small green fruit | green, a few peaches in July | yellow; bare in November | bare |
| Weather it tends to show | showers, fog in the morning, an occasional storm | clear, hazy heat, afternoon storms | fog, drizzle, grey skies | clear and cold, frost, snow |
| Falling things | blossom petals | none (a few seeds) | leaves | snow, when it snows |
| Porch | pots of pansies | hanging ferns | a pot of mums; pumpkins from 25 to 31 October (R20) | a wreath on the door and a string of lights in December (R20); snow on the roofs |
| Light | soft and fresh | long, bright, golden hour late | low and warm | pale, short days, early lights (R3) |
| Chimney smoke (R4, 15 °C or lower) | on cool days | hardly ever | most days | most days |

### 4.3 Season modes

Decided on 2026-11-27: two modes, set in the tray (0.2) and later on the settings page (0.4).

- **Calendar (the default):** the season is the real date. The weather is live from the provider of 8.1 once 0.4 is out and the player has agreed to the network; before that, or with no network, it is simulated and the menu says "Simulated weather".
- **Fast:** each real day runs through one month, so a year takes twelve days and the nature changes where the player can see it. The weather is always simulated, with the climate of the month that is showing. The fast date moves forward one calendar month per 24 real hours, smoothly (one hour is about 1.25 days). **When the player switches Fast on, that day is January** (decided 2026-11-27): the fast date starts at the first of January at that moment (the moment is kept in the record), the next real day is February, and so on, so a year takes twelve days; switching Fast off and on again starts again from January. The month names are those of the place's own calendar (in a southern city January is summer). The change at the switch is a slow cross-fade of a few seconds, so there is no cut.

Concerns, for the owner to weigh:

1. **Before 0.4 there is no live weather.** In 0.2 and 0.3 the default mode shows simulated weather too; "real weather from an API" is what 0.4 adds. The menu says which one is showing.
2. **Fast mode and live weather do not mix:** a real rainy day in a fast "July" would be wrong, so Fast forces simulated weather (written above).
3. **The forest is one texture drawn from the palette of the day** (section 5, item 3). In Calendar mode it is redrawn at most once a day; in Fast mode the palette moves a month a day, so it needs a redraw about every 15 minutes while the scene is drawing. That is one more texture build every quarter hour, and while it runs the old and the new texture exist together (a peak of about twice 6 to 8 MB in the graphics process that a Mac may not give back at once). **A tint or palette change on the existing texture (a colour matrix, or a second copy tinted and cross-faded) comes first; a rebuild in place (one texture, redrawn) only if the tint looks wrong.** Either way it is measured with 20 switches and an hour of Fast mode on both systems, and a rebuild is done in one frame budget or split over frames (the 30 fps cap).
4. **A day length that moves:** in Fast mode the length of the day (and so the window lights, R3) follows the fast date, so sunset moves by minutes within one real day. That is smooth, and no player will count it; it is stated so that the test does not expect the real sunset.
5. **A month goes by in a day:** the blossom of a species (table 4.2) lasts one to three real days. That is the point of the mode, but the blends must be smooth, never a pop. Because Fast always starts in January, the first picture after switching it on is winter (bare trees, maybe snow); the blossom of March comes after about two real days.

## 5. Look and sound

**Layers, back to front:**

1. Sky: a gradient from the sun's position, stars at night, a moon.
2. Far clouds and the **fog bank**: slow, wide, soft sprites; low cloud lowers the fog over the mountain top (the photo is this case).
3. The **mountain, in three layers** (decided 2026-11-27): a far ridge (almost the colour of the fog, a few tiny pines), a mid ridge (small faded trees) and the near **forest hill**, a silhouette with a noisy ridge filled with thousands of tree shapes in seeded positions: each a tall crown on a trunk (not a low blob, so the forest has height), coloured by the season palette with variation, with dark pines that stay green all year and are **shorter than the tallest leafy trees**. The near hill is drawn **once** to one texture at the resolution cap (about 6 to 8 MB); the mid ridge at half and the far ridge at a quarter of that resolution (about 2 MB and 0.5 MB, since they sit in the fog). They are drawn again only when the day's palette has moved enough (in Calendar mode at most once a day while the scene is drawing; in Fast mode about every 15 minutes, 4.3). No art per season.
4. The mid hill, bushes, and **four flowering trees** in front of the house: redbud, cherry, dogwood and peach, chosen so that blossom, leaf colour and bare branches show the season (table 4.2). A small atlas, with the seasonal variants drawn or tinted.
5. The **house**: two floors of stone, three windows upstairs and two downstairs with shutters, a **full-width front porch** with white columns and rail (a Georgia farm house), a tin roof, a chimney with light smoke at the full hours (R4, bent by the wind), windows that light at dusk (R3). No dormer.
6. The drive and the **farm truck** (DEC-64: a late-1970s Chevrolet C10 style step-side pick-up, blue and white, drawn here from scratch with no badge and no lettering; it replaces the faded blue-green stake truck), which drives out and home every quarter hour, forward and backward (R5).
6b. The **red barn** at the left edge of the field (DEC-64, R13): a red board barn with white trim, a hayloft window, a roof with a weathervane (R18) and a wide door; the animals go in at night. Drawn once as a picture like the house.
7. The **field**: grass colour from the season (green, golden, frosted, snow), darker and wetter in rain, with puddles.
8. The **fence**: white painted rails and posts, between the drive and the field.
9. **Animals**, in the field in front of the fence by day and at the barn door when they go in or come out: seven in three kinds (rules R6 to R8, R12 and R13), scaled by depth and drawn back to front. Their breath shows when it is freezing (R17).
10. Weather and small things: fireflies, a rainbow, an owl and shooting stars (R14 to R16 and R19) are a few capped particles or sprites on top of the sky and field. Rain and snow as a capped number of particles, a mist layer near the ground, a faint lightning dim (no flash: a short darkening, never a bright flash), light from the sun through clouds.
11. A grade over everything: sun colour, dusk, night, storm.

**Art:** the forest, sky, clouds, weather and the fence are procedural (code); the house, the truck, the animals, the flowering trees and the bushes are small hand-made or SVG sprites in an atlas (about 4 MB at the drawing size). The style guide is the project's (`STYLE.md` of the tank, extended): soft, flat colours, no outlines. All original.

**Sound:** none in v1. A soft rain sound only after a player action is not planned.

## 6. What it needs from the platform

| Need | Why |
| --- | --- |
| Capabilities | `data: ["weather@1"]`, `place: "coarse"`; **no `net`** (the host's weather connector does the request, so the scene declares no host) |
| `host.time` | the real clock, the season curve, sun position, `nightness` (first user; shared with the desk) |
| `host.place` | the typed city (default "Atlanta, GA"): latitude, the climate for simulated weather, the length of the day |
| `host.data` (`weather@1`) | live weather, with `updatedAt` and `source` |
| `host.safeArea` | the house and the animals stay out of the icon column and the Dock |
| `pointer(x, y)` | clouds and fog drift from the pointer |
| `resume(gapMs)` | settle after a gap |
| `fps` in the manifest | ask for 15 and measure (12 to 20); clouds, grass and a few walking animals read fine at a low rate [owner: it does not need many frames] |
| Options | weather mode, season mode (Calendar or Fast) and the previews, the place (a typed city), Scatter hay |

First-user cost: this scene is why `host.time`, `host.place` and `host.data` exist, and it is the first scene to need the network module and the consent dialog (document 2).

## 7. Budget and performance

- Target: at most 30 MB over the empty host. The room measured later (`platform/05`, footprint) is **about 50 MB on the Mac and about 40 MB on Windows** (the tank itself costs about 36 MB over the empty host on the Mac), so 30 MB is not a given for a 5.8 MB forest texture (7.7 MB with mipmaps), two ridges, seven animals and an atlas: **before the art is drawn in earnest, `npm run measure:switch` is run on a stub scene that only allocates the forest textures** (P2 plan, step S4). The near forest texture is 5.8 MB at 1600 x 900 (7.7 MB with mipmaps), the two far ridges about 2.5 MB together; overlays are small; the atlas about 4 MB (about 15 MB of the 30 in all).
- A full-screen scene redraws many pixels. Everything static is one texture; only sprites move; clouds drift slowly; the frame-rate hint is 15 to start (10 with reduced motion); the GPU and battery are measured on an integrated GPU at 4K as well as the CPU.
- Weather refresh: done by the host, once an hour while the computer is awake and the farm house (a weather scene) is active, and each request carries the next 24 hours, so a missed request never freezes the sky (document 2, section 11). The scene gets "the weather now" and `updatedAt`; by default the covered scene is not drawn at all (document 1, section 7.1).
- Measure on both systems before the look is polished; if it does not fit, the answer is less art, not a higher limit.

## 8. Offline behaviour and privacy

- With no network, no consent, or in Fast mode, the weather is simulated from the seed, the date and the month's climate, and the menu says "Simulated weather". The default place ("Atlanta, GA") is used when no city is typed, and the weather is simulated for it until the player agrees to the network (0.4).
- With consent: rounded coordinates (0.1 degree) go to the weather provider once an hour while the farm house is active; nothing else leaves the machine. With no city typed, the request is for the coordinates of Atlanta, not of the player, but it is still a request from the player's computer, so the consent applies. The place is a typed city, the most private way.
- The scene never sees the IP address or the exact place. The provider, like any web server, sees the player's IP address; the consent text says so.

### 8.1 Weather provider (a proposal; the owner reads the terms before 0.4)

Looked up on 2026-11-27 on the providers' own pages. Terms change, so they are read again before 0.4; the MET Norway terms were revised on 5 November 2026.

| Provider | Coverage and key | Terms | Fit |
| --- | --- | --- | --- |
| **Open-Meteo** | the whole world; hourly forecast with weather code, cloud cover, precipitation and temperature; **a city search (geocoding) API too**; no key, no sign-up | free for **non-commercial use** under 10,000 calls a day, 5,000 an hour and 600 a minute; data under CC BY 4.0 (the player-facing credit "Weather data by Open-Meteo.com" is needed); commercial use needs a paid plan | **Best:** one provider for the forecast and for the typed city; a player's one request an hour is far below the limits (each player calls from their own address). The project is free and MIT, which fits "non-commercial"; selling the app or showing ads would not |
| **MET Norway** (Locationforecast) | the whole world; no key; no city search | free under CC BY 4.0 (credit needed); whether commercial use and acceptance of the terms are allowed as stated is **checked on the licence page before 0.4**; **every request must carry a User-Agent that names the app (or its domain) and a contact, an email or a website link** (a missing or generic one is throttled with 429; 403 is for coordinates with more than 4 decimals); under 20 requests a second, `Expires` and `If-Modified-Since` honoured, https and gzip; browsers are told to use a proxy (the main process is that proxy); the name "Yr" may not be used in the app | **Fallback:** the contact in the User-Agent must be the project's own (its GitHub project address qualifies as a website link), never a personal address; the city search would come from elsewhere |
| **National Weather Service** (`api.weather.gov`) | the United States only; no key; a User-Agent is required; an API key is planned | open data, free for any use | **Not enough alone** (US only), though right for the default place |

Recommendation: **Open-Meteo**, behind the host's `weather@1` connector (document 2, section 11), so that moving to MET Norway later is a change of the connector and not of the scene. The request is made by the main process. The weather codes of the provider map to the kinds of `weather@1`.

## 9. Tests

- Golden state hash: with the seed and the manual clock at fixed dates (one per season) and fixed weather, the state and the scene graph hash.
- A season test: 365 days of palette values change smoothly (no jumps above a threshold) and the southern hemisphere is the same curve shifted by half a year; in Fast mode the fast date moves one month per 24 hours without a jump, also across a gap.
- Rule tests (4.1), all with the manual clock: the lights come on after sunset and go out at the times of R3 (also in December and June); the smoke shows from hh:00:00 to hh:02:00 and not outside; the truck is at the same place for the same minute and does not move at night; the animals are always in the field in front of the fence or in the barn, there are always seven, and nobody pops in or out (DEC-64); the barn, the fireflies, the rainbow, the owl, the breath, the weathervane, the shooting stars and the porch touches show exactly when their rules say.
- A weather test: every `weather@1` kind draws; snow is never chosen above a temperature; the simulated weather is the same for the same seed, date and place.
- The contract test (including `resume(gapMs)` after an hour) and the capability test (no data: it draws simulated weather).
- Dev kit: a time slider for day and season, a weather picker.
- Hand checks: dusk lights, fog on the mountain top, rain on both systems; the scene next to desktop icons on Windows (left) and the Mac (right).

## 10. Open questions

Answered on 2026-11-27 (kept here so the reasons stay):

1. **"Each day is a season":** two modes, Calendar (the default, the real date and, from 0.4, real weather from an API) and Fast (one real day = one month, simulated weather). Concerns are in 4.3.
2. **Animals:** seven in three kinds (two horses, brown and beige; two cows; three sheep), and a tray item **Scatter hay** (R12).
3. **Place:** a typed city; with none typed, "Atlanta, GA" is used in the background for the weather and the season. In 0.2 there is no settings page, so the place is the default one until 0.4 (DEC-57). The time of day follows the computer's clock and time zone, never the place (section 4).
4. **Truck:** it moves, out and home every 15 minutes, forward and backward (R5).
5. **Mountain:** three layers (section 5, item 3).
6. **Names:** no names for the animals and no record of them.
8. **Chimney smoke:** only in the cool part of the year (R4: 15 °C or lower).
9. **Truck:** the stagger (:07, :22, :37, :52), the length of a trip and daylight only are all confirmed, and "forward and backward" is read right: it backs out, turns, drives off forward and comes home forward (R5).
10. **Window lights:** from the rule R3 (dusk, not 7 PM), with the off times in the rule.
11. **Flowering trees:** the dates come from the typed city (table 4.2), with Atlanta's dates as the default.
12. **Fast mode:** the day the player switches it on is January (4.3).
13. **Scatter hay:** a pause of half a minute between two uses (R12).
14. **The barn, hay by day, the small things and the seasonal touches** (DEC-64, 2026-11-27 evening): R13 to R20 above; the porch touches are on for everyone with no toggle; no spring foal or lamb (it would break R6).

Still open:

7. **The weather provider:** a proposal is in 8.1 (Open-Meteo, MET Norway as the fallback); the owner reads the terms and decides before 0.4. Nothing in 0.2 or 0.3 waits for it.
