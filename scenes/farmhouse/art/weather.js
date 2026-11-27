// The small pictures of the sky and the weather (docs/scenes/farmhouse.md section 5, items 1, 2, 10 and 11): clouds, fog
// banks, the sun and the moon, the stars, the falling things, and the vignette. Pure, like the other art modules (draw.js).
// Every one is drawn once, small, and used for many sprites: a cloud picture for nine clouds, a streak for four hundred
// drops. Each is drawn around its own centre (x and y are minus half the size) so a sprite with its anchor in the middle
// can be put at a point.
import { makeRng } from '../../../shared/rng.js';
import { DESIGN } from '../layout.js';
import { FOG, n } from './colour.js';
import { gradient, makePicture } from './draw.js';

const W = DESIGN.width;
const centred = (width, height, resolution, ops) =>
  makePicture({ x: -width / 2, y: -height / 2, width, height, resolution }, ops);
const glow = (x, y, rx, ry, colour, alpha) => ({
  t: 'glow',
  x: n(x),
  y: n(y),
  rx: n(rx),
  ry: n(ry),
  colour,
  alpha,
});

/** A soft cloud: a flat base and a few round tops of overlapping glows, in white (the scene tints it grey in rain). */
export function cloudPicture(variant = 0) {
  const rng = makeRng(31 + variant);
  const ops = [glow(0, 14, 250, 44, '#f4f3ec', 0.7)];
  for (let i = 0; i < 7; i++) {
    const x = -170 + i * 56 + rng.range(-12, 12);
    const r = rng.range(46, 82) * (1 - Math.abs(x) / 420);
    ops.push(glow(x, -rng.range(4, 34), r * 1.25, r * 0.8, '#fbfaf4', 0.78));
  }
  return centred(560, 160, 0.5, ops);
}

/** A long bank of fog, wider than the design so it can drift sideways without showing an end. */
export function fogPicture(seed = 32) {
  const rng = makeRng(seed);
  const ops = [];
  for (let i = 0; i < 20; i++) {
    ops.push(
      glow(
        -1300 + i * 136 + rng.range(-40, 40),
        rng.range(-22, 22),
        rng.range(210, 330),
        rng.range(46, 80),
        FOG,
        rng.range(0.5, 0.78),
      ),
    );
  }
  return centred(2900, 200, 0.4, ops);
}

/** A raindrop as a thin streak, falling straight down (the scene turns it with the wind). */
export function rainPicture() {
  return centred(6, 24, 1, [
    { t: 'path', d: 'M 0 -10 L 0 10', stroke: '#d4deea', width: 1.5, cap: 'round' },
  ]);
}

/** A snowflake: a small soft white dot. */
export function flakePicture() {
  return centred(8, 8, 2, [
    glow(0, 0, 4, 4, '#fbfbf7', 1),
    { t: 'ellipse', x: 0, y: 0, rx: 1.8, ry: 1.8, fill: '#fbfbf7' },
  ]);
}

/** A leaf: a small oval in an autumn colour, turned by the scene as it falls. */
export const LEAF_COLOURS = ['#d9a23c', '#c2692f', '#b4552e', '#e0b44a'];
export function leafPicture(colour) {
  return centred(10, 6, 2, [{ t: 'ellipse', x: 0, y: 0, rx: 4.6, ry: 2.4, fill: colour }]);
}

/** A petal: a small pale oval. */
export const PETAL_COLOURS = ['#f3c9d4', '#f8dbe2', '#f4efe4'];
export function petalPicture(colour) {
  return centred(7, 5, 2, [{ t: 'ellipse', x: 0, y: 0, rx: 3.2, ry: 1.9, fill: colour }]);
}

/** The sun: a wide warm glow and a pale disc. */
export function sunPicture() {
  return centred(260, 260, 0.5, [
    glow(0, 0, 128, 128, '#fff1c9', 0.55),
    glow(0, 0, 56, 56, '#fff6dc', 0.9),
    { t: 'ellipse', x: 0, y: 0, rx: 17, ry: 17, fill: '#fffaea' },
  ]);
}

/** The moon: a cool glow, a pale disc and two soft craters. */
export function moonPicture() {
  return centred(160, 160, 1, [
    glow(0, 0, 78, 78, '#cfd9ee', 0.5),
    { t: 'ellipse', x: 0, y: 0, rx: 19, ry: 19, fill: '#f1efe2' },
    { t: 'ellipse', x: -6, y: -4, rx: 4.5, ry: 4, fill: '#dedccd' },
    { t: 'ellipse', x: 6, y: 6, rx: 3.2, ry: 3, fill: '#e3e1d3' },
  ]);
}

/** The stars: a few dozen small dots over the top of the sky, some brighter. */
export function starsPicture(seed = 33) {
  const rng = makeRng(seed);
  const ops = [];
  for (let i = 0; i < 90; i++) {
    const big = rng.next() < 0.12;
    ops.push({
      t: 'ellipse',
      x: n(rng.range(0, W)),
      y: n(rng.range(8, 230)),
      rx: big ? 1.9 : 1.1,
      ry: big ? 1.9 : 1.1,
      fill: '#f4f1e4',
      alpha: n(rng.range(0.45, 0.95)),
    });
  }
  return makePicture({ y: 0, height: 240, resolution: 0.5 }, ops);
}

/** The vignette: the top of the picture a little darker (the concept's soft grade). */
export function vignettePicture() {
  return makePicture({ y: 0, height: DESIGN.height, resolution: 0.25 }, [
    {
      t: 'rect',
      x: 0,
      y: 0,
      w: W,
      h: DESIGN.height,
      fill: gradient(0, DESIGN.height, '#2e2a26', '#2e2a26', 0.16, 0),
    },
  ]);
}
