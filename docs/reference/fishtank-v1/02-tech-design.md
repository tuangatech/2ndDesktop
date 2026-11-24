# Fish Tank — Technical Design

Status: Draft v0.9
Companion docs: 01-functional-spec.md (FR-n and NFR-n references point to it); 03-platform-design.md (the platform proposal); 04-implementation-phase-1.md and 05-implementation-phase-2.md (step-by-step plans for Phases 1 and 2)

**Files moved (2026-11-22, platform plan Step 1a, `06-implementation-platform.md`):** the tank is now the scene in `scenes/fishtank/`. `renderer/game/*` (except `drawing.js` and `SoundPlayer.js`, now in `renderer/`) is `scenes/fishtank/*`; `renderer/repo/` is `scenes/fishtank/repo/`; `renderer/hud.js` and `renderer/devPanel.js` are `scenes/fishtank/hud.js` and `devPanel.js`; `shared/rules.js` and `shared/config.js` are `scenes/fishtank/rules.js` and `config.js` (`shared/rng.js` stays). This document still says the old paths in many places; read them with this mapping. Nothing but the paths changed. **Step 1b (same day):** `scenes/fishtank/fishtank.js` is now `scenes/fishtank/index.js` (the factory is `create(host)`); `assets/species.json` and `assets/decor.json` are `scenes/fishtank/species.json` and `decor.json`; the atlas is `assets/spritesheets/fishtank.png` and `fishtank.json` (not `art.*`); the tank's HUD markup moved from `renderer/index.html` and its styles from `renderer/style.css` into `scenes/fishtank/hud.js` and `hud.css`; the art sources are `scenes/fishtank/art/*.svg` and the generator `scenes/fishtank/gen-decor-art.mjs` (was `assets/art/` and `scripts/gen-decor-art.mjs`); the host has `renderer/scenes.js` (the registry) and `renderer/art.js` (atlas loading). The IPC names `tank:*` are `scene:*`, and the tray menu comes from the scene (`scenes/fishtank/menu.js`).

Changes in v0.9 (what building Step 5 changed; sections 3.2 to 3.5, 3.7 and 3.8 were updated)
- The save is one record per scene id, `records/<scene-id>.json`, shaped `{ schemaVersion, savedAt, state }`, written by `electron/store.js` (atomic, with a backup, a damaged file moved aside). The repository is `LocalTankRepository` and the tank is created through one entry point, `createFishtank(host)` (3.4; docs/03-platform-design.md).
- The scene hit-tests clicks itself in one fixed order (egg, floating pellet, fish, water) instead of using the Pixi event system (3.2, 3.3).
- The tray menu is built from a summary that the renderer sends on request, and the actions come back through one fixed list (3.8). In desktop mode the main process polls the cursor and sends it to the renderer.
- The pacing simulator is built; it shows that a visitor at a random hour is slower than the spec's once-a-day figures (3.7).

Changes in v0.8 (what building Steps 1 to 3 taught us; sections 3.2, 3.3, 3.5, 3.8 and 14 were updated)
- Windows desktop mode is built with our own `koffi` module, and the way it is attached changed: the window must be shown as a normal window before it is moved onto the desktop, Chromium keeps an invisible frame inside it that has to be cancelled, and the covered-window check is ours (3.8).
- Both modes draw without antialiasing, to stay under the memory budget (3.2, 3.8), and the decoded atlas image is closed once it is on the graphics card (a lost WebGL context reloads the page; after 3 reloads within a minute it stops, the tank stays paused and the error is logged: `renderer/reloadGuard.js`).
- The art pipeline: the scenery (rocks, corals, weeds) is generated from seeds by a script and has real detail; the packer is our own; fish are three layers on one canvas (3.3).
- Fish and food are built as designed, with three changes: a wander that hops between targets, a chase speed that is solved from the pellets' landing times, and a repository stub that sits behind the final interface (3.3).

## 1. Summary

A desktop game for macOS and Windows, built with Electron (HTML, JavaScript) and PixiJS v8 for rendering. From Phase 3 it talks to a small HTTPS API on Railway backed by Postgres. The server owns the game economy (pellets, growth, hearts). The client renders the tank, runs the swimming animation, and sends player actions to the server.

The tank can live on the desktop itself, behind the icons and windows like a living wallpaper (desktop mode), or in a small window (window mode). Desktop mode is the riskiest technical part of the project, so it is tested in the first slice (3.8). The player looks after the fish from a tray menu, because a tank behind the icons receives no clicks.

The work is phased (functional spec, section 11). Phase 1 is a fully offline tank: there is no server, and the client keeps its state in a local file. The game rules are written once, in a shared module, so the same code runs locally in Phase 1 and on the server in Phase 3.

Why this stack
- Electron: the whole client is plain HTML and JS, with one codebase for macOS and Windows. The same code can later move to Tauri or a native WebView shell if app size matters.
- PixiJS v8: GPU-accelerated 2D rendering with meshes (bending fish, swaying plants), filters (water ripple) and a built-in pointer event system for clicking pellets.
- Railway with Postgres: one small service and one database, easy deploys from GitHub (Phase 3 onward).
- No realtime channel in v1: visits and activity are fetched when opened. This keeps the server simple and cheap.

### 1.1 Tech stack

Versions were checked on 2026-11-20. "Start with" is the major version to install; the exact version is then fixed by the committed `package-lock.json`. Electron is pinned to an exact version (no `^`), because each Electron release changes the bundled Chromium and Node.

| Layer | Choice | Start with | Phase | Notes |
| --- | --- | --- | --- | --- |
| Runtime for tooling | Node.js LTS | 24 | 1 | Pinned in `.nvmrc` and `engines`. Same major on the server in Phase 3. |
| Package manager | npm | 11 (ships with Node 24) | 1 | Plain npm; no workspaces until the server arrives in Phase 3. |
| Desktop shell | Electron | 45 (exact pin) | 1 | `contextIsolation` on, `nodeIntegration` off, `sandbox` on. |
| Client language | JavaScript, ES modules | ES2023 | 1 | Types through JSDoc, checked by the editor. The server (Phase 3) uses TypeScript. |
| Rendering | PixiJS | 8.x | 1 | WebGL backend (`preference: 'webgl'`), because WebGPU support in Electron is not consistent across both systems yet. The Phase 2 ripple uses the `DisplacementFilter` that ships with PixiJS, so no extra filter package is needed. |
| Renderer bundler / dev server | Vite | 8 | 1 | Renderer only. The Electron main and preload files are not bundled in Phase 1. |
| Unit tests | Vitest | 5 | 1 | Tests `shared/rules.js` and the repository. The same tests run on the server later. |
| End-to-end tests | Playwright (`_electron`) | 1.x | 1 | Smoke test on macOS and Windows runners. |
| Lint and format | ESLint (flat config), Prettier | 10 / 3 | 1 | Line endings forced to LF (see 14.5). |
| Windows desktop attach | `koffi` (Win32 calls from JavaScript, prebuilt, no compiler) | 3.x | 1 | Windows only, main process only. Version 3 ships its native code as prebuilt per-platform packages (`@koromix/koffi-win32-x64`), pointers are BigInt values. Chosen instead of `electron-as-wallpaper`, which compiles Rust at install and was last released in January 2025, before Windows 11 24H2 changed the desktop (see `docs/desktop-spike.md`). Works on Windows 11 build 26200 (3.8). On macOS the `desktop` window type needs no native call; `koffi` only reads the window list for the cover check (CoreGraphics, 3.8). |
| Tray | Electron `Tray` | built in | 1 | Template icon on macOS, PNG on Windows (3.8). |
| Packaging | electron-builder | 26 | 1 | `.dmg` (universal) and NSIS installer. `koffi` and its `@koromix` platform packages are unpacked from the asar archive; a universal macOS build needs both darwin packages (14.6). |
| CI | GitHub Actions | n/a | 1 | Matrix of `macos-latest` and `windows-latest`. |
| Bundled fonts | An open-licence font via `@fontsource/*` | n/a | 1 | Bundled, so text looks the same on both systems and works offline. |
| Art | SVG files drawn by Claude Code (including the tray icons); `@resvg/resvg-js` to render to PNG; our own shelf packer in `scripts/build-assets.mjs` | 2.x | 1 | Source files in `assets/art/`. See "Art pipeline" in 3.3. resvg draws SVG filters (noise, lighting, blur), which the scenery uses. The packer is about 20 lines, so `free-tex-packer-core` is not used. |
| Sound | Web Audio API, synthesized in code | n/a | 1 | No sound files, so no licences or downloads. |
| Diagnostics | A local JSON log and the clipboard | n/a | 1 | Nothing is sent over the network. See 3.7. |
| API server | Fastify, Zod, `pg`, node-pg-migrate | see 4.1 | 3 | TypeScript on Node 24. |
| Database | Postgres (Railway) | 16 or newer | 3 | Docker Postgres for local development. |
| Hosting | Railway | n/a | 3 | Staging and production environments. |

## 2. Architecture

```
+------------------------------+          HTTPS / JSON          +---------------------------+
| Desktop app (Electron)       |  <--------------------------> | Railway                   |
|  main process: window/desktop|        Bearer token           |  API service (Fastify)    |
|    host, tray, menu, secure  |                               |       |                   |
|    token storage, auto-update|                               |       v                   |
|  renderer: canvas game loop, |                               |  Postgres                 |
|    API client, local cache   |                               +---------------------------+
+------------------------------+
```

In Phase 1 the right-hand side of the diagram does not exist. The app reads and writes a local save file and the client applies the rules itself (see 3.4). In Phase 3 the server takes over the rules and the client becomes a renderer that sends requests.

Responsibilities (final design, Phase 3 onward)

| Concern | Client | Server |
| --- | --- | --- |
| Swimming, rendering, effects | yes | no |
| Pellet spawning, caps | display only | authoritative |
| Collect, feed, hearts | requests, optimistic UI for collect and feed | validates and applies |
| Growth, stage, colors | renders from fish data | computes stage and palette index |
| Timers and clocks | none that matter | server time only |
| Lighting, pointer reactions | yes | no |

## 3. Client design

### 3.1 Process layout

- Main process (main.js): creates the BrowserWindow in window mode or desktop mode (`desktop.js`, 3.8), the tray and menus, the login item, stores the player token, handles auto-update.
- Preload (preload.cjs): exposes a small API through contextBridge, for example getToken, saveCache, setAlwaysOnTop, and the fixed messages of 3.8 (tank summary, tank action, pointer position, flush).
- Renderer (index.html and JS modules): game loop, input, API calls. Node integration is off and contextIsolation is on.

Window mode settings: 480 × 320 by default, always 3:2, between 360 × 240 and 1200 × 800, resizable, frameless with a custom drag area, with remembered size and position, and an optional always-on-top. The full rules are in 3.7.

Desktop mode: a frameless window the size of the primary display, placed behind the desktop icons and all windows, with no focus and no clicks. How it is made on each system, the tray menu that replaces clicking, and the layout for any display size are in 3.8.

A transparent overlay with click-through (fish over other windows) is not planned (spec section 10).

### 3.2 Rendering and game loop (PixiJS v8)

Install `pixi.js` (8.x) from npm and bundle it in the app; no CDN is used, so the game works offline. Check the current PixiJS v8 docs when coding, because v8 renamed some classes (for example `SimpleRope` is now `MeshRope`, and constructors take option objects).

- A single Pixi `Application` owns the canvas. Its ticker is the game loop. All movement uses the frame time (delta), so speed is the same at any frame rate.
- Content-Security-Policy: the page allows no `eval` and no blob workers. PixiJS therefore loads its eval-free shader path (`import 'pixi.js/unsafe-eval'`, which needs no CSP change despite the name) and image decoding runs on the main thread (`Assets.setPreferences({ preferWorkers: false })`).
- Antialiasing is on in window mode and off in desktop mode. Multisampling cost about 70 MB of graphics memory on a full-screen tank, which was the difference between 305 MB and 235 MB against the 250 MB budget (NFR-4; `docs/perf-notes.md`).
- High-DPI: set `resolution` to the screen's device pixel ratio with `autoDensity` on, so the tank is sharp on Retina and on Windows display scaling. In desktop mode the resolution is also capped so that the drawing never has more pixels than 1600 × 900 (3.8).
- Size: the scene is laid out from the canvas width and height by the pure function `computeLayout` (3.8), never from fixed pixel values, so the same scene works in the 3:2 window and on any display.
- Frame rate: in window mode up to 60 fps while the window is active and 30 fps when it is visible but not active (NFR-2); in desktop mode always 30 fps (`ticker.maxFPS`). The ticker stops when the tank is hidden, minimized, fully covered, or the screen is locked or asleep (FR-22; see 3.7 and 3.8).
- Scene layers (Containers), back to front: water background (with the far reef, `backdrop.js`, drawn in it), water surface (FR-54), light shafts (FR-51), back decor (rocks, corals; paler and bluer, FR-53), the back haze (one water-coloured veil over the back decor row, `water.backHaze`; a Phase 1 addition of 2026-11-22, it sits between the back decor and the sand and is part of the water container, so a ripple filter covers it), sand floor, caustic light on the floor (FR-52), fish shadows (FR-55), bubbles, fish, pellets and eggs, front decor (weeds, foreground rocks), a thin front sand lip, a depth-shading gradient (FR-53), then a UI overlay. Everything between the background and the sand lip sits in one "water" container so a single ripple filter covers it.
- Phase 1 builds these layers: water background and the far reef, back decor, the back haze, sand floor, bubbles, fish, pellets and eggs, front decor, the sand lip and the UI overlay. Phase 2 adds the water surface, light shafts, floor light, fish shadows, the depth-shading gradient and the ripple filter, in the positions shown above, so the layer order never changes between phases. Crawling creatures (Phase 2) are drawn in the layer of the surface they walk on: on the sand they sit with the sand floor, between the floor light and the fish shadows; on a rock they sit in the same layer (back or front decor) as that rock.
- Entities: Fish, Pellet (floating), DroppedPellet (sinking), Egg, Bubble, BubbleEmitter, Decor, PointerTracker (Phase 1); Shadow, Creature (Phase 2).
- Swimming uses simple steering behaviors: wander in two dimensions, wall avoidance (surface, sand, sides), separation from neighbors, seek toward a dropped pellet. Speed scales down with fish size. Vertical movement follows 3.3 "Fish movement in depth".
- Input in window mode: the canvas gets `pointerdown`, `pointermove` and `pointerleave`, and `TankScene.click(x, y)` decides what was hit, in a fixed order: an egg, a floating pellet, a fish (an ellipse around the body, a little generous), then the water, where the click drops a pellet. Everything in the scene has `eventMode: 'none'`, so clicks work the same on mouse and trackpad and the order is easy to test. In desktop mode the canvas receives no input at all; the player uses the tray menu and the pointer position comes from the main process (3.8).

### 3.3 Fish, decor and water

Fish
- Art: each species has one set of textures used for all three stages, drawn as SVG, rendered at 3x the size they have in the default window (so they stay sharp on a 1080p desktop) and packed into a spritesheet (see "Art pipeline"). The stages differ only in size and palette (FR-12, FR-13). The art is drawn in neutral light tones so color can be applied in code.
- Three layers on one canvas: `tail` (tail and all fins, tinted by the `fin` color), `body` (tinted by `body`, with the eye) and `accent` (the stripe, tinted by `accent`). All three SVGs have the same 200 × 64 canvas with the fish facing right, so one array of rope points fits all three and no layer needs its own offset. The tail overlaps the body by 14 units, so the wave never shows a gap. A species is therefore three frames in `species.json` (`frames: { body, tail, accent }`), and the draw order is tail, body, accent.
- Body animation: each layer is a `MeshRope` that shares one array of 8 to 12 points (`ropePoints`), running from the tail (first point) to the head (last point), centred on the fish's origin. Each frame a sine wave travels from head to tail: `y = sin(phase - (1 - t) × 2π / wavelength) × amplitude × length × weight(t)`, where `t` is 0 at the tail and 1 at the head and `weight` grows from 0.12 at the head to `tailBoost` at the tail. The wave speed follows the swim speed, and a meal or a stage change swells the amplitude for about a second. Numbers per species are in `species.json` (`wave`).
- Turning: the facing sign follows the horizontal velocity (only when it is clearly non-zero), and the flip (`scale.x` of the inner container) eases through zero over 0.25 seconds, so fish never snap around. The pitch is `faceSign × atan2(vy, |vx|)`, limited to ±25° and smoothed, so a fish tilts its nose up when it climbs and down when it dives, whichever way it faces.
- Mouth: `species.mouth` is a fraction of the body length (x towards the head, y downwards), turned and scaled with the fish. `Fish.mouthOffset()` returns it in tank pixels; it is where food is eaten (and, in Phase 2, where bubbles come out).
- Color: each species has three palettes (fry, juvenile, adult) of 2 to 3 HSL colors. The server (or the local rules in Phase 1) provides `stage`, `species`, `seed` and `palette_variant`. The client tints the fish parts with the palette plus a hue shift from the seed (±20°). At a stage change the old and new palette are blended over 2 seconds with the bubble effect (FR-14).
- Size: scale = 0.5 + 0.5 × min(growth_points / 400, 1) (FR-12), applied to the fish container.
- Drowsy: if the time since `last_fed_at` (or since `created_at` for a fish that was never fed) is more than 36 hours, speed drops by 50% and saturation is reduced (FR-10). The fish's preferred depth moves to the lower third of the tank (FR-45).
- Anchors: `species.json` gives each species a `mouth` point (where bubbles come out and where food is eaten) in the fish's own coordinates, so they scale and turn with the fish.

Fish movement in depth (FR-45, Phase 1)
- Each species has a `depthRange` (0 at the surface, 1 at the sand, kept inside a margin from each edge), for example the angelfish mid-water and the tetra anywhere. Targets are drawn from the seeded generator inside that range.
- The wander is built from hops: every 4 to 10 seconds the fish picks a new target, a random point of the swimming area: a horizontal position at least 22% of the tank width away (`chooseHopX`) and a height inside the species depth range at least 20% of the swim height away (`chooseHopY`), and swims to it, slowing down on arrival. Both coordinates are free, so the paths run in all directions, diagonals to every corner included (the end-to-end test requires all four diagonals). Wall avoidance and separation are added to the wanted velocity, the vertical speed is limited to 65% of the swim speed, and the velocity follows the wanted velocity with a short delay, so turns and depth changes are smooth. The pure helpers (`wallForce`, `separationForce`, `chooseDepth`, `chooseHopX`, `chooseHopY`) are in `renderer/game/steering.js` and are unit-tested.
- Pitch: the fish container rotates toward the angle of its velocity, limited to about ±25° and smoothed; the head stays on the correct side when the fish flips (see Turning above).
- Drowsy fish use the range 0.67 to 0.92 of the depth.

Fish bubbles (FR-56, Phase 2)
- Each fish keeps a countdown drawn from 10 to 30 seconds. At zero it spawns 1 to 3 bubbles at its mouth anchor, 150 ms apart, using the shared bubble pool. Bubble size scales with the fish's size. When the window is hidden the countdown does not run.

Decor
- Sand: a tiling texture with a soft gradient and noise, along the bottom.
- Rocks and shells: sprites, a few variants each, placed at tank creation from a seed (FR-41).
- Corals and weeds: `MeshRope` or `MeshPlane` objects with a few points. Each frame the points move sideways by `sin(time × speed + phase) × amplitude × heightFraction`, so tops sway more than bases.
- Bubble chains (FR-44): `layoutDecor` marks 2 to 4 decor items (rocks and corals) as bubble sources and gives each a vent point. A `BubbleEmitter` per source runs a small state machine: emit a chain of 5 to 12 bubbles about 120 ms apart, then wait a random 4 to 15 seconds.
- Bubbles: one shared pool of about 60 small sprites (the chains and the fish bubbles use it), each rising with a sideways wobble, growing about 20% on the way up, then fading and playing a tiny ring at the surface before returning to the pool. If the pool is empty, a new bubble is simply skipped. Bubble counts scale with the window area, and in Reduced effects the pool is capped at about 20.

Dropped food and eating (FR-46, FR-47, Phase 1)
- Dropped pellet (`renderer/game/Food.js`): created at the clicked point (only above the sand line; clicks on the sand do nothing and spend nothing, and neither does a drop when there are no fish). It sinks at a constant speed of `waterHeight / 6` per second with a sine sway on x (the sway is small and ignored by the fish). It is not a click target. It is small: 3.4 units across, which is about 8% of an adult tetra's length (6 units looked too big). A pellet that reaches the sand rests there, slightly flattened, until it is eaten.
- Who eats it: the scene picks the fish with the shortest swim to it, counting the path through the pellets that fish already has queued, so a busy fish counts as farther away (FR-7; the "not full" rule comes with the rules in Step 5). The pellet goes onto that fish's `foodQueue`; other fish ignore it. While the queue is not empty the fish stops wandering. Pellets are eaten in the order they will land (the lowest first).
- Interception: the fish aims at `predictInterceptPoint(mouthPos, speed, pelletPos, pelletVelocity)`, the point where it would meet the pellet if both keep their speeds, clamped to above the sand line. The aim is for the mouth, not the middle of the fish, and the mouth is taken on the side the fish will face on arrival, so the aim does not jump while the fish turns around (an early version dithered because of that). The fish faces the pellet at once.
- Chase speed: the fish does not just swim 40% faster. `chaseSpeedFor(mouth, speeds, pellets, restY, margin)` tries the speeds 1.4, 1.9, 2.5 and 3.2 times the swim speed and uses the lowest one for which a simulation reaches every queued pellet, one after another, before it lands, with 20% of the time kept as margin and 0.35 seconds per meal. It is pure and unit-tested. A single pellet is usually chased at 1.4 times; a pellet at the far end of the tank, or a second and third pellet, make the fish dart. The limit is physical: two fish cannot reach three pellets dropped at the same moment in three corners within 6 seconds, and then a pellet lands and is eaten from the sand, as FR-47 requires. In an automated test with three pellets dropped about 0.35 seconds apart in the middle of the tank, 24 rounds had no pellet landing (`tests/e2e/feeding.spec.js`).
- Eating: when the distance between the mouth and the pellet is under a small radius (7 units plus 4 per size), the pellet is removed and the fish plays a short mouth pulse (a swell) and a wiggle (double wave amplitude for 0.9 seconds), and 2 or 3 tiny bubbles (the shared pool already exists, so this is in Phase 1). The scene then calls the `eat` hook, which will emit the `fed` event for the game loop (growth display, stage change effect) in Step 5.
- Because the economy is committed at drop time (the repository updates the stash, fullness and points right then, see the Phase 1 plan, decision D1), these animations never decide any numbers; a missed or interrupted animation loses nothing.
- Resize while food is sinking: pellet and fish positions are stored as fractions of the water area, so they keep their relative position.

Touching a fish (FR-48, Phase 1)
- Window mode only (FR-48). `TankScene.click` finds the fish under the click (`Fish.hitTest`, an ellipse) and calls `fish.poke()`, a 0.5 second wiggle (double wave amplitude), and the HUD (`renderer/hud.js`) opens the HTML label for 3 seconds: name (or species), stage, and "Hungry", "Full" or "Drowsy" (from `isFull` and `isDrowsy`), plus a rename button (FR-15). The label follows its fish. The rename box takes up to 16 letters, numbers and spaces; Enter saves, Escape cancels, and a bad name shows a message and changes nothing. The only repository call is the rename. No timers or numbers are shown, so the label stays calm.

Pointer reaction (FR-49, Phase 1)
- A `PointerTracker` records the pointer position, speed and time of the last move. In window mode it takes them from Pixi `pointermove` events and marks the pointer absent on `pointerleave`, window blur and when the window is hidden. In desktop mode the main process reads the global cursor position every 100 ms and sends it (3.8); the tracker marks the pointer absent when no update arrives for 2 seconds or the tank pauses.
- Each fish gets a `personality`: `curious` if `makeRng(seed ^ 0x9e3779b1).next() < 0.6`, otherwise `shy`. It is derived from the seed and not saved, so the save format does not change.
- Each fish has a reaction state (`none`, `approach`, `follow`, `flee`) and a `cooldownUntil` time. A fish notices the pointer when it is closer than `120 × (tankHeight / 320)` px and the pointer moved in the last 2 seconds. Curious fish `approach`, then `follow` with a gentle seek that stops about 40 px away, and stop after 8 seconds or when the pointer has been still for 3 seconds. Shy fish `flee` with a gentle force away, scaled up to 1.6 times when the pointer is fast. After a reaction ends, `cooldownUntil = now + 20 s`.
- The decision is a pure function `chooseReaction(fish, pointer, now, cfg)` so it can be unit-tested.
- Steering priority: eating (a non-empty `foodQueue`) comes first, then the pointer reaction, then normal wandering. Wall and separation forces always apply, so reacting fish still never leave the tank or overlap.
- A reaction only changes movement. It never calls the repository.

Water and light (all Phase 2)
- Ripple (FR-50): a `DisplacementFilter` with a tileable noise map that scrolls slowly, applied to the water container with a small scale. Set `filterArea` to the tank rectangle so the filter does not cover the whole screen.
- Light shafts (FR-51): 3 to 5 tall, soft, additive sprites at slight angles starting near the top. Their alpha and width follow slow sine curves (10 to 30 second cycles) with different phases, and the sprite gradient fades them out toward the sand. A plain sprite is cheaper than a filter and gives the same look; use a light-ray filter only if the sprites look flat.
- Light on the floor (FR-52): one tileable caustic texture (a bright net of wavy lines) is drawn as an additive `TilingSprite`, scrolled slowly in two directions with two layers at different speeds. It is shown only where there is sand or a rock: a silhouette mask is rendered once into a `RenderTexture` from the sand shape and the upper faces of the rocks and corals (rebuilt only when the window is resized), and used as the mask. This costs one extra draw and no filter. In Reduced effects the scrolling stops and the sprite shows a fixed patch.
- Depth shading (FR-53): a vertical gradient overlay (transparent at the top, a dark blue at the bottom, at most about 15% on fish) drawn above fish and below the UI, plus a per-layer tint: back decor is tinted paler and bluer and front decor stays neutral.
- Surface (FR-54): a thin `MeshRope` or a tiling strip along the top edge, with a sine wave moving along it and a bright color. Static in Reduced effects.
- Fish shadows (FR-55): a pool of soft dark ellipse sprites on the sand, one per fish, following the fish's x; scale and alpha shrink as the fish rises. The shadows stay on in Reduced effects.
- Reduced effects (FR-50) removes the ripple filter, light shaft animation, caustic scrolling and the surface wave, lowers the bubble cap, and lowers the frame rate cap to 30. Day/night colors, shadows and pointer reactions stay on. Reduced effects must meet the Phase 1 budgets (spec 7.3).

Day and night lighting (FR-57, Phase 2)
- A `Lighting` module turns the time of day into `nightness`, from 0 (full day) to 1 (full night). It is 0 from 07:00 to 18:00, rises to 1 between 18:00 and 20:00, is 1 from 20:00 to 05:00, and falls to 0 between 05:00 and 07:00. Both slopes use smoothstep, so there are no sudden changes. This function is pure (time in, number out) and unit-tested.
- Everything that depends on the time is a blend of a day look and a night look by `nightness`: the background (two gradient sprites cross-faded by alpha, so no texture is rebuilt), light shaft color (warm to cool) and strength, floor-light strength, the depth-shading overlay color and strength, and the back-decor tint. Fish are touched only through the depth overlay, which stays within the 15% limit (FR-53, FR-57).
- `nightness` is recomputed once a minute from the computer's local time and eased over about 2 seconds when it changes, so toggling the menu item never jumps. It is separate from the game clock used by the repository: changing the computer's clock changes only the lighting, never growth, pellets or drowsiness.
- With the "Day/night lighting" setting off, `nightness` is forced to 0. In Reduced effects it stays on, because it is only color blending.
- The dev panel gets a time-of-day slider and a "play one day in 30 seconds" button to check the transitions.

Crawling creatures (FR-58, FR-59, Phase 2)
- Walkable surfaces: each rock and coral kind in `assets/decor.json` gets a `walkLine`, a polyline along its top in its own coordinates. `layoutDecor` returns `walkPaths`: the sand line, plus the transformed `walkLine` of every rock or coral placed, and `links` where a rock meets the sand (its base points) so a creature can step between the sand and a rock. A creature stores a path id and a distance along that path, never free x and y.
- Counts come from `makeRng(decorSeed ^ 0x51ed270b)`: 1 to 2 crabs and 1 to 3 snails, plus a small body or shell tint. Starting positions are random on each launch and are not saved. Visitors in Phase 4 see the same counts because they use the same decor seed.
- Movement is a pure step function `stepCreature(creature, paths, dt, rng)` with two states, `rest` and `move`. Snail: 4 to 8 px/s, rests 5 to 20 s. Crab: bursts of about 1 s at 30 to 50 px/s, rests 2 to 8 s, with a chance of raising a claw while resting. At a link the creature picks the next path at random, and at the end of a path it turns back. Speeds scale with `windowHeight / 320`.
- Look: a snail's body stretches and shrinks with a sine wave while it moves and its eye stalks sway. A crab keeps its body direction and moves sideways while its legs bob. Both are a few pooled sprites (at most 5 creatures in all), drawn in the layer of the surface they walk on (3.2).
- Click (window mode only): `pointertap` on a creature plays a reaction for about 1 second (the snail pulls in its stalks, the crab raises both claws). Hit priority is: egg or pellet, fish, creature, water. Creatures never call the repository.
- They ignore food, fish and the pointer, pause with the rest of the scene when the window is hidden, and keep running in Reduced effects because they cost only a few sprites. Day and night shading reaches them through their layer.

Performance notes
- Use spritesheets and pooled objects. Avoid many separate filters on large areas, since filters are the main GPU cost.
- Measure early on a Mac and a Windows laptop with integrated graphics, and on a 2x display.

Art pipeline (all art and sound are created by Claude Code)
- Fish, decor, crawling creatures (Phase 2) and small textures are drawn as SVG files in `assets/art/`, in a clean vector style with soft gradients. Fish parts are drawn in neutral light tones (white to light grey) so the palette can tint them in code: per species, one SVG for the body, one for the tail (with the fins) and one for the accent (nine pieces for three species), all on the same canvas (3.3). The three stages share the shape and differ only in size and color.
- Scenery is generated: the first hand-drawn rocks, corals and weeds looked flat and fake, so `scripts/gen-decor-art.mjs` draws them from a seed per piece (`node scripts/gen-decor-art.mjs`, then `npm run assets`) and writes the SVG files, which are committed like any other art. Rocks are smooth silhouettes with stone relief (SVG noise and lighting filters), lit and shaded planes, cracks, barnacles and an algae film. Corals are recursive tapered branches with a light edge, pores and rounded tips; the sea fan is a net of spokes and cross links. Weeds are tapered blades with a vein and a shaded side. The six kinds are `rock-large`, `rock-small`, `coral-branch`, `coral-fan`, `weed-tall` and `weed-short` (`assets/decor.json` says which sway and which are bubble sources). `assets/art/STYLE.md` allows this extra detail for scenery only; fish stay simple and flat.
- `npm run assets` (a Node script in `scripts/`) renders each SVG to PNG at 3x the default-window size with `@resvg/resvg-js` (prebuilt binaries for Windows and macOS, no build tools needed) and packs the PNGs into one spritesheet with a small shelf packer of our own (tallest first, left to right), writing to `assets/spritesheets/`. The script also writes a contact sheet PNG showing all art side by side.
- Review loop: Claude Code looks at the contact sheet and at screenshots of the running tank (taken with Playwright), fixes what looks wrong, and the owner reviews screenshots and asks for changes. This is the quality gate, because art cannot be judged from code.
- Small textures (a bubble, a light shaft, a tileable caustic pattern, a soft shadow ellipse, a pellet sparkle) are SVG too, or generated in code where that is simpler (for example the caustic pattern).
- Sound effects are synthesized with the Web Audio API (`renderer/game/SoundPlayer.js`, D36). There are no sound files. The design:
  - Water sounds are small bubbles, as a real drop makes (a trapped air bubble that rings and rises in pitch): a sine that glides up about 35 to 50 percent in 40 to 60 ms, a quiet octave above it so small laptop speakers still carry it, and for the splash a very short, dark low-passed noise touch and a second, higher and fainter bubble. The pop is one bright, short bubble. The chime is three bell notes up the D major triad (F#5, A5, D6), each with a quiet overtone at 2.76 times its pitch for a glassy colour, ringing in the room.
  - One key (D major pentatonic) and one range (500 Hz to 1.5 kHz) for all sounds, so any two can overlap without clashing; a sound never picks the note it used last.
  - One shared chain, built once with the audio context: voices go to a dry bus and to a send into a convolution reverb whose 1.1 s impulse response is generated in code (decaying noise that darkens, fixed seeds), then a master gain, a low-pass at 6.5 kHz and a gentle compressor so overlapping sounds do not add up. The noise buffer is made once and reused.
  - Envelopes: silence, a 4 to 8 ms linear rise, then `setTargetAtTime` to zero (seven time constants long), so no voice starts or ends with a click. Oscillators are stopped at the end of the tail and every node of a voice is disconnected on `ended`. Nothing is allocated per frame; a sound makes up to about 16 small nodes.
  - Levels: the peaks, before the system volume, are about -19 dBFS (splash), -20 dBFS (pop) and -14 dBFS (chime, the rare one). `npm run sounds` opens a page that plays them and prints these numbers from an offline render of the same code.
  - Sources that informed it (ideas only, nothing copied): the Minnaert bubble model and the papers on synthesizing water sounds from bubbles (Cornell "Toward animating water with complex acoustic bubbles"; Hugh Pumphrey's finding that a drop's sound comes from a bubble under the surface); Microsoft's Windows "Sound" UX guideline (short, under a second, soft, 600 Hz to 2 kHz) and Material Design "Applying sound to UI"; MDN pages on `AudioParam.setTargetAtTime`, `exponentialRampToValueAtTime` and the Web Audio best practices, and the "Web Audio: the ugly click and the human ear" article on avoiding clicks; Moorer's "About This Reverberation Business" and the MDN `ConvolverNode` page for reverb from decaying noise; the Opera "Synthesising Drum Sounds with the Web Audio API" article for pitch-swept oscillators.
- Expectation: the result is a clean, stylized vector look, not painterly hand-drawn art. If the owner later wants a different style, only the files in `assets/art/` and `species.json` change.
- Licences: nothing is bought or downloaded. Fonts come from `@fontsource` (open licence); list the font in `assets/ATTRIBUTION.md`.
- If hand-animated characters are wanted later, Rive is an option with a web runtime. It is not needed for v1.

### 3.4 Local state, rules and the repository

Phase 1 has no server, so the client must be able to play the whole game on its own. Three pieces make that switch to a server in Phase 3 painless:

1. Shared rules module (`shared/rules.js`). Pure functions with the clock passed in: pellet spawn, fullness decay, growth stage, size, drowsiness, egg count. All tunable numbers come from one `config` file (`shared/config.js`), bundled with the app in Phases 1 and 2 and served by the server (`GET /config`) from Phase 3. The client uses the rules in Phase 1; the server imports the same file in Phase 3, so both compute the same results.
2. Repository interface. The game code never touches files or the network directly. It calls a `TankRepository` with methods such as `load()`, `collect(n)`, `feed(fishId)`, `hatchEgg()`, `renameFish(id, name)`.
   - Slice (Step 3): an in-memory stub with the same shape. It was replaced in Step 5 (below) and deleted.
   - Phase 1 (built in Step 5): `createLocalRepository({ storage, clock, rng, config, speciesIds })` in `renderer/repo/LocalTankRepository.js` keeps the state `{ localPlayerId, tank, fish }`, applies `shared/rules.js` for every action (`collect`, `feed`, `hatchEgg`, `renameFish`), saves after each successful action (`storage.save`), and notifies the scene through `subscribe` with an event that says what changed (`{ type: 'feed', fishId, pointsAfter }`, `{ type: 'hatch', fishId }`, `{ type: 'collect', collected }`, ...; the `TankEvent` typedef), so the scene reacts to the event and not to flags set around the call, which a Phase 3 repository that answers later could not honor. `load()` reads the record, runs `migrate` and `repairState` (wrong values are clamped or filled in and the fish kept, D34; only a record with no tank starts a new one; either way the original is kept as `records/<scene>-damaged-<time>.json` through `storage.keepCopy`; a record from a newer version is never overwritten) and catches up with the clock. `tick()` settles pellets and hunger in memory. `storage` is the main process in the app and a fake in tests, and `clock` can be moved by the dev panel. The interface is the typedef in `renderer/repo/TankRepository.js`.
   - Phase 3: `RemoteTankRepository` calls the API, keeps a local read-only copy of the last tank for viewing while offline (6.3).
3. Versioned save format. The save file has a `schemaVersion` so later versions can migrate it.

Save file (Phase 1)
- A JSON file in the app's user data folder (`app.getPath('userData')`: `~/Library/Application Support/<app>` on macOS and `%APPDATA%\<app>` on Windows). `<app>` is the `name` in `package.json`, so the **packaged** app uses `fish-tank` (checked on the Mac, 2026-11-23: `~/Library/Application Support/fish-tank`); a development run uses `Fish Tank (dev)` (`electron/main.js`), and the installer and the Dock use the `productName` "Fish Tank". A rename of the product changes this folder: copy the old one at the first start (see `docs2/platform/04`, section 5).
- Contents (Step 5): `records/fishtank.json` holds `{ schemaVersion, savedAt, state }`, where `state` is `{ localPlayerId, tank: { floatingPellets, pelletsUpdatedAt, stash, totalFed, eggsClaimed, decorSeed, hintShown }, fish: [{ id, species, seed, name, growthPoints, fullness, fullnessUpdatedAt, lastFedAt, createdAt }] }`. The renderer sends the whole record on every change, the main process keeps the latest copy and writes it after a second of quiet and on quit (decision D8), and a reload after a mode switch reads that copy. Window position and settings live in a separate `settings.json` (`activeScene` for now), and the diagnostics log in a third file (3.7).
- Written atomically: write a temporary file, then rename it over the old one, and keep one backup copy. Saves are debounced by about 1 second after a change and always happen on quit. A write that fails (a file held by an antivirus or the indexer, a full disk) is logged with its error code, stays pending, and is tried again after a growing delay (up to a minute); on quit it is tried twice.
- A damaged file falls back to the backup; if both are bad, the app starts a new tank and keeps the bad file aside.

On launch (Phase 1)
- Load the save, then catch up with the shared rules using the local clock. If the clock went backwards, the timers re-anchor to the new "now" (decision D9 in the Phase 1 plan), so changing the clock back gains nothing.
- Config: `shared/config.js` is bundled. Test builds (channel `test`) also read an optional `tuning.json` in the data folder and override known numeric keys within sane ranges, so pacing can be adjusted during a playtest without a new build. Release builds ignore the file. Active overrides are listed in the diagnostics text.

Phase 3 additions
- The player token is stored with Electron `safeStorage` (Keychain on macOS, DPAPI on Windows), never in plain text.
- On first connection the app uploads the local save once. The server checks it with the same rules module, clamps anything out of range, and accepts the import once per player. Fish names are stored as private text and returned only to the owner. The local file stays as a backup until the server confirms.
- On later launches: render from the cached snapshot immediately, then fetch `GET /v1/me/tank` and replace the cache. If the fetch fails, keep showing the cached snapshot, read-only (6.3).

### 3.5 Project structure

```
fish-tank/
  package.json
  package-lock.json
  vite.config.js         # renderer build and dev server
  eslint.config.js
  electron-builder.yml
  .nvmrc  .editorconfig  .gitattributes  .gitignore  .prettierrc
  .github/workflows/     # ci.yml (every push), release.yml (version tags)
  docs/                  # specs, designs, implementation plans
  tests/
    unit/                # Vitest: rules, repository
    e2e/                 # Playwright for Electron
  scripts/               # small Node scripts. Built: build-assets.mjs (render and pack art), gen-decor-art.mjs (draw the scenery), make-icons.mjs, run-electron.mjs (npm start and dev), shot.mjs (screenshots). Planned: pacing-sim.js
  electron/              # (built = in the repository now; the rest is planned)
    main.js              # built. Lifecycle (closing the window quits in window mode), IPC, single-instance lock, log file
    preload.cjs          # built. CommonJS on purpose: sandboxed preload scripts cannot be ES modules
    desktop.js           # built. Display mode: creates the window or desktop window, switching, the 2-second monitor, display changes (3.8). Safe start is planned
    desktop-win.js       # built. Windows only: attach behind the icons, keep attached, foreground window (koffi)
    desktop-mac.js       # built. macOS only: the windows on screen, for the cover check (koffi, CoreGraphics)
    frame-fit.js         # built. Pure: cancels the invisible frame Chromium keeps inside the desktop window (3.8)
    cover.js             # built. Pure: does the foreground window cover the desktop (Windows), how much of it do windows hide (macOS)? (3.8)
    sampler.js           # built. CPU and memory per process for the performance notes (FISHTANK_SAMPLE=1)
    tray.js              # built. The tray icon and its menu (3.8)
    menu.js              # built: buildTrayTemplate, the shared settingsItems (tray, gear menu and the macOS Tank menu) and buildAppMenuTemplate (the macOS menu bar). Windows has no application menu
    store.js             # built. Atomic JSON write with backup, damaged files moved aside, the debounced writer, the record store (one file per scene id)
    placement.js         # pure function that fits the saved window position onto the current displays
    diagnostics.js       # local usage and measurement log, "Copy diagnostics" text
  renderer/
    index.html
    main.js              # built. Boot, input (a click drops a pellet in window mode), the tray feed message, the dev panel
    devPanel.js          # built. Slice only: points slider, drowsy, 2 or 8 fish, drop a pellet (FISHTANK_DEV=1, window mode)
    game/                # built: TankScene, layout.js (computeLayout, layoutDecor), Fish, Food (DroppedPellet and FoodSystem),
                         # steering.js, palette.js, repository.js (slice stub), Bubbles, SwayMesh, textures, drawing, visualConfig.
                         # Step 5 added: fishtank.js (the one entry point), Pellet.js (floating pellets), Egg.js, pointer.js (PointerTracker, chooseReaction).
                         # Planned: water effects
    host.js              # built. The scene contract as a typedef (SceneHost, Scene); there is no loader yet (D33)
    hud.js               # built. Window mode only: stash counter, toasts, the fish label and its rename box
    repo/
      TankRepository.js  # built. The interface as a typedef
      LocalTankRepository.js    # built. Phase 1: state, rules, saving, migrate and repair
      RemoteTankRepository.js   # Phase 3
    api.js               # fetch wrapper (Phase 3)
    cache.js
  shared/
    rules.js             # pure game rules, used by client and server (built so far: stageOf, sizeOf)
    config.js            # tunable numbers (built so far: growth thresholds, start stash)
    rng.js               # built. Small seeded random generator (decor layout, fish hue shift, pointer personality)
    names.js             # adjective and sea-creature lists for display names (Phase 3)
  assets/
    art/                 # source art
    tray/                # tray icons (macOS template image, Windows PNGs)
    app-icon.png         # 256 px app icon, rendered from build/app-icon.svg: the window icon and the About box (the installed app uses the .exe and .icns icons)
    spritesheets/        # packed textures
    sounds/
    species.json         # built for the tetra: frames, art length, rope points, wave, speed, mouth, depth range, palettes
    decor.json           # built: the six decor kinds, which sway, which are bubble sources, vent points
  server/                # Phase 3
    package.json
    src/
      index.ts
      routes/
      services/          # tank, fish, hearts, visit log, official tanks
      db/migrations/
    scripts/             # seed-official (creates the official tanks)
```

### 3.6 Cross-platform (macOS and Windows)

The renderer code is identical on both systems. The differences are in the shell around it:

| Area | macOS | Windows | How we handle it |
| --- | --- | --- | --- |
| App lifetime | Apps normally stay running with no windows | Closing the last window quits | In window mode, closing the window quits the app on both systems (`window-all-closed` calls `app.quit()`, except while switching modes). The tray icon (3.8) also offers Quit, and in desktop mode it is the only way to quit. Minimizing keeps the game running, and the next launch catches up |
| Tray | Menu bar item with a template image (`Tray`) | Notification area icon, which Windows may move to the overflow area | The same code on both; `popUpContextMenu` on click, so the menu is rebuilt each time (3.8) |
| Desktop mode window | `type: 'desktop'` window below the icons; shows on all Spaces; Dock icon hidden | Child window of the desktop layer through Win32 calls (`koffi`); structure differs between Windows 11 24H2 and older builds | Mode controller in `electron/desktop.js`; Windows details in `electron/desktop-win.js`; checked on both systems in the slice (3.8) |
| Menu | Application menu in the menu bar, the tray menu, plus the in-window gear menu | The tray menu and the in-window gear menu | One menu definition for the tray and the gear menu; on macOS the application menu adds Cmd+Q and Cmd+W |
| Window frame | Optional hidden-inset title bar | Frameless needs its own buttons | Frameless with a CSS drag region on both, own close and minimize buttons (window mode) |
| Fixed 3:2 shape while resizing | `setAspectRatio` works | `setAspectRatio` can jitter on edge resize | If it jitters, drop the 3:2 lock on that system and keep only the size limits (3.7) |
| Always on top | `setAlwaysOnTop(true, 'floating')`; does not show over other apps' full-screen spaces | `setAlwaysOnTop(true)`; may show above borderless full-screen windows | No full-screen workaround (decision D20); documented in the README and About |
| Covered-window pause | Occlusion reported as hidden by Chromium | Native window occlusion reported as hidden by Chromium | Verify in the slice (3.7); fall back to the 30 fps unfocused mode if a system does not report it |
| Placement at launch | Spaces, notch, menu bar | Taskbar on any edge, mixed scaling | Pure placement function run once at launch (3.7) |
| Launch at login | `app.setLoginItemSettings` | `app.setLoginItemSettings` | Same call, off by default |
| Secure token storage (Phase 3) | Keychain via `safeStorage` | DPAPI via `safeStorage` | Same call |
| Save and log paths | `~/Library/Application Support` | `%APPDATA%` | Always use `app.getPath` and `path.join` |
| Shortcuts | Cmd | Ctrl | Use `CmdOrCtrl` accelerators |
| Fonts | System fonts differ | System fonts differ | Bundle the fonts the game uses |
| High-DPI | Retina (2x) | Display scaling 100% to 200% | Pixi `autoDensity` with device pixel ratio |

Both systems are tested from Phase 1 onward, not at the end.

### 3.7 Desktop behavior, budgets and diagnostics (Phase 1)

This section turns the spec's window requirements (FR-19, FR-20, FR-22) and budgets (NFR-1 to NFR-7, spec 7.3) into design. The window rules apply to window mode; desktop mode is in 3.8.

Window size and shape (FR-19)
- `BrowserWindow` options: `width: 480`, `height: 320`, `minWidth: 360`, `minHeight: 240`, `maxWidth: 1200`, `maxHeight: 800`, plus `setAspectRatio(3 / 2)`. The tank fills the whole window; the 22 px strip overlays its top edge, so the 3:2 shape applies to the tank.
- On Windows, `setAspectRatio` counts the invisible frame of the window (about 8 px each way), so the window opened 4 px narrower and lost a few more pixels at every start (measured on Windows at 100% scale and on the CI runner, 2026-11-21). So the 3:2 lock is on macOS only, and Windows keeps only the minimum and maximum size; the spec says so (FR-19). There is no `will-resize` workaround.
- Also on Windows at a fractional scale (125%, 150%), the system rounds a rectangle outwards: a window made with the saved size came out a few pixels larger, and the saved size grew about 4 px at every start. `settleBounds` (desktop.js) corrects the request after the window is created until `getBounds()` is the wanted size.
- The maximum is also limited to the usable area (`workArea`) of the display the window is on: on `moved` (debounced), call `setMaximumSize` with `min(1200 × 800, workArea)`.

Position and placement at launch (FR-19)
- `settings.window = { x, y, width, height }`, in device-independent pixels, written (debounced 500 ms) on `resize` and `move`.
- `fitWindowToDisplays(saved, displays, primary)` in `electron/placement.js` is a pure function that returns the bounds to use. If saved bounds exist and at least 100 × 60 px of the window lie inside some display's work area, keep the position (shifted so the window is fully inside) and clamp the size to that work area. Otherwise use the primary display: the saved size (or the default), clamped, placed in the bottom-right corner of the work area with a 24 px margin. The first launch has no saved bounds, so it takes the same path.
- Built as designed (2026-11-21). Details: the saved width decides the size and the height follows from 3:2; the limits come from `sizeLimitsFor(workArea)` (1200 × 800 at most, 360 × 240 at least, both lowered to fit a smaller work area, so the window never ends up larger than the display); the display with the largest visible part of the window wins; the save happens 500 ms after the last `move` or `resize`, at once on `close` and before the switch to desktop mode, and uses `getNormalBounds()` so a minimized window is not saved at its off-screen place.
- It is unit-tested with fake displays: one display; two displays; the second one removed; mixed scale factors; a taskbar or menu bar on any edge; a work area smaller than the minimum size; the saved window half off-screen.
- Placement runs at launch only. A monitor that is unplugged while the app runs is handled by the operating system, which moves the window, and the next launch runs the placement again. The renderer updates its resolution when the pixel ratio changes (3.2), so moving between a 1x and a 2x display keeps the picture sharp (FR-43).

Always on top (FR-20)
- `setAlwaysOnTop(true, 'floating')` on macOS and `setAlwaysOnTop(true)` on Windows; off by default, saved in `settings.json`. There is no full-screen workaround (decision D20 in the Phase 1 plan).
- On macOS the window stays on its own space and does not appear over other apps' full-screen spaces. On Windows a topmost window can appear above a borderless full-screen window, and Electron has no way to detect other apps' full-screen state. This is accepted for Phase 1 and documented in the README and About. A native check (`SHQueryUserNotificationState`) is a possible later fix.

Pausing (FR-22, NFR-1)
- The renderer stops the ticker when `document.visibilityState === 'hidden'`. Chromium reports minimized, hidden and (through native window occlusion tracking) fully covered windows as hidden on Windows and macOS.
- The main process also sends `paused` and `resumed` messages on `hide`, `minimize`, `show` and `restore`, and on `powerMonitor` `lock-screen`, `unlock-screen`, `suspend` and `resume`.
- Verify the covered-window case on both systems in the slice (cover the tank with another window and log `visibilitychange`). If a system does not report it, the tank keeps running at the 30 fps unfocused mode (NFR-2) there, and the limit is noted in `docs/perf-notes.md`.
- While paused nothing runs on a timer, except the diagnostics sampler in the main process (once a minute). Pellets, hunger and drowsiness are computed lazily on resume, so there is nothing to catch up by ticking.

Politeness (NFR-6)
- The app never calls `focus()` on its window. When it is started at login (`--login` argument passed through `setLoginItemSettings({ args })` on Windows, `wasOpenedAtLogin` on macOS), it shows the window with `showInactive()`. The desktop window is created with `focusable: false`.
- No `Notification` is ever created, and there are no dock, taskbar or tray badges and no flashing icons.
- Sounds are played only from handlers of player actions. A unit test checks that `SoundPlayer.play` is never called from a timer or from the game tick.

Measuring the budgets (NFR-1 to NFR-5)
- A sampler in the main process runs once a minute and calls `app.getAppMetrics()`. CPU is the sum of `cpu.percentCPUUsage` over all processes; memory is the sum of `memory.workingSetSize` (and `privateBytes` where available) in MB. These numbers are a guide; pass or fail for memory is decided with Activity Monitor and Task Manager.
- The renderer sends the average frame rate over the last minute, and reports the first rendered frame, which gives the start time for NFR-5.

Diagnostics log and "Copy diagnostics" (NFR-7)
- `electron/diagnostics.js` keeps `diagnostics.json` in the data folder (written with `store.js`, schema version 1):

```json
{
  "schemaVersion": 1,
  "installId": "random-local-id",
  "firstSeenDay": "2026-11-21",
  "days": { "2026-11-21": { "opens": 2, "desktopMin": 170, "windowMin": 20, "activeMin": 2 } },
  "desktop": { "layout": "new", "attachMs": 240, "failures": 0, "lastReason": null },
  "samples": [ { "t": 1790000000000, "state": "visible-desktop", "cpuPct": 1.8, "memMB": 190, "fps": 30 } ],
  "errors": [ { "t": 1790000000000, "msg": "TypeError: x is undefined" } ],
  "startupMs": [1450]
}
```

- `desktopMin` and `windowMin` count each minute in which the tank was drawn in that mode (so visible time is their sum, and paused or covered minutes are not counted). `activeMin` counts each minute with at least one click or key press in the window, or one tray menu action (mouse movement alone does not count). `desktop` holds the last attach result: the layout found (`new` or `classic` on Windows), how long it took, the number of failures and the last reason (3.8). Days use the local date. The log keeps 30 days, the last 500 samples, 20 errors and 10 start times.
- The renderer reports state changes, clicks, frame rates and errors (`window.onerror` and unhandled rejections) through fixed IPC messages.
- `sanitize(text)` replaces the home folder and the user name with `~`, reduces absolute paths and `file://` URLs to the file name, and cuts messages to 200 characters. It is unit-tested with Windows and macOS paths.
- "Copy diagnostics" calls `buildText()` and writes to the clipboard: app, Electron and OS versions, architecture, GPU description (`app.getGPUInfo('basic')`), display sizes and scale factors, display mode and the desktop attach result, window size, settings and active tuning overrides, number of fish and total pellets fed, the usage summary as a short per-day table (date, opens, desktop minutes, window minutes, active minutes), the CPU, memory and frame rate summary, the start times and recent errors. The playtest numbers are read from these tables by hand and typed into a spreadsheet; there is no summary script.
- Built as designed (2026-11-21), with these details: the sampler is `createUsageLog().start()` in `electron/usage-log.js`, a 60 second timer that is `unref`ed and the only one that runs while the tank is paused; a paused minute is sampled (its CPU should be near zero, NFR-1) but not counted in `desktopMin` or `windowMin`; `activeMin` counts a minute once, from a click or key press (the renderer reports at most one per 10 seconds) or a tray menu action; memory is the private bytes of all processes where the system has them, else the working set (on macOS Electron gives only the working set, which counts pages shared between the processes and reads about 190 MB above the footprint the Mac limit is measured in, so "Copy diagnostics" says which number it is, in a line under "Measurements"); the start time is `process.uptime()` when the renderer says it is ready (`tank:ready`); errors come from the page (`error` and `unhandledrejection`), the main process (uncaught exception, unhandled rejection) and are cleaned with `sanitize` and `shortenPaths` (paths and `file://` URLs become the file name) and cut to 200 characters. The file is written with a 2 second debounce and on quit; a damaged file starts a new log. The per-day table in the copied text is tab separated so that it pastes into a spreadsheet. `FISHTANK_DIAG_MS` shortens the interval in tests (`FISHTANK_TEST=1` only).
- Nothing is sent over the network. The `installId` is random and local; it lets a tester's pastes be grouped and identifies nobody.

Pacing simulator
- `scripts/pacing-sim.js` (`npm run sim`) uses `shared/rules.js` to play 30 days for several visit patterns (daily at a fixed hour, daily at a random hour, every 12 hours, every 3 days, never) with the 2 starting fish and egg hatching. It prints the day each fish reaches juvenile and adult, the day of the first egg and of the eighth fish, pellets wasted, and how often a visit found everyone full.
- Built in Step 5 (`scripts/pacing-sim.js`, `tests/unit/pacing.test.js`). A unit test asserts the design promises from spec 7.2 (juvenile on day 3, adult on day 10 and the first egg on day 3 for a daily visitor; no growth for a player who never visits), so a change to `shared/config.js` that breaks them fails the build. The first run found that the promise holds for a visitor at the same hour every day: a visitor at a random hour feeds about 1.5 pellets per fish per day and reaches adult after about 14 visits (see the Phase 1 plan, Step 5).

### 3.8 Desktop mode and the tray (Phase 1)

This section turns FR-60 to FR-64 into design. Live-wallpaper apps inspired it. Deskland (a Windows wallpaper made with C# and WebView2, GPL-3.0) was read to learn the technique only. No code is copied from it, and the Win32 calls below are written from the public Windows documentation.

Two modes, one app
- Both modes run the same renderer, rules and save file. The mode only decides which `BrowserWindow` the main process creates, and whether the renderer shows its in-window UI (strip, labels, hints).
- `electron/desktop.js` owns the mode. `setMode(mode)` asks the renderer to save (`tank:flush`), sets a `switching` flag so that `window-all-closed` does not quit, destroys the current window, creates the new one and stores `settings.displayMode`. Re-creating the window is simpler and safer than re-parenting a live one, and it loses nothing, because the tank is saved and everything else is computed from the stored values and timestamps. The renderer gets `?mode=desktop` or `?mode=window` in its URL.
- First launch: no `displayMode` is stored, so window mode opens with the hint from spec section 8. Later launches use the stored mode. `FISHTANK_MODE` forces a mode in development (14.4).

How the window is made on each system

| | Windows | macOS |
| --- | --- | --- |
| Window options | `frame: false`, `skipTaskbar: true`, `focusable: false`, `resizable: false`, `hasShadow: false`, `show: false`, an opaque background; created small (240 × 150, in the bottom-right corner) and moved to the primary display's bounds only after it has been shown (see "Attaching on Windows"). `transparent` is not needed | `type: 'desktop'`, `frame: false`, `focusable: false`, `resizable: false`, `hasShadow: false`; bounds = the primary display's `bounds` |
| Where it sits | A child of the desktop layer: above the system wallpaper, below the icons (details below) | Electron's `desktop` window type puts it at the desktop background level, below the icons |
| Spaces and Dock | n/a | `setVisibleOnAllWorkspaces(true)`; `app.dock.hide()` in desktop mode and `app.dock.show()` in window mode. macOS ignores a hide early in a launch (M1, 2026-11-22: the icon stayed in the Dock in every desktop-mode start, in development and packaged builds, while a hide 1 second later worked), so desktop mode checks `app.dock.isVisible()` and hides again every half second, for up to 5 seconds; window mode cancels that |
| Mouse | It receives no clicks from the system, which is intended | Electron documents that a desktop-type window gets no keyboard or mouse events; `setIgnoreMouseEvents(true)` is set as well |
| Native code | Win32 calls through `koffi` (below) | None for the window: on macOS 27.2 (M1, 2026-11-21) it shows above the wallpaper and below the icons with no native call and no show-first step. The cover check reads the window list through `koffi` (below) |

Attaching on Windows (`electron/desktop-win.js`)
- `koffi` is a foreign-function library with prebuilt binaries, so there is no compiler step and no `node-gyp`. It is loaded only in the main process: on Windows for the attach and the cover check, on macOS for the cover check only. We use our own small module; `electron-as-wallpaper` was skipped (1.1).
- Show first, then attach. The most important finding of the slice: Chromium draws nothing in a window that was attached to the desktop layer before it was ever shown as an ordinary top-level window. The tank showed only the window's background colour, in every variant tried (layered, transparent, opaque, inside the wallpaper `WorkerW`). The fix is `showInactive()` on the small corner window, a 200 ms wait, and only then the attach and the resize to the whole display. With that, all four tried variants draw the tank on Windows 11 build 26200; the default is the plainest one (`opaque+show`, opaque window, parent `Progman`). The corner window is visible for a fraction of a second. The variants stay in `electron/desktop.js` (`VARIANTS`) for `npm run attach:lab`, which shows each variant with a label and a magenta page background, so a failure on another Windows build can be diagnosed on the spot.
- `attachToDesktop(handleBuffer, rect, options)`:
  1. `hwnd` comes from `win.getNativeWindowHandle()`; the window has been shown (above).
  2. `progman = FindWindowW('Progman')`. Send Explorer the undocumented message `0x052C` once (`SendMessageTimeoutW(progman, 0x052C, 0xD, 1, 0, 1000, …)`) so that it creates the wallpaper layer. Sending it more than once can delete the layer. The result is ignored and the windows are looked up with a retry for up to 2 seconds.
  3. Detect the layout by looking at the windows, not at the Windows build number. If `Progman` has a child of class `SHELLDLL_DefView` (the layout of Windows 11 24H2 and later, called `new`), the parent is `Progman` and our window is inserted right after `SHELLDLL_DefView` in the order, so it is below the icons and above the system wallpaper windows; Explorer's own wallpaper `WorkerW` children are first sent to the bottom. Otherwise (`classic`), find the top-level window that holds `SHELLDLL_DefView` and use the `WorkerW` window that follows it as the parent. Only the `new` layout has been tested so far.
  4. Replace `WS_POPUP`, `WS_CAPTION` and `WS_THICKFRAME` with `WS_CHILD | WS_VISIBLE`, call `SetParent(hwnd, parent)`, convert the display's physical bounds into the parent's coordinates with `ScreenToClient`, and call `SetWindowPos` with `SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW` (see "No gaps at the edges" below).
  5. Return `{ ok, layout, ms, parent, hwnd }` or `{ ok: false, reason }`. Each call is wrapped so that nothing throws and nothing blocks for more than 1 second.
- No gaps at the edges. Chromium keeps an invisible frame inside a frameless window: on the test machine the client area (where the page is drawn) was 2541 × 1591 inside a 2561 × 1601 window, so a strip of the wallpaper showed on the left and right. `placeWindow()` places the window, reads the window rectangle, the client rectangle and the client origin (`GetWindowRect`, `GetClientRect`, `ClientToScreen`), and if the client is inset, places the window again, bigger by exactly the insets. The window is clipped to its parent, so only the client area, which now covers the whole display, shows. `frameInsets()` and `compensate()` in `electron/frame-fit.js` are pure and unit-tested, and the same function runs after every display change.
- Stacking order. A later move must keep the order: `moveOnDesktop` uses `SWP_NOZORDER`. An early version moved the window with `HWND_TOP` after a display-change event and covered the icons.
- Keeping it attached: a check every 2 seconds, only while the tank is visible, tests `IsWindow(parent)`, `GetParent(hwnd) === parent` and that the window is visible. If something is wrong (Win+D, Explorer restarted, the wallpaper changed), the window is destroyed and created again after 1 second. If the attach fails (after an Explorer restart there is no `Progman` for a few seconds), the window is destroyed and the attach is tried again every 3 seconds; after 10 failures within 60 seconds the app switches to window mode (FR-64). Win+D has been tested on Windows 11 build 26200 (the tank survives). The first Explorer restart test (2026-11-21) fell back to window mode at once because the old code gave up after the first failed attach; the retry above is the fix and is to be confirmed.
- Killing Explorer (Task Manager, Restart) ends the app (found 2026-11-21, twice, exit code `0xC000041D`, "fatal exception in a user callback", and no line in the log). The tank is a child window of Explorer's window; when Explorer's process dies, Windows destroys the child from inside the death and Chromium cannot survive that. It is reproducible without touching Explorer: an Electron window attached to a window of a throwaway process dies the same way when that process is killed, also with an in-process holder window in between, while destroying the window from inside the app is harmless. There is no warning before Explorer dies, so the window cannot be moved out in time. The app now logs uncaught errors, gone child processes and the exit code. Win+D, which does not kill Explorer, is not affected.
- The fix is not a watchdog process (it would cost about 30 MB of the memory budget for a rare event) but Windows itself: while the tank is on the desktop, `electron/crash-restart.js` calls `RegisterApplicationRestart` (crash only: no restart after a hang, a patch or a reboot) with the command line `<app folder in a development run> --restarted`, and `UnregisterApplicationRestart` in a window. Tested with the throwaway-parent test: Windows started the app again after the kill. Windows restarts only an app that ran for at least a minute before it crashed, which also prevents a crash loop at startup. The new process finds `displayMode: desktop` and `desktopAttempt: ok` and attaches again; if Explorer is not back yet, the existing retry (every 3 seconds) covers it. A development run is restarted without its environment variables (FISHTANK_USER_DATA and the like), an installed app has none. The log shows `restart after a crash: on` when it is registered.
- A normal quit during the 10 seconds of `trying` stores `ok` (`settingsOnQuit`): the app was running and shut itself down, which is neither a crash nor a hang.
- Widgets that add their own child window to the desktop layer (a Bing Wallpaper widget was seen) did not stop the attach.
- Not supported on purpose: reading desktop icon positions, global mouse hooks, anything that writes to Explorer's memory.

Safe start (FR-64)
- Built as designed (2026-11-21), with these details: the two settings are `displayMode` (`window` or `desktop`; nothing on the first launch, which opens a window) and `desktopAttempt`; the pure `chooseStartMode` and `settingsForMode` are in `electron/display-mode.js`. `trying` is written before every attach (also a re-attach after Win+D). "The first frame" is the renderer's `tank:ready` message, sent when the tank has finished starting, not a drawn frame, so a desktop that is covered from the start still confirms; then 10 seconds in which the window is not replaced. A run that gives up on the desktop (too many failed attaches) is stored as a window with `failed`, so the next launch does not try again by itself; "Show on desktop" in the tray tries again. `FISHTANK_MODE` forces a mode and the run stores nothing.
- Before attaching, the main process writes `settings.desktopAttempt = 'trying'`. It writes `'ok'` after the first rendered frame and 10 stable seconds. If a launch finds `'trying'` (the last attempt crashed or hung), it starts in window mode, sets a note for the tray ("Couldn't show on the desktop, showing in a window") and stores `'failed'`. The player can try again from the tray menu. The result, the layout found, the time it took and the number of failures go into the diagnostics (3.7).

Pausing in desktop mode (FR-22, NFR-1)
- macOS: Chromium sets `visibilityState` to hidden only when a full-screen app takes the Space (green button): the log says `renderer visibility: hidden` and the frame-rate lines stop (M1, macOS 27.2, 2026-11-21). A normal window as large as the screen does not count: the tank kept drawing at 30 fps (about 1.3% CPU) behind a Finder window and behind a test window filling the screen (2026-11-22). So desktop mode checks too, in the main process, every 2 seconds: `electron/desktop-mac.js` reads the windows on screen in the current Space with `CGWindowListCopyWindowInfo` through `koffi` (bounds, layer, alpha and owner process id only; this needs no Screen Recording permission, which only guards window titles), and the pure `coveredShare` in `electron/cover.js` adds up how much of the primary display's work area (`screen.getPrimaryDisplay().workArea`, below the menu bar and beside the Dock) the normal windows (layer 0) of other processes hide together. At `MAC_COVER_SHARE` (96%) or more the tank pauses with the reason `cover`; the margin lets tiled windows with their small gaps count. Unlike the Windows check it looks at every window, not only the front one, so two windows side by side also pause the tank. The share is logged in steps of a tenth (`windows hide 100% of the desktop; covered=true`). One reading takes about 0.4 ms. If `koffi` cannot load, the log says `cover check unavailable` and only the full-screen case pauses. Tested on M1 (2026-11-22) with a maximized editor in front: 2 seconds after the start the log said `windows hide 100% of the desktop; covered=true` and `desktop is covered: pausing`, no frame was drawn, and the app used 0.3% CPU instead of 1.3%. The owner checked resuming by hand the same day: Show Desktop (Fn+F11) logged `windows hide 1% of the desktop` and `desktop is visible: resuming` within 2 seconds, the tank drew at 30 fps again, and pressing it again paused it. An unsigned arm64 build from electron-builder loads `koffi` from `app.asar.unpacked` and pauses the same way. With Stage Manager on, the windows in the side strip are reported at their small size, so only the window in front counts and the fish swim around it; "Click wallpaper to reveal desktop" resumes the tank while the desktop shows (owner, M1, 2026-11-22). Two windows tiled left and right are covered by a unit test of `coveredShare` but were not tried by hand.
- Windows: Chromium does not report a child of the desktop layer as covered, so desktop mode does its own check in the main process, every 2 seconds (the same timer as the attach check). It takes `GetForegroundWindow()`, skips the shell windows (`Progman`, `WorkerW`, `Shell_TrayWnd`, `Shell_SecondaryTrayWnd`, `SHELLDLL_DefView`) and our own process, and decides "covered" if that window is visible, not minimized, not cloaked (`DwmGetWindowAttribute` with `DWMWA_CLOAKED`), centred on the primary display, and either maximized (`IsZoomed`) or as large as the display. The decision is the pure function `decideCovered` in `electron/cover.js`, which takes edges (`left`, `top`, `right`, `bottom`); `rectToEdges` converts Electron's `{ x, y, width, height }`, and the first version missed that conversion, so it never paused (found from the log, now tested). A covered tank pauses with the reason `cover` (reasons `cover`, `hidden` and `power` are tracked together, so the ticker restarts only when none is left; the pause is sent to the renderer when it changes, and again whenever a page reports ready, because a page that reloaded after a lost graphics context starts unpaused: found on M1 on 2026-11-22, where a covered desktop tank drew again after such a reload). The monitor logs each change of the foreground window with the decision, so a missed pause can be explained from the log. Tested on build 26200: maximizing a window pauses the tank and restoring it resumes. This only looks at the foreground window, so a maximized window behind a small focused one is missed and the tank keeps drawing (accepted; a walk over all top-level windows is a later improvement). NFR-1 is about the game, so this 2-second check in the main process is allowed; it costs almost nothing.
- Lock, unlock, suspend and resume come from `powerMonitor`, as in window mode (3.7).

Pointer in desktop mode (FR-49)
- The renderer gets no pointer events, so the main process reads `screen.getCursorScreenPoint()` every 100 ms while the tank is drawn in desktop mode, converts it into tank coordinates (relative to the primary display, in device-independent pixels) and sends `pointer:pos` only when it changed, or `null` when the cursor is on another display. The timer exists only while the desktop tank is drawn (it stops when the tank is paused, in window mode and on quit), so a paused tank reads nothing (NFR-1). The `PointerTracker` (3.3) accepts either source: the canvas pointer events in window mode, `pointer:pos` in desktop mode. A fish that is eating ignores the pointer.

The tray (`electron/tray.js`, FR-61, FR-62)
- One `Tray` exists whenever the app runs, in both modes. Icons are drawn as SVG by Claude Code and rendered by `npm run assets`: a monochrome template image for macOS (`assets/tray/trayTemplate.png` and `@2x`, 16 and 32 px, so the system colors it for light and dark menu bars) and 16, 24 and 32 px PNGs for Windows. The tooltip is the static text "Fish Tank". There are no badges, no balloons and no flashing.
- On `click` and `right-click` (both systems) the main process asks the renderer for a summary, waits at most 300 ms (it uses the last known summary if the renderer is late), builds the menu and shows it with `tray.popUpContextMenu`. The menu is rebuilt on every opening, so the status and the greyed items are always current, and nothing updates in the background (no timers).
- The summary is `{ waiting, stash, stashFull, hungry, eggReady, allFull }`, computed lazily by the repository from stored values and the current time (3.4). The renderer owns the tank state, so there is still exactly one writer.
- `buildTrayTemplate(summary, settings, note)` in `electron/menu.js` is a pure function that returns the menu template: the status line, Collect pellets, Feed a pellet, Feed until full (or Stop feeding while it runs), Hatch egg (only when `eggReady`), the mode switch, then the shared settings items (the same list as the gear menu, so Phase 2 adds each new item in one place), and Quit. Labels and enabled flags follow FR-62; it is unit-tested.
- Built in Step 5: the menu of FR-61; the settings items were added in the first slice of Step 6: `settingsItems(settings, handlers)` in `electron/menu.js` is the one list (Always on top in window mode only, Launch at login, Sound, Copy diagnostics, About), used by the tray and the gear menu. Settings live in `settings.json` (`electron/settings.js`: `alwaysOnTop`, `sound`, other keys kept); Launch at login is read from the operating system and only registered by a packaged app; the renderer learns the sound flag through `getSettings` and `onSettingsChanged`. Sounds are synthesized in `renderer/game/SoundPlayer.js` (design in the art pipeline section, D36; `npm run sounds` to audition them) and only played from a click or a menu action. The first-launch hint is HTML in window mode, shown until `tank.hintShown`, which `fishtank.js` sets on the first successful feed. Opening it asks the renderer for a summary (`tank:summary-request`, answer `tank:summary`, 300 ms limit, the last known summary otherwise), and the template comes from `buildTrayTemplate`. The summary is `{ waiting, stash, stashFull, hungry, fishCount, eggs, eggReady, allFull, feeding }`. A greyed line says why an action is not possible ("Stash is full", "No pellets waiting", "No pellets in the stash", "Everyone is full and happy"), and Hatch egg shows only while an egg is waiting. The slice's `tank:feed` message is gone.
- Actions go through one IPC channel, `tank:action`, with a value from a fixed list (`collect`, `feed`, `feedUntilFull`, `stopFeeding`, `hatch`). The main process forwards only names from that list, and the renderer's `onMenu` calls the same scene methods as a click (`collectAll`, `feedOne`, `startFeeding`, `stopFeeding`, `hatch`). The player cannot aim from the tray, so `feedOne` gives the pellet to the hungriest fish (lowest fullness, then the longest wait since its last meal) and drops it just under the top edge above that fish; a random spot used to favor fish that swim high.
- Feed until full is a short loop in the renderer, started by the player: it drops a pellet, waits about 2 seconds of scene time, and repeats until `allFull` or the stash is empty. Stop feeding, Quit, a mode switch or pausing ends it.
- If the tank is paused (covered, locked) when an action arrives, the economy is applied at once, because it is committed at drop time (decision D1), and the animation is skipped. Nothing is lost, and the fish simply look fed when the tank is next visible.
- Window mode keeps clicking on pellets, the water and eggs. The tray works there too.

Layout for any display size (FR-63)
- `renderer/game/layout.js` has a pure function `computeLayout({ width, height, usable })` that returns the rectangles the scene needs: the water, the sand line (the bottom part of the height), the swimming area, the pellet drop band, and the usable area (the display's `workArea` in tank coordinates, so fish and pellets stay clear of the taskbar, menu bar and Dock while the water and sand reach the edge).
- One unit is `height / 320`. Sizes and speeds in the spec's starting values (6.11, 6.12) are multiplied by it, so the default 480 × 320 window has a unit of 1, a 1080p display has 3.4 and a 4K display at full resolution 6.75. The existing rules that scale with `windowHeight / 320` use this unit.
- `layoutDecor(seed, aspect)` creates the decoration slots one after another from the seed and uses more of them on a wider tank (for example 6 at 3:2, up to about 14 at 32:9). Because the slots come in a fixed order, the first ones stay where they are when the aspect grows. The arrangement for a given display shape is always the same. Bubble sources, the crab and snail counts and the paths (3.3) come out of the same call. Each slot is in the back row (paler, higher on the sand) or the front row. Given the width of each kind (from the atlas), a front rock or coral that would stand inside an earlier front rock or coral by more than a quarter of the narrower one moves to the back row, so it sits behind instead of colliding (`FRONT_OVERLAP`; widths are measured at 3:2 whatever the aspect, so the first slots still do not change on a wider tank). Weeds may overlap anything. The owner saw a coral standing in a rock in the middle of the window on 2026-11-22; about a quarter of 3:2 tanks change, by one item moving to the back.
- Drawing resolution: in desktop mode `resolution = min(devicePixelRatio, sqrt(1 440 000 / (width × height)))`, so the drawing never has more than 1600 × 900 pixels, and the browser scales the canvas up. A 4K display at 200% scaling therefore draws 1600 × 900 pixels. The cap was 1920 × 1080 until the memory investigation in `docs/perf-notes.md` (every megapixel costs about 21 MB in the graphics process). In window mode the normal rule applies (3.2). The frame rate is capped at 30 (`ticker.maxFPS = 30`) in desktop mode.
- Texture sharpness: art is rendered at 3 times the size it has in the default window (the plan before was 2 times), so a 1080p tank is sharp; mipmaps keep small windows clean. The spritesheets stay within 4096 × 4096. Texture memory is measured in the slice (risk in section 13).
- Nothing in HTML is shown in desktop mode (no strip, labels or hints); messages such as "Everyone is full and happy" live in the tray menu.

Display changes (FR-64)
- In desktop mode, `screen` events `display-metrics-changed`, `display-added` and `display-removed`, debounced by 500 ms, make the main process read the primary display again, call `setBounds` (macOS), and (Windows) place the window again inside its parent with the same `placeWindow()` as the attach, which also cancels the invisible frame. The window is placed from physical pixels: `screen.dipToScreenRect` converts the display bounds, because the system scaling (150% on the test machine) would otherwise make the window the wrong size. The renderer then recomputes the layout. In window mode nothing is done (3.7). Moving the tank to another display when the primary display changes is covered by the same code.

Failure modes and what the player sees
- Attach fails or Windows changes the desktop structure in a future update: window mode with the tray note, and the diagnostics say why.
- Explorer restarts or Win+D: the window is created and attached again within a few seconds.
- The tray icon is moved to Windows' overflow area: nothing changes; the tank still runs and the icon is still there.
- The app quits or crashes: the child window is destroyed with the process and Windows paints the normal wallpaper again. The app never changes the system wallpaper setting.

## 4. Server design

### 4.1 Stack

- Node.js 24 LTS (same as development; Node 20 is past end of life) and TypeScript
- Fastify with the rate-limit and CORS plugins
- Postgres via `pg` and a migration tool (node-pg-migrate) — no heavy ORM needed for this size
- Zod for request validation

### 4.2 Authoritative economy with lazy evaluation

Nothing runs on a timer. State that changes with time is computed when it is read. The formulas below live in `shared/rules.js`, the same file the client uses in Phase 1.

Floating pellets
```
elapsed   = now - tank.pellets_updated_at
spawned   = floor(elapsed / SPAWN_INTERVAL)
floating  = min(MAX_FLOATING, tank.floating_pellets + spawned)
```
When the tank is read or changed, the server writes back `floating_pellets` and sets `pellets_updated_at` to the time of the last whole interval used. If the tank is full, `pellets_updated_at` is set to now so the cap does not store up "free" spawns.

Fullness
```
fullness_now = max(0, fish.fullness - floor((now - fish.fullness_updated_at) / FULLNESS_DECAY))
```

Stage
```
stage = points < 100 ? 'fry' : points < 400 ? 'juvenile' : 'adult'
```
The stage is derived from points, so it is never stored separately and cannot go out of sync.

### 4.3 Transactions and concurrency

Every write that changes food runs in a transaction with a row lock on the player's own tank: collect, feed and hatch use `SELECT ... FROM tanks WHERE id = $1 FOR UPDATE`. Because every food change touches only the player's own tank (visitors cannot change food), there is no lock ordering to worry about. A heart changes no food; it checks the 24 hour limit and inserts the event in one transaction that holds the recipient tank row.

### 4.4 Duplicate requests

There are no idempotency keys. Each write is checked again by the server (the stash cannot go below 0, a full fish does not eat, an egg is claimed once). The client sends one write at a time per tank, disables the button while it waits, never resends a write automatically, and after a timeout fetches the tank and shows what the server has. An action is therefore never applied twice.

## 5. Data model (Postgres)

```sql
CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    BYTEA NOT NULL UNIQUE,        -- SHA-256 of the secret token
  friend_code   CHAR(8) NOT NULL UNIQUE,
  name_adj      SMALLINT NOT NULL,            -- index into the adjective list (shared/names.js)
  name_noun     SMALLINT NOT NULL,            -- index into the sea-creature list; display name = adjective + creature
  banned        BOOLEAN NOT NULL DEFAULT false,
  is_official   BOOLEAN NOT NULL DEFAULT false,   -- official tanks: no real owner, token never issued
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tanks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          UUID NOT NULL UNIQUE REFERENCES players(id),
  floating_pellets   INT  NOT NULL DEFAULT 4 CHECK (floating_pellets >= 0),
  pellets_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stash              INT  NOT NULL DEFAULT 0 CHECK (stash >= 0),
  total_fed          INT  NOT NULL DEFAULT 0,
  decor_seed         INT  NOT NULL,              -- decoration layout; visitors see the same layout
  eggs_claimed       INT  NOT NULL DEFAULT 0     -- eggs available = floor(total_fed / 12) - eggs_claimed
);

CREATE TABLE fish (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id           UUID NOT NULL REFERENCES tanks(id),
  species           TEXT NOT NULL,
  seed              INT  NOT NULL,
  name              VARCHAR(16),               -- private: returned only to the owner
  growth_points     INT  NOT NULL DEFAULT 0,
  fullness          INT  NOT NULL DEFAULT 0,
  fullness_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_fed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fish_tank_idx ON fish(tank_id);

CREATE TABLE friendships (
  player_id  UUID NOT NULL REFERENCES players(id),
  friend_id  UUID NOT NULL REFERENCES players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, friend_id),
  CHECK (player_id <> friend_id)
);

CREATE TABLE tank_events (
  id          BIGSERIAL PRIMARY KEY,
  tank_id     UUID NOT NULL REFERENCES tanks(id),     -- the tank that was visited
  actor_id    UUID NOT NULL REFERENCES players(id),   -- the visitor
  kind        TEXT NOT NULL CHECK (kind IN ('visit', 'heart')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tank_events_log_idx   ON tank_events(tank_id, created_at DESC);
CREATE INDEX tank_events_pair_idx  ON tank_events(actor_id, tank_id, kind, created_at);
```

Notes
- The visit log for the owner is read from `tank_events` (tank = my tank, last 20, newest first). The heart limit in FR-33 is checked from the same table: hearts from one visitor to one tank in 24 hours. A `visit` event is inserted only if the same visitor has no `visit` event on that tank in the last 24 hours.
- Official tanks (FR-30, Phase 4) are ordinary rows with `is_official = true`. A seed script creates them (`npm run seed:official` in `server/`): a random token hash that is never issued, the display name "Official", and 3 to 8 fish in all species and stages (fish names are private, so they have none). They accept hearts, and they are left out of player statistics.
- A cleanup job (a daily SQL statement run by a Railway cron service) deletes `tank_events` older than 30 days.

## 6. API

Base URL: `https://<service>.up.railway.app/v1`. JSON in and out. Auth header on every route except registration: `Authorization: Bearer <token>`.

### 6.1 Endpoints

| Method and path | Purpose | Notes |
| --- | --- | --- |
| POST /players | Create an anonymous player | Returns `player_id`, `token`, `friend_code`, and the new tank. The token is shown only once. |
| GET /me/tank | Own tank snapshot | Fish, floating pellets, stash, eggs available, server time. |
| POST /me/collect | Move pellets to the stash | Body `{ count }`, max 16. Applies up to what is available and what fits in the stash; returns the actual number. |
| POST /me/fish/:id/feed | Feed one pellet | Costs 1 stash; fails with 409 if the fish is full or the stash is empty. Returns the updated fish. |
| POST /me/eggs/hatch | Hatch an egg | Fails if no egg is available or the tank is full. |
| PATCH /me | Change display name | Body `{ adjective, creature }`: two indices into the fixed lists in `shared/names.js`. No free text. |
| PATCH /me/fish/:id | Name a fish | Validates length and characters (letters, numbers, spaces). The name is private and returned only to the owner. |
| GET /me/friends | List friends | Name, fish count, friend code. |
| POST /me/friends | Add a friend | Body `{ friend_code }`. |
| GET /me/log | Visit log | Last 20 `tank_events` rows for my tank, newest first (visit, heart), with the visitor's display name. |
| GET /tanks/:friend_code | View another tank | Read-only: fish (species, seed and stage only, no names), `decor_seed` and the owner's display name (or "Official"); no stash and no floating pellets. Records a `visit` event (at most one per visitor per 24 hours). |
| GET /tanks/random | Random tank to explore | Excludes own tank; prefers tanks not seen in 24 hours; adds official tanks when fewer than 20 real tanks qualify (FR-30). |
| POST /tanks/:friend_code/heart | Send a heart | No body. At most one per tank per 24 hours (FR-33). |
| GET /config | Tunable numbers | Intervals, caps, thresholds; the client reads this at launch. |

### 6.2 Example responses

GET /me/tank
```json
{
  "server_time": "2026-11-20T18:00:00Z",
  "tank": { "floating_pellets": 6, "stash": 4, "eggs_available": 1, "max_fish": 8 },
  "fish": [
    {
      "id": "…", "name": "Bubbles", "species": "tetra", "seed": 48213,
      "growth_points": 130, "stage": "juvenile", "fullness": 2,
      "last_fed_at": "2026-11-20T15:40:00Z"
    }
  ]
}
```

POST /tanks/:code/heart — error cases

| Status | `error` | Meaning |
| --- | --- | --- |
| 409 | `already_sent` | Already sent a heart to this tank in the last 24 hours; includes `retry_after_seconds`. |
| 403 | `own_tank` | Cannot send a heart to your own tank. |
| 404 | `not_found` | Unknown friend code. |

### 6.3 Offline behavior

There is no offline queue: the player does things when back online (FR-27).
- The app keeps a copy of the last tank snapshot. When the server cannot be reached, the tank is shown from that copy, read-only, and the fish keep swimming. Collecting, feeding, hatching, visiting and hearts show a quiet "Offline" note and do nothing.
- The client checks the connection when it is launched, when the window becomes visible again, and after any failed request. A failed request is never replayed later. When the connection returns, the client fetches `GET /me/tank` and replaces its copy.
- If a write request times out and the client does not know whether the server applied it, the client fetches the tank and shows what the server has (4.4). It never resends the request.
- If the server rejects an action (for example, the fish was already full), the client replaces its state with the server's snapshot and shows a gentle message.

## 7. Security and abuse prevention

- The token is 256 random bits, generated by the server. Only its SHA-256 hash is stored. A lost token means a lost account in v1 (see open questions).
- All game rules are enforced on the server, so editing the JS in the app gives no advantage. The client only asks; the server decides.
- Rate limits: 60 requests per minute per token, 10 per minute per IP for POST /players, and 10 per minute per token for hearts.
- CORS: since the app uses bearer tokens and no cookies, the API can allow any origin without credentials, which also covers the `null` origin of file:// pages. Alternatively, load the renderer from a custom protocol and allow only that origin.
- Input: there is almost no free text, so there is no word filter and no moderation. Display names are two indices into fixed lists (`shared/names.js`), so nothing is typed and the server rejects any index outside the lists. Fish names are free text (letters, numbers, spaces, at most 16 characters) but are private: the server returns them only to the owner and never in a visited tank. Hearts carry no text.
- Electron hardening: contextIsolation on, nodeIntegration off, a strict Content-Security-Policy, only the API origin allowed for connect-src, no remote code loaded.
- Secrets (database URL) live only in Railway environment variables and are never in the repo or the app.
- Privacy: the server stores a random ID, a chosen name, and game data. No email or device identifiers. IP addresses appear only in short-lived logs.

## 8. Deployment

Railway project
- Service `api`: built from the `server` folder via Nixpacks or a Dockerfile; start command `node dist/index.js`; health check `GET /health`.
- Plugin: Postgres. The `DATABASE_URL` variable is shared with the api service.
- Migrations run on deploy with a pre-deploy command (`npm run migrate`).
- Environments: `staging` and `production`, each with its own database.
- Cron service (optional): daily cleanup of old tank events.
- Official tanks: run the seed script (`npm run seed:official`) once per environment after the migrations (Phase 4).

Desktop app distribution (macOS and Windows)
- Build with electron-builder: a `.dmg` for macOS (universal, Apple Silicon and Intel) and an NSIS installer for Windows (x64; arm64 optional).
- Build each installer on its own OS. A GitHub Actions matrix with a macOS runner and a Windows runner, triggered by a version tag, uploads the results to a GitHub Release.
- Phase 1 test builds are unsigned. On macOS 14 and older, testers right-click the app and choose Open the first time; on macOS 15 and newer, they try to open it once, then go to System Settings > Privacy & Security and press "Open Anyway" (the right-click shortcut no longer works there). Checked on macOS 27 with the universal `.dmg` (2026-11-23, an ad-hoc signed build with the download tag set by hand): a double-click on the app in Applications shows "Fish Tank" Not Opened, "Apple could not verify "Fish Tank" is free of malware that may harm your Mac or compromise your privacy", with only two buttons, Move to Trash and Done (do not press the first). Then System Settings > Privacy & Security, the Security section: "Fish Tank" was blocked, **Open Anyway**, a password or Touch ID, and the app opens; later starts need nothing. A local build with no download tag opens with no question at all. On Windows, testers click "More info" and then "Run anyway" on the SmartScreen warning.
- Phase 5 signing: macOS signing and notarization need an Apple Developer account ($99 per year). Windows signing needs a code-signing certificate from a certificate authority (paid; check current options and prices). A signed Windows app may still show a SmartScreen warning until it builds reputation.
- Auto-update with electron-updater from GitHub Releases works on both systems and is meant for signed builds.

## 9. Observability

- Structured JSON logs from Fastify; Railway shows them in the dashboard.
- Metrics to watch first: requests per minute, error rate, p95 latency, heart rejections, new players per day (official tanks excluded).
- Error reporting: Sentry (free tier) in both the server and the Electron renderer, optional.

## 10. Testing

- Unit tests for the pure rules: pellet spawn math, fullness decay, stage and size from points, drowsiness, egg count. Write these as plain functions with injected time so they are easy to test. The pacing simulator test (3.7) checks the pacing promises of the spec.
- API tests with a throwaway Postgres (Docker or a Railway staging database) covering the rules the server checks: a collect or feed that would overdraw the stash or overfeed a fish is refused, an egg is claimed once even if two hatch requests arrive together, and the heart limit (one per visitor per tank per 24 hours).
- Client: manual test checklist for the acceptance criteria in the functional spec, plus a Playwright-for-Electron smoke test for launch, collect, and feed. Run the smoke test in CI on both a macOS runner and a Windows runner.
- Shared rules: the same unit tests run against `shared/rules.js` for the client (Phase 1) and the server (Phase 3).
- Visual and performance: a manual checklist for look and smoothness on a Mac, a Windows laptop with integrated graphics, and a 2x display, including Reduced effects on and off (from Phase 2).
- Desktop mode (manual, on real machines, because CI runners have no real desktop): attached behind the icons and behind windows; clicks reach icons and windows; Win+D, Explorer restart, wallpaper change, unplugging a display and changing the scaling on Windows (Windows 11 24H2 or later and an older build); on macOS, Fn+F11 (Show Desktop), switching Spaces, Stage Manager and "Click wallpaper to reveal desktop"; a maximized and a full-screen window cover it and pause it; tray menu actions; fallback to window mode when attaching is made to fail; quitting restores the normal wallpaper. The results go into `docs/gate-g1.md`.
- Pure helpers get unit tests too: `computeLayout` (3:2, 16:9, 32:9, 4K, a taskbar on any edge) and `layoutDecor` (deterministic, at least 2 bubble sources, the first slots stay in place when the aspect grows, no two front rocks or corals overlap by more than `FRONT_OVERLAP`), `buildTrayTemplate` (every state in FR-62: nothing waiting, stash empty, stash full, everyone full, egg ready, feeding in progress, fallback note), the cover decision of the Windows check (a pure function over window rectangles and flags), the steering helpers (intercept point, depth limits), the pointer-reaction choice `chooseReaction`, the creature movement step `stepCreature` (Phase 2), the window `fitWindowToDisplays`, the diagnostics `sanitize` and `buildText`, and (Phase 2) the `nightness` curve.
- Budgets (NFR-1 to NFR-6): measured by hand on the reference Mac and Windows laptop with the diagnostics sampler and Activity Monitor or Task Manager in Steps 2, 3, 4, 6 and 7 of the Phase 1 plan, and again in every step of Phase 2. A budget that is missed is fixed or loosened with a written reason in `docs/perf-notes.md`.

## 11. Capacity and cost

Expected load is tiny: one tank read and a few writes per player per session. A single small Railway service and the smallest Postgres plan handle thousands of players. Each tank has at most 8 fish rows, so the data stays small. Cost is dominated by the fixed monthly Railway usage; check current pricing before launch.

## 12. Milestones

Phases match the functional spec, section 11.

Phase 1 — Offline tank core (macOS + Windows). Detailed plan: 04-implementation-phase-1.md

Part 1A: vertical slice
1. Skeleton: Electron and PixiJS app that builds and runs on both systems in CI, with an empty tank, window handling, a tray icon with a stub menu, and the desktop attach test (a plain colored window behind the icons on macOS and Windows). The attach test comes first because it decides how much of the rest is possible.
2. Slice scene: water gradient, sand, a few decor kinds with sway, bubble chains, `computeLayout` for any size, resizing, desktop mode with the scene at 1080p and 4K, pause when hidden or covered, sharp on high-DPI screens, and the first CPU and memory measurements.
3. Slice fish: SVG art for the tetra (3 stages), MeshRope body animation, steering in two dimensions (up and down), sinking food that is chased and eaten (dropped from the tray menu in desktop mode), held in memory only.
4. Gate G1 (go/no-go): art style approved by the owner, budgets met on both systems, a one-minute relaxing watch test, window drag and resize working on both systems, and desktop mode working on both systems as described in the spec's gate item 5.

Part 1B: the rest of Phase 1
5. Remaining species (guppy, angelfish) and decor, palette tint and growth in size.
6. Rules, save and interaction: shared rules module, pacing simulator, LocalTankRepository, pellets, collecting, growth, eggs, fish names, touching a fish, pointer reaction (both sources), tray actions (collect, feed, feed until full, hatch), atomic save with backup.
7. Desktop polish and diagnostics: window rules (size limits, position memory, placement at launch), always on top, close quits in window mode, mode switching and the safe start, re-attaching and display changes, the tray menu and its status line, launch at login, synthesized sound, onboarding hints, local diagnostics log and "Copy diagnostics".
8. Playtest on both systems with unsigned builds, with the measured exit criteria. Gate: the Phase 1 exit criteria.

Phase 2 — Living tank: light, depth and effects. Detailed plan: 05-implementation-phase-2.md
9. Effects base: filter performance check on both systems, ripple, the Reduced effects switch and its menu item.
10. Light: light shafts, light on sand and rocks, water surface.
11. Depth and life: depth shading, fish shadows, fish bubbles.
12. Day and night lighting with its menu item.
13. Art polish and performance: art review pass, Phase 2 budgets checked, playtest. Gate: the Phase 2 exit criteria.

Phase 3 — Accounts and saved progress
14. Server on Railway staging: players, tank, collect, feed, lazy pellet spawning, migrations, shared rules imported, display-name lists.
15. RemoteTankRepository, token storage, read-only cache, one-time import of the local save (with name checking).

Phase 4 — Social
16. Friend codes, friends list, visit view, hearts, feeding a friend's fish, visit log.
17. Official tanks: seed script, Explore fallback.

Phase 5 — Release and extras
18. Code signing and notarization for both systems, auto-update, production deploy, public download page.
19. Later: the tank on every display, a transparent overlay, decorations, breeding.

## 13. Risks and open questions

- Account recovery: a lost token loses the player. Option: add optional sign in with Apple or an email magic link later, and link it to the existing player.
- The pacing numbers (spec 7.1) are untested guesses for a once-a-day player. Mitigations: the pacing simulator, the local tuning override in test builds, and the Phase 1 playtest metrics.
- The CPU and memory budgets (spec 7.3) are set before any measurement. They are checked at the end of the slice and may be loosened only with a written reason.
- Covered-window detection and the fixed 3:2 shape can behave differently on Windows and macOS; both have a fallback in 3.7. A topmost window on Windows can appear above borderless full-screen windows (accepted, documented).
- Official tanks need good content (named fish in all species and stages) and are the first thing a new visitor sees in Explore; they are drawn with the same art and need no extra assets.
- Electron size and memory: acceptable for a prototype. Tauri is the fallback if size matters.
- Desktop mode on Windows depends on how Explorer builds the desktop. The technique uses an undocumented message (`0x052C`), and Windows 11 24H2 changed the window structure, so a future update can break it again. Mitigations: detect the structure from the windows instead of the build number, wrap every call so a failure becomes a fallback to window mode, record the cause in the diagnostics, test on 24H2 and an older build in the slice, and keep window mode fully working. This risk was real in the slice: a window attached before it was shown drew nothing, and it was found and worked around only because the attach variants could be compared on the screen (`npm run attach:lab`, 3.8). Security software can also dislike apps that re-parent their window into the shell; test with Windows Defender and note it in the README.
- Desktop mode on macOS depends on Electron's `desktop` window type being visible at the right level. A level just below the wallpaper would hide the tank, and macOS versions with Stage Manager or new desktop features may behave differently. Check on the oldest and newest macOS we can reach in the slice (so far only macOS 27.2: the window sits above the wallpaper and below the icons, also with Stage Manager on, and on every Space; no older macOS has been tried). The fallbacks are the `electron-as-wallpaper` package, then window mode.
- Chromium may not report a desktop-level window as covered, which would break the pause (NFR-1). Windows has its own check (3.8); macOS falls back to the 30 fps mode if needed.
- Texture memory: art rendered at 3x the default-window size is about 2.25 times the pixels of the earlier 2x plan. The atlas is capped at 4096 × 4096 and memory is measured in the slice against NFR-4. The atlas height is not rounded up to a power of two (the three species made the rounded atlas 16 MB instead of 10 MB, and 8 fish went over 250 MB). If it is too high, lower the art scale or the desktop drawing resolution. Measured in the slice on a 2560 × 1600 display at 150%: 235 MB in desktop mode with antialiasing off (305 MB with it on), 203 to 215 MB in window mode (`docs/perf-notes.md`).
- The tray menu is the only control in desktop mode. If a tester cannot find the tray icon (Windows hides new icons in the overflow area), the first-launch hint and the README explain where it is.
- The `koffi` package must be unpacked from the asar archive, and a universal macOS build needs both `@koromix/koffi-darwin-arm64` and `@koromix/koffi-darwin-x64` (`npm run dist` adds the missing one, 14.6); both are checked in the first packaged build.
- Does Railway's pricing and sleep behavior suit an always-on API? Check the plan so the API does not cold-start slowly.
- Fish names are free text stored on the server (private to the owner). If names ever become visible to others, a word filter, a report button and moderation must be added first; this is why the spec keeps them private.
- Art is the largest effort for a "beautiful" tank (3 species × 3 stages plus decor), and Claude Code draws all of it as SVG. The risks are style and quality: vector art drawn from code can look flat or stiff. Mitigations: the screenshot review loop in 3.3, a simple fixed style guide in `assets/art/STYLE.md` (palette, outline, gradient rules), doing one species fully first and getting the owner's approval before drawing the other two, and keeping all art swappable through `species.json`.
- PixiJS filters can be costly on integrated GPUs and large screens. The first Phase 2 step is a performance check of the ripple on both systems; keep the ripple area small, keep the Reduced effects switch, and measure on both systems from Phase 1.
- Phase 1 timers use the local clock, so offline players can cheat by changing the clock. Accepted for offline play; the Phase 3 import validation and server time remove the benefit.
- Unsigned builds show security warnings on both systems. Fine for testers; signing is needed before a public release (Phase 5).

## 14. Development environment setup

Works the same on macOS and Windows. Phase 1 needs no server, database, Docker, or accounts other than GitHub.

### 14.1 Prerequisites

| Tool | Version | Windows | macOS |
| --- | --- | --- | --- |
| Git | 2.40 or newer | Git for Windows | Xcode Command Line Tools (`xcode-select --install`) or Homebrew |
| Node.js | 24 LTS | `nvm-windows` or `fnm` (`winget install Schniz.fnm`) | `fnm` or `nvm` (`brew install fnm`) |
| npm | 11 | comes with Node | comes with Node |
| Editor | VS Code | with the ESLint and Prettier extensions | same |
| GitHub CLI (optional) | current | `winget install GitHub.cli` | `brew install gh` |

Notes
- The only native Node module is `koffi` (desktop mode), and it ships prebuilt binaries, so no Visual Studio Build Tools or Python are needed. If the slice shows that a custom addon is required, this note and the CI steps change.
- A Mac is needed to build and test the macOS installer, and a Windows PC to build and test the Windows one. CI can build both, but the look and feel must be checked on real machines (see 3.6).
- Phase 3 adds: Docker Desktop (local Postgres) and the Railway CLI.

### 14.2 First-time setup

```bash
git init -b main                 # or clone the GitHub repo
fnm use                          # reads .nvmrc (24); nvm users run: nvm use
npm install                      # installs from package-lock.json
npm run dev                      # Vite dev server + Electron window
```

On Windows PowerShell the same commands work, since all scripts are plain Node or npm scripts and avoid shell-specific syntax (use `cross-env` where an environment variable must be set in a script).

npm 11.17 and later hold back package install scripts that have not been approved (`npm warn allow-scripts`). If `node_modules/electron/dist` is missing after `npm install`, `npm start` cannot launch. Run `node node_modules/electron/install.js` once, or approve the script with `npm approve-scripts electron`. This happened on the Mac (M1). The other held-back scripts (`koffi`, `electron-winstaller`, `fsevents`) are not needed on a Mac: `koffi` loads its prebuilt file from `@koromix/koffi-darwin-arm64` without its script.

Setting the development variables (14.4) for one run differs by shell:

| Shell | Example |
| --- | --- |
| macOS Terminal (zsh, bash) | `FISHTANK_MODE=desktop FISHTANK_DEBUG=1 npm start` |
| Windows PowerShell | `$env:FISHTANK_MODE='desktop'; $env:FISHTANK_DEBUG='1'; npm start` |

The PowerShell form does nothing in zsh and gives no error, so on a Mac the app starts in window mode. In PowerShell, the variables stay set for the rest of the session. Clear them with `Remove-Item Env:FISHTANK_MODE`.

To follow the log while the app runs: `tail -f ~/Library/Application\ Support/Fish\ Tank\ \(dev\)/desktop-spike.log` on macOS, `Get-Content -Wait "$env:APPDATA\Fish Tank (dev)\desktop-spike.log"` in PowerShell.

### 14.3 npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts Vite on `localhost:5173` and Electron pointing at it. The renderer reloads on save (HMR); restart the command after changing `electron/*`. |
| `npm run build` | Builds the renderer into `dist/renderer` with Vite. |
| `npm start` | Runs Electron against the built renderer (what the packaged app does). |
| `npm run lint` / `npm run format` | ESLint check / Prettier write. |
| `npm test` | Vitest unit tests. |
| `npm run test:e2e` | Builds, then runs the Playwright Electron smoke test. |
| `npm run shot -- <name> [WxH] [window\|desktop] [seconds] ["script"]` | Launches the app through Playwright and saves a screenshot to `docs/screenshots/<name>.png`, so the look can be reviewed without a person at the keyboard. The picture is reproducible: a fixed seed and the manual clock (`FISHTANK_SEED`, `FISHTANK_MANUAL_TIME`), a seeded `Math.random` (`scripts/seeded-random.mjs`, because the looks of the tank use `Math.random` on purpose, D1) and the scene stepped by `<seconds>` of simulated time (30 steps a second) before the picture, so two runs of the same code give the same picture on the same machine and graphics card. `SHOT_LIVE=1` gives the old behaviour (real time, real random numbers). The optional script runs in the page first and can use `__tank.scene` and `__tank.repository`, for example to set the fish to 0, 100 and 400 points. Page errors are printed. It never touches the real screen, so it is safe to run on the desktop where the tank is showing. |
| `npm run measure:alloc -- [frames] [fish] [--top]` | After `npm run build`: measures how much memory one frame allocates (garbage for the collector) with V8's sampling heap profiler, wandering and feeding, 1800 frames and 8 fish by default. `--top` lists the functions that allocate most (build with `npx vite build --minify false` to see their names). Results and history in `docs/perf-notes.md`, "Garbage per frame". |
| `npm run assets` | Renders the SVG files in `assets/art/` to 3x PNG (and the tray icons), packs them into `assets/spritesheets/`, and writes a contact sheet image for review. |
| `node scripts/gen-decor-art.mjs` | Draws the scenery SVGs (rocks, corals, weeds) from their seeds into `assets/art/` (3.3). Run `npm run assets` after it. |
| `npm run attach:lab` | Shows each desktop attach variant on the desktop for a few seconds with a label, to diagnose attach problems on a Windows build (3.8). `attach:lab:swcomp` and `attach:lab:nogpu` repeat it with software compositing and with the GPU off. |
| `npm run sim` | Runs the pacing simulator (3.7) and prints the growth, egg and wasted-pellet numbers. |
| `npm run dist` | Builds a release installer for the current operating system into `release/` (electron-builder). |
| `npm run dist:test` | Same, with the channel set to `test`, so the build reads the optional `tuning.json` override. Used for playtest builds. |

### 14.4 How the dev loop works

- In development the main process loads the URL in the `VITE_DEV_SERVER_URL` environment variable; the dev script sets it. When it is not set (packaged app, `npm start`), main loads `dist/renderer/index.html` from the app folder. Vite is configured with `base: './'` so the built files load from `file://`.
- Vite serves the renderer from `renderer/` and allows reading `shared/` and `assets/` from the project root (`server.fs.allow`).
- DevTools open in a detached window in development only (`webContents.openDevTools({ mode: 'detach' })`).
- A dev-only debug panel (toggle with Ctrl+Shift+D / Cmd+Shift+D) is available through `import.meta.env.DEV`: add a pellet, move the game clock forward, set growth points, show an FPS counter. It is stripped from production builds.
- Environment variables read by the main process, used for development and tests only: `FISHTANK_USER_DATA` (use a different save folder, so tests and experiments never touch the real save), `FISHTANK_TEST=1` (enables a small test hook on `window` and a fake clock) and `FISHTANK_MODE=desktop|window` (forces the display mode, so a dev run never depends on the saved mode), `FISHTANK_DEBUG=1` (a text line with the size, resolution and frame rate on the tank, renderer console messages copied into the log, and the `__tank` hook for scripts), `FISHTANK_DEV=1` (the slice's dev panel, window mode only), `FISHTANK_SAMPLE=1` (CPU and memory per process in the log every 10 seconds). Measurement and test helpers: `FISHTANK_WINDOW_SIZE=WxH` and `FISHTANK_TEST_RENDER_MODE=desktop` (with `FISHTANK_TEST=1`, draw the desktop scene in an ordinary window, as `npm run shot` does) `FISHTANK_TEST_MINIMIZE_AT=<seconds>`, and, for the end-to-end tests (with `FISHTANK_TEST=1`), `FISHTANK_SEED=<number>` (a fixed random seed, so the same fish and decor every run) and `FISHTANK_MANUAL_TIME=1` (the scene moves only when a test calls `fishtank.update`, so no test depends on where a fish happens to swim; `tests/e2e/helpers.js` sets both, and a test that needs real time passes `FISHTANK_MANUAL_TIME: '0'`). The main process writes `desktop-spike.log` in the data folder, a log of what it did (attach result, window geometry, covered and visible changes, frame rate) that holds no personal data and that a tester can send back. Some editors set `ELECTRON_RUN_AS_NODE=1`, which makes Electron behave like Node; `npm start` and `npm run dev` go through `scripts/run-electron.mjs`, which removes it. In desktop mode the dev panel and DevTools open in their own windows; if a dev run leaves the tank stuck on the desktop, quit from the tray menu or end the process.
- In development the app stores its data under a separate folder name (`Fish Tank (dev)`), so a dev run never overwrites a real save.
- The build channel is `package.json` → `fishtank.channel` (`release` or `test`). In a `test` build, and in development, the optional `tuning.json` in the data folder overrides the numbers in `shared/config.js` (3.4).
- The dev panel also shows the live CPU, memory and frame rate from the diagnostics sampler, and a button that prints "Copy diagnostics" to the console.

### 14.5 Repository settings that prevent cross-platform trouble

- `.gitattributes`: `* text=auto eol=lf`, so Windows does not turn files into CRLF. Binary art and sound files are marked `binary`.
- `.editorconfig`: UTF-8, LF, 2-space indentation. Prettier uses the same values.
- `.nvmrc`: `24`. `package.json` has `"engines": { "node": ">=24 <25" }` and `"type": "module"`.
- `.gitignore`: `node_modules/`, `dist/`, `release/`, `.env*`, test output, OS files (`.DS_Store`, `Thumbs.db`). Source art in `assets/art/` stays in the repo; check the size and use Git LFS if large files appear.
- Paths: always `path.join` and `app.getPath`, never hard-coded separators. File names in `assets/` are lowercase with dashes, because macOS is usually case-insensitive and Linux CI is not.
- Scripts in `package.json` must not use shell-only commands such as `rm -rf`, `cp` or `export`. Use `cross-env` for variables and small Node scripts in `scripts/` for file work.

### 14.6 Running and packaging a test build

- `npm run dist` on a Mac produces `release/Fish Tank-<version>-universal.dmg`; on Windows it produces `release/Fish Tank Setup <version>.exe`.
- Unsigned builds show a warning (section 8). The testers' instructions for both systems go in the README.
- Packaged-app checks differ from `npm run dev`: launch at login, file paths, `file://` loading, the tray icon files and the `koffi` binary only behave properly in a packaged build, so test them there.
- `koffi` in electron-builder: set `asarUnpack` for `node_modules/koffi/**` and `node_modules/@koromix/**` (koffi 3 keeps its native file in a per-platform package) so the native file can load. The macOS build includes it since the cover check (3.8). npm installs only the package of the build machine's processor, and `npm install --os=darwin --cpu=x64` refuses the other one (`notsup`), so `npm run dist` first runs `scripts/koffi-universal.mjs`, which fetches the missing darwin package with `npm pack` at the installed koffi version and unpacks it into `node_modules` (nothing is saved; it does nothing off macOS). Both packages then sit in both halves of the universal app, which `@electron/universal` refuses unless they are listed in `mac.x64ArchFiles`; each half loads the one for its processor. Checked on M1 (2026-11-22): the universal `.dmg` builds, and both the arm64 half and the x64 half under Rosetta load `koffi` and pause under a window filling the screen. The Windows target is checked for the unpacked file in the first packaged build.

### 14.7 Continuous integration

- `ci.yml` on every push and pull request, on `macos-latest` and `windows-latest`: `npm ci`, `npm run lint`, `npm test` (which includes the pacing simulator test), `npm run build`, `npm run test:e2e`.
- `release.yml` on a tag like `v0.1.0`: runs `npm run dist` on both runners and attaches the installers to a GitHub Release. A tag like `v0.1.0-test.1` runs `npm run dist:test` instead, for playtest builds.
- Secrets: none in Phase 1. Phase 5 adds the Apple and Windows signing secrets as GitHub encrypted secrets.

### 14.8 Phase 3 additions to the environment

- A `server/` folder with its own `package.json` (TypeScript, Fastify) and a `docker-compose.yml` for local Postgres 16.
- npm workspaces (root, `server`) so `shared/` can be imported by both.
- A `.env.example` for the server with `DATABASE_URL`; real values only in a local `.env` (ignored by git) and in Railway variables.
- Railway CLI for deploys and logs; GitHub integration for staging deploys.
