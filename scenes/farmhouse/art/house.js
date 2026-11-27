// The stone house with its porch, the drive and the old farm truck (docs/scenes/farmhouse.md section 5, items
// 6 and 8; the concept picture docs/scenes/farmhouse/farmhouse-autumn-preview.png is the look). Pure, like
// landscape.js: a seed (and the snow) in, a list of drawing operations out (draw.js). The lit windows, the smoke and the
// truck's movement are the scene's, drawn over these pictures (`WINDOW_RECTS`, `DOOR_GLASS`, `CHIMNEY_TOP`, `TRUCK`).
//
// The house was drawn for a picture 1600 wide with the house at x 810: `X` moves everything to the middle of the design.
import { makeRng } from '../../../shared/rng.js';
import { DESIGN } from '../layout.js';
import { mix, n } from './colour.js';
import { gradient, makePicture } from './draw.js';
import { SNOW } from './palette.js';

const W = DESIGN.width;
const X = DESIGN.houseX - 810;
const GROUND = 560;
const CREAM = '#efe9da';
const SHUTTER = '#5e7260';
const WOOD = '#a07c55';

const pick = (rng, list) => list[rng.int(0, list.length - 1)];
const rect = (x, y, w, h, fill, extra = {}) => ({
  t: 'rect',
  x: n(x),
  y: n(y),
  w: n(w),
  h: n(h),
  fill,
  ...extra,
});
const ball = (x, y, r, fill) => ({ t: 'ellipse', x: n(x), y: n(y), rx: n(r), ry: n(r), fill });
const path = (d, fill, extra = {}) => ({ t: 'path', d, fill, ...extra });
/** A path of the 1600-wide concept, moved to the middle of the design: only the x of each pair of numbers moves. */
const shift = (d) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${+x + X} ${y}`);

/** The windows that light up: where each one is (design units), for the scene's glow over the house. */
export const WINDOW_RECTS = Object.freeze({
  'up-left': { x: 695 + X, y: 424, w: 40, h: 48 },
  'up-mid': { x: 791 + X, y: 424, w: 40, h: 48 },
  'up-right': { x: 887 + X, y: 424, w: 40, h: 48 },
  'down-left': { x: 695 + X, y: 504, w: 40, h: 44 },
  'down-right': { x: 887 + X, y: 504, w: 40, h: 44 },
});
/** The glass of the front door (the lamp that stays on all night). */
export const DOOR_GLASS = Object.freeze({ x: 802 + X, y: 509, w: 24, h: 14 });
/** Where the smoke leaves the chimney. */
export const CHIMNEY_TOP = Object.freeze({ x: 944 + X, y: 308 });
/** The glass colours, lit and unlit. */
export const GLASS = Object.freeze({ lit: '#efd9a0', litLow: '#d9b66c', dark: '#8fa3a6' });

/**
 * The house: stone walls, the second floor with its shutters, the porch, the roof, the chimney and the bushes along the
 * foundation. The glass is dark here; the lit windows are drawn over it.
 * @param {number} snowCover  0 to 1: snow on the two roofs, the porch deck and the bushes
 */
export function housePicture(snowCover = 0, seed = 5) {
  const rng = makeRng(seed);
  const snow = (c, k = 1) => mix(c, SNOW, Math.max(0, Math.min(1, snowCover)) * 0.7 * k);
  const L = 650 + X;
  const R = 970 + X;
  const T = 408;
  const ops = [];
  // The wall, with its stones.
  ops.push(rect(L, T, R - L, GROUND - T, gradient(T, GROUND, '#c2b293', '#a09075')));
  let row = 0;
  for (let y = T + 2; y < GROUND - 4; y += 11) {
    let x = L + (row % 2 ? -10 : 0);
    while (x < R) {
      const w = rng.range(18, 32);
      const x0 = Math.max(L, x);
      const x1 = Math.min(R, x + w);
      const h = rng.range(8, 10);
      const c = pick(rng, ['#b6a687', '#cdbf9f', '#a79776', '#bfb094', '#9d8e73']);
      const alpha = n(rng.range(0.35, 0.7));
      if (x1 - x0 > 6) ops.push(rect(x0 + 1, y, x1 - x0 - 2, h, c, { rx: 3, alpha }));
      x += w;
    }
    row++;
  }
  ops.push(rect(L, T, R - L, 14, gradient(T, T + 14, '#4a3d38', '#4a3d38', 0.35, 0)));

  const window = (x, y, w, h) => {
    ops.push(
      rect(x - 15, y - 2, 10, h + 4, SHUTTER, { rx: 3 }),
      rect(x + w + 5, y - 2, 10, h + 4, SHUTTER, { rx: 3 }),
      rect(x - 4, y - 4, w + 8, h + 8, CREAM, { rx: 5 }),
      rect(x, y, w, h, GLASS.dark, { rx: 3 }),
      rect(x + w / 2 - 1.5, y, 3, h, CREAM),
      rect(x, y + h * 0.42, w, 3, CREAM),
    );
  };
  for (const id of ['up-left', 'up-mid', 'up-right']) {
    const r = WINDOW_RECTS[id];
    window(r.x, r.y, r.w, r.h);
  }
  // The ground floor, in the shade of the porch.
  ops.push(
    rect(L, 486, R - L, GROUND - 486, gradient(486, GROUND, '#3d322c', '#3d322c', 0.34, 0.16)),
  );
  for (const id of ['down-left', 'down-right']) {
    const r = WINDOW_RECTS[id];
    window(r.x, r.y, r.w, r.h);
  }
  ops.push(
    rect(792 + X, 498, 44, GROUND - 498, CREAM, { rx: 5 }),
    rect(797 + X, 503, 34, GROUND - 503, gradient(503, GROUND, '#6f8a80', '#587268'), { rx: 3 }),
    rect(DOOR_GLASS.x, DOOR_GLASS.y, DOOR_GLASS.w, DOOR_GLASS.h, GLASS.dark, { rx: 3 }),
    rect(802 + X, 530, 10, 20, '#4f675e', { rx: 2 }),
    rect(816 + X, 530, 10, 20, '#4f675e', { rx: 2 }),
    ball(827 + X, 540, 2.2, '#d9b66c'),
  );

  // The main roof: tin, with standing seams.
  ops.push(
    path(
      shift('M 626 418 L 720 346 L 900 346 L 994 418 Z'),
      gradient(346, 418, snow('#8f8b85', 0.8), snow('#625f5b', 0.5)),
      {
        stroke: snow('#76726d', 0.9),
        width: 8,
      },
    ),
  );
  for (let x = 640; x < 985; x += 15) {
    const top = x < 720 ? 346 + ((720 - x) / 94) * 72 : x > 900 ? 346 + ((x - 900) / 94) * 72 : 346;
    ops.push(
      path(`M ${x + X} ${n(top + 6)} L ${x + X} 412`, null, {
        stroke: '#4f4a46',
        width: 1.6,
        cap: 'round',
        alpha: 0.25 * (1 - snowCover * 0.8),
      }),
    );
  }
  // The chimney.
  ops.push(rect(928 + X, 316, 32, 82, gradient(316, 398, '#b7a78a', '#9a8a70'), { rx: 3 }));
  for (let y = 322; y < 392; y += 12) {
    ops.push(rect(930 + X, y, rng.range(10, 14), 8, '#a99a7e', { rx: 3, alpha: 0.6 }));
  }
  ops.push(rect(923 + X, 308, 42, 11, '#8b7c66', { rx: 5 }));

  // The porch: deck, steps, roof, columns and rails.
  ops.push(
    rect(616 + X, 556, 388, 12, gradient(556, 568, snow('#b9ae95', 0.5), snow('#a29780', 0.3)), {
      rx: 4,
    }),
    rect(784 + X, 566, 62, 8, '#a99e87', { rx: 3 }),
    rect(790 + X, 573, 50, 7, '#9a8f79', { rx: 3 }),
    path(
      shift('M 612 512 L 650 480 L 970 480 L 1008 512 Z'),
      gradient(480, 512, snow('#9a9893', 0.8), snow('#74716d', 0.5)),
      {
        stroke: snow('#7f7c77', 0.9),
        width: 7,
      },
    ),
    rect(620 + X, 508, 380, 8, CREAM, { rx: 4 }),
  );
  for (const [a, b] of [
    [640, 740],
    [888, 980],
  ]) {
    ops.push(
      rect(a + X, 530, b - a, 5, CREAM, { rx: 2.5 }),
      rect(a + X, 548, b - a, 4, CREAM, { rx: 2 }),
    );
    for (let x = a + 6; x < b - 3; x += 9) ops.push(rect(x + X, 534, 3, 14, CREAM, { rx: 1.5 }));
  }
  for (const cx of [640, 740, 888, 980]) {
    ops.push(
      rect(cx + X - 5, 514, 10, 42, '#e8e1cf', { rx: 3 }),
      rect(cx + X - 7.5, 510, 15, 6, CREAM, { rx: 3 }),
      rect(cx + X - 7, 552, 14, 6, CREAM, { rx: 3 }),
    );
  }
  // A pot of mums on the porch.
  ops.push(
    rect(920 + X, 540, 16, 14, '#b0654f', { rx: 3 }),
    ball(923 + X, 536, 6, '#d9a23c'),
    ball(932 + X, 535, 6, '#c2692f'),
    ball(928 + X, 530, 5.5, '#e0b44a'),
  );

  // The bushes along the foundation (evergreen, so the same all year; snow lies on top).
  for (let i = 0; i < 18; i++) {
    const x = (rng.next() < 0.5 ? rng.range(612, 774) : rng.range(856, 1006)) + X;
    const r = rng.range(12, 20);
    ops.push(
      ball(
        x,
        GROUND + 12 - r * 0.2,
        r,
        snow(pick(rng, ['#6e7d58', '#7c8b62', '#5f6f4f', '#86925f']), 0.6),
      ),
    );
  }
  return makePicture({ x: 560 + X, y: 300, width: 520, height: 300, resolution: 1 }, ops);
}

/** The gravel drive that leaves the porch steps and runs out to the right, with its stones. */
export function drivePicture(seed = 6) {
  const rng = makeRng(seed);
  const ops = [
    path(
      `${shift('M 800 574 C 790 596 820 604 880 603')} L ${W} 603 L ${W} 628 ${shift('L 880 628 C 780 630 770 600 770 574 Z')}`,
      gradient(574, 628, '#d6c9a8', '#bfb18f'),
    ),
  ];
  for (let i = 0; i < Math.round(160 * ((W - 780 - X) / 820)); i++) {
    ops.push({
      t: 'ellipse',
      x: n(rng.range(780 + X, W)),
      y: n(rng.range(606, 626)),
      rx: n(rng.range(2, 6)),
      ry: 1.6,
      fill: pick(rng, ['#c4b692', '#e0d4b4', '#b3a584']),
      alpha: 0.7,
    });
  }
  return makePicture({ x: 760 + X, y: 570, width: W - 760 - X, height: 62, resolution: 1 }, ops);
}

/** The truck is drawn with its nose to the left, in its own space: the origin is the left of the chassis on the ground. */
export const TRUCK = Object.freeze({
  x: 1056 + X,
  y: 614,
  width: 190,
  height: 96,
  left: -14,
  top: -84,
});

/**
 * An old farm truck seen from the side: round fenders, an upright cab, a wooden stake bed with a hay bale. Drawn in its own
 * space (`TRUCK`), the scene places it and mirrors it when it faces right.
 */
export function truckPicture() {
  const BODY = (y0, y1) => gradient(y0, y1, '#8faea3', '#648178');
  const D = '#5c766e';
  const ops = [
    rect(-6, -22, 182, 8, '#4d4a46', { rx: 3 }),
    rect(104, -36, 70, 8, WOOD, { rx: 2.5 }),
    rect(110, -58, 48, 22, gradient(-58, -36, '#e2c46a', '#c9a74e'), { rx: 5 }),
    path('M 126 -58 L 126 -36 M 142 -58 L 142 -36', null, {
      stroke: '#8a7440',
      width: 2,
      cap: 'round',
    }),
  ];
  for (const x of [105, 128, 151, 172]) ops.push(rect(x - 2, -62, 4.5, 28, '#8a6a48', { rx: 2 }));
  ops.push(
    rect(104, -60, 71, 4.5, WOOD, { rx: 2 }),
    rect(104, -47, 71, 4, WOOD, { rx: 2 }),
    path('M -4 -22 L -4 -38 Q -4 -46 6 -47 L 46 -48 L 50 -22 Z', BODY(-48, -22), {
      stroke: D,
      width: 3,
    }),
    rect(-2, -41, 5, 16, '#a9b3ad', { rx: 2 }),
    path('M 48 -22 L 51 -73 Q 52 -78 58 -78 L 92 -78 Q 98 -78 99 -72 L 101 -22 Z', BODY(-78, -22), {
      stroke: D,
      width: 3,
    }),
    rect(58, -71, 35, 24, gradient(-71, -47, '#cdd8d4', '#a3b4b0'), { rx: 6 }),
    rect(74, -71, 3, 24, D),
    rect(56, -44, 40, 21, null, { rx: 3, stroke: D, width: 2 }),
    rect(60, -38, 8, 3, '#d9dfda', { rx: 1.5 }),
  );
  for (const wx of [30, 138]) {
    ops.push(
      { t: 'ellipse', x: wx, y: -14, rx: 25, ry: 25, fill: BODY(-39, 11), stroke: D, width: 3 },
      { t: 'ellipse', x: wx, y: -12, rx: 20, ry: 20, fill: '#3f3a36' },
    );
  }
  ops.push(
    { t: 'ellipse', x: 22, y: -30, rx: 9, ry: 4, fill: '#a8664a', alpha: 0.45 },
    { t: 'ellipse', x: 146, y: -34, rx: 7, ry: 3.5, fill: '#a8664a', alpha: 0.4 },
  );
  for (const wx of [30, 138])
    ops.push(
      ball(wx, -10, 16, '#3b3e42'),
      ball(wx, -10, 7.5, '#b6b7b3'),
      ball(wx, -10, 2.5, '#8d8e8b'),
    );
  ops.push(ball(-2, -34, 5, '#ecdca4'), rect(-10, -24, 9, 5, '#b9bcb8', { rx: 2.5 }));
  return makePicture(
    { x: TRUCK.left, y: TRUCK.top, width: TRUCK.width, height: TRUCK.height, resolution: 1 },
    ops,
  );
}
