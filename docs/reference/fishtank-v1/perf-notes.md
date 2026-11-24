# Fish Tank — Performance Notes

Test machines, the budgets from the functional spec (7.3), and the measurements. Filled in from Step 2 of the Phase 1 plan onward. A missed budget is fixed or loosened here with a written reason.

## Test machines

| ID | System | CPU / RAM | GPU | Display | Role |
| --- | --- | --- | --- | --- | --- |
| W1 | Windows 11 Pro, build 26200 (24H2 desktop structure or later) | Intel Core i7-14650HX, 24 threads, 32 GB | NVIDIA GeForce RTX 4070 Laptop and Intel UHD Graphics | 2560 × 1600, scaling to be recorded | Development machine. Not a typical "integrated graphics" machine, so budget runs force Chromium onto the Intel GPU (Windows Settings > System > Display > Graphics, per-app setting) and are labelled "W1 (Intel)". |
| W2 | Windows older than 24H2 (Windows 10, or Windows 11 23H2) | to be decided | to be decided | to be decided | Needed for the Windows desktop mode test in Step 1 (the classic desktop structure). |
| M1 | macOS 27.2.1 (build 26B131) | Apple M4 Pro (Mac16,8), 48 GB | Apple M4 Pro (integrated) | Built-in 3024 × 1964 Retina (1512 × 982 points, 2x); external 1920 × 1080 displays at times, one used in portrait | Owner's Mac. macOS desktop mode test (2026-11-21): 29 to 30 fps in desktop mode, nothing drawn while covered. CPU and memory measured on 2026-11-21 (Step 4). Strong chip, so its CPU numbers are a lower bound. Unified memory, so graphics memory counts as app memory. |
| M2 | macOS (oldest we can reach) | optional | | | Desktop mode level check on an older macOS. |

Display scaling tested: 100% and 200% on each machine where possible. Desktop mode is tested at 1920 × 1080 and at 4K.

## Budgets (from spec 7.3)

| ID | Budget |
| --- | --- |
| NFR-1 | Hidden, minimized or covered: at most 0.5% of one CPU core, nothing is drawn, and the game wakes at most once a minute. |
| NFR-2 | Visible but not active, and desktop mode whenever visible: at most 30 fps and at most 3% of one core. |
| NFR-3 | Window mode, visible and active: at most 60 fps and at most 8% of one core. |
| NFR-4 | Memory: at most 250 MB in total after one hour (350 MB on macOS, loosened on 2026-11-21, reason below), and growth of less than 20 MB over 8 hours. |
| NFR-5 | Start: the tank is visible within 3 seconds of launching. |

Phase 2, all effects on: NFR-2 5%, NFR-3 10%, NFR-4 300 MB. Reduced effects: the Phase 1 numbers.

## Results

| Date | Step | Machine | Mode and size | State | CPU % | Memory MB | FPS | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-20 | 2 | W1 | Window 480 × 320, scene without fish | Visible, started from a script (not the active window) | 0.9 to 1.0 | 203 to 215 | 58 | Within NFR-2 and NFR-4 | The sampler sums all 4 processes (browser, GPU, utility, renderer). The frame rate is the cap of 60 with a small dip. |
| 2026-11-20 | 2 | W1 | Window 480 × 320 | Minimized | 0.0 | 202 to 205 | none | Within NFR-1 | The renderer reported `visibilityState: hidden` at once and the ticker stopped. On restore it caught up within one reporting period. |
| 2026-11-20 | 2 | W1 | Desktop mode, main display 2560 × 1600 at 150% (drawn at about 1920 × 1080) | Visible behind the icons | 0.6 to 0.7 | 305 to 314 with antialiasing | 30 | Over NFR-4 | Graphics process 206 MB. |
| 2026-11-20 | 2 | W1 | Same, antialiasing off in desktop mode | Visible behind the icons | 0.6 to 0.7 | 234 to 236 | 30 | Within NFR-2 and NFR-4 | Multisampling cost about 70 MB of graphics memory. Desktop mode now draws without antialiasing. |
| 2026-11-21 | 3 | W1 | Window 480 × 320, 2 tetras | Visible, started from a script | 0.9 | 228 to 229 | 58 | Within NFR-2, NFR-3 and NFR-4 | Memory is 25 MB higher than the scene without fish. |
| 2026-11-21 | 3 | W1 | Window 480 × 320, 8 tetras | Visible | 0.9 | 237 | 58 | Within | |
| 2026-11-21 | 3 | W1 | Desktop scene 1920 × 1080 in an ordinary window (no antialiasing), 2 tetras | Visible | 0.7 | 233 | 30 | Within NFR-2 and NFR-4 | The real desktop-mode window was not measured with fish. |
| 2026-11-21 | 3 | W1 | Same, 8 tetras | Visible | 0.6 | 239 | 30 | Within | 11 MB under the memory budget. |
| 2026-11-21 | 4 | W1 | Window 480 × 320, 8 fish (tetra, guppy and angelfish mixed, stages mixed) | Visible | 0.9 | 223 to 229 | 58 | Within NFR-2, NFR-3 and NFR-4 | The first run was 259 to 261 MB (over NFR-4): the new art made the atlas 2048 × 2048 (16 MB) with the height rounded up to a power of two. The atlas height is now exact, 2048 × 1228 (10 MB). |
| 2026-11-21 | 4 | W1 | Desktop scene 1920 × 1080 in an ordinary window (no antialiasing), same 8 fish | Visible | 0.6 | 241 to 243 | 30 | Within | Only 7 MB under the memory budget; the long run is the real test. If it is needed, fish art can be drawn at 2x instead of 3x (about 40% fewer pixels). |
| 2026-11-21 | 4 | M1 | Empty Electron window 480 × 320 (no PixiJS, no WebGL), for comparison | Visible | | 80 (working set 357) | | | Main 43, GPU 13, utility 7, renderer 16 MB. What Electron itself costs on this Mac. |
| 2026-11-21 | 4 | M1 | Empty page with one WebGL 2 canvas, window 480 × 320 (buffer 960 × 640, antialiasing on), cleared to a colour each frame | Visible | | 242 to 243 | 60 | At the edge of NFR-4 | GPU process 174 MB, of which 140 MB is graphics memory owned by the GPU. What WebGL itself costs, before any drawing. |
| 2026-11-21 | 4 | M1 | Same, full-screen desktop window (buffer 1787 × 1160, no antialiasing) | Visible behind the icons | | 245 to 247 | 30 | At the edge of NFR-4 | GPU process 179 MB. A canvas 3.4 times bigger costs only 5 MB more, so the cost is fixed, not per pixel. |
| 2026-11-21 | 4 | M1 | Empty PixiJS app (one moving circle), same desktop window and options as the tank | Visible behind the icons | | 272 to 276 | 30 | Over NFR-4 | GPU process 195 MB, renderer 26 to 31 MB. |
| 2026-11-21 | 4 | M1 | Window 480 × 320 (drawn at 960 × 640, 2x), 8 fish (tetra, guppy and angelfish mixed) | Visible, started from a script | 1.4 to 1.5 | 347 to 354 (working set 478 to 483) | 59 | CPU within NFR-2 and NFR-3; memory at the macOS limit (350 MB) | Over the old 250 MB. Up to 4 MB over 350 in this 100-second run; the one-hour number decides. |
| 2026-11-21 | 4 | M1 | Same | Minimized | 0.0 to 0.1 | 160 (working set 455) | none | Within NFR-1 | Graphics memory is released while minimized; 317 to 399 again after the restore. |
| 2026-11-21 | 4 | M1 | Desktop scene in an ordinary window, 1920 × 1080 asked for (the display is 1512 × 982 points, so macOS may have made it smaller), same 8 fish | Visible | 0.9 to 1.0 | 327 to 337 (working set 467 to 475) | 29 to 30 | CPU within NFR-2; memory within the macOS limit | Over the old 250 MB. |
| 2026-11-21 | 4 | M1 | Desktop mode, 1512 × 982 points at 2x (drawn at about 1920 × 1080 pixels), same 8 fish | Visible behind the icons | 0.9 to 1.0 | 347 to 355 (working set 467 to 476) | 29 to 30 | CPU within NFR-2; memory at the macOS limit | Over the old 250 MB. Up to 5 MB over 350 in the first minute. |
| 2026-11-21 | 4 | M1 | Same, 10 minutes | Visible behind the icons (hidden for 10 s once) | 1.0 to 1.1 | 325 to 361; 326 to 332 in the last 5 minutes | 29 to 30 | Within the macOS limit after the first minutes; no sign of a leak | One sample of 361 MB at 30 s (start-up), then 348 to 361 until the renderer's first garbage collection. | Per process at the end: GPU 236, renderer 46, main 43, utility 7 MB. The renderer goes up and down between 41 and 74 MB (garbage collection), it does not keep growing. |
| 2026-11-21 | 4 | M1 | Window 480 × 320, same 8 fish, one hour (run at the same time as the next row, each with its own data folder) | Visible, not active | about 2.0, up to 2.4 | 347 to 360 in minutes 0 to 12 (over 350 for about 8 minutes), 338 to 342 in minutes 12 to 24, 318 to 330 from minute 25; **327 at one hour** | 58 to 59 | Within NFR-4 (350 MB on macOS) at one hour; no leak | Renderer 62 → 80 MB in the first 6 minutes, 70 MB by itself at minute 12, 46 to 53 MB after a 2-second hidden blip at minute 24 and flat after that. GPU process 223 to 236 MB, one 30-second spike to 310. |
| 2026-11-21 | 4 | M1 | Desktop mode, same 8 fish, one hour | Visible behind the icons | about 1.2, up to 1.5 | 348 to 371 in minutes 0 to 24 (**over 350 for about 20 minutes**), 325 to 336 from minute 25; **334 at one hour** | 29 to 30 | Within NFR-4 at one hour; no leak | Renderer 60 → 85 MB in the first 7 minutes and stayed there until the hidden blip at minute 24, then 44 to 51 MB and flat. GPU process 229 to 241 MB, one spike to 315. |
| 2026-11-22 | 6 | M1 | Window 480 × 320, 8 fish, one hour, `main` with the garbage fix (run at the same time as the next row, each with its own data folder) | Visible, not active | about 2.0, up to 3.8 | 351 to 358 in minutes 0 to 13 (over 350 for about 11 minutes), then 338 to 344; **341 at one hour** | 58 to 59 | Within NFR-4 at one hour; no leak | Renderer 60 to 66 MB early (80 to 85 before the garbage fix), dropping to 55 at minute 13 by itself, with no visibility change. |
| 2026-11-22 | 6 | M1 | Desktop mode, same 8 fish, one hour, same code | Drawing all hour (a maximized editor covered the desktop, but macOS did not pause the tank, see Covered-window detection) | about 1.2, up to 1.4 | 348 to 358 in minutes 0 to 19 (over 350 for about 15 minutes; up to 371 before), then 334 to 339; **338 at one hour** | 29 to 30 | Within NFR-4 at one hour; no leak | Renderer 57 to 62 MB early, 51 to 53 after minute 19. |
| 2026-11-21 | 5 | W1 | Desktop scene 1920 × 1080 in an ordinary window (no antialiasing), 8 mixed fish, with the saved record, floating pellets and eggs | Visible | 0.6 to 0.7 | 242 to 243 | 30 | Within | The same as Step 4 (241 to 243): the new objects cost nothing measurable. |
| 2026-11-21 | 5 | W1 | Real desktop mode, main display 2560 × 1600 at 150% (drawn at 1821 × 1138), 8 mixed fish | Covered (the maximized editor was in front, so the tank was paused) | 0.0 to 0.5 | 258 to 270 | none | Over NFR-4 | The same run on `main` (Step 4) gave 251 to 263, so Step 5 is 4 to 7 MB higher (GPU 152 to 157, browser 45 to 46, renderer 45 to 55). The in-window run above shows no change, so this is close to the run-to-run spread of about 5 MB. This is the first measurement of the real desktop window with fish; the earlier desktop numbers were an ordinary window. The real window costs about 15 MB of graphics memory and 7 MB in the main process more than the same scene in a window. To check: a run with the desktop uncovered, and a one-hour run. |

Notes on these numbers
- W1 has a fast discrete GPU, so CPU numbers here are a lower bound. Windows lists three GPUs (Intel, NVIDIA, Microsoft basic); which one Chromium used was not recorded. The runs on the Intel GPU (forced in Windows graphics settings) and on a real integrated-graphics laptop are still to do.
- Not yet measured: the active-window frame rate and CPU (NFR-3), memory after one hour on Windows and growth over eight hours everywhere (NFR-4), start time (NFR-5), a maximized window covering the desktop, and a true 4K display.
- Memory on the Mac is the sum of the memory footprint (`phys_footprint`, from `footprint -p`) of the 4 processes, the number Activity Monitor shows. Electron has no `privateBytes` on macOS, so the sampler's number there is the working set, which also counts shared pages; it is given in brackets but is not comparable with the Windows numbers.
- **Owner's decision (2026-11-21): NFR-4 is 350 MB on macOS** (spec 7.3, v0.8), for the reasons in the next points. With it, desktop mode settles at 326 to 332 MB (18 to 24 MB of margin); the window is closer, 347 to 354 MB in a short run, so the one-hour run must check the window first, and the tank's own 52 to 81 MB is where to cut if it fails.
- **One-hour run on the Mac (2026-11-21, Step 4 code, rows above): both modes pass at one hour** (window 327 MB, desktop 334 MB) and nothing leaks: after it settles, the renderer stays at 46 to 53 MB for the last 35 minutes. But there is a high stretch before that. In the first minutes the renderer grows to 80 to 85 MB, and in desktop mode it stayed there, about 20 MB over 350, until the window was briefly hidden at minute 24 (cause unknown, perhaps something on the screen); the hide let Chromium free renderer memory. A tank on a quiet desktop may never be hidden, so how long the high stretch lasts without that is not known. Worth trying if it matters: run the 8-hour growth test without touching the Mac, and look at what the renderer holds in the first minutes (the start-up allocations of PixiJS and the scene).
- A first one-hour attempt was not valid: the Mac went to sleep after 19 minutes, and the tank was paused (hidden) for the rest. Its first 19 minutes agree with the run above. The valid run kept the Mac and display awake with `caffeinate`. While hidden, the app used 162 to 168 MB and no CPU.
- The first one-hour numbers are for the Step 4 code; the run was repeated on the Step 6 code with the garbage fix on 2026-11-22 (rows above and Garbage per frame).
- **The Mac was over the old 250 MB by about 80 to 100 MB in every visible state.** CPU and frame rate are within budget. The extra memory is in the GPU process: about 235 MB, against 13 MB for an empty Electron window. In desktop mode its footprint is 141 MB of graphics memory owned by the GPU (textures and buffers), 32 MB of IOSurface (the frames shown on screen) and 15 MB of accelerator memory. The tank's own textures are small (the art atlas is 2048 × 1228, about 10 MB), so most of it is not the tank.
- **An empty WebGL page alone uses 245 MB on the Mac** (measured 2026-11-21 with a small test app: the same Electron version, window types, sizes and antialiasing as the tank, and nothing in the page but a WebGL 2 canvas cleared to a colour). Starting WebGL adds about 165 MB to the GPU process, 140 MB of it graphics memory owned by the GPU. It is the same for a 960 × 640 canvas and a 1787 × 1160 one, so it is a fixed cost of WebGL in Chromium on this Mac, not something the tank does. In desktop mode the total breaks down as: Electron 78 MB, + WebGL 167 MB = 245, + PixiJS 29 MB = 274, + the tank (scene and 8 fish) 52 to 81 MB = 326 to 355.
- So 250 MB cannot be met on this Mac by changing the tank: an empty WebGL page is already at the limit. Chromium switches, WebGPU and WebGL context settings were tried next (table below) and none of them lowers it for the tank. The owner chose to raise NFR-4 on macOS to 350 MB (see the first point).
- W1's GPU has its own memory, and Windows does not count what is in it as private bytes, so the W1 memory numbers probably leave out the textures and frame buffers. On an integrated-graphics Windows laptop the total is likely closer to the Mac's. To check in the W1 (Intel) run.
- Run with `FISHTANK_SAMPLE=1` (the log shows a line every 10 seconds). `FISHTANK_TEST=1 FISHTANK_TEST_MINIMIZE_AT=40` minimizes the window after 40 seconds and restores it 30 seconds later.

## Lowering the fixed WebGL cost on the Mac (M1, 2026-11-21)

Measured with the same test app as the WebGL baseline above, in the full-screen desktop window (about 1920 × 1080 pixels, 30 fps), 35 seconds per run. Memory is the summed footprint; the second number is the GPU process. "No WebGL" means the page got no WebGL at all, so its low memory does not count. Run-to-run spread is about 5 MB.

| What was tried | Memory MB (GPU process) | WebGL | Result |
| --- | --- | --- | --- |
| Nothing (WebGL 2, Chromium defaults, ANGLE on Metal) | 247 to 257 (180 to 188) | yes | The reference. |
| `--use-angle=gl` (ANGLE on OpenGL) | 119 (54) | no | The GPU process exits: this Chromium allows only ANGLE on Metal on macOS. |
| `--use-angle=swiftshader --enable-unsafe-swiftshader` (software WebGL) | 119 (54) | no | SwiftShader fails to start (its Vulkan layer does not initialise). |
| `--disable-gpu --enable-unsafe-swiftshader` | 119 (54) | no | Same. |
| `--disable-features=SkiaGraphite` | 120 (55) | no | Chromium falls back to software compositing and turns WebGL off. |
| `--disable-gpu-compositing` | 351 (251) | yes | Worse: 100 MB more and 3.7% CPU instead of 0.7%. |
| `--disable-gpu-program-cache --disable-gpu-shader-disk-cache` | 247 to 249 (180) | yes | No change. |
| `--force-gpu-mem-available-mb=256` | 248 to 250 (180) | yes | No change. |
| WebGPU instead of WebGL (one canvas cleared each frame, Metal 3) | 233 to 235 (165) | WebGPU | 15 MB less than WebGL. |
| Empty PixiJS app on WebGPU (`preference: 'webgpu'`) | 361 to 365 (280) | WebGPU | 87 MB more than the same app on WebGL (274 to 276). Not an option. |
| WebGL context with `depth: false` | 233 to 234 (165) | yes | 15 MB less. `alpha: false` and `powerPreference: 'low-power'` alone change nothing. |
| Empty PixiJS app on its own context with `depth: false`, `alpha: false`, low power (stencil kept, then also off) | 275 to 278 (196 to 197) | yes | No change from PixiJS's own context (274 to 276), so the 15 MB saving does not reach the tank. |

Result: on this Mac WebGL always runs on ANGLE over Metal, and that costs about 165 MB in the GPU process however it is set up. No switch or setting tried lowers the tank's memory, so none was added to the app. Not tried: an older or newer Electron (another Chromium may differ), and a 2D canvas instead of WebGL (it would need a different renderer and would cost CPU).

## Where the Windows memory goes (W1, 2026-11-22)

Why: on W1's real desktop mode the diagnostics log showed 260 to 278 MB against NFR-4's 250 MB. Method: a throwaway Playwright harness (not in the repository) launched the built app with a clean data folder and the same 8 mixed fish as the rows above, and read `app.getAppMetrics()` (private bytes, summed per process type) every 5 seconds; the last values of a 40 to 50 second run are given. The experiments that need code (antialiasing, depth and stencil, the pixel cap) used a temporary query switch that was removed again. Run-to-run spread is about 2 to 3 MB (two identical desktop runs: 258 and 256).

**Where it is, real desktop mode, 8 fish, steady after 4 minutes (256 MB):** GPU process 151, renderer 52, main (Browser) 42, utility 11. The renderer's JavaScript heap is only 10 MB, and the tank holds only 7 textures, 10 MB, almost all of it the art atlas (2048 × 1228), so the scene itself is not what costs memory. Chromium runs on the Intel UHD graphics (vendor 0x8086, device 0xa78b is the active adapter), not the NVIDIA card; the diagnostics line does not say which one is active.

| What was run (desktop mode unless stated) | Total MB | GPU process | Change |
| --- | --- | --- | --- |
| Reference (drawn at 1835 × 1147, no antialiasing) | 256 to 258 | 150 to 151 | |
| Window 480 × 320 (drawn at 722 × 485), antialiasing on (as shipped) | 238 | 129 | |
| Same, antialiasing off | 226 | 117 | **−12** |
| Window 1200 × 800 (the maximum), antialiasing on | 359 | 255 | |
| Same, antialiasing off | 262 | 157 | **−97** |
| Pixel cap 1600 × 900 (1.44 MP) instead of 1920 × 1080 (2.07 MP) | 245 | 140 | **−13** |
| Pixel cap 1280 × 720 (0.92 MP) | 231 | 127 | **−27** |
| Close the decoded atlas image in the renderer after the upload (measured against a control run in the same conditions, which was a busy machine, so only the difference counts) | 266 (control 276) | 172 in both | **−10** (renderer 51 → 41) |
| `--in-process-gpu` (no GPU process; its memory moves into the main process) | 248 | n/a | −8, and a graphics crash would take the app down |
| `--enable-features=NetworkServiceInProcess2` | 250 | 143 | no effect (the utility process is still there; the GPU change is run-to-run spread) |
| `--use-angle=d3d9` / `gl` / `d3d11on12` | 276 / 254 / 361 | 166 / 147 / 256 | worse or the same |
| Pixi `depth: false`, and also `stencil: false` | 258 / 259 | 151 / 153 | none |

What this says:
- **The pixel count is the one setting that moves the GPU process:** about 21 MB per megapixel of drawing resolution, on top of a fixed cost of roughly 110 to 120 MB (the Direct3D device and driver, shaders, the atlas) that no Chromium switch lowered, as on the Mac.
- **Multisampling is the biggest single item in window mode:** it costs 12 MB at the default size and 97 MB at the largest window (the window can be dragged to 1200 × 800), and the saved size of the owner's window (752 × 501) is already in between. Desktop mode already draws without it. A side-by-side screenshot of the window at 480 × 320 with and without it shows no visible difference (sprites and meshes carry their own soft edges).
- **The renderer holds a decoded copy of the atlas** (an `ImageBitmap`, 2048 × 1228 × 4 bytes = 10 MB) after it was uploaded to the GPU. Closing it frees exactly that. It must be closed after the first frame has drawn (the upload happens at first use), and a lost WebGL context would then need the page to reload, because Pixi could not upload the atlas again. The app has no context-loss handling today.
- **The resolution cap looks nearly the same:** crops of the same frame at 1920 × 1080, 1600 × 900 and 1280 × 720 pixels, shown at the real 2560 × 1600 screen size, differ only in slightly softer sand grain and fish detail at 1280 × 720.
- **Not counted:** the Intel graphics driver also uses shared system memory that is not in private bytes (see the note above about W1's GPU), so these totals are for comparing changes, not the whole cost.
- **The diagnostics log read 14 to 22 MB higher than these fresh runs** (272 visible and 260 paused at minute 2, with 2 fish). Not explained by these runs, which settle at 256 and do not drift; a one-hour diagnostics run after the changes below will show whether it is the early renderer peak or something that stays.

**Applied (branch `memory-investigation`, W1, 2026-11-22):** antialiasing off in both modes, the decoded atlas image closed after the upload (a lost graphics context reloads the page; `will-navigate` now lets a reload of the same page through), and `MAX_DESKTOP_PIXELS` 1920 × 1080 → 1600 × 900. Measured together with the same harness (8 mixed fish, last 4 samples of a 50 to 60 second run): **desktop mode 256 → 229 MB** (GPU 136, tab 40, browser 41, utility 12), **window mode at the default size 238 → 218 to 222 MB**. Better than the estimates below, which are kept as the record of what was predicted. The Mac window mode (341 MB at one hour, limit 350) is the reason to confirm this on the Mac (TODO-Mac.md W-10).

Estimated before the change, not measured together: desktop mode 256 → about 246 with the atlas closed, about 233 with the 1600 × 900 cap as well, about 220 with 1280 × 720; window mode at the default size 238 → about 216 with antialiasing off and the atlas closed. Candidates in order of cost against benefit: antialiasing off in window mode (one line, no visible change), closing the atlas image (a few lines and a reload on context loss), then the pixel cap (one number in `renderer/game/drawing.js`, a small loss of sharpness the owner should judge).

## The empty host (W1, 2026-11-22)

What the app costs with no tank in it, for the platform plan (`docs/06-implementation-platform.md` section 3, D41). Method: the same harness as "Where the Windows memory goes" (built app, clean data folder, private bytes summed per process type, median of the last samples of a 40 to 45 second run), with a throwaway build that stops after the PixiJS application is created, the frame-rate cap set and the drawing resolution capped, and draws nothing (not committed).

| Run | Total (MB) | Browser | GPU | Utility | Renderer |
| --- | --- | --- | --- | --- | --- |
| Desktop mode, empty (drawn at 1529 × 956) | 196 | 39 | 107 | 12 | 38 |
| Desktop mode, the tank with 8 fish | 229 | 41 | 136 | 12 | 40 |
| Window mode (480 × 320), empty | 172 | 36 | 87 | 12 | 37 |
| Window mode, the tank with 8 fish | about 220 | 37 | 127 | 12 | 45 |

So the tank adds about 33 MB in desktop mode and 48 MB in window mode, and the room left for a second scene under 250 MB is about 54 and 78 MB. A full-screen texture at the drawing cap (1600 × 900) is 5.8 MB, 7.7 MB with mipmaps.

Pitfall: a first empty run that skipped the resolution cap was drawn at 2562 × 1602 (4.1 million pixels) and read 246 to 249 MB, 50 MB too high and higher than the tank itself. A baseline must use the same cap as the real thing. Mac (M1, W-14, `phys_footprint` of all processes, 15 minutes each, drawn at the cap, the same throwaway build): desktop mode empty 258 to 264 MB (graphics process 177, renderer 34, main 44; CPU 1.1%) against the tank's 328 to 339 MB, so the tank costs about 70 MB; window mode (480 × 320) empty 242 to 249 MB (graphics 163, renderer 29 to 35, main 43 to 46; CPU 1.4%) against the tank's 294 to 303 MB, so about 55 MB. The room left under 350 MB for a second scene is about 88 MB (desktop) and 100 MB (window).

## Garbage per frame (M1, 2026-11-22)

The one-hour Mac run showed the renderer growing to 80 to 85 MB early on and dropping only after a visibility change, which looks like garbage piling up between collections. V8's sampling heap profiler (Chrome DevTools protocol, `HeapProfiler.startSampling`, 1800 calls of `fishtank.update(1/30)` with 8 fish and a moving pointer; `npm run measure:alloc`) measured what each frame allocates:

| Code | Wandering | Feeding |
|---|---|---|
| Before (Step 6 with fixes 5 and 6) | 9.7 KB per frame | 9.4 KB per frame |
| After | 1.2 KB per frame | 1.5 KB per frame |

At 60 fps that is about 580 KB of garbage a second before and about 70 KB after. Where it came from: a new `{x, y}` for every steering result (`limit`, `clampToArea`, `wallForce`, `separationForce`, `reactionVelocity`), closures created on every call (`wallForce`, `chooseReaction`, the egg callback), `Math.hypot` (V8 allocates for its arguments), the fish list, the `env` object and the `eat` closure of `TankScene.update`, `filter` in `currentFood`, and copies of the pellet and egg lists. The steering helpers now take an optional `out` object, and each fish keeps its own. What is left is mostly the once-a-second rules tick (new state objects on purpose, the state is never changed in place) and Pixi.

The one-hour run again (2026-11-22, rows above): the early renderer peak is 60 to 66 MB instead of 80 to 85, and it comes down by itself (minute 13 in the window, 19 in desktop mode) instead of waiting for a visibility change. The total still goes over 350 MB for 11 to 15 minutes early on, by at most 8 MB, because the GPU process (227 to 247 MB) is most of it. At one hour both modes are within, 3 to 14 MB higher than the Step 4 run (saves, pellets and eggs are in the code now).

## Covered-window detection

| Machine | Mode | Is a covering window reported as hidden? | Fallback used |
| --- | --- | --- | --- |
| W1 | Window | Minimizing: yes (`visibilityState` becomes hidden). Covering by another window: not yet tested. | none |
| W1 | Desktop | Not yet tested. The foreground check in `electron/desktop-win.js` is written and unit-tested (`decideCovered`). | none |
| M1 | Window | Minimizing: yes (`visibilityState` becomes hidden, 0.0% CPU, nothing drawn). | none |
| M1 | Desktop | A full-screen window: yes, Chromium reports the desktop window as hidden (see `docs/desktop-spike.md`). A window as large as the screen (Finder, or a test window): no, the tank kept drawing at 30 fps, about 1.3% CPU (2026-11-22). | Our own check: the window list from CoreGraphics, paused when other apps' windows hide 96% of the work area (tech design 3.8). With a maximized editor in front it paused within 2 seconds, 0.3 to 0.5% CPU while paused; Show Desktop resumed it within 2 seconds |

## Development runs and the Dock icon (M1, 2026-11-22)

From the app icon commit (944b7b1) on, a development run on the Mac set the 1024 px `build/icon-mac.png` as its Dock icon, and the main process grew from 40 to 45 MB to 77 to 81 MB. Found by measuring the main process of each commit merged that day, after one minute in window mode with 8 fish: 42, 41, 42, 40 and 42 MB, then 77 MB at 944b7b1. Without the `setIcon` call it was 45 MB; with the image scaled to 256 px first, 48 MB. The packaged app never sets this icon and its main process was 44 MB. So development-run totals from 944b7b1 until the fix are about 35 MB too high; the 15-minute window run on that `main` (368 to 390 MB) is the inflated one.
