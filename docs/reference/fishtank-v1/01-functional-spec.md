# Fish Tank — Functional Specification

Status: Draft v0.8
Platform: macOS and Windows desktop (Electron, HTML/JS, PixiJS); backend on Railway from Phase 3
Companion docs: 02-tech-design.md, 03-platform-design.md (proposal), 04-implementation-phase-1.md, 05-implementation-phase-2.md

## 1. Overview

Fish Tank is a small, calm desktop game. Each player owns a tank with fish swimming around. The tank lives on the desktop itself, behind the icons and windows like a living wallpaper, or in a small window if the player prefers. Food pellets appear in the tank over time. The player collects the pellets and feeds them to the fish, about once a day. Fed fish grow: they get bigger and change color as they reach new life stages. Players can visit other players' tanks and send a heart.

The game is casual and made for relaxing. Nothing dies, nothing is lost permanently, and there is no pressure to play at a fixed time. A fish that is not fed simply does not grow that day.

Direction

Fish Tank is a calm desktop companion for relaxing, not a serious game. Think of a small aquarium in the corner of the desk: it is pleasant to look at, and playing with it is optional and light. When a design choice is unclear, the calmer, simpler and quieter option wins.

- Ambient first: the tank is good to look at even if the player never clicks. Its home is the desktop itself, and the player looks after the fish from a small tray menu (FR-60 to FR-62).
- No pressure: no scores, rankings, streaks, nagging countdowns, daily rewards or penalties. Missing a day only means the fish grow a little later.
- Quiet: no notifications, no sounds on their own, and nothing that takes focus or asks for attention.
- Little effort: about a minute a day is enough, and nothing needs the player to be at the computer at a given time.
- Gentle with the computer: low CPU and memory use, and animation that stops when nobody can see it.
- Kind social play: visitors can only send a heart, and nobody ever sees text that another player typed.

## 2. Goals and non-goals

Goals
- A relaxing tank that lives on the desktop (or in a corner of it) and is pleasant to leave running.
- Low effort: feeding once a day is enough for the fish to grow, and a daily visit takes about a minute. Missing a day only delays growth.
- A simple loop: collect food, feed fish, watch them grow.
- Light social play: visit tanks, send a heart, see who visited you.
- Progress is saved on the server and follows the player to a new computer (from Phase 3).
- A beautiful, smooth tank that looks and plays the same on macOS and Windows.
- A polite desktop citizen: light on CPU and memory, quiet, and never in the way (see 7.3).
- Offline first: the tank must be great on its own before accounts and social features are added (see section 11).

Non-goals (v1)
- Real-time multiplayer or chat.
- Fish death, penalties, or paid items.
- Competition: scores, rankings, streaks, or daily rewards.
- Taking food from other players, and trading fish between players.
- Linux or mobile versions.

## 3. Users

- Casual player: keeps the tank on the desktop (or open in a corner) while working, glances at it to relax, and feeds the fish once a day.
- Social player: shares a friend code, visits friends, sends hearts, checks who visited.

## 4. Core concepts

Tank: one per player. Holds up to 8 fish, a food stash, and floating food pellets.

Display mode: how the tank is shown. Desktop mode draws it on the desktop behind the icons and windows, like a living wallpaper (FR-60). Window mode shows it in a small window. Both modes show the same tank and have the same tray menu (FR-61).

Fish: has a species, a growth stage, a size, and colors. Starts as a fry and grows to a juvenile and then an adult.

Floating pellets: food that has appeared in the tank and has not been collected yet. Only the owner can collect them.

Food stash: pellets the owner has collected and keeps for feeding. Nobody else can use it.

Friend code: a short code (8 characters) that identifies a tank for visiting and adding friends.

Official tank: a tank made by the game team, not owned by a player, with fully grown fish of every species. Official tanks are labeled "Official" and make sure Explore always has something to show.

### 4.1 Creatures

The tank is home to fish, which are the game, and to small crawling creatures, which are scenery with life.

| Creature | Where it lives | How it moves | What the player can do | Game numbers | Phase |
| --- | --- | --- | --- | --- | --- |
| Tetra | In the water | Swims and wanders, up and down | Feed it, name it (names are private), click it, hatch more from eggs | Eats, grows, counts toward the 8-fish limit | 1 |
| Guppy | In the water | Swims and wanders, up and down | Same as the tetra | Same as the tetra | 1 |
| Angelfish | In the water | Swims and wanders, up and down, mostly mid-water | Same as the tetra | Same as the tetra | 1 |
| Snail | On the sand and on rocks | Crawls very slowly, with long pauses | Click it for a small reaction | None | 2 |
| Crab | On the sand and on rocks | Scuttles sideways in short bursts, then rests | Click it for a small reaction | None | 2 |

Clicking a creature needs window mode, because the tank on the desktop receives no clicks (FR-60). Fish are the only creatures with game numbers. Crabs and snails never eat, grow, die or get named, do not count toward the 8-fish limit, and are not saved: their number and kind come from the tank's decoration seed, and their positions are random on each launch. Visitors see the same crabs and snails in a visited tank. More creatures are listed in section 10.

## 5. Core loop

1. Pellets appear in the tank over time (see 6.1).
2. The player collects the pellets into the food stash: by clicking them in window mode, or with "Collect pellets" in the tray menu (FR-62).
3. The player drops pellets from the stash: by clicking a spot in the tank in window mode, or with "Feed a pellet" or "Feed until full" in the tray menu (FR-62). The pellet sinks slowly, and a nearby hungry fish swims over and eats it before it reaches the sand.
4. Eating adds growth points. Fish grow and change appearance at stage thresholds.
5. When every fish is full, the day's feeding is done. The player can just watch and relax.
6. Reaching feeding milestones hatches new fish (see 7).
7. Optionally, the player visits another tank and sends a heart (see 6.8).

## 6. Functional requirements

### 6.1 Food pellets

- FR-1: A new pellet appears in a tank every 60 minutes, whether or not the owner is online.
- FR-2: A tank holds at most 16 floating pellets. When full, no new pellets appear until some are collected.
- FR-3: Pellets drift slowly and gently in the tank so they are easy to click.
- FR-4: Clicking a pellet moves it to the food stash with a short animation. The stash count is shown on screen.
- FR-5: The food stash holds at most 30 pellets. Pellets cannot be collected when the stash is full, and a message says so.

### 6.2 Feeding

- FR-6: The player drops a pellet by clicking an empty spot in the tank. This costs 1 pellet from the stash. The dropped pellet then sinks slowly (FR-46).
- FR-7: The nearest fish that is not full swims to the pellet and eats it. If all fish are full, the pellet is not dropped and the player sees a friendly message: "Everyone is full and happy. Come back later!"
- FR-8: Each fish has a fullness meter with a maximum of 2 pellets. Fullness drops by 1 every 12 hours, so a fish that is fed fully once a day is hungry again the next day. A fish at maximum fullness does not eat.
- FR-9: Eating a pellet gives the fish 20 growth points.
- FR-10: A fish that has not eaten for 36 hours (it missed a day) looks drowsy (slower, dimmer, swimming low). It recovers immediately when fed. Fish never die.

### 6.3 Growth, size, and color

- FR-11: Each fish moves through three stages based on growth points:
  - Fry: 0 to 99 points
  - Juvenile: 100 to 399 points
  - Adult: 400 points and up (growth stops)
- FR-12: Size grows smoothly with points. A fry starts at 50% of adult size and an adult is 100%. Size = 50% + 50% × min(points / 400, 1).
- FR-13: Color changes at stage transitions. A fry has a pale color. The fish switches to its juvenile palette at 100 points and its adult palette at 400 points. Each fish's palettes are fixed by its species and a random seed given when it hatches, so the same fish always looks the same.
- FR-14: A stage change plays a short effect (bubbles and a color fade, about 2 seconds) when a fish reaches a new stage while the owner is watching.
- FR-15: Fish can be given a name of up to 16 characters (letters, numbers, spaces). Fish names are private: only the owner ever sees them. Other players see a fish's species and stage, never its name.

### 6.4 New fish

- FR-16: A new tank starts with 2 fry of different species.
- FR-17: For every 12 pellets a player feeds in total, an egg appears. The player clicks the egg to hatch a new fry (random species and seed).
- FR-18: A tank holds at most 8 fish. At the limit, eggs wait until a slot is free. In v1 there is no way to remove fish, so the limit is a soft end-game.

### 6.5 Tank view and desktop behavior

- FR-19: In window mode the tank is shown in a small window that the player can drag and resize.
  - Size: 480 × 320 points by default, at least 360 × 240, at most 1200 × 800, and never larger than the usable area of the display it is on. The shape is 3:2: the window opens in that shape and, on macOS, resizing keeps it. On Windows resizing is free (the system's aspect-ratio lock made the window shrink a few pixels at every start); the tank adapts to any shape (FR-63) and the next launch restores the 3:2 shape.
  - Position: the window remembers its size and position. On the very first launch it opens near the bottom-right corner of the main display.
  - Several displays: placement is checked at launch only. If the remembered position is no longer visible on any display (for example a monitor was unplugged), the window opens on the main display and keeps its size. Moving the window between displays with different scaling keeps its size and the picture sharp (FR-43).
  - Closing: closing the window quits the app. The tank does not hide in the tray; to keep it running the player minimizes it or switches to desktop mode (FR-60). The next launch catches up on the time that passed (FR-22).
- FR-20: In window mode the window can be set to stay above other windows ("Always on top"). It is off by default. On macOS it does not appear above other apps' full-screen windows; on Windows it may, because the operating system allows it (accepted, and noted in the README). Desktop mode has no such setting, because the tank is behind everything.
- FR-21: Fish swim on their own: they wander, avoid walls, and keep a little distance from each other. Larger fish swim slower. Fish also swim up and down, not only sideways (FR-45).
- FR-22: The game pauses animation when nobody can see the tank: the window is hidden, minimized or fully covered by other windows; in desktop mode, when a maximized or full-screen window covers the main display; and when the screen is locked or the display is asleep. When the tank is visible again, it catches up on the time that passed.
- FR-60: Two display modes.
  - Desktop mode: the tank fills the main display and is drawn on the desktop itself, behind the desktop icons and behind every window, like a living wallpaper. It never takes keyboard focus, never covers a window and receives no clicks: the system delivers clicks to the icons and windows as usual, and the player uses the tray menu (FR-61, FR-62). It shows on all virtual desktops (Spaces) of the main display. Only the main display shows the tank; other displays keep their normal wallpaper (more displays are in section 10). The system's own wallpaper setting is never changed, and the normal wallpaper returns when the app quits or switches to window mode.
  - Window mode: FR-19.
  - The player switches with "Show on desktop" and "Show in a window" in the tray menu, and the choice is remembered. The first launch opens window mode with a short hint that the tank can be moved onto the desktop from the tray icon (the player sees the tank and finds the tray icon first). Later launches use the remembered mode.
  - Things that need clicks on the tank (touching a fish, renaming it, clicking a crab or snail) work in window mode only.
- FR-61: Tray menu. The app puts one small icon in the Windows notification area or the macOS menu bar whenever it runs, in both modes. Opening it shows a menu with: a status line (for example "2 pellets waiting · 5 in the stash · 1 hungry"), Collect pellets, Feed a pellet, Feed until full, Hatch egg (only while an egg is waiting), Show on desktop or Show in a window, and the settings items of FR-36, with Quit at the bottom. The icon is a small monochrome fish and never shows badges, numbers or flashes (section 1, Direction).
- FR-62: Looking after the fish from the tray. Every action that is a click in window mode has a tray menu equivalent, and the same rules apply in both modes.
  - Collect pellets moves all waiting floating pellets into the food stash (FR-4), stopping when the stash is full (FR-5).
  - Feed a pellet drops one pellet from the stash at a random spot near the top of the tank (FR-6). It sinks and is eaten as in FR-46 and FR-47.
  - Feed until full drops pellets one at a time, about 2 seconds apart, until every fish is full or the stash is empty, so the player can watch each one being eaten. Choosing it again, or Quit, stops it.
  - Hatch egg hatches the waiting egg (FR-17).
  - An item that cannot be used is greyed out and says why: "Everyone is full and happy" (FR-7), "No pellets in the stash", "Stash is full" or "No pellets waiting".
- FR-63: The scene fits any display. The layout adapts to any width and height: 16:9, 16:10, ultrawide, 4K and the 3:2 window. Fish, decorations, bubbles, pellets and speeds are sized relative to the height of the tank, so the tank looks the same in proportion at every size. Decorations from the layout seed (FR-41) are spread across the full width, and there are still at most 8 fish. Fish and pellets stay inside the usable area of the display (the part not used by the taskbar, the menu bar or the Dock), and the water and sand are drawn to the edge. The picture is drawn at no more than 1600 × 900 pixels (1.44 million) and scaled up on bigger displays, and desktop mode draws at most 30 frames per second, so a 4K display still meets the budgets in 7.3.
- FR-64: Desktop mode stays in place and has a fallback. It re-attaches by itself when Windows rebuilds the desktop (for example after Win+D, an Explorer restart or a wallpaper change) and resizes itself when the size or scaling of the main display changes. If it cannot attach at launch, or keeps failing, the app switches to window mode and the tray menu shows a one-line note ("Couldn't show on the desktop, showing in a window"). There are no pop-ups or notifications.

### 6.6 Accounts and progress

- FR-23: On first launch the game creates an anonymous player automatically. No sign-in is needed.
- FR-24: Progress is stored on the server. Closing and reopening the app, or using the same player on another computer, shows the same tank.
- FR-25: The player's display name is picked from lists, not typed: an adjective and a sea creature, for example "Sleepy Crab". The player can press a button to get another combination, or choose each part. Names need not be unique (the friend code identifies a tank). Because nothing is typed, no word filter is needed.
- FR-26: The player can see and copy their friend code from the menu.
- FR-27: If the player has no internet, the tank still shows from the last saved copy and the fish keep swimming. Collecting, feeding, visiting and hearts need the internet and show a quiet "Offline" note. Nothing is queued: the player simply does these things when back online.

### 6.7 Social: friends and visiting

- FR-28: The player can add a friend by typing a friend code. Adding is one-way and needs no approval, since tanks are public and a visitor can only send a heart (FR-33).
- FR-29: The Friends list shows each friend's name, number of fish, and a "Visit" button.
- FR-30: "Explore" opens a random tank (not the player's own, not visited in the last 24 hours if possible). If fewer than 20 real tanks qualify, Explore also offers official tanks, so it is never empty.
- FR-31: A visited tank is shown read-only. The visitor sees the fish (species and stage only), the decorations and the owner's display name (or "Official"). The owner's stash and floating pellets are not shown.
- FR-32: Visitors cannot change anything in a visited tank except by sending a heart (FR-33). Fish names are private (FR-15), so a visitor never sees them.

### 6.8 Hearts and the visit log

- FR-33: Hearts. A visitor can send a heart to a tank, at most once per tank per 24 hours. Hearts cost nothing and change no game numbers. The owner sees small hearts float up in the tank the next time they open it. Official tanks accept hearts.
- FR-34: The owner sees a visit log with the last 20 events, for example "Mika visited, 3h ago" and "Mika sent a heart". Opening a tank adds one visit event per visitor per 24 hours; each heart is its own event. Opening the app after new events shows a small notice. The names in the log are display names picked from lists (FR-25).
- FR-35: A visitor cannot send a heart to their own tank.

### 6.9 Settings and menu

- FR-36: Menu items: Show on desktop or Show in a window (FR-60), Always on top (window mode only), Launch at login, Sound on/off, Copy diagnostics (7.3), About, Quit. They are in the tray menu (FR-61) in both modes, and also in the gear menu of the window in window mode. From Phase 2 the menu also has Reduced effects (FR-50) and Day/night lighting (FR-57). From Phase 4 it also has Friends, Explore, Visit log and My code.
- FR-37: Launch at login is off by default. The first-launch hint (section 8) mentions it, because desktop mode only helps when the app is running.
- FR-38: Sound effects are short and quiet (splash, pop, and a chime for a new fish), soft and in one key. They can be switched off. Sounds play only as a reaction to something the player did, never on their own.

### 6.10 Tank scenery and visual quality (Phase 1)

- FR-39: The tank is a layered scene: a water background with a soft gradient (lighter at the top, deeper at the bottom), a sandy floor, and decorations in front of and behind the fish. Light from above is added in Phase 2 (6.12).
- FR-40: Decorations include sand, rocks, corals and weeds, plus bubble chains rising from rocks and corals (FR-44). Weeds and corals sway gently (tops move more than bases). Rocks and sand stay still.
- FR-41: The decoration layout is picked when the tank is created and then stays the same. Choosing or moving decorations is out of scope for v1.
- FR-42: Fish bend their bodies as they swim (a wave runs from head to tail), turn smoothly instead of flipping, and pass in front of or behind decorations to give depth.
- FR-43: The tank looks the same on macOS and Windows and stays sharp on high-resolution screens (Retina and Windows display scaling from 100% to 200%).

### 6.11 Life in the tank: bubbles, swimming, food and touch (Phase 1)

All sizes and times in sections 6.11 and 6.12 are starting values for the default 480 × 320 window and are tuned by eye. On other sizes they scale with the height of the tank (FR-63). They live in one client-side visual settings file, not in the game rules config.

- FR-44: Bubble chains. Two to four spots on rocks or corals send up chains of small bubbles. A chain is 5 to 12 bubbles one after another, followed by a random pause of 4 to 15 seconds. Bubbles are 3 to 10 px, wobble sideways, grow slightly as they rise, and pop at the surface with a tiny ring. The spots are picked with the decoration layout and stay the same (FR-41). Bubbles never block clicks.
- FR-45: Fish swim in every direction. Fish use the whole depth of the water, from just under the surface to just above the sand, not only left and right. Every 4 to 10 seconds a fish picks a new random spot anywhere in the water and swims there, so its paths run sideways and diagonally: to the top left, top right, bottom left and bottom right as well as straight across. The spot is far enough away for a visible climb or dive. The body tilts up when climbing and down when diving (up to about 25°), and turns and depth changes are smooth. Drowsy fish (FR-10) stay in the lower third of the tank. Fish never touch the sand or break the surface.
- FR-46: Dropped food sinks. A dropped pellet appears at the clicked point and sinks slowly (about 6 seconds from the top to the sand), swaying a little. A click on the sand does nothing and costs no pellet. Decorations and bubbles never block a click. Floating pellets that the player collects (FR-3) drift and bob and do not sink.
- FR-47: The fish eats it before the sand. The fish chosen in FR-7 heads for where the pellet will be, not where it is, speeds up a little, turns to face it, opens its mouth and eats it before it reaches the sand. Other fish do not take it. Eating plays a small pop and a short happy wiggle. A dropped pellet is never lost: the chosen fish always eats it, even if it has reached the sand. If several pellets are dropped for the same fish, it eats them one after another.
- FR-48: Touching a fish (window mode only, FR-60). Clicking a fish makes it give a small wiggle and shows a small label for 3 seconds with its name (or species), its stage, and whether it is hungry or full. The label has a button to rename the fish (FR-15). Clicking a fish changes no game numbers.
- FR-49: Fish react to the mouse pointer. Each fish has a personality picked from its seed: curious (about 6 in 10 fish) or shy. When the pointer moves over the tank, a fish within about 120 px (in the default window, scaled with the height of the tank) notices it. In desktop mode, where the tank receives no clicks, the app reads the pointer position from the system about 10 times a second while the tank is drawn, so fish react to the pointer on the desktop too (a fish may react to a pointer that is over another window, which is accepted). A curious fish swims slowly toward the pointer and stays near it, and loses interest after about 8 seconds or when the pointer has been still for 3 seconds. A shy fish swims calmly away, a little faster if the pointer moves fast. After reacting, a fish ignores the pointer for about 20 seconds. A fish that is going to eat dropped food (FR-47) ignores the pointer. Reactions never change any game numbers. Fish do not react when the window is hidden or the pointer is outside the tank.

### 6.12 Living tank: light, depth and effects (Phase 2)

Light and water
- FR-50: The water has a subtle ripple and shimmer effect. A "Reduced effects" setting is for slower or battery-powered computers. It turns off the ripple, the moving light shafts (FR-51), the moving light patterns on the floor (FR-52, which then show as still patches) and the surface wave (FR-54), and cuts the number of bubbles to about a third. Fish, fish shadows, food, day/night colors (FR-57), pointer reactions (FR-49) and everything the player does stay the same. Reduced effects must meet the Phase 1 budgets in 7.3.
- FR-51: Light from above. Soft shafts of light slant down from the surface through the water, brightest at the top and fading with depth. Their width and brightness change slowly (a cycle of 10 to 30 seconds).
- FR-52: Light on the sand and rocks. The light reaches the floor: the sand and the upper faces of rocks and corals show soft, bright, moving patterns (like sunlight rippling on a pool floor) that drift and shimmer slowly.
- FR-53: Depth shading. Things lower in the tank are a little darker and bluer, and decorations at the back are paler and bluer than those at the front. Fish are shaded by at most 15%, so the color change at stage thresholds (FR-13) stays easy to see.
- FR-54: Water surface. A bright, softly waving line runs along the top edge, as seen from underneath.
- FR-55: Fish shadows. Each fish casts a soft, faint shadow on the sand below it, smaller and lighter the higher the fish is.

Fish life, day and night
- FR-56: Fish release bubbles. Every 10 to 30 seconds (random) each fish lets out 1 to 3 small bubbles from its mouth, which rise to the surface. Larger fish release larger bubbles. A fish also gives 2 or 3 tiny bubbles when it eats (FR-47).
- FR-57: Day and night lighting. The tank lighting follows the computer's local time. Day (about 07:00 to 18:00) is bright, with warm light shafts. Evening (18:00 to 20:00) and morning (05:00 to 07:00) blend smoothly between day and night. Night (20:00 to 05:00) is darker and deeper blue, with dim, cool, moonlight-like shafts and softer floor light. Changes are gradual, never a jump, and the lighting is updated about once a minute. Fish colors stay clearly visible at night (the same 15% limit as FR-53). The lighting uses only the local time of day and never changes game timers, growth or drowsiness (FR-10). A menu item "Day/night lighting" (on by default) turns it off, which keeps the tank in daylight.

Crawling creatures (see 4.1)
- FR-58: Snails. A tank has 1 to 3 snails, decided with the decoration layout (FR-41). A snail crawls very slowly (a few pixels per second) along the sand and over the rocks, with long pauses (about 5 to 20 seconds). Its body stretches and shrinks as it moves and its eye stalks sway. It stays on surfaces, never swims, and does not leave the tank. Clicking a snail makes it pull in its eye stalks for a moment.
- FR-59: Crabs. A tank has 1 to 2 crabs, decided with the decoration layout (FR-41). A crab scuttles sideways along the sand and over rocks in short bursts (about 1 second), then rests for 2 to 8 seconds, now and then raising a claw. It stays on surfaces and does not leave the tank. Clicking a crab makes it raise both claws. Crabs and snails ignore food, fish and the pointer, change no game numbers, and are neither saved, named, fed nor counted (see 4.1). A click goes to an egg or pellet first, then a fish, then a crab or snail, then the water.

## 7. Rules, numbers and budgets

### 7.1 Game numbers (tunable)

All numbers below live in one config file (`shared/config.js`). In Phases 1 and 2 it is bundled with the app, and test builds can override it with a local tuning file so pacing can be adjusted during a playtest without a new build. From Phase 3 the server provides the same numbers, so they can be changed without a new app release.

| Rule | Value |
| --- | --- |
| Pellet spawn interval | 60 minutes |
| Max floating pellets | 16 |
| Max food stash | 30 |
| Growth points per pellet | 20 |
| Stage thresholds | 100 and 400 points |
| Fullness max / decay | 2 pellets / 1 per 12 hours |
| Drowsy after | 36 hours without food |
| Pellets per egg | 12 fed in total |
| Max fish per tank | 8 |
| Start of a new tank | 2 fry, 4 floating pellets |
| Hearts | 1 per tank per 24 hours |

### 7.2 Pacing check

Designed for a player who visits once a day for about a minute.
- A fish eats up to 2 pellets a day, for 40 growth points. Fed every day, it becomes a juvenile on day 3 (120 points) and an adult on day 10 (400 points). Skipping a day only delays this; nothing is lost. The days are counted for a visitor who comes at the same hour every day. A visit less than 24 hours after the last one finds a fish only half hungry, so a player who comes at a different hour each day feeds about 1.5 pellets per fish per day and sees the adult stage after about 14 visits (found with the pacing simulator, Step 5).
- The two starting fish eat 4 pellets a day, so the first egg (12 pellets) comes on day 3, together with the first stage change. Both give a reason to open the app on day 3.
- Supply is generous on purpose: 24 pellets a day arrive (up to 16 wait in the tank, 30 in the stash). A full tank of 8 fish needs 16 a day, which matches the 16 floating pellets.
- A tank reaches 8 fish after roughly 10 days of daily feeding. Long-term play after that comes from visiting and friends.
- A daily session: collect the waiting pellets, drop about 2 for each fish, and see "Everyone is full and happy". After that there is nothing to do but watch.
- These numbers are a starting point. A small pacing simulator in the tests and the Phase 1 playtest will check and adjust them.

### 7.3 Desktop behavior budgets

These are targets for a polite desktop citizen. They are set now, before measuring, and can be loosened only with a written reason after the first measurements (Phase 1, slice gate). They are measured on one Mac and one Windows laptop with integrated graphics, with 8 fish, as the total across all of the app's processes: in window mode at the default window size, and in desktop mode on a 1920 × 1080 display and on a 4K display.

| ID | Budget |
| --- | --- |
| NFR-1 | Window hidden, minimized or covered, or desktop mode with the desktop covered: at most 0.5% of one CPU core, nothing is drawn, and the game wakes at most once a minute (the pointer is not read while paused; on Windows the app may check every 2 seconds whether a window covers the desktop). |
| NFR-2 | Visible but not the active window (the usual "corner of the desktop" case), and desktop mode whenever the desktop is visible: at most 30 frames per second and at most 3% of one core. |
| NFR-3 | Window mode, visible and active: at most 60 frames per second and at most 8% of one core. |
| NFR-4 | Memory: at most 250 MB in total after one hour (350 MB on macOS, see below), and growth of less than 20 MB over 8 hours. |
| NFR-5 | Start: the tank is visible within 3 seconds of launching. |
| NFR-6 | Politeness: the tank never takes keyboard focus or moves above other windows by itself (except while Always on top is on), desktop mode never receives or blocks a click meant for an icon or a window, the tray icon never flashes or shows a badge, nothing shows notifications, and sounds play only in reaction to the player's actions. |
| NFR-7 | Diagnostics: the app keeps a small local log (never sent anywhere) of days opened, minutes visible (the tank drawn, in either mode), minutes of player activity (clicks in the window and tray menu actions), the display mode, CPU and memory samples, frame rate samples and recent errors. "Copy diagnostics" in the menu copies a text summary to the clipboard: version, operating system, GPU, display size and scaling, display mode, window size, settings, number of fish and pellets fed, the result of the last attempt to show the tank on the desktop, the usage summary as a short per-day table (date, opens, desktop minutes, window minutes, active minutes), the measurement summary, and recent errors without file paths (the user's home folder name is removed). |

In Phase 2, with all effects on, NFR-2 becomes 5% of one core, NFR-3 becomes 10%, and NFR-4 becomes 300 MB. With Reduced effects on, the Phase 1 numbers apply. In desktop mode the Phase 2 numbers for NFR-2 and NFR-4 apply with all effects on, because desktop mode is always "visible but not active".

Loosened after the first measurements (2026-11-21): on macOS, NFR-4 is 350 MB. Reason: on the Mac an empty page with only a WebGL canvas already uses about 245 MB, because Chromium runs WebGL on ANGLE over Metal and that costs about 165 MB of graphics memory however it is set up, and unified memory counts it as app memory. No Chromium switch, WebGPU or WebGL setting tried lowered it (`docs/perf-notes.md`). The Phase 2 number for macOS is set when Phase 2 is measured.

## 8. User flows

First launch
1. App opens and creates an anonymous player (Phase 3), or a local tank (Phases 1 and 2).
2. Tank appears with 2 fry and 4 pellets.
3. The tank opens in a window (window mode) with a short hint: "Click food to collect it, then click the water to feed. Find the fish icon in your tray (menu bar) to move the tank onto your desktop. Turn on Launch at login to keep it there."
4. When the player chooses "Show on desktop", the window closes and the tank fills the desktop behind the icons. Later launches open in that mode.

Daily use (about a minute)
1. The tank is already on the desktop (or the app is started; it catches up on the time that passed). Pellets that appeared since last time are floating.
2. Open the tray menu, choose "Collect pellets", open it again and choose "Feed until full". The fish eat the pellets one by one. (In window mode the player can click the pellets and the water instead.)
3. The menu now says "Everyone is full and happy". Close the menu and relax. Possibly see "Mika sent a heart" in the visit log.

Visit a friend
1. Open Friends and press Visit.
2. See their tank and send a heart.
3. Press Back to return to the own tank.

## 9. Edge cases

- Clock changes on the computer must not affect growth or spawns once the server is in place (Phase 3), when all timers use server time. In Phases 1 and 2 the local clock is used, which is accepted for an offline game.
- Two devices on the same player: the server is the source of truth and the other device refreshes on its next sync.
- A friend code that does not exist shows "No tank found".
- A removed or banned player's tank disappears from Friends and Explore.
- A request to the server times out: the app asks the server for the current tank instead of guessing, so nothing is applied twice and nothing is queued (Phase 3 onward).
- App closed while a dropped pellet is still sinking: the feeding already counts (the stash, fullness and growth were updated when the pellet was dropped), so nothing is lost or repeated.
- Window resized while food is sinking: the pellet and the fish keep their relative positions and the fish still eats it.
- Very small window: the number of bubbles scales with the window area, so a small window does not look crowded.
- The display scaling changes while the app runs: the picture is redrawn sharp (FR-43). A monitor is unplugged while the app runs: in window mode the operating system moves the window, and the next launch places it on a visible display (FR-19); in desktop mode the tank resizes to the main display (FR-64).
- Desktop mode: desktop icons are drawn on top of the fish, which is expected. If the player hides the icons, the whole tank shows. If Windows rebuilds the desktop (Win+D, an Explorer restart), the tank re-attaches within a few seconds (FR-64). If the system wallpaper changes, the tank stays on top of it.
- Desktop mode and full-screen or maximized windows: animation pauses while one covers the main display (FR-22), and resumes as soon as the desktop is visible again.
- Desktop mode on macOS: the tank shows on every Space of the main display. If a future macOS version hides it or stops it from attaching, the app falls back to window mode (FR-64).
- A tray menu action while the tank is covered or paused: the pellets are collected, dropped and eaten in the numbers right away, without animation, and nothing is lost (the economy is committed at drop time).
- The tray menu is the only way to use the tank in desktop mode. If the tray icon is hidden by the system (for example in the Windows overflow area), the tank still runs, and the player can find the icon there.
- The computer sleeps and wakes: animation resumes, and the tank catches up on the pellets and hunger that changed while it slept (FR-22).

## 10. Out of scope for later versions

- Fish swimming over other windows (a transparent overlay with click-through).
- The tank on every display (desktop mode shows it on the main display only).
- Clicking the tank on the desktop (needs a global mouse hook and, on macOS, an Accessibility permission), and fish that avoid the desktop icons (needs reading the icon positions, which Windows allows and macOS does not).
- Decorations and plants for the tank.
- Fish breeding with color mixing.
- Leaderboards, such as the biggest fish this week.
- Push-style notifications when someone visits.
- Sharing pellets with a friend's fish (removed from v1 to keep social play simple).
- Any text typed by one player and shown to another (display names are picked from lists, and fish names are private).
- More creatures (for example shrimp, starfish, a seahorse) and more fish species.
- Playing offline with later sync once accounts exist (dropped: the offline view in FR-27 is read-only).

## 11. Implementation phases

The game is built offline first. Phase 1 builds the working tank: it plays well, looks pleasant and runs on both macOS and Windows, with no account, server or social feature. Phase 2 makes the tank feel alive with light, depth, effects, day and night, and crawling crabs and snails. Later phases add accounts, social play and release work on top without changing how the tank looks or feels. Requirements that need a server or are complex (official tanks and hearts) are placed in Phases 3 and 4.

| Phase | Name | Requirements | Needs server |
| --- | --- | --- | --- |
| 1 | Offline tank core (macOS + Windows) | FR-1 to FR-22, FR-36 to FR-49, FR-60 to FR-64, NFR-1 to NFR-7 (the menu without the Phase 2 and 4 items) | No |
| 2 | Living tank: light, depth and effects | FR-50 to FR-59, plus the "Reduced effects" and "Day/night lighting" menu items | No |
| 3 | Accounts and saved progress | FR-23 to FR-25, FR-27 | Yes |
| 4 | Social | FR-26, FR-28 to FR-35, official tanks, social menu items | Yes |
| 5 | Release and extras | Section 10 items, signing, auto-update | Yes |

Art and sound: all art (fish, decorations, textures) is original vector art drawn by Claude Code as SVG files and turned into spritesheets by a script, and all sound effects are synthesized in code. No art or sound is bought or downloaded, so there are no licences to track. The owner reviews the result on screenshots and asks for changes.

### Phase 1 — Offline tank core (macOS + Windows)

Goal: a working, pleasant tank that people can play on both operating systems with no internet at all, that asks for about a minute a day, and that is light on the computer.

Phase 1 is built in two parts.

Part 1A: vertical slice, with a go/no-go
- An Electron + PixiJS app that runs on both systems, with the water, sand, a few decorations and bubble chains, laid out for any display size from the start (FR-63).
- A desktop attach test: the same scene shown in desktop mode behind the icons on macOS and on Windows (FR-60), with the tray icon and a "Feed a pellet" item. This is the riskiest technical part, so it is tested in the slice, before the art is drawn.
- One species (the tetra) with one shape and its fry, juvenile and adult sizes and colors, swimming up and down with body bend and smooth turns.
- Dropped food that sinks and is eaten before it reaches the sand. State is kept in memory only; there is no save file yet.
- Gate (all must be true to continue):
  1. The owner approves the art style from screenshots and a short screen recording.
  2. The budgets NFR-1 to NFR-4 are met on one Mac and one Windows laptop, or are loosened with a written reason.
  3. After watching the tank for a minute, the owner and two other people call it pleasant and relaxing.
  4. Dragging and resizing the frameless window, and sharp drawing at 100% to 200% scaling, work on both systems.
  5. Desktop mode shows the tank behind the icons and behind all windows on macOS and on Windows (Windows 11 24H2 or later, and an older Windows build), and meets the budgets in 7.3 on 1920 × 1080 and 4K. On Windows it recovers after Win+D and an Explorer restart, and a click on an icon or window is never blocked.
- If gate item 5 fails on one system, desktop mode ships only on the other system, the failing system uses window mode, and the decision is written down. If it fails on both, the project stays in window mode and the desktop idea is reviewed again.
- If another gate item fails, fix it before drawing the other species or building the rest: change the art style, simplify the swimming, or switch to a framed window.

Part 1B: the rest of Phase 1
- Two more species (guppy and angelfish). Each species has one shape; fry, juvenile and adult differ in size and color (section 6.3).
- Pellets, collecting, feeding, fullness, growth, eggs and hatching, fish names, touching a fish and pointer reactions (sections 6.1, 6.2, 6.4, FR-48, FR-49).
- Window behavior: drag, resize, size limits, position memory with placement at launch, always on top, close quits, pause when hidden, minimized or covered (section 6.5).
- Desktop mode, the tray menu with collecting, feeding and hatching, the fallback to window mode, and re-attaching (FR-60 to FR-64).
- Menu (tray and gear): Show on desktop or in a window, Always on top, Launch at login, Sound, Copy diagnostics, About, Quit.
- Local save file and test builds for macOS and Windows.
- The local diagnostics log (NFR-7).

How Phase 1 differs from the final game
- Pellet spawning and growth timers use the computer's own clock. When the app opens, the tank catches up on the pellets that would have appeared while it was closed, up to the cap. A player could cheat by changing the clock; this is accepted while the game is offline.
- Progress is saved in a file on that computer only. It is not shared between computers.
- There is no display name, friend code, visiting, hearts or visit log.
- There is no light from above, ripple, depth shading, fish bubbles, day and night, or crabs and snails yet (Phase 2).
- Builds are unsigned test builds.

Exit criteria (measured in a playtest of at least 5 people, at least 2 of them not close friends, on both systems, for 7 days, using Copy diagnostics)
- Return: at least 80% of testers open the game on 3 or more different days within their first 7 days.
- Time open: the median tester has the tank visible (on the desktop or in the window) for at least 2 hours on the days they use it, and at least half of the testers leave it running for 4 hours or more on at least one day.
- Effort: the median tester spends under 3 minutes a day actively using the game (clicking or using the tray menu).
- Desktop mode: at least 3 of 5 testers keep the tank on the desktop for most of their visible time, and none reports that it blocked a click, hid an icon or stayed on top of a window.
- Stability: no crash and no lost progress; every damaged save file recovers from its backup.
- Budgets: NFR-1 to NFR-7 are met on both systems, in the testers' measurements and on the reference laptops.
- Opinion: at least 4 of 5 testers say they would keep it open on their desktop. Behavior (the numbers above) counts for more than opinions.
- Quality: the same look and behavior on a recent Mac and on Windows 10 or 11 (desktop mode where the gate allowed it), sharp on high-resolution screens, with at least 3 species and 5 kinds of decoration, and fish visibly changing size and color at the stage thresholds.
- These thresholds are starting points. After the first playtest they are reviewed and adjusted from what was measured.

### Phase 2 — Living tank: light, depth and effects

Goal: take the working tank and make it feel alive and beautiful, without changing how the game plays.

In scope
- Water ripple and shimmer, and the Reduced effects setting (FR-50).
- Light from above, light on the sand and rocks, depth shading, water surface, fish shadows (FR-51 to FR-55).
- Fish release bubbles (FR-56).
- Day and night lighting that follows the computer's clock (FR-57).
- Crabs and snails crawling on the sand and rocks (FR-58, FR-59).
- A polish pass on the art, and the Phase 2 budgets (section 7.3) checked.
- Menu: Reduced effects and Day/night lighting.

Exit criteria
- Same look on both systems at 100% to 200% display scaling, with all effects on, in window mode and in desktop mode on 1920 × 1080 and 4K displays.
- The Phase 2 budgets in 7.3 are met with all effects on, and the Phase 1 budgets are met with Reduced effects on, on a Mac and on a Windows laptop with integrated graphics.
- Light visibly reaches the sand and rocks, fish release bubbles, snails and crabs crawl on the sand and rocks, and the lighting changes smoothly from day to night and back (checked by moving the clock).
- In a playtest of the same kind as Phase 1, the return and time-open results are no worse than in Phase 1, and most testers say the tank looks better.

### Phase 3 — Accounts and saved progress

Scope: anonymous player creation (FR-23), progress stored on the server and synced (FR-24), display name picked from lists (FR-25), a read-only offline view (FR-27), and moving all timers to server time.

Existing Phase 1 and Phase 2 players keep their tank: the first time the app connects, it uploads the local save once. The server checks it against the game rules (growth points match pellets fed, pellet counts and fish count within the caps), corrects anything out of range, and accepts the import only once per player. Fish names are kept as private text for the owner and are never sent to other players. The local file is kept as a backup until the server confirms.

Exit: closing the app and opening it on another computer shows the same tank, and with the network off the tank still shows from the last saved copy.

### Phase 4 — Social

Scope: friend code (FR-26), friends, Explore, visiting, hearts and the visit log (FR-28 to FR-35), official tanks, plus the Friends, Explore, Visit log and My code menu items. These screens open in the window; choosing one in desktop mode switches to window mode (open question 7).

Official tanks: at least 6, made by the game team, covering all species and stages, with named fish. They are marked "Official", belong to no player, accept hearts only, and are used by Explore when fewer than 20 real tanks qualify (FR-30).

Exit: the social acceptance criteria in section 13 pass.

### Phase 5 — Release and extras

Scope: code signing for both systems, auto-update, a public download page, and the first items from section 10 (the tank on every display and a transparent overlay are the first candidates).

Exit: a signed build that a stranger can install on macOS or Windows without security warnings.

## 12. Open questions

1. Should friends be mutual (approval needed) rather than one-way?
2. Should there be a way to release or swap fish once the tank is full?
3. Do we want fish species to affect behavior (fast, shy, schooling), or only appearance? (Pointer reactions already use a per-fish personality, not the species.)
4. Are six official tanks enough, or should Explore also offer a small gallery of fully grown fish?
5. Should crabs and snails ever react to food or the pointer, or stay as quiet scenery (as now)?
6. Should Launch at login be on by default once desktop mode is the main way to use the game? It is off for now, to stay quiet.
7. In Phase 4, how should the social screens (Friends, Explore, visiting) work in desktop mode, where the tank receives no clicks? For now they open the window, and the player switches back to the desktop from the tray menu.

## 13. Acceptance criteria (v1, all phases)

Phase 1
- A new player can collect food, feed a fish, and see its size increase, with no sign-up.
- A fish changes color at 100 and 400 points and the change survives restart.
- Pellets that spawn while the app is closed are present on the next launch, up to the cap of 16.
- When every fish is full, the player sees the friendly "full" message and nothing is spent.
- A dropped pellet sinks slowly and is eaten by the chosen fish before it reaches the sand, and no pellet is ever left uneaten.
- The tank shows bubble chains from at least 2 spots and fish that swim up and down.
- Clicking a fish shows its label and a small wiggle; curious fish come toward the pointer and shy fish move away, and fish going for dropped food ignore it.
- In window mode the window remembers its size and position, stays within 360 × 240 and 1200 × 800, and opens on the main display when its old display is gone.
- Closing the window quits the app; relaunching catches up on the time that passed.
- Animation stops when the window is hidden, minimized or fully covered, and in desktop mode when a maximized or full-screen window covers the main display.
- "Show on desktop" puts the tank behind the icons and behind every window on the main display; icons and windows still get their clicks; "Show in a window" brings the window back and the normal wallpaper returns.
- From the tray menu the player can collect pellets, feed one pellet, feed until full, and hatch an egg, in both modes, and greyed items say why they are unavailable.
- The same scene looks right on 16:9, ultrawide and 4K displays and in the 3:2 window.
- If desktop mode cannot attach, the app opens window mode and the tray menu says so.
- "Copy diagnostics" copies a summary with no personal file paths.

Phase 2
- Light shafts, and moving light on the sand and the tops of rocks and corals, are visible. Fish release bubbles.
- With Reduced effects on, the ripple, moving light and surface wave are gone, bubbles are fewer, and everything else is the same.
- The lighting changes smoothly between day and night with the computer's clock, and "Day/night lighting" off keeps the tank in daylight.
- 1 to 3 snails and 1 to 2 crabs crawl on the sand and over the rocks, rest between moves, never leave the tank, react when clicked, and are the same on every launch in number and kind.

Phase 3
- With the network off, the tank still shows from the last saved copy, collecting and feeding show "Offline", and after reconnecting everything works normally.
- The display name can only be chosen from the lists, and fish names are never shown to other players.

Phase 4
- A visitor can send at most 1 heart per tank per 24 hours, and not to their own tank.
- The owner sees visits and hearts in the visit log.
- Explore never comes back empty: with few real tanks it shows official tanks.
