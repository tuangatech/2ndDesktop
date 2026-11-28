// The red barn (docs/scenes/farmhouse.md section 5 item 6b, rule R13, DEC-64): a red board barn with cream trim, a gambrel
// roof, a hayloft window, a big closed double door with its X braces and a wide open door that the animals go in by.
// Pure, like house.js: the snow in, a list of drawing operations out (draw.js). Drawn in its own space: x from the barn's
// left edge, y 0 at the ground and up to minus its height; the scene places it at the left edge of the screen. The glow
// of the open door and the lantern at night are the scene's, drawn over this picture (`BARN_DOOR`, `BARN_LANTERN`).
import { BARN } from '../game/barn.js';
import { mix, n } from './colour.js';
import { gradient, makePicture } from './draw.js';
import { SNOW } from './palette.js';

const RED_DARK = '#7f3325';
const TRIM = '#efe9da';
const ROOF = '#5b6068';

const rect = (x, y, w, h, fill, extra = {}) => ({
  t: 'rect',
  x: n(x),
  y: n(y),
  w: n(w),
  h: n(h),
  fill,
  ...extra,
});
const path = (d, fill, extra = {}) => ({ t: 'path', d, fill, ...extra });

/** The open door of the animals, in the barn's own space: the scene lights it at night. */
export const BARN_DOOR = Object.freeze({ x: BARN.doorX - 33, y: -92, w: 66, h: 92 });
/** The lantern beside the door. */
export const BARN_LANTERN = Object.freeze({ x: 131, y: -64 });
/** The hayloft window (the owl's place, R16). */
export const BARN_LOFT = Object.freeze({ x: 113, y: -150, w: 26, h: 24 });

/**
 * @param {number} snowCover  0 to 1: snow on the roof
 */
export function barnPicture(snowCover = 0) {
  const k = Math.max(0, Math.min(1, snowCover));
  const snow = (c, t = 1) => mix(c, SNOW, k * 0.7 * t);
  const { x: dx, y: dy, w: dw, h: dh } = BARN_DOOR;
  const ops = [
    { t: 'ellipse', x: 125, y: 2, rx: 123, ry: 6, fill: '#2e2a26', alpha: 0.2 },
    // the stone foundation
    rect(8, -7, 234, 7, '#8d8a84', { rx: 2 }),
    // the front: a gable end with a gambrel roof line
    path(
      'M 14 -6 L 14 -104 L 42 -146 Q 125 -176 208 -146 L 236 -104 L 236 -6 Z',
      gradient(-176, -6, '#b24a34', RED_DARK),
      { stroke: RED_DARK, width: 1.6 },
    ),
    // the boards
    path(
      Array.from({ length: 14 }, (_, i) => `M ${24 + i * 15.6} -8 L ${24 + i * 15.6} -104`).join(
        ' ',
      ),
      null,
      { stroke: RED_DARK, width: 1, alpha: 0.55 },
    ),
    // the big closed double door with its X braces, on the left
    rect(36, -92, 76, 86, '#9c3e2b', { stroke: TRIM, width: 4 }),
    path('M 38 -90 L 110 -8 M 110 -90 L 38 -8 M 74 -92 L 74 -6', null, {
      stroke: TRIM,
      width: 3,
      cap: 'round',
    }),
    // the hayloft: a dark window with a cream frame and a sill
    rect(BARN_LOFT.x, BARN_LOFT.y, BARN_LOFT.w, BARN_LOFT.h, '#2a1f1c', {
      stroke: TRIM,
      width: 3.5,
    }),
    rect(BARN_LOFT.x - 4, BARN_LOFT.y + BARN_LOFT.h + 2, BARN_LOFT.w + 8, 4, TRIM, { rx: 1.5 }),
    // the lantern on its bracket between the two doors
    path('M 131 -86 L 131 -76', null, { stroke: '#3a332c', width: 2, cap: 'round' }),
    rect(127.5, -76, 7, 12, '#4a4036', { rx: 1.8 }),
    // the open door of the animals: a dark opening with a cream frame
    rect(dx - 4, dy - 4, dw + 8, dh + 4, TRIM, { rx: 2 }),
    rect(dx, dy, dw, dh, gradient(dy, dy + dh, '#241915', '#3a2a22')),
    // cream trim along the roof edge
    path('M 11 -104 L 40 -148 Q 125 -179 210 -148 L 239 -104', null, {
      stroke: TRIM,
      width: 4.5,
      cap: 'round',
    }),
    // the roof: a dark band along the edge of each slope, and a ridge cap
    path(
      'M 6 -102 L 38 -151 Q 125 -184 212 -151 L 244 -102 L 238 -100 L 208 -146 Q 125 -176 42 -146 L 12 -100 Z',
      gradient(-184, -100, snow(ROOF, 0.9), snow('#43474e', 0.6)),
      { stroke: snow('#3d4046', 0.9), width: 1.4 },
    ),
    path('M 52 -163 Q 125 -188 198 -163', null, {
      stroke: snow('#7a7f86', 0.9),
      width: 3,
      cap: 'round',
    }),
  ];
  if (k > 0.25) {
    // snow lying along the top of the two slopes
    ops.push(
      path('M 8 -103 L 38 -152 Q 125 -185 212 -152 L 242 -103', null, {
        stroke: SNOW,
        width: 3 + k * 5,
        cap: 'round',
        alpha: 0.9,
      }),
    );
  }
  return makePicture(
    { x: 0, y: -BARN.height, width: BARN.width, height: BARN.height + 10, resolution: 1 },
    ops,
  );
}
