# Fish Tank — Art Style Guide

Status: Draft, waiting for the owner's approval (Phase 1, Step 0). The swatches are in [palette.svg](palette.svg); open it in VS Code or a browser to see the colors.

All art is drawn by Claude Code as SVG and rendered by `npm run assets`. This guide keeps the pieces consistent. If a drawing and this guide disagree, change the drawing, or change the guide and get it approved again.

## The feeling

Calm, soft and a little dreamy: a quiet aquarium, not a cartoon. Round shapes, gentle curves, moderate color, and nothing that shouts for attention. The tank must be pleasant to leave on a desktop all day and look good behind desktop icons.

## Rules

1. **No outlines.** Shapes are defined by color and value. Where an edge needs help, use a thin line (about 2% of the shape's length) in a darker tone of the same fill, never black.
2. **Soft gradients.** A shape has a flat fill or a two-stop linear gradient. The light comes from above, so the top is lighter and the bottom is darker. No gradient meshes and no more than three tones per shape.
3. **Round and simple.** Rounded ends, gentle curves, no sharp spikes. Details are few and large enough to read at 48 px long.
4. **Moderate saturation.** Colors come from the palette below. Pure, hard saturated colors are not used, because they look loud on a desktop.
5. **No text, no black, no pure white** except for small highlights.
6. **Drawn in daylight.** Night, depth and tint are applied in code. Never paint shadows of the tank into a piece of art.

## Palette (about 8 color families)

| Name | Light | Mid | Dark | Used for |
| --- | --- | --- | --- | --- |
| Water | `#9be8e4` | `#3fb0c4` | `#14507c` | Background gradient from top to bottom, light shafts (Phase 2) |
| Abyss | `#0e2f55` | | | Deepest water at night (Phase 2), UI panels |
| Sand | `#efdfb0` | `#d6bb86` | `#a98f5e` | Floor, shells |
| Rock | `#9aa7b8` | `#6f7e93` | `#4b5a70` | Rocks (blue-gray, so they sit well in the water) |
| Weed | `#7fd1a0` | `#46a97d` | `#2b7a5e` | Weeds and sea grass |
| Coral warm | `#ffb09f` | `#f27f73` | `#c75a58` | Corals |
| Coral cool | `#f6bfd0` | `#e293b0` | `#b96d8f` | Corals, fans |
| Fish neutral | `#ffffff` | `#e6ebf2` | `#c4cdd9` | Tintable fish parts (see below) |

Species palettes (fry, juvenile and adult) are chosen in `species.json` from these families plus small accents (a warm orange `#ffb35c`, a soft yellow `#f6df7a`, a cool blue `#6aa8f0`), each of 2 to 3 colors. Fish colors are the one place where the palette may be a little more saturated than the scenery, so the fish are the first thing the eye finds.

## Fish

- **Three pieces per species:** `body`, `tail` and `accent` (fins, stripes or spots). One shape for all three growth stages. Size and color change in code (FR-12, FR-13).
- **Tintable parts are neutral.** `body`, `tail` and `accent` are drawn in the Fish neutral tones (light grays, 75% to 100% brightness) so a tint from the palette multiplies cleanly. A tint of any palette color must still look good.
- **Eye:** a small dark round dot with a tiny light highlight, part of `body`. No mouth line; the mouth point is an anchor in `species.json`.
- **Facing:** every fish faces right, with its center at the middle of the artwork. Body length is 200 SVG units, and the tail overlaps the body slightly so the `MeshRope` wave never shows a gap.
- **Readable in grayscale:** the three species have different silhouettes (tetra slim, guppy round with a fan tail, angelfish tall and diamond shaped). Check the contact sheet in grayscale.
- **Canvas per species (2026-11-21):** the art is always 200 units long, but the height follows the shape: the tetra 64, the guppy 80 and the angelfish 150 (tall body with long dorsal and anal fins). Accent bands may extend onto the fins (clipped to body and fins). Keep the canvas tight, because the atlas is video memory.
- **Size in the default window (480 × 320):** an adult is about 44 px (tetra), 48 px (guppy) and 52 px (angelfish) long. Art is rendered at 3 times that, so it stays sharp on a 1080p desktop.

## Scenery

- **Update 2026-11-20 (owner: the first scenery looked fake, wanted more detail).** Scenery (not fish) may now use more than two tones per piece: stone relief and fine grain, flat lit and shaded facets, cracks, barnacles and a film of algae on rocks; coral with tapered branches, a light edge, pores and round polyps; sea fans as a net; weed blades with a vein and a shaded side. The rules above about outlines, no black and moderate saturation still hold. The scenery is drawn by `scripts/gen-decor-art.mjs` (a seed per piece), which writes the SVGs in this folder. Change the numbers there and run `node scripts/gen-decor-art.mjs && npm run assets`. Fish stay simple and flat.

- **Update 2026-11-22 (compared with a reference aquarium picture, with the owner's request to make the scenery better).** Two changes, both made in code and not in the SVGs: (1) a **far reef**, three soft silhouette layers (ridges and thin weed shapes) in the Water family (shades between the Water mid `#3fb0c4` and dark `#14507c` tones: `#2b86a8`, `#1c6b93`, `#124f7a`), darker and bluer toward the front, drawn behind the decor by `renderer/game/backdrop.js` from the tank seed (numbers in `visualConfig.backdrop`). It gives the water depth and stays low in contrast, so the fish are still the first thing the eye finds. (2) The **back row** of decor is paler through one veil of water colour (`visualConfig.decor.backHaze`, the layer `water.backHaze`) instead of a transparency per piece, so a back coral no longer shows through a back rock. Ideas from the reference that are not done yet: more kinds (a teal tube coral, a sea star, a shell, a sponge), because new kinds change the seeded decor layout (FR-41).

- **Decor kinds for Phase 1:** `rock-large`, `rock-small`, `coral-branch`, `coral-fan`, `weed-tall`, and either `weed-short` or `shell`. At least 5 kinds.
- **Back and front:** back decor uses the Light tones and front decor uses the Mid tones, so the back looks farther away.
- **Sway parts** (weeds and corals) are drawn as tall strips that bend well; rocks and sand never move.
- **Walk lines (Phase 2):** each rock and coral kind gets a polyline along its top for crabs and snails.
- **Sand** is generated in code (soft noise) with a lighter highlight line along its top edge.

## Small things

- **Pellet:** a small round brown-gold drop (`#d9a441`) with a lighter top highlight. Readable on water and sand.
- **Egg:** a soft off-white oval with a pale speckle, resting on the sand.
- **Bubbles:** a thin lighter ring with a small highlight, white at 60% opacity. Sizes from 3 to 10 px.
- **Tray icon:** a one-color fish silhouette on a 16 px grid, drawn with simple shapes. On macOS it is a template image (black on transparent, the system colors it). On Windows it is a two-tone water-blue version (mid and dark blue) that reads on dark and light taskbars.
- **App icon:** a rounded square in the Water gradient with a single light fish.

## Review checklist (for the owner)

- [ ] The palette feels calm and right behind desktop icons.
- [ ] Rounded, outline-free shapes are the right look.
- [ ] Fish colors may be slightly more saturated than the scenery.
- [ ] The sizes in the default window are about right.

Changes requested by the owner are written here with the date.
