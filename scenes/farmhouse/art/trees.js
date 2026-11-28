// The trees beside the house, the field and the fence (docs/scenes/farmhouse.md section 5, items 5, 7 and 9, and section 4
// for what each tree shows through the year). Pure: the day's season (and for the flowering trees what `floweringAt`
// gives) in, drawing operations out (draw.js). Every tree has its own picture so that one tree can be drawn again alone
// when its look has moved: `treeKey` says when.
//
// Each tree has fixed blobs (a place, a size, a tone from the seed); the season decides which blobs are there (the leaves
// come and go), what colour they are, and whether the branches under them show. So a tree is the same tree all year.
import { makeRng } from '../../../shared/rng.js';
import { DESIGN } from '../layout.js';
import { FOG, darker, lighter, mix, n } from './colour.js';
import { gradient, makePicture } from './draw.js';
import { SNOW, crownColour, snowy } from './palette.js';

const W = DESIGN.width;
const X = DESIGN.houseX - 810;
const WOODS = ['#5d4a3b', '#5a4639', '#5b4440', '#54443a', '#5f4a3c'];

/** The leafy trees behind the house: a position, a size, the tones of the forest palette they use (palette.js). */
export const BACK_TREES = Object.freeze([
  { id: 'birch', x: 80 + X, base: 590, scale: 0.85, tones: [1, 7, 0, 5] },
  { id: 'maple', x: 1525 + X, base: 592, scale: 0.9, tones: [2, 3, 8, 5] },
  { id: 'oak', x: 1405 + X, base: 592, scale: 1.0, tones: [0, 5, 2, 7] },
  { id: 'far-maple', x: 90, base: 588, scale: 0.8, tones: [3, 8, 2, 1] },
]);

/** The flowering trees in front of the house: one species each (game/flowering.js). */
export const FRONT_TREES = Object.freeze([
  {
    id: 'redbud',
    x: 300 + X,
    base: 600,
    scale: 1.0,
    crown: -102,
    spread: 58,
    rise: 40,
    count: 22,
    radius: [18, 28],
    green: ['#5f8a48', '#6a9550', '#55803f'],
    autumn: ['#e2c25a', '#d6b04a', '#c9a246', '#ecd075'],
    blossom: ['#c4608e', '#d173a0', '#b3507f'],
    twin: true,
  },
  {
    id: 'cherry',
    x: 480 + X,
    base: 602,
    scale: 1.15,
    crown: -138,
    spread: 72,
    rise: 52,
    count: 28,
    radius: [22, 34],
    green: ['#58763f', '#63824a', '#4f6b39'],
    autumn: ['#b9563a', '#c9683c', '#a6472f', '#d7894a'],
    blossom: ['#f3c9d4', '#efb7c8', '#f8dbe2'],
  },
  {
    id: 'dogwood',
    x: 1112 + X,
    base: 598,
    scale: 1.0,
    crown: -96,
    spread: 64,
    rise: 40,
    count: 0,
    radius: [],
    green: ['#4f7a3c', '#5c8a44', '#456f36'],
    autumn: ['#8f3a44', '#a8484a', '#7e3340', '#b95a4e'],
    blossom: ['#f4efe4', '#ebe5d6', '#f8f4ea'],
    tiers: true,
    berry: '#c9453c',
  },
  {
    id: 'peach',
    x: 1262 + X,
    base: 598,
    scale: 0.95,
    crown: -108,
    spread: 70,
    rise: 34,
    count: 24,
    radius: [18, 28],
    green: ['#5f8d46', '#6a9a4e', '#547f3d'],
    autumn: ['#dcb04a', '#e0974a', '#c9983f', '#e6c35e'],
    blossom: ['#ecaab6', '#e697a8', '#f2bfc8'],
    fruit: '#e8a24c',
  },
]);

const step = (v) => Math.round(v / 0.05);
/** The key of a tree's look: it changes when the tree needs drawing again (steps of 0.05 of each number). */
export const treeKey = (state, snowCover) =>
  [
    state.leaf,
    state.turn ?? 0,
    state.blossom ?? 0,
    state.fruit ?? 0,
    state.berries ?? 0,
    state.petals ?? 0,
    snowCover,
  ]
    .map(step)
    .join('.');

const wood = (c, snowCover) => snowy(c, snowCover * 0.5);
const ellipse = (x, y, rx, ry, fill, extra = {}) => ({
  t: 'ellipse',
  x: n(x),
  y: n(y),
  rx: n(rx),
  ry: n(ry),
  fill,
  ...extra,
});
const line = (x0, y0, x1, y1, stroke, width, extra = {}) => ({
  t: 'path',
  d: `M ${n(x0)} ${n(y0)} L ${n(x1)} ${n(y1)}`,
  stroke,
  width: n(width),
  cap: 'round',
  ...extra,
});
const trunk = (x, base, scale, top, colour) => ({
  t: 'path',
  d: `M ${n(x - 9 * scale)} ${n(base)} Q ${n(x - 5 * scale)} ${n(base - 50 * scale)} ${n(x - 4 * scale)} ${n(top)} L ${n(x + 4 * scale)} ${n(top)} Q ${n(x + 6 * scale)} ${n(base - 50 * scale)} ${n(x + 9 * scale)} ${n(base)} Z`,
  fill: colour,
});

/** Bare branches that fork five times (they show when the leaves are few). */
function limbs(rng, ops, x0, y0, ang, len, w, depth, colour) {
  const x1 = x0 + Math.sin(ang) * len;
  const y1 = y0 - Math.cos(ang) * len;
  ops.push(line(x0, y0, x1, y1, colour, Math.max(1.4, w)));
  if (depth <= 0) return;
  limbs(
    rng,
    ops,
    x1,
    y1,
    ang + rng.range(0.25, 0.6),
    len * rng.range(0.62, 0.78),
    w * 0.68,
    depth - 1,
    colour,
  );
  limbs(
    rng,
    ops,
    x1,
    y1,
    ang - rng.range(0.25, 0.6),
    len * rng.range(0.62, 0.78),
    w * 0.68,
    depth - 1,
    colour,
  );
  if (rng.next() < 0.4)
    limbs(rng, ops, x1, y1, ang + rng.range(-0.15, 0.15), len * 0.6, w * 0.6, depth - 1, colour);
}

const frame = (x, base, scale) => ({
  x: Math.round(x - 140 * scale),
  y: Math.round(base - 270 * scale),
  width: Math.round(280 * scale),
  height: Math.round(290 * scale),
  resolution: 1,
});

/**
 * A leafy tree behind the house (a round crown of blobs on a trunk with branches): the blobs of the season's leaves, in
 * its own tones; bare branches show through while the leaves are few and in winter.
 * @param {typeof BACK_TREES[number]} tree
 * @param {{leaf: number, turn: number, day: number}} season  what `seasonAt()` gives
 * @param {number} snowCover
 */
export function backTreePicture(tree, season, snowCover = 0, seed = 7) {
  const rng = makeRng(seed + Math.round(tree.x));
  const { x, base, scale: sc } = tree;
  const ops = [trunk(x, base, sc, base - 100 * sc, wood(WOODS[0], snowCover))];
  // The branches show through only while the leaves are few: with a full crown they would stick out of it.
  const branches = [];
  limbs(rng, branches, x, base - 96 * sc, 0, 52 * sc, 7 * sc, 4, wood('#5c493b', snowCover));
  if (season.leaf < 0.7) ops.push(...branches);
  const blobs = [];
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next());
    const bx = x + Math.cos(a) * rr * 62 * sc;
    const by = base - 135 * sc + Math.sin(a) * rr * 50 * sc;
    blobs.push({
      bx,
      by,
      r: rng.range(20, 34) * sc,
      tone: tree.tones[rng.int(0, tree.tones.length - 1)],
      jitter: rng.range(-0.12, 0.12),
      order: rng.next(),
      up: (base - 135 * sc - by) / (50 * sc),
    });
  }
  blobs.sort((p, q) => q.by - p.by);
  const full = { ...season, leaf: 1 };
  for (const b of blobs) {
    if (b.order >= season.leaf) continue; // this blob has no leaves yet (or no more)
    const c = snowy(crownColour(full, b.tone, b.jitter), snowCover * 0.6);
    const tone = b.up > 0 ? lighter(c, 0.18 * b.up) : darker(c, 0.22 * -b.up);
    ops.push(ellipse(b.bx, b.by, b.r, b.r, tone));
  }
  // A few leaves hang on the bare branches in late autumn, and drop.
  return makePicture(frame(x, base, sc), ops);
}

/**
 * A flowering tree in front of the house, in the state of the day.
 * @param {typeof FRONT_TREES[number]} tree
 * @param {{leaf: number, turn: number, blossom: number, fruit: number, berries: number, petals: number}} state
 *        what `floweringAt()` gives
 * @param {number} snowCover
 */
export function frontTreePicture(tree, state, snowCover = 0, seed = 8) {
  const rng = makeRng(seed + Math.round(tree.x));
  const { x, base, scale: sc } = tree;
  const top = base + tree.crown * sc;
  const ops = [];
  const woodColour = wood(WOODS[Math.abs(Math.round(tree.x)) % WOODS.length], snowCover);
  const stem = (dx, lean) => ({
    t: 'path',
    d: `M ${n(x + dx - 7 * sc)} ${n(base)} Q ${n(x + dx + lean * 0.5)} ${n(base - 50 * sc)} ${n(x + dx + lean - 4 * sc)} ${n(top + 20 * sc)} L ${n(x + dx + lean + 4 * sc)} ${n(top + 20 * sc)} Q ${n(x + dx + lean * 0.5 + 5 * sc)} ${n(base - 50 * sc)} ${n(x + dx + 7 * sc)} ${n(base)} Z`,
    fill: woodColour,
  });
  if (tree.twin) ops.push(stem(-10 * sc, -12 * sc), stem(10 * sc, 14 * sc));
  else ops.push(stem(0, 0));
  const branches = [];
  limbs(rng, branches, x, top + 21 * sc, 0, 40 * sc, 6 * sc, 3, woodColour);
  if (state.leaf < 0.7) ops.push(...branches);

  const blobs = [];
  if (tree.tiers) {
    for (let tier = 0; tier < 4; tier++) {
      const w = (74 - tier * 11) * sc;
      const ty = top + 34 * sc - tier * 24 * sc;
      for (let k = 0; k < 6; k++) {
        blobs.push({
          bx: x + rng.range(-1, 1) * w * 0.75,
          by: ty + rng.range(-4, 4) * sc,
          rx: rng.range(26, 38) * sc,
          ry: rng.range(10, 14) * sc,
          up: tier / 3,
        });
      }
    }
  } else {
    for (let i = 0; i < tree.count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const rr = Math.sqrt(rng.next());
      const r = rng.range(tree.radius[0], tree.radius[1]) * sc;
      blobs.push({
        bx: x + Math.cos(a) * rr * tree.spread * sc,
        by: top + Math.sin(a) * rr * tree.rise * sc,
        rx: r,
        ry: r,
        up: (top - (top + Math.sin(a) * rr * tree.rise * sc)) / (tree.rise * sc),
      });
    }
  }
  for (const b of blobs) {
    b.pickLeaf = rng.int(0, 2);
    b.order = rng.next();
    b.mixBlossom = rng.next();
    b.pickAutumn = rng.int(0, 3);
  }
  blobs.sort((p, q) => q.by - p.by);
  const presence = Math.max(state.leaf, state.blossom);
  const bloom = state.blossom * (1 - state.leaf * 0.6);
  for (const b of blobs) {
    if (b.order >= presence) continue;
    let c;
    if (b.mixBlossom < bloom) {
      c = tree.blossom[b.pickLeaf];
    } else {
      c = mix(tree.green[b.pickLeaf], tree.autumn[b.pickAutumn], state.turn);
    }
    c = snowy(c, snowCover * 0.6);
    const tone = b.up > 0 ? lighter(c, 0.16 * b.up) : darker(c, 0.2 * -b.up);
    ops.push(ellipse(b.bx, b.by, b.rx, b.ry, tone));
  }
  // Berries (dogwood) and fruit (peach) on the crown.
  const dots = tree.berry
    ? Math.round(16 * state.berries)
    : tree.fruit
      ? Math.round(10 * state.fruit)
      : 0;
  for (let i = 0; i < dots; i++) {
    ops.push(
      ellipse(
        x + rng.range(-70, 70) * sc,
        top + rng.range(-30, 34) * sc,
        (tree.berry ? 2.6 : 3.4) * sc,
        (tree.berry ? 2.6 : 3.4) * sc,
        tree.berry ?? tree.fruit,
      ),
    );
  }
  // Petals on the ground while the blossom falls.
  const petals = Math.round(30 * state.petals);
  for (let i = 0; i < petals; i++) {
    ops.push(
      ellipse(
        x + rng.range(-70, 70) * sc,
        base + rng.range(-4, 12),
        rng.range(2.5, 4),
        1.6,
        tree.blossom[i % 3],
        {
          alpha: 0.85,
        },
      ),
    );
  }
  return makePicture(frame(x, base, sc), ops);
}

/**
 * The grass colours of a day: green in the growing season, straw in winter, with snow on top.
 * @param {{grass: number}} season
 * @param {number} snowCover
 */
export function grassColours(season, snowCover = 0) {
  // Snow lies thicker on the ground than on a tree: up to nine tenths white.
  const thickSnow = (c, k) => mix(c, SNOW, Math.max(0, Math.min(1, k)) * 0.9);
  const g = Math.max(0, Math.min(1, season.grass));
  const top = mix('#b3a877', '#93a95f', g);
  const bottom = mix('#948c5c', '#5a893d', g);
  return {
    top: thickSnow(top, snowCover),
    bottom: thickSnow(bottom, snowCover),
    stripes: [
      thickSnow(mix('#b9b080', '#a4b568', g), snowCover),
      thickSnow(mix('#7d7a4c', '#4f7f37', g), snowCover),
      thickSnow(mix('#a09660', '#79974c', g), snowCover),
      thickSnow(mix('#c4bd8c', '#b9b876', g), snowCover),
    ],
    tufts: [
      thickSnow(mix('#9a9060', '#79974c', g), snowCover * 0.7),
      thickSnow(mix('#847b52', '#6a8d44', g), snowCover * 0.7),
      thickSnow(mix('#a89f6c', '#8da85a', g), snowCover * 0.7),
    ],
  };
}

export const FIELD_TOP = 664;

/** The lawn behind the house, drawn with the grass of the day. */
export function lawnGroundPicture(season, snowCover = 0, seed = 4) {
  const rng = makeRng(seed);
  const gr = grassColours(season, snowCover);
  const light = snowy(mix('#c8c58d', '#b0b46f', Math.min(1, season.grass)), snowCover);
  const ops = [
    {
      t: 'rect',
      x: 0,
      y: 540,
      w: W,
      h: 130,
      fill: gradient(540, 670, mix(gr.top, '#a3ad68', 0.5), mix(gr.bottom, '#8ea05a', 0.6)),
    },
  ];
  for (let i = 0; i < Math.round(40 * (W / 1600)); i++) {
    ops.push(
      ellipse(
        rng.range(0, W),
        rng.range(556, 650),
        rng.range(60, 240),
        rng.range(5, 14),
        [light, gr.stripes[1], gr.stripes[0]][rng.int(0, 2)],
        {
          alpha: 0.4,
        },
      ),
    );
  }
  for (let x = -40; x < W + 60; x += 46) {
    ops.push(
      ellipse(
        x + rng.range(-10, 10),
        rng.range(538, 548),
        rng.range(46, 80),
        rng.range(9, 16),
        mix(gr.top, '#a3ad68', 0.5),
      ),
    );
  }
  ops.push({
    t: 'rect',
    x: 0,
    y: 520,
    w: W,
    h: 50,
    fill: {
      y0: 520,
      y1: 570,
      stops: [
        [0, FOG, 0],
        [0.35, FOG, 0.28],
        [1, FOG, 0],
      ],
    },
  });
  return makePicture({ y: 500, height: 170, resolution: 1 }, ops);
}

/** The field in front of the fence: a gradient, long soft stripes, tufts of grass. */
export function fieldPicture(season, snowCover = 0, seed = 9) {
  const rng = makeRng(seed);
  const gr = grassColours(season, snowCover);
  const height = DESIGN.height - FIELD_TOP;
  const ops = [
    {
      t: 'rect',
      x: 0,
      y: FIELD_TOP,
      w: W,
      h: height,
      fill: gradient(FIELD_TOP, DESIGN.height, gr.top, gr.bottom),
    },
  ];
  for (let i = 0; i < Math.round(46 * (W / 1600)); i++) {
    const d = rng.next();
    ops.push(
      ellipse(
        rng.range(0, W),
        FIELD_TOP + 6 + d * 220,
        rng.range(120, 420) * (0.6 + d),
        rng.range(4, 12) * (0.5 + d),
        gr.stripes[rng.int(0, 3)],
        {
          alpha: n(rng.range(0.2, 0.42)),
        },
      ),
    );
  }
  for (let i = 0; i < Math.round(260 * (W / 1600)); i++) {
    const d = rng.next();
    const y = FIELD_TOP + 14 + d * 220;
    const x = rng.range(0, W);
    const h = rng.range(6, 12) * (0.6 + d * 1.2);
    const w = 0.6 + d;
    ops.push({
      t: 'path',
      d: `M ${n(x)} ${n(y)} Q ${n(x + 1)} ${n(y - h)} ${n(x + 5 * w)} ${n(y)} M ${n(x + 3)} ${n(y)} Q ${n(x + 6)} ${n(y - h * 0.8)} ${n(x + 9 * w)} ${n(y)} Z`,
      fill: gr.tufts[rng.int(0, 2)],
    });
  }
  return makePicture({ y: FIELD_TOP, height, resolution: 1 }, ops);
}

/** The white fence in front of the drive: two rails, a post every 96 units, tufts at its foot. */
export function fencePicture(season, snowCover = 0, seed = 10) {
  const rng = makeRng(seed);
  const gr = grassColours(season, snowCover);
  const white =
    snowCover > 0
      ? [mix('#f4f0e5', SNOW, snowCover * 0.5), mix('#d6cfbd', SNOW, snowCover * 0.4)]
      : ['#f4f0e5', '#d6cfbd'];
  const ops = [
    {
      t: 'rect',
      x: -10,
      y: 614,
      w: W + 20,
      h: 9,
      rx: 4.5,
      fill: gradient(614, 623, white[0], mix(white[1], '#d9d2c0', 0.5)),
    },
    {
      t: 'rect',
      x: -10,
      y: 640,
      w: W + 20,
      h: 9,
      rx: 4.5,
      fill: gradient(640, 649, white[0], mix(white[1], '#d9d2c0', 0.5)),
    },
  ];
  for (let x = 20; x < W + 40; x += 96) {
    const px = x + rng.range(-3, 3);
    ops.push({
      t: 'rect',
      x: n(px - 6),
      y: 598,
      w: 12,
      h: 72,
      rx: 5,
      fill: gradient(598, 670, white[0], white[1]),
    });
  }
  for (let x = 0; x < W; x += 14) {
    const h = rng.range(8, 16);
    ops.push({
      t: 'path',
      d: `M ${n(x)} 672 Q ${n(x + 2)} ${n(672 - h)} ${n(x + 5)} 672 Z`,
      fill: gr.tufts[rng.int(0, 2)],
    });
  }
  return makePicture({ y: 590, height: 90, resolution: 1 }, ops);
}
