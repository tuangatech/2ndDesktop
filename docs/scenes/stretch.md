# Scene: Stretch (`stretch`)

Status: Draft v0.4, 2026-11-23. A proposal from the owner, not built, **deferred to version 1.1** (owner, 2026-11-23: not part of 1.0; if it is complicated it waits). A guided stretch break at the desk: a small always-on-top window with a drawn instructor in the middle, a counter, a timer ring and the name of the next exercise, in short workouts of 2 to 3 minutes. It is the first scene that is **not a wallpaper**: it runs only when the player starts it. Platform documents: `../platform/01` to `05`; the template is `../platform/01`, appendix A.

v0.3 records the owner's decisions (approach A, no desktop mode, loop until closed, the words, the order: after the desk, through the catalog) and the Mac's Re W-26. v0.2 changed v0.1: the screen layout follows the owner's sample picture (a follow-along workout video); the unit of time is an **interval** of 20 seconds; every interval shows the instructor from the front and then from the side; the player can pick a whole workout or one exercise; the words are fixed (the table below); the Mac's reply W-25 is applied (section 6).

## The words

The owner's draft used "set" for the counter ("6/16"). A **set** in fitness is a group of repetitions, and this scene does not count repetitions, so the exact word for one timed block is **interval**. One vocabulary, used in the tray, the window, the data files, the code and the tests:

| Word | Means | Example |
| --- | --- | --- |
| **workout** | the whole thing the player starts: a list of intervals | "Quick reset", 6 intervals, 2 minutes |
| **exercise** | one named movement, with its poses | "Neck tilt" |
| **interval** | one timed block of one exercise; 20 seconds in the first workouts | "interval 3 of 6" |
| **side** | left or right; a one-sided exercise takes two intervals, one for each side | "Neck tilt, left" |
| **round** | one pass through the exercises of a workout, when a workout repeats them | "round 2" |
| **view** | how the instructor is seen: `front` or `profile` (the player reads "front view" and "side view"; the code value is `profile` so it never clashes with the `side` of an exercise) | front for the first half, profile for the second |
| **instructor** | the drawn person in the middle | |
| **counter** | the "3/6" at the bottom left | |
| **timer ring** | the circle that fills with the time elapsed in the interval; in the last 3 seconds it shows the countdown number | |
| **up next** | the banner in the middle at the bottom that names the next exercise in the last 3 seconds | "UP NEXT… Neck tilt" |
| **get ready** | the 3 seconds before the first interval | |
| **loop** | repeat one chosen exercise until the player closes the window | |

Why not the other words: "routine" suggests a daily habit, and this app has no streaks; "session" is the platform's word for a scene the player starts (section 6); "rep" and "set" count repetitions, which we never do; "program" is a plan over weeks. The words to **avoid in any text the player sees**: fix, cure, relieve, correct, posture, therapy, treatment, pain, "good for". The text says what to do and for how long, not what it does to the body.

## 1. Summary and vibe

Press "Start" in the tray and pick a workout. A small window opens in front of everything: the instructor stands in the middle and does the first exercise while a ring fills. For the first half of the interval the instructor is seen from the front, for the second half from the side. In the last 3 seconds a countdown runs inside the ring and the next exercise is named in the middle. A first workout is 6 intervals of 20 seconds (2 minutes) made from 3 or 4 exercises; later ones can be 3 minutes. When it ends the window closes and the previous scene is on the desktop again.

**Tone:** gentle and plain. No streaks, no scores, no "you missed a day", no reminders (owner: none). The scene never promises a result. It says what to do and for how long.

**One line of care, not a lecture** (owner: do not be too serious about it): the first time the window opens it says "Go gently. If something feels wrong, stop." and the About text says the exercises are general and not medical advice. That is all.

## 2. The player's experience

- **First minute:** the tray menu has "Start a workout" (a list of workouts) and "Loop an exercise" (a list of exercises). The player picks "Quick reset (2 min)". The window opens in front, always on top, near the bottom right of the main display, with the instructor in a ready pose and a 3-second "Get ready". The first-run line is shown once under the instructor.
- **A normal break:** one click in the tray. Interval 1 of 6: the instructor does the exercise, seen from the front for 10 seconds and from the side for 10 seconds; the timer ring fills; at 17 seconds the countdown 3, 2, 1 shows in the ring and "UP NEXT… <exercise>" appears in the middle; at 20 seconds the next interval starts with no pause. A one-line cue sits under the instructor ("Tilt your head toward your left shoulder"). Sound is off by default.
- **Choosing one exercise:** "Loop an exercise" opens the window with that exercise on repeat (alternating sides if it has two), with the ring running and the counter hidden. It stays until the player closes it; nothing ends it. This is the owner's "choose which exercise to show".
- **Control:** a small bar of Pause, Skip, Back and Close shows when the mouse is over the window and fades after 3 seconds; keys Space, right arrow, left arrow, Esc. Close at any time ends the workout; nothing is lost or counted against the player.
- **The end:** "Done" shows for 2 seconds, the window closes, focus goes back (section 6) and the earlier scene returns.

## 3. Interaction

- **Window mode only; always on top** (owner: window on top is the default). The owner's phrase "show on desktop" is read as "on the screen". A stretch on the wallpaper behind the windows would be covered at work and never seen (document 1, section 7.1), so there is no desktop mode (decided, open question 3). On macOS "always on top" stays below full-screen apps, so a break during a full-screen video call is not interrupted.
- **Layout** (from the owner's sample; the picture is a layout reference only and nothing of it is copied):

  ```
  +--------------------------------------------------+
  |                                                  |
  |                                                  |
  |                  the instructor                  |
  |                  (in the middle,                 |
  |                   about 70% of the height)       |
  |                                                  |
  |  3/6                                             |
  |  (ring)          UP NEXT...   (last 3 seconds)   |
  |                  NECK TILT                       |
  +--------------------------------------------------+
  ```

  Counter bottom left, the timer ring below it, the up-next banner bottom centre, the cue under the instructor, the control bar at the top when the mouse is over the window. The window is landscape, 16:10 like the sample.
- **Timer ring:** a full circle is one interval (20 s); the filled part is the time elapsed; in the last 3 seconds the number 3, 2, 1 shows in the middle of the ring. The ring is a vector shape; the counter, the number, the banner and the cue are HTML text in `host.ui` (crisp; document 1, section 6).
- **Tray (host items, from the manifest, because the scene is not loaded yet):** "Start a workout" and "Loop an exercise", each with its list. When Stretch is the active scene the tray shows its scene items: the status line, Pause, Skip, Stop.
- **Status line** (a passive line, not a reminder; decided, open question 10): "Done today at 14:10" after a workout that day, and **nothing on every other day** (never "3 days ago"). Stretch is not loaded when the menu opens, so the host shows a line the scene handed it when the workout ended, only if its day is today (section 6, the new `host.statusLine`). Nothing pops up, ever.
- **No clicks in the instructor.** It is an illustration, not a toy.

## 4. Rules and state

**A workout and an exercise are data**, not code (this is also what lets contributors add them later without writing JavaScript):

```json
{ "id": "quick-reset", "name": "Quick reset", "intervalSeconds": 20,
  "intervals": [
    { "exercise": "neck-tilt", "side": "left" },
    { "exercise": "neck-tilt", "side": "right" } ] }
```

```json
{ "id": "neck-tilt", "name": "Neck tilt", "cue": "Tilt your head toward your shoulder.",
  "sided": true, "views": ["front", "profile"],
  "keys": [ { "t": 0, "pose": "stand-ready" }, { "t": 0.3, "pose": "neck-tilt" },
            { "t": 0.9, "pose": "neck-tilt" }, { "t": 1, "pose": "stand-ready" } ] }
```

(Illustration only. The real exercises, their order and their wording come from the owner's reference videos, section 5.)

- **Timing of an interval** (`t` = seconds since the interval began, length `L`, 20 at first): the view is `front` for `t < L/2` and `profile` after (the 0.5 s turn belongs to the second half) (the owner's sample uses 15 and 15 of 30; here 10 and 10 of 20); the **countdown** shows when `L - t <= 3` as `ceil(L - t)`; **up next** shows in the same last 3 seconds and names the next interval's exercise (on the last interval it says "Nearly done"); the ring's filled part is `t / L`. There is no rest between intervals; the countdown is the warning, and the next exercise starts at once.
- **Counter:** "interval index / number of intervals". A one-sided exercise takes two intervals (left, right), mirrored: the figure and the cue are flipped. A workout may repeat an exercise to reach its length. **Total time** = 3 seconds of get ready + `intervals × L`; the label ("2 min") must match within 5 seconds (a unit test).
- **Time is counted from `update(dt)`**, the active time the host gives the scene, **not** from the wall clock: if the player minimises the window or locks the screen the workout waits and does not run on without them. (The rule of document 1, section 8.4, point 1 is for state that changes while nobody looks; here nothing does.) `host.clock` is used only for the "last workout" time.
- **One pure function does all of it:** `frameAt(workout, activeSeconds)` returns the interval number, `t`, the exercise, the side, the view, the countdown (or null), the up-next name (or null), the ring fraction and the pose. No drawing and no clock. The window is drawn from the result; the golden test hashes it.
- **What counts as done:** only a workout that **reached its end**. One closed early, and Loop mode, never set `lastDoneAt` or the status line, or "Done today" would be untrue.
- **Loop mode** builds a workout in memory from one exercise (its intervals repeat, alternating sides) and never ends by itself.
- **Joint limits:** every joint has a range; a keyframe outside it is a test failure, so no exercise shows an impossible or unpleasant pose.
- **Record** (`records/stretch.json`, `schemaVersion` 1): `lastDoneAt` (epoch ms), `lastWorkout` (id), and the player's chosen instructor colour. **No counts, no streaks.**

## 5. Look, the instructor and the owner's videos

**Look.** A quiet room: a flat soft background and a floor line, nothing else (the sample's tennis court is not copied). The instructor is in one flat colour with rounded limbs and a plain round head, no face detail, no skin tone (a neutral clay colour; the player can pick from four soft colours). Style guide: the project's (`STYLE.md`, moved to `docs/art-style.md`): soft flat colours, no outlines. Everything is drawn in code (PixiJS `Graphics`), so the scene has almost no art files. The counter, ring and banner use the font of the project (Nunito, OFL), in our own design, not the sample's.

**The instructor and the two views. Decided by the owner (2026-11-23): approach A, a small 3D skeleton drawn flat, where the view is a turn around the vertical axis.** Every interval is seen from the front and then from the side, so one flat pose per exercise is not enough: a "front" drawing and a "side" drawing of the same stretch are different pictures of one body. The two ways that were compared:

- **A (chosen): a small 3D skeleton, drawn flat.** About 15 joints (pelvis as the root, two spine segments, neck, head; for each side shoulder, upper arm, forearm, hand, thigh, shin, foot); each bone is a direction in 3D; a pose is the list of joint rotations. The drawing is a plain orthographic projection: **the view is a turn around the vertical axis** (0° front, 90° profile), limbs are sorted by depth so the near arm is drawn over the body. No 3D engine, no textures, the same rounded shapes. A bonus: the change from front to side is a half-second turn of the instructor, not a cut (a cut when reduced motion is on).
- **B: two flat poses per key** (a front drawing and a side drawing), blended in time. Simpler to draw, no depth sorting, but twice the pose data and no turn.

**Why A (the Mac's review, Re W-26, agreed).** The deciding point is the data, not the drawing: with B every key pose is authored twice and the two can disagree about where the elbow is; with A there is one pose and the other view is free. The owner's screenshots in both views are what a 3D pose needs (the front gives x and y, the side gives z and y). B's hidden cost is the blend between a front and a side drawing, which is a cross-fade of two different bodies, not a turn.

**How to keep A small:**

- A limb is a thick line with round caps between two projected joints (under an orthographic view a capsule keeps its radius); only the torso changes with the view, as an ellipse of width `|cos t| * W + |sin t| * D`.
- Joint angles, not quaternions: every joint has at most three small ranges (section 4), so the angles are interpolated per joint. About 15 bones are sorted by the depth of their midpoints once per frame.
- A right-side interval is mirrored in 2D after projecting, so the turn always goes the same way and one pose serves both sides.
- The `frameAt` golden hashes numbers rounded to 3 decimals, not raw floats.

**Where A can fail, and the pass mark of the prototype.** Build the prototype first (about one day, in the dev kit, no platform change):

1. Same colour and no outline: in profile the near arm over the body becomes one blob. The far limbs get a slightly darker tone of the same colour (a tone, not an outline). Test on the hardest exercise first (an arm across the chest, or a side bend with the arm overhead), not on the neck tilt.
2. A head with no face has no front: in profile the player cannot tell which way the instructor looks. The feet (toes forward) and a small nose bump or an offset of the head carry it; decide in the prototype.
3. Authoring from 2D screenshots by hand is slow: the comparison page gets a slider per joint and a "copy pose as JSON" button, or each "raise the elbow" costs an edit and a reload.
4. **Pass mark:** freeze three exercises at one frame each, in both views, with no labels; the owner names the exercise from each picture. If the hardest one fails after a day, build B for that exercise only; the `frameAt` shape does not change (it returns the pose; only the drawing differs).

**The reference content: the owner supplies YouTube videos, and the pose data is made from them.**

1. **What I can and cannot do.** I cannot watch a video. For each exercise I need from the owner: the link, the time range, and **screenshots of the key poses from the front and from the side** (start, the stretched pose, and a middle pose if there is one), or a short description of each pose in the owner's words. From these I write the pose data and the cue.
2. **A comparison page.** The dev kit (`npm run dev:scene stretch`) shows the instructor next to the owner's screenshot for each key pose, in both views, with a time slider, so the owner can say "raise the elbow", "turn the head less". The screenshots stay on the owner's computer and are **not committed** unless their license allows it.
3. **The rights, plainly.** All art in the project is original and never traced (document 3, section 5; STYLE.md). A body movement is not something a video's author owns, but the video itself, its exact sequence and timing, its on-screen design and its words may be. So: the instructor and the poses are drawn here, **the cue text is written in our own words**, the layout is our own, and the exercises are chosen and ordered by the owner. If a workout follows one video's whole sequence and timing closely, ask the creator for permission and credit them in `LICENSES.md` and `DESIGN.md`. This is a practical rule, not legal advice.
4. **Review of the content.** The owner checks each exercise by eye against the video. A review by a qualified person is welcome but optional (owner's choice); the wording stays free of promises either way.

**Sound:** none by default. With the host's sound switched on: a very soft tick for the countdown 3, 2, 1, a soft sound at each new interval and a chime at the end, in the tank's style (short, quiet, synthesized in code).

## 6. What it needs from the platform

Stretch needs little from the existing contract and one **new thing**.

| Need | Why |
| --- | --- |
| Capabilities | **None.** No network, no data, no place, no consent dialog |
| `host.ui` | the counter, the number, the banner, the cue, the control bar (window mode) |
| `update(dt)`, `setVisible`, the host's pause | the workout waits when the window is hidden |
| `host.clock` | only the "last workout" time |
| `host.record` | `lastDoneAt`, `lastWorkout`, the colour |
| `host.sound` | the optional ticks and chime (`host.sound.define`, document 4, leak 4) |
| `status()`, `menuItems()`, `onMenu(id)` | the tray lines and Pause, Skip, Stop |
| **New: `host.statusLine.set(text, { day })`** | the line "Done today at 14:10" while the scene is not loaded (document 1, section 13, item 6) |
| `fps` | 30 while a workout runs; the scene is not loaded the rest of the time |
| `onSettings({ reducedMotion })` | document 1, section 7.4 |
| **New: session scenes** | see below |

**The new thing: a scene that is started by the player and ends itself ("a session").** Today the platform has one active scene, shown as a wallpaper or in a window. Stretch needs:

1. **A manifest that says it is a session scene:** `"kind": "session"`, `"modes": ["window"]`, a window request (`"window": { "alwaysOnTop": true, "aspect": 1.6, "height": 400 }`; the size is relative to the display, FR-63), and a list of `sessions` (`id`, `label`: the workouts and the exercises of the two tray lists) so the host can put "Start a workout" in the tray **without loading the scene**.
2. **A visit, not a switch for good.** Choosing a session remembers the current scene and its mode, switches to Stretch in window mode (the usual reload with the save handshake, about 0.3 s), and when the session ends or the window is closed, switches back to the earlier scene and mode. Each scene keeps its own record, so nothing is lost.
3. **Two calls for the scene:** `start(sessionId)` (the host sends it once the scene is loaded, the way a menu id is sent) and `host.session.end()` (the scene asks to be closed when the workout is done).

**Three rules for a visit** (from the Mac's design review, W-24 point 9; each is a failure case of the visit state machine):

- **A second "Start" while a visit runs is ignored** (the tray items are disabled and say "A workout is running").
- **Quitting the app during a visit** saves the **earlier** scene as the active one, never Stretch; a visit is never the saved active scene.
- **A crash or a failed load during a visit** brings the earlier scene back (the reload guard falls back to it, not to Stretch).

**Why a switch and not a second page at once** (my estimate, not yet a measurement): a second page costs at least what an empty page costs in its own process, and the old project measured an empty host at 242 to 249 MB in window mode on the Mac, with about 21 MB of the 250 MB left on Windows with the tank alone. The Mac's review rightly says that figure is for a full-size page and a 640 x 400 window is a fraction of the pixels. The process and its baseline are not smaller, but **a spike should measure a second small window on both systems** before the visit is accepted. If it fits on the Mac only, the visit is still the answer on Windows. The switch keeps "one scene at a time" (decided by the owner) true; its cost is a blink on the desktop, acceptable because the player's own windows are in front of it.

**Window and focus rules** (measured on the Mac, W-25, 2026-11-23):

- **Always on top, made right:** `setAlwaysOnTop(true, 'floating')`, on the current Space only, and **no** `visibleOnFullScreen` (the Edit mode script used it, which is the opposite of what Stretch wants). Not yet tried with a full-screen app in front.
- **Opening works:** after `show()` plus `app.focus({ steal: true })` a 380 x 560 test window became the key window with the keyboard (`document.hasFocus()` true) and no Dock icon. The player has just pressed Start, so taking the focus is right (the politeness rule is about doing it unasked).
- **Closing:** the window closing does not return the focus by itself; `app.hide()` does in 2 of 3 runs (once another app came to the front), so **do not promise the exact same program every time**. The desktop window stays visible and keeps drawing after `app.hide()`, so the same helper is safe on the way out of a visit. Tray clicks do not change the front app, so "the program the player was using" is right at the moment Start is chosen. On Windows closing normally returns to the previous window; to check by hand.
- **A visit from desktop mode costs more than the blink:** the page reload is 0.3 s, but the attached window is destroyed and made again on the way back, and the Dock icon returns for about 1 to 1.6 s each time on macOS. Two fixes, neither tried: `app.setActivationPolicy('accessory')` after each window instead of `app.dock.hide()` and its retries, or keep the attached window alive and switch the page inside it. Until one is measured it is a visible flash in desktop mode and nothing in window mode.
- **Starting a visit with a full-screen app in front** may make macOS switch to a Space that has a window of ours; rare, but a hand check before the scene ships.
- **Place:** bottom right of the main display's work area (not under the Dock or the menu bar), remembered per display (`placement.js` already does this for the tank's window).

This is open item 5 in document 1, section 13; none of it is in the contract yet, and it is deferred to version 1.1.

## 7. Budget and performance

- Target: about 10 to 15 MB over the empty host (to be measured). The instructor is about 15 rounded shapes redrawn each frame (a few hundred vertices); there is almost no texture memory.
- **Almost nothing runs the rest of the time:** the scene is loaded only for a workout (2 to 3 minutes) and the host is back to the earlier scene afterwards. No timer, no background tick.
- fps 30 for smooth motion; during a held pose the rate can drop, if the measurement shows a gain.
- Reduced motion: the exercises themselves are the content and stay; ambient motion (breathing, sway) stops; the turn from front to side is a cut; an option "Show poses as still pictures" shows the start and end pose side by side with the timer only.

## 8. Offline behaviour and privacy

Fully offline. Nothing leaves the machine. The record is a local file with the last time and workout. No account, no analytics.

## 9. Tests

- **Workout data:** every workout and exercise file passes the schema; the total (get ready + intervals) matches its label within 5 seconds; every `pose` named in a key exists; keys are in time order from 0 to 1; a one-sided exercise appears with both sides.
- **`frameAt`:** at fixed times, for each workout: the view changes at the half of the interval; the countdown is null before the last 3 seconds and 3, 2, 1 after; up next names the next exercise and says "Nearly done" on the last interval; the counter and the ring fraction are right; a left interval is the mirror of a right one.
- **Joint limits:** every keyframe pose is inside every joint's range.
- **Projection** (if approach A): the same pose seen from the front and from the side gives the right widths and depth order (a fixed set of expected 2D points).
- **`frameAt` golden:** a hash of the frames at fixed times, so a refactor cannot change an exercise by accident. Pure, so it needs no browser.
- **Session test:** start, pause, skip, back, close at every interval; `host.session.end()` is called once at the end; the record is saved once and only when the workout reached its end (an early close and Loop mode save nothing and set no status line); a pause while hidden does not advance time; a second Start is ignored; quitting during a visit saves the earlier scene.
- **The contract and capability tests** (document 1, section 12): no capabilities, runs with no `host.net`, `host.data` or `host.place`.
- **Visual:** the dev kit makes a contact sheet of every key pose in both views with `npm run shot`, for the owner's review against the videos.
- **Hand checks:** the window opens in front, closes and returns focus on both systems; always-on-top stays below a full-screen app on macOS; Start with a full-screen app in front (Mac); a minimised window pauses the workout; a visit from desktop mode on the Mac (the Dock flash).

## 10. Open questions

1. ~~Order in the roadmap.~~ **Decided by the owner (2026-11-23):** the bundled scenes are the fish tank and the farm house; **Stretch is not part of 1.0 and comes in version 1.1** (`../platform/03`, section 6.1). The store is not scheduled (it is built when there are enough users and contributors), so Stretch ships as a **bundled scene** with the session feature unless the store exists by then; where its code lives is the open point of document 1, section 13, item 3. The Mac's advice stands: the **instructor prototype first** (it needs no platform change), session scenes not before the platform's P2 gate has passed.
2. **Session scenes in the platform** (section 6): the manifest fields, `start(sessionId)`, `host.session.end()`, the visit and its three rules, and the spike for a second small window. To be written into document 1 once the owner agrees.
3. ~~"Show on desktop".~~ **Decided (2026-11-23):** Stretch has no mode behind the windows; the exercise the player chooses is shown in the window on top ("desktop" in the owner's draft meant "on the screen").
4. **The instructor:** approach A is decided (section 5), with the prototype and its pass mark; still open: rounded limbs or a stick figure, and the colours.
5. **The first exercises:** 3 or 4 from the owner's videos (links, time ranges, screenshots in both views); which workout, and its order. Is "Quick reset" the right name?
6. **The interval rules:** 20 seconds; the view changes at the half (10 and 10); countdown and up next in the last 3 seconds; no rest between intervals; 3 seconds of get ready. All as in the owner's sample, scaled from 30 seconds; confirm.
7. ~~Loop mode.~~ **Decided:** until the player closes the window. (This has nothing to do with the desktop being covered: the window stays on top of the other windows until the player clicks Close.)
8. **Window:** landscape 16:10, height about 400 px at a 1080p display, bottom right, remembered per display; resizable with the ratio kept.
9. **A "look away" eye break** as one exercise of a 3-minute workout, using the window and the tree of the icon: yes or no.
10. ~~The status line in the tray menu.~~ **Decided by the owner (2026-11-23): option (c)**, "Done today at 14:10" only when there is good news and nothing on every other day. (The options were: none; always, "Last workout: 3 days ago", which reads like a ledger and can make the player feel behind; or this one.)
11. ~~The words.~~ **Confirmed by the owner (2026-11-23):** workout, exercise, interval. The view value in the code is `profile`, not `side` (the Mac's point: `side` already means left or right).
