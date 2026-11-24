# Scene: Fish tank, moving it into 2ndDesktop (reuse and folder structure)

Status: Draft v0.1, 2026-11-23. The scene's design is in `fishtank.md` (its future `DESIGN.md`); this document is about the **code and files**: what is reused as it is, what must change to meet the new contract, and the recommended folder structure. The host side is in `../platform/04-reuse-from-fish-tank.md`; read its section 2 (three commits, each green) first.

Facts come from the fish-tank checkout at `main`, commit `9d18c90`.

## 1. What must not change

1. **The scene id `fishtank` and the record file `records/fishtank.json` with `schema` 1**, so the owner's saved tank still loads (the data-folder question is in the platform document, section 5).
2. **The game numbers** in `config.js` and the visual numbers in `visualConfig.js`: the pacing was checked by a simulator (`npm run sim`) and the look by hand.
3. **The layer order** of the scene (`fishtank.md`, section 5).
4. **The golden state hash** (`scenes/fishtank/tests/golden.spec.js`): the hash of `serialize()` plus the scene graph after a scripted session must be the same before and after every step of the move. If it changes, something moved that should not have; the answer is never to record a new hash.
5. **The reproducible screenshot** (`npm run shot`): the same picture before and after.

## 2. What is in the folder today

`scenes/fishtank/` has 22 JavaScript files (about 3,600 lines), two JSON data files, one CSS file, the `repo/` folder, `art/` with 19 SVG files (about 148 KB of source; the generated atlas is 482 KB of PNG and is not committed), and one generator script. All files are flat in one folder, which worked while one person knew them. A contributor who opens this scene as the reference for a new one will not know which files matter.

| File | Role | Lines | Pure (no Pixi, no DOM, no Node)? |
| --- | --- | --- | --- |
| `index.js` | the one entry point: `create(host)` builds the repository, the scene, the HUD, the dev panel and returns the contract object | 117 | no |
| `menu.js` | the tray status line and items from a summary | 60 | yes |
| `rules.js`, `config.js` | the game rules as pure functions, and the game numbers | 249, 75 | yes, and **enforced by ESLint** (Node globals only) |
| `repo/TankRepository.js`, `repo/LocalTankRepository.js` | the state, the saving through `host.record`, repair of a damaged record | 33, 290 | takes `storage`, `clock`, `rng` as arguments |
| `steering.js` | steering helpers for the fish (pure functions on pixel coordinates) | 191 | yes |
| `TankScene.js` | the Pixi scene: layers, update loop, click handling | 613 | no |
| `Fish.js`, `Food.js`, `Pellet.js`, `Egg.js`, `Bubbles.js`, `SwayMesh.js` | the drawn things | 490, 139, 187, 113, 129, 41 | no |
| `layout.js`, `backdrop.js`, `palette.js`, `pointer.js` | layout from a seed and the screen shape, backdrop shapes, species colours, pointer tracking | 146, 93, 53, 142 | each has a unit test; they use `makeRng` |
| `textures.js` | the sand texture made in code, and `ART_SCALE` | 41 | no (and it imports a host file: section 4, point 5) |
| `visualConfig.js` | the visual numbers | 136 | yes |
| `hud.js`, `hud.css`, `devPanel.js` | window-mode HTML over the canvas, and the development panel | 185, -, 91 | no |
| `species.json`, `decor.json` | species and decoration data | | data |
| `gen-decor-art.mjs`, `art/*.svg` | the generator for rocks, corals and weeds (committed output), and all art sources | | author-side |

## 3. Recommended folder structure

The platform asks for very little (document 1, section 8.1): `scene.json`, `index.js`, `DESIGN.md`, `assets/`, `tests/`. **What is inside is the scene's own business**, so this structure is a recommendation for the fish tank, and a convention that `CONTRIBUTING.md` can offer to others, not a rule of the platform.

```
scenes/fishtank/
  scene.json            the manifest (section 5)
  index.js              create(host): the one entry point, unchanged in shape
  DESIGN.md             = docs/scenes/fishtank.md
  LICENSES.md           the license of the art and the sounds (all original, MIT)
  menu.js               tray status line and items (pure)
  sounds.js             the three sound recipes: splash, pop, chime (from app/page/SoundPlayer.js)
  game/                 PURE: no Pixi, no DOM, no Node. A later server could run it
    rules.js
    config.js
    repo/
      TankRepository.js
      LocalTankRepository.js
  view/                 everything drawn with Pixi
    TankScene.js
    Fish.js  Food.js  Pellet.js  Egg.js  Bubbles.js  SwayMesh.js
    layout.js  backdrop.js  palette.js  pointer.js  steering.js  textures.js
    visualConfig.js
  data/
    species.json  decor.json     bundled into index.js by the pack tool
  ui/                   window mode only
    hud.js  hud.css  devPanel.js
  assets/
    thumbnail.webp      the store picture, 640 x 360, at most 150 KB (new)
    art-src/            the 19 SVG sources (today scenes/fishtank/art/)
    tools/
      gen-decor-art.mjs the generator; its output is committed in art-src/
    art/                GENERATED atlas (png + json); not committed, goes into the pack
  tests/
    unit/               rules, repository, species, steering, layout, palette, backdrop, pointer, pacing
    e2e/                golden, feeding, game, step6 (they drive the tank through `__tank`)
```

**Why these groups:**
- **`game/` is the contract with the future.** `rules.js` and `config.js` are the only files held to "Node globals only" by ESLint, because a server could one day run the same rules. Putting the repository next to them keeps one pure folder to protect with one glob. (A server is not planned: document 3, section 7.2 drops the old Phase 3 and 4 server ideas. The folder is still the honest answer to "which code has no drawing in it".)
- **`view/` holds everything that needs Pixi**, so a reader knows where the drawing is.
- **`ui/` is window mode only** (desktop mode shows no HTML, decision D31 of the old project), so a contributor sees at once that it is optional.
- **`assets/` follows document 1, section 9**: sources apart from what ships; the thumbnail is new and required by the store.
- **Tests live with the scene.** The pack tool and the catalog's CI run the scene's own tests, so they must be in the folder that is reviewed.

**What it costs:** about 30 import paths change (every `./x.js` between groups becomes `../game/x.js` and the like), the ESLint globs, the Vitest include pattern, and the unit tests' import paths. Use `git mv` so history follows. It is a mechanical change that the golden hash can fully check.

**When to do it:** not in the import. The platform document's commit 3 moves the host; the scene's regrouping is **its own PR after the host move is green**, and before the farm house is started, so that the farm house copies the new shape. If the owner prefers zero churn, the alternative is to keep the folder flat and add only `assets/`, `tests/`, `DESIGN.md` and `sounds.js`; the platform works the same. My recommendation is the regrouping, because the tank is the reference scene that contributors will read first.

**ESLint after the move:** the "pure rules" glob changes from `scenes/*/rules.js` and `scenes/*/config.js` to `scenes/*/game/rules.js` and `scenes/*/game/config.js` (or the whole `scenes/*/game/**` if the repository files are pure too: check that `LocalTankRepository.js` uses no browser or Node global before widening it). The clock rule (`Date.now`, `performance.now`, `new Date()`) stays on every file under `scenes/`.

## 4. What the scene must change to meet the new contract

The contract of `docs/platform/01`, section 8.3 differs from the one in `app/page/host.js`. Differences the tank has to follow, and how each is handled so that the golden hash does not move:

| # | Old (today) | New (document 1, section 8) | What to do in the tank |
| --- | --- | --- | --- |
| 1 | `status()` returns `{ line, diagnostics }` | `status()` returns one line | Keep the tray line. The diagnostics line ("Fish: 2, pellets fed in total: 4") needs a home: proposal, an optional `diagnostics()` on the scene, or the scene logs it through `host.log` when the host asks for diagnostics. **To decide in document 1** |
| 2 | `resize(width, height)` | `resize(width, height, unit)` | The tank computes its own unit in `computeLayout` (relative to its height). Accept and ignore the third argument; check that the host's `unit` equals the tank's, so no number moves |
| 3 | `host.rng` (a seeded generator object, made by the host) | `host.seed` and the shared `makeRng` | In `index.js`: `makeRng(host.seed)`. **Risk to the golden hash:** the host must hand out a seed that produces the same sequence as today's `host.rng` for the same test seed. Test it before anything else |
| 4 | `host.art.textures`, the atlas loaded by the host from `scene.json` `"atlas": "fishtank"` | `host.assets.load(path)` for files in the scene's own folder | The atlas should stay **host-loaded** (the host uploads it to the graphics card and closes the decoded image: `app/page/art.js`; this is a memory fix worth 10 MB and every scene needs it). The documents have a gap: the manifest has no `atlas` field and `host` has no `art`. **Proposal for document 1:** keep `"atlas": "assets/art/atlas.json"` in the manifest and `host.art = { textures, scale }`. The tank then changes nothing here |
| 5 | `textures.js` imports `../../assets/spritesheets/fishtank.json` to read `meta.artScale` | a scene reads only its own folder and `host` | `host.art.scale` replaces the import; `ART_SCALE` is set in `create()` and passed on (it is used by `Fish`, `Food`, `Egg`, `Bubbles`, `Pellet`). The pack tool writes `artScale` into the atlas file as it does today |
| 6 | `host.sound.play('splash'\|'pop'\|'chime')`; the recipes live in the host | the scene brings its own sounds | `sounds.js` holds the three recipes; `host.sound.define(name, recipe)` registers them, `host.sound.play(name)` plays. The recipes use the engine's helpers (`partial`, `bubble`, `touch`, `route`), which the engine passes in. **Proposal; document 2's sound capability may want another shape** |
| 7 | `host.options = { fish, dev }` (named, from the URL) | `options` are the manifest's player options; development switches are a free bag | `DESKTOP2_SCENE_OPTIONS` JSON (platform document, leak 2). The tank reads `fish` and `dev` from it |
| 8 | no `migrate` | `migrate(record)` exported next to `create` | The repository already repairs and upgrades records (`status.problem`, `fixes`); export a `migrate` that is a pass-through for `schema` 1 until a schema 2 exists |
| 9 | no `safeArea`, `time`, `settings` | `host.safeArea`, `host.time`, `onSettings` (reduced motion) | Phase 2 and the reduce-motion rule (document 1, section 7.4): the tank has no code for them yet. Plan: `onSettings({ reducedMotion })` lowers bubbles to a third and drops the ripple when it exists. Not needed for the move itself |
| 10 | `debug: { scene, repository }` exposed as `window.__tank` with `?debug=1` | tests and measuring tools | Keep; the host renames the global (platform document, leak 7) |
| 11 | no manifest `fps`, `capabilities`, `budget`, `thumbnail`, `summary` | required | Section 5 |

**Order inside the scene change:** items 3 and 5 first (they touch numbers and files and are checked by the golden hash); then 1, 2, 8; then 6 (a small audible check: the three sounds must be identical, and the sound lab `npm run sounds` helps); then 11.

## 5. The manifest

Today:

```json
{ "id": "fishtank", "name": "Tank", "version": "0.1.0", "author": "Fish Tank",
  "license": { "code": "MIT", "art": "MIT" }, "schema": 1, "atlas": "fishtank" }
```

Proposed for the new contract (fields of document 1, section 8.2; the `atlas` row is the proposal of section 4, point 4):

```json
{
  "id": "fishtank",
  "name": "Fish tank",
  "summary": "A calm aquarium. Feed the fish once a day and watch them grow.",
  "version": "0.1.0",
  "apiVersion": 0,
  "minHost": "0.1.0",
  "authors": ["Tuan Tran"],
  "license": { "code": "MIT", "assets": "MIT" },
  "schema": 1,
  "fps": 30,
  "background": { "tickMs": 0 },
  "capabilities": { "data": [], "place": null, "net": null, "secrets": [], "ui": [], "sound": true },
  "options": [],
  "budget": { "memoryMB": 33 },
  "thumbnail": "assets/thumbnail.webp",
  "atlas": "assets/art/atlas.json"
}
```

- `name` is "Fish tank" (today "Tank", which the macOS menu bar shows as a menu title; check that the longer name fits there).
- `authors`: the old file says `"Fish Tank"`, which is not a person; the owner's name is a decision (the license text needs a copyright holder anyway).
- `license.art` becomes `license.assets` (the new field name). The art is original and AI-assisted; the note about it is in document 3, section 5.
- `fps: 30` matches today's 30 fps desktop cap (`fishtank.md`, section 7); `budget.memoryMB: 33` is the measured cost on Windows, 70 on macOS: the field takes one number, so the open point is whether it is the worse of the two. Document 1, section 7.2 decides.
- `options` is empty for now; "Reduced effects" and "Day and night lighting" arrive with Phase 2.
- `capabilities` is empty: the tank needs **no consent dialog**, which is the point of keeping it the default scene.

## 6. The art pipeline

- **Sources stay SVG** (`assets/art-src/`): original, drawn in this project. `scripts/build-assets.mjs` already renders each SVG at 3x with `resvg`, packs one atlas per scene and writes a contact sheet. It changes in three small ways: it reads `assets/art-src/` instead of `art/`, it writes `assets/art/atlas.png` and `atlas.json` inside the scene instead of `assets/spritesheets/`, and the contact sheet goes to a build folder.
- **The atlas stays PNG.** `app/page/art.js` closes the decoded image after the upload and its comment warns that this works only for an `ImageBitmap`, which PixiJS makes for PNG; a smoke test checks it. Do not change the format in the move; a WebP atlas needs its own check.
- **The generator stays on the author's computer.** `gen-decor-art.mjs` draws rocks, corals and weeds from a seed and writes SVG; its **output is committed**. This already matches the catalog rule that CI never runs a scene's own scripts (document 1, section 5.4, point 2).
- **The style guide** `docs/art-style.md` (it was `assets/art/STYLE.md`; moved in the documents step) belongs to every scene; the farm house and the desk follow it.
- **The thumbnail** is new. `npm run shot` already makes reproducible pictures (fixed seed, manual clock) and can make the 640 x 360 image; converting it to WebP and keeping it under 150 KB needs an encoder that is not in the dependencies today (`resvg` writes PNG only). Open point: add one dev dependency, or let the pack tool do it.
- **The contact sheet** (`assets/contact-sheet-fishtank.png`) is generated and git-ignored; keep it so.

## 7. Tests

Step 4 of the bootstrap (the move) already put the nine unit files and four end-to-end files of the tank flat into `scenes/fishtank/tests/`, and left the rest in `tests/host/` and `tests/e2e/`. The table says where each goes in the regrouping of the tank (`unit/` and `e2e/` inside the scene), and what to check on the way.

| Now | Goes to | Why |
| --- | --- | --- |
| `scenes/fishtank/tests/rules.test.js`, `repository.test.js`, `species.test.js`, `pacing.test.js` | `scenes/fishtank/tests/unit/` | the game |
| `scenes/fishtank/tests/steering.test.js`, `layout.test.js`, `palette.test.js`, `backdrop.test.js`, `pointer.test.js` | `scenes/fishtank/tests/unit/` | the drawing support |
| `tests/host/menu.test.js` | check first | it may test the **host's** menu (`app/main/menu.js`) and not the tank's `menu.js`; split if it tests both |
| `tests/host/sound.test.js` | split | the engine part stays in the host tests, the recipe part moves with `sounds.js` |
| `scenes/fishtank/tests/golden.spec.js`, `feeding.spec.js`, `game.spec.js`, `step6.spec.js` | `scenes/fishtank/tests/e2e/` | they drive the tank through `window.__scene` (renamed in the rename step) |
| `tests/e2e/smoke.spec.js` | stays in the host tests | it checks the atlas upload and the host; it also uses `window.__scene` |

New tests the scene gets from the platform: the **contract test** (every scene object has the functions the contract names; `resume(gapMs)` after a long gap; `dispose()` frees what it made) and the **capability test** (a scene without capabilities runs with `host.net`, `host.data` and `host.place` absent). The tank is the first scene to pass them, and must pass them unchanged in behaviour.

The Vitest include pattern and the Playwright test directory must be told about `scenes/**/tests/`; if they are not, the tests silently stop running after the move. After the move, count the tests (about 330 unit tests are reported in `fishtank.md`, section 9) and compare with the count before.

## 8. Steps

Each step is one small PR, and the golden hash and the reproducible screenshot must be identical after it.

1. The host import, rename and move (platform document, sections 2 and 7). The scene folder is copied as it is.
2. **Host change for the scene's sake:** `host.art.scale` (point 5), `host.seed` equal to the old `host.rng` for a test seed (point 3), `DESKTOP2_SCENE_OPTIONS` (point 7). Tank change: use them. Golden unchanged.
3. **Regroup the folder** (section 3) with `git mv`; update imports, ESLint, Vitest. No logic change.
4. **Move the tests** (section 7) and make them run from the new places; compare the test count.
5. **Sounds:** split the engine and the recipes (leak 4 of the platform document, point 6 here).
6. **Manifest and thumbnail:** the new `scene.json`, `assets/thumbnail.webp`, `LICENSES.md`, `DESIGN.md` (from `fishtank.md`).
7. **Contract and capability tests** pass for the tank; the dev kit `npm run dev:scene fishtank` shows it.
8. Phase 2 effects, the reduced-motion option and day and night lighting come after, as scene features, not as part of the move.

## 9. Open points

1. Where does the tank's diagnostics line go (section 4, point 1)?
2. How does a scene get its atlas: `host.art` with `atlas` in the manifest (proposed), or only `host.assets.load`?
3. The name in the manifest: "Fish tank" or "Tank"; the author field: the owner's name.
4. `budget.memoryMB`: the Windows figure (33), the Mac figure (70), or the larger.
5. The WebP encoder for the thumbnail.
6. Regroup the folder (recommended) or keep it flat.
