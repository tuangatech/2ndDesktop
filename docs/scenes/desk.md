# Scene: Desk (`desk`)

Status: Draft v0.1, 2026-11-23. A proposal from the owner, not built, **not scheduled** (it needs data kinds, connectors and secrets, which wait for demand; `../platform/03`, section 6.1). It is the scene that shows data from other places (tasks, schedules) and the first to use data kinds, connectors and secrets. Platform documents: `../platform/01` to `03`. The owner prefers the name "desk" to "office" and "study".

## 1. Summary and vibe

A cozy corner of a desk in front of a window, drawn as a side-view cutaway in the style of the tank. Outside the window is a tree that follows the real season, the real weather and the real time of day. A lamp turns on at dusk, rain runs down the glass, a mug steams, a plant grows over real days, and the laptop screen shows the next three things the player has to do. It is a place, not a dashboard: the information is a part of the picture and nothing in it demands attention.

**Tone:** cozy and quiet. It is a tool scene, so it may show information, but it never alarms: no red, no counters of overdue items, no sound, no notification (platform politeness rules).

## 2. The player's experience

- **First minute:** a desk at the current time of day. The laptop says "Nothing planned" and the tray menu offers "Choose where tasks come from...".
- **A normal day:** morning light through the window; the laptop lists up to three tasks; at dusk the lamp turns on and warms the desk; when it rains outside, streaks run down the glass; the tree shows the season.
- **Using it:** the player adds a task from the tray ("Add task...", a small host dialog) or the tasks come from a source the player set up (a file, a calendar link, a service). The player looks at the desktop (Win+D) and sees the next three tasks in a calm picture.

## 3. Interaction

- **Desktop mode: read-only.** The scene takes no clicks. Everything else is in the tray menu.
- **Tray items:**
  - Add task... (a host dialog, one line; adds to the local task file).
  - Choose where tasks come from... (opens the host's "Data sources" settings).
  - Hide task text (a toggle): the laptop shows blank lines instead of text.
  - Lamp: Auto, On, Off.
  - Show next event (a toggle, if an `events@1` source exists).
- **Window mode:** the same picture; clicking the lamp toggles it; clicking a task line marks it done in the local file (for local tasks only; other sources are read-only).
- **Safe area:** desktop icons sit on the left on Windows and on the right on the Mac. The laptop and its text are placed on the opposite side of the icon strip (`host.safeArea` says which), and nothing important sits under the taskbar, menu bar or Dock.

## 4. Rules and state

- **Tasks** (`tasks@1`): the scene shows up to three items that are not done, ordered by due date, then priority. If there are none, the laptop shows "All done" with a small check. If a source has no data yet or is old, the laptop shows the last data with its age ("updated 2 h ago").
- **Events** (`events@1`, optional): one line with the next event ("Standup, 10:30").
- **Calm rules for the screen:** no red; an item due today may have a small mark; overdue items look the same as the others; no counts of what is overdue.
- **Weather and season outside the window** come from the same shared sky and weather code as the farm house (`shared/` library, bundled into each scene; scenes do not import each other).
- **The lamp** turns on when the sun is below the horizon plus a little (from `host.time`), off at dawn (Auto).
- **The plant** grows over real days: five stages over about 60 days, from the date stored in the record. At the last stage it stays and blooms with the season. Nothing dies.
- **Time** comes only from `host.clock`; the plant, the lamp and the light are functions of it.
- **Record** (`records/desk.json`, `schemaVersion` 1): `plantStart`, the options (hide text, lamp mode, show event), and the local tasks (a list of `{ id, title, done, due? }`, at most 200). Task text from a service is **not** saved in the record; the host caches it, and the cache is removed with the source.

## 5. Look and sound

**Layers, back to front:** the sky and weather outside, the tree outside (drawn procedurally, with leaf colour by the season curve, bare in winter, snow on the sill), the window frame and glass (rain streaks, frost in the corners, fog as a grey tint), the wall and shelf, a curtain that moves a little, the desk, then the laptop, the lamp (with a warm additive glow), the mug (steam), the plant, and a small clock or a calendar on the wall (optional). A final grade for dusk and night.

**Laptop screen:** drawn text at a size that stays readable at the drawing cap (the laptop takes at least 18% of the width; the text is rendered at twice its size and scaled, and checked on a 4K display). The font is an OFL font from the project (Nunito).

**Motion** is slow: a cursor blink at 1 Hz, steam, a few raindrop streaks, a curtain sway. The scene asks for a low frame rate (10 to start).

**Art:** about 25 hand-made or SVG sprites (desk, laptop, lamp, mug, plant in five stages, shelf, window frame, curtain, a book, a small clock) in one atlas of at most 6 MB at the drawing size; the tree, sky, rain and light are procedural. Style: flat soft colours, consistent with the tank. The art style of a side-view cutaway is easier to keep consistent than a perspective room, which is why it is chosen.

**Sound:** none.

## 6. What it needs from the platform

| Need | Why |
| --- | --- |
| Capabilities | `data: ["tasks@1", "events@1", "weather@1"]`, `place: "coarse"`, `ui: ["prompt"]`. **No `net`**: the exfiltration rule forbids a free network host together with private data kinds |
| `host.data` | tasks, events, weather |
| `host.time`, `host.place` | the lamp, the season, the light |
| `host.ui.prompt` | "Add task..." (the tray cannot take text) |
| `host.safeArea` | the side of the icons, the taskbar and the Dock |
| Data sources (document 2, section 6) | a local file connector (default), an ICS URL connector, later services |
| Secrets | only for the services that need a token, held by the host |
| `resume(gapMs)` | after a gap: the lamp and the light are right at once, the plant grows |
| `fps` | 10 |
| Options | hide text, lamp mode, show event |

Contributors will extend this scene's **sources**, not the scene: a connector for a tool they use (an issue tracker, a to-do service, a calendar) gives the same `tasks@1`, and every task-showing scene gets it.

## 7. Budget and performance

- Target: at most 35 MB over the empty host (the atlas up to 6 MB, the procedural layers a few MB, the text textures small). Few moving things at a low frame rate keep the CPU and the GPU low; it is the cheapest of the three scenes to draw.
- Data refresh: tasks every 5 to 15 minutes while drawing, none on battery saver, at most once on resume (the host's rules).

## 8. Offline behaviour and privacy

- Offline: the local task file works with no network; weather is simulated; a cached answer from a service is shown with its age.
- **Privacy matters most in this scene.** The text on the laptop can be seen by anyone who sees the screen (a meeting, a recording). "Hide task text" is one tray click away. Task text and event titles are never written to the log, the diagnostics or the record; tokens are never given to the scene (the host adds them); the scene has no network at all.
- The scene's `DESIGN.md` and the store page say, in one line: "Shows your tasks on the desktop. Your task text stays on this computer."

## 9. Tests

- Golden state hash with a fixed clock and fake `tasks@1` data.
- Tasks: 0, 1, 3, 50 items; a 200-character title is trimmed; control characters are removed (by the host); overdue items look the same as the others.
- The lamp turns on and off at the right times at several places and dates; the plant stages at day 0, 10, 30, 60.
- The text is readable at 1600 x 900 and on a 4K display (a screenshot check).
- The contract test, the capability test (no data: "Nothing planned") and a privacy test (with "hide text" on, no task text is drawn anywhere).
- Dev kit: fake tasks, a time slider, a weather picker.

## 10. Open questions

1. Local file first, or straight to a service? (Local first is recommended: it works offline and needs no secrets.)
2. Which service connectors first, and which format for the local file (Markdown checkboxes: `- [ ] write report`)?
3. A cat, a window seat, other small life? (One animal on the sill is cheap and lovely; the owner decides.)
4. Does the plant ever reset, or choose a species?
5. A second laptop-screen mode: a clock only, for people who want no text at all?
6. Where is the line between a cozy desk and a dashboard? A dashboard scene (many widgets, a work wallpaper) may be a separate scene made by contributors.
