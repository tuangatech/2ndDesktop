// The sky and the three mountain layers, as drawing operations (docs/scenes/farmhouse.md section 5, items 1 to 3; the concept picture
// docs/scenes/farmhouse/farmhouse-autumn-preview.png is the look). Pure: a palette and a seed in, a list of operations out (draw.js); the
// scene turns each list into one texture (raster.js). Every tree has its place from the seed and keeps it all year,
// only its colour moves with the season (palette.js). Random numbers are drawn in a fixed order whatever the palette, so
// a tree stays where it is when the season changes.
//
// All sizes are in the design space of layout.js (2100 wide). Each layer is its own picture of its own strip of the
// design, so the near hill can be drawn sharp and the two far ridges, which sit in the fog, at a quarter or a half of
// the resolution.
import { makeRng } from '../../../shared/rng.js';
import { DESIGN } from '../layout.js';
import { FOG, lighter, mix, n } from './colour.js';
import { band, gradient } from './draw.js';
import { CONIFERS, TONES, TRUNK, crownColour, snowy } from './palette.js';

const W = DESIGN.width;
/** The concept picture was 1600 wide: the tree counts grow with the width so the forest is as dense. */
const DENSITY = W / 1600;

// The three ridges (the concept's formulas, x in design units).
const ridgeFar = (x) =>
  196 - 22 * (x / W) + 26 * Math.sin(x / 290 + 2) + 11 * Math.sin(x / 83) + 4 * Math.sin(x / 29);
const ridgeMid = (x) =>
  246 - 34 * (1 - x / W) + 24 * Math.sin(x / 230 + 1) + 9 * Math.sin(x / 67) + 5 * Math.sin(x / 26);
const ridgeNear = (x) =>
  300 -
  46 * (1 - x / W) +
  20 * Math.sin(x / 170) +
  11 * Math.sin(x / 57 + 2) +
  6 * Math.sin(x / 23);
export const FOREST_BOTTOM = 556;

/** The strips of the design that each layer's picture covers: y of the top, height, and the resolution it is drawn at. */
export const STRIPS = Object.freeze({
  sky: { y: 0, height: 440, resolution: 0.25 },
  far: { y: 120, height: 250, resolution: 0.25 },
  mid: { y: 170, height: 260, resolution: 0.5 },
  hill: { y: 170, height: 420, resolution: 1 },
});

/** One picture: its drawing operations, the strip of the design it covers, and its size in pixels. */
const picture = (strip, ops) => ({
  x: 0,
  y: strip.y,
  width: W,
  height: strip.height,
  pixelWidth: Math.round(W * strip.resolution),
  pixelHeight: Math.round(strip.height * strip.resolution),
  ops,
});

/** The top of a ridge: where its gradient starts. */
const topOf = (f) => {
  let top = Infinity;
  for (let x = 0; x <= W; x += 20) top = Math.min(top, f(x));
  return top;
};
const silhouette = (f, bottom, fill) => {
  let d = `M 0 ${n(f(0))}`;
  for (let x = 20; x <= W; x += 20) d += ` L ${x} ${n(f(x))}`;
  return { t: 'path', d: `${d} L ${W} ${bottom} L 0 ${bottom} Z`, fill };
};
const pine = (x, y, h, w, c, stroke) => ({
  t: 'path',
  d: `M ${n(x)} ${n(y - h)} Q ${n(x + w * 0.2)} ${n(y - h * 0.6)} ${n(x + w / 2)} ${n(y)} L ${n(x - w / 2)} ${n(y)} Q ${n(x - w * 0.2)} ${n(y - h * 0.6)} ${n(x)} ${n(y - h)} Z`,
  fill: c,
  stroke: c,
  width: stroke,
});
const crown = (x, y, rx, ry, fill) => ({
  t: 'ellipse',
  x: n(x),
  y: n(y),
  rx: n(rx),
  ry: n(ry),
  fill,
});

/**
 * The sky: a gradient from the top of the picture down to the horizon (the clouds, the sun and the fog banks are the
 * weather layer's, S7; the grade of the time of day is the last layer's).
 * @param {{top?: string, bottom?: string}} [colours]
 */
export function skyPicture({ top = '#a9c3d6', bottom = '#e6e4d6' } = {}) {
  return picture(STRIPS.sky, [
    {
      t: 'rect',
      x: 0,
      y: 0,
      w: W,
      h: STRIPS.sky.height,
      fill: gradient(0, STRIPS.sky.height, top, bottom),
    },
  ]);
}

/** The far ridge: almost the colour of the fog, a few tiny pines. */
export function farRidgePicture(seed = 1) {
  const rng = makeRng(seed);
  const body = [silhouette(ridgeFar, 360, gradient(topOf(ridgeFar), 360, '#cfd3cd', '#dad8cb'))];
  for (let i = 0; i < Math.round(70 * DENSITY); i++) {
    const x = rng.range(0, W);
    const y = ridgeFar(x) + rng.range(6, 30);
    const h = rng.range(14, 26);
    body.push(pine(x, y, h, h * 0.34, '#b9c2bb', 2));
  }
  body.push({ t: 'rect', x: 0, y: 180, w: W, h: 120, fill: band(180, 300, FOG, 0.5) });
  return picture(STRIPS.far, body);
}

/** The mid ridge: small faded trees in the season's colours, a few pines, a veil of fog. */
export function midRidgePicture(season, snowCover = 0, seed = 2) {
  const rng = makeRng(seed);
  const body = [silhouette(ridgeMid, 420, gradient(topOf(ridgeMid), 420, '#c4bd9c', '#c9c0a0'))];
  const trees = [];
  for (let i = 0; i < Math.round(900 * DENSITY); i++) {
    const x = rng.range(-10, W + 10);
    const top = ridgeMid(x);
    const y = rng.range(top + 10, top + 90);
    const sz = 4.5 + ((y - top) / 90) * 6 + rng.range(0, 2.5);
    const tone = rng.int(0, TONES - 1);
    const jitter = rng.range(-0.12, 0.12);
    const haze = 0.5 + rng.range(-0.06, 0.1);
    trees.push({
      x,
      y,
      sz,
      c: mix(snowy(crownColour(season, tone, jitter), snowCover), FOG, haze),
    });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) body.push(crown(t.x, t.y - t.sz * 1.6, t.sz * 0.8, t.sz * 1.7, t.c));
  for (let i = 0; i < Math.round(40 * DENSITY); i++) {
    const x = rng.range(0, W);
    const y = ridgeMid(x) + rng.range(14, 80);
    const h = rng.range(22, 40);
    body.push(pine(x, y, h, h * 0.34, snowy(mix('#3f5a45', FOG, 0.55), snowCover * 0.6), 2.4));
  }
  body.push({ t: 'rect', x: 0, y: 236, w: W, h: 110, fill: band(236, 346, FOG, 0.42) });
  return picture(STRIPS.mid, body);
}

/**
 * The near forest hill: a noisy ridge filled with thousands of tall-crowned trees (a slim trunk, then an oval crown) and
 * dark conifers that stay green and stand shorter than the tallest leafy trees, with the haze that separates it from the
 * house. This is the picture that is drawn again when the palette has moved (palette.js `paletteKey`).
 */
export function hillPicture(season, snowCover = 0, seed = 3) {
  const rng = makeRng(seed);
  const body = [];
  body.push(
    silhouette(
      ridgeNear,
      FOREST_BOTTOM + 20,
      gradient(
        topOf(ridgeNear),
        FOREST_BOTTOM + 20,
        mix('#cdbf94', '#e4e2d8', snowCover * 0.5),
        mix('#8a8447', '#c9cabb', snowCover * 0.5),
      ),
    ),
  );

  const trees = [];
  for (let i = 0; i < Math.round(1900 * DENSITY); i++) {
    const x = rng.range(-20, W + 20);
    const top = ridgeNear(x);
    const y = rng.range(top + 30, FOREST_BOTTOM + 14);
    const d = Math.max(0, Math.min(1, (y - top) / (FOREST_BOTTOM - top)));
    const sz = 8 + d * 19 + rng.range(0, 6);
    const tone = rng.int(0, TONES - 1);
    const jitter = rng.range(-0.15, 0.15);
    const haze = (0.14 + (1 - d) * 0.58) * (0.8 + 0.4 * rng.next());
    const highlight = rng.next() < 0.3;
    trees.push({
      x,
      y,
      sz,
      d,
      c: mix(snowy(crownColour(season, tone, jitter), snowCover), FOG, haze),
      highlight,
    });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    const cy = t.y - t.sz * 2.1;
    body.push(
      {
        t: 'rect',
        x: n(t.x - t.sz * 0.1),
        y: n(t.y - t.sz * 0.5),
        w: n(t.sz * 0.2),
        h: n(t.sz * 0.55),
        fill: mix(TRUNK, FOG, 0.2 + (1 - t.d) * 0.5),
      },
      crown(t.x, cy, t.sz * 0.8, t.sz * 1.9, t.c),
    );
    if (t.highlight) {
      body.push(
        crown(t.x - t.sz * 0.16, cy - t.sz * 0.4, t.sz * 0.46, t.sz * 1.1, lighter(t.c, 0.18)),
      );
    }
  }
  const conifers = [];
  for (let i = 0; i < Math.round(46 * DENSITY); i++) {
    const x = rng.range(0, W);
    const top = ridgeNear(x);
    const y = rng.range(top + 40, FOREST_BOTTOM - 4);
    const d = (y - top) / (FOREST_BOTTOM - top);
    const h = 40 + d * 52;
    const c = mix(CONIFERS[rng.int(0, CONIFERS.length - 1)], FOG, (1 - d) * 0.5);
    conifers.push({ x, y, h, c: snowy(c, snowCover * 0.7) });
  }
  conifers.sort((a, b) => a.y - b.y);
  for (const c of conifers) body.push(pine(c.x, c.y, c.h, c.h * 0.34, c.c, 3));
  // The haze at the foot of the hill, which separates it from the house (the fog banks that lie on it are the weather layer's).
  body.push({ t: 'rect', x: 0, y: 486, w: W, h: 90, fill: gradient(486, 576, FOG, FOG, 0, 0.42) });
  return picture(STRIPS.hill, body);
}
