// The stone house with its porch, the drive and the blue and white pick-up truck (docs/scenes/farmhouse.md section 5, items
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
  width: 210,
  height: 96,
  left: -14,
  top: -84,
});

/**
 * A late-1970s square-body step-side pick-up (the owner's reference was a Chevrolet C10; this drawing is made here from
 * drawing operations: no badge, no lettering, nothing traced), seen from the side in blue and white: a blue hood, doors
 * and bed, a white roof, white fender flares and bumpers, a hay bale in the bed. Drawn in its own space (`TRUCK`), the
 * scene places it and mirrors it when it faces right. Its nose is to the left; the ground is y 0.
 */
export function truckPicture() {
  const BLUE = (y0, y1) => gradient(y0, y1, '#4a7fb4', '#2f5f93');
  const BLUE_LINE = '#264e7a';
  const CREAM_BODY = (y0, y1) => gradient(y0, y1, '#f3efe4', '#d9d5c8');
  const CREAM_LINE = '#aeb2b0';
  const GLASS = gradient(-66, -48, '#dbe7ec', '#a3bac6');
  const CHROME = '#d6d8d4';
  const DARK = '#2e2a26';
  const WHEELS = [34, 142];
  const ops = [
    { t: 'ellipse', x: 90, y: 1, rx: 98, ry: 5, fill: DARK, alpha: 0.22 },
    // under the body, between the wheels
    rect(8, -25, 170, 9, '#3a3733', { rx: 3 }),
    // the hay bale standing in the bed (it shows above the rail)
    rect(134, -60, 34, 16, gradient(-60, -44, '#e3c66e', '#c9a74e'), { rx: 3.5 }),
    path('M 145 -60 L 145 -45 M 157 -60 L 157 -45', null, {
      stroke: '#8a7440',
      width: 1.6,
      cap: 'round',
    }),
    // the bed: a blue side with a cream rail, and the step behind the cab
    rect(108, -45, 77, 24, BLUE(-45, -21), { rx: 2, stroke: BLUE_LINE, width: 1.6 }),
    rect(107, -48, 79, 4, CREAM_BODY(-48, -44), { rx: 2, stroke: CREAM_LINE, width: 1 }),
    path('M 112 -37 L 128 -37 M 112 -30 L 128 -30', null, {
      stroke: BLUE_LINE,
      width: 1,
      alpha: 0.7,
    }),
    rect(105, -23, 16, 5, CHROME, { rx: 2 }),
    // the rear fender of a step-side: a cream flare that stands out of the bed side
    path(
      'M 119 -21 L 119 -35 Q 119 -47 133 -47 L 152 -47 Q 168 -47 171 -34 L 172 -21 Z',
      CREAM_BODY(-47, -21),
      {
        stroke: CREAM_LINE,
        width: 1.6,
      },
    ),
    path('M 125 -37 Q 128 -43 136 -43 L 152 -43', null, {
      stroke: '#fff6e6',
      width: 1.2,
      alpha: 0.6,
      cap: 'round',
    }),
    // the hood
    path('M -2 -23 L -2 -39 Q -2 -45 5 -46 L 51 -49 L 53 -22 Z', BLUE(-49, -22), {
      stroke: BLUE_LINE,
      width: 1.8,
    }),
    path('M 2 -45 L 50 -48', null, { stroke: '#7ba3cb', width: 1.4, cap: 'round' }),
    // the cab: blue body, cream roof, a door with its window
    path(
      'M 50 -22 L 50 -45 L 63 -69 Q 64 -71 68 -71 L 104 -71 Q 108 -71 108 -67 L 108 -22 Z',
      BLUE(-71, -22),
      {
        stroke: BLUE_LINE,
        width: 1.8,
      },
    ),
    path(
      'M 59.2 -62 L 63 -69 Q 64 -71 68 -71 L 104 -71 Q 108 -71 108 -67 L 108 -62 Z',
      CREAM_BODY(-71, -62),
      {
        stroke: CREAM_LINE,
        width: 1.2,
      },
    ),
    path('M 62 -48 L 68 -65 L 102 -65 Q 104.5 -65 104.5 -62.5 L 104.5 -48 Z', GLASS, {
      stroke: '#efeadf',
      width: 2.4,
    }),
    path('M 77 -65 L 77 -48', null, { stroke: '#efeadf', width: 1.8 }),
    path('M 53 -45 L 53 -23 M 105.5 -46 L 105.5 -23', null, { stroke: BLUE_LINE, width: 1.2 }),
    rect(91, -44, 9, 2.6, '#ebe6da', { rx: 1.3 }),
    // a chrome strip along the side, and the lower door trim
    path('M 4 -37 L 107 -37', null, { stroke: '#ebe6da', width: 1.8, cap: 'round' }),
    rect(55, -27, 48, 4, '#c9cbc7', { rx: 2 }),
    // the mirror
    path('M 58 -57 L 62 -53', null, { stroke: DARK, width: 1.6, cap: 'round' }),
    rect(54, -60, 6.5, 9, DARK, { rx: 2 }),
    // the nose: a cream grille, a round lamp, an amber lamp, the bumpers
    rect(-4, -43, 8, 17, CREAM_BODY(-43, -26), { rx: 2, stroke: CREAM_LINE, width: 1 }),
    path('M -2 -39 L 2 -39 M -2 -35 L 2 -35 M -2 -31 L 2 -31', null, {
      stroke: '#8d9290',
      width: 1,
    }),
    ball(-0.5, -41.5, 2.6, '#f0e2a8'),
    rect(-3.5, -27, 5, 2.6, '#e8a73a', { rx: 1.2 }),
    rect(-9, -22, 15, 7, CHROME, { rx: 3 }),
    rect(177, -22, 13, 7, CHROME, { rx: 3 }),
    rect(182.5, -40, 3.6, 9, '#b9392f', { rx: 1.2 }),
  ];
  for (const wx of WHEELS) {
    ops.push(
      { t: 'ellipse', x: wx, y: -16, rx: 19.5, ry: 19.5, fill: DARK },
      { t: 'ellipse', x: wx, y: -16, rx: 16.5, ry: 16.5, fill: '#34312d' },
      { t: 'ellipse', x: wx, y: -16, rx: 10.5, ry: 10.5, fill: '#efeadf' },
      { t: 'ellipse', x: wx, y: -16, rx: 7.5, ry: 7.5, fill: '#b8bcba' },
      { t: 'ellipse', x: wx, y: -16, rx: 2.8, ry: 2.8, fill: '#767c7a' },
    );
  }
  return makePicture(
    { x: TRUCK.left, y: TRUCK.top, width: TRUCK.width, height: TRUCK.height, resolution: 1 },
    ops,
  );
}
