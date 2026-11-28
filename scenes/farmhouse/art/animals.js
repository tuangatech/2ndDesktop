// The seven animals of the field and the hay (docs/scenes/farmhouse.md section 5, item 10; game/animals.js for where they
// are). Pure, like the other art modules: each coat is one picture, drawn once in its own space (the origin is the middle
// of the hooves on the ground, the nose to the right); the scene places it, mirrors it for 'left' and scales it by depth
// (rule R7), so there are five pictures for seven animals. Drawn at 1.5 times the design's resolution because an animal at
// the bottom of the screen is shown at 1.5 times its size.
import { makeRng } from '../../../shared/rng.js';
import { RIGS } from '../game/gait.js';
import { darker, mix, n } from './colour.js';
import { gradient, makePicture } from './draw.js';

const RESOLUTION = 1.5;
const COATS = {
  brown: ['#a8643d', '#7e4a2e', '#5a3624'],
  beige: ['#dcc7a0', '#b9a37c', '#8a7a5c'],
};
const rect = (x, y, w, h, fill, rx = 0) => ({ t: 'rect', x, y, w, h, rx, fill });
const oval = (x, y, rx, ry, fill, extra = {}) => ({ t: 'ellipse', x, y, rx, ry, fill, ...extra });
/** An ellipse turned about its own centre (the concept's `rotate`), as a path. */
const tilted = (x, y, rx, ry, degrees, fill) => {
  const a = (degrees * Math.PI) / 180;
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const px = Math.cos(t) * rx;
    const py = Math.sin(t) * ry;
    pts.push(
      `${n(x + px * Math.cos(a) - py * Math.sin(a))} ${n(y + px * Math.sin(a) + py * Math.cos(a))}`,
    );
  }
  return { t: 'path', d: `M ${pts.join(' L ')} Z`, fill };
};
const tufts = (seed, spread) => {
  const rng = makeRng(seed);
  const ops = [];
  for (let k = 0; k < 7; k++) {
    const x = rng.range(-spread, spread);
    const h = rng.range(7, 12);
    ops.push({
      t: 'path',
      d: `M ${n(x)} 2 Q ${n(x + 2)} ${n(2 - h)} ${n(x + 6)} 2 Z`,
      fill: ['#79974c', '#6a8d44', '#8da85a'][rng.int(0, 2)],
    });
  }
  return ops;
};

function horse(coat) {
  const [c1, c2, mane] = COATS[coat];
  const g = gradient(-80, -30, c1, c2);
  return [
    { t: 'path', d: 'M -48 -58 C -66 -56 -70 -34 -64 -14', stroke: mane, width: 9, cap: 'round' },
    oval(0, -52, 49, 21, g),
    tilted(36, -82, 7, 26, 35, mane),
    tilted(43, -76, 12, 26, 35, g),
    tilted(69, -93, 17, 9, 38, g),
    tilted(81, -85, 6.5, 5.5, 38, darker(c2, 0.25)),
    tilted(60, -108, 3, 6.5, 12, c2),
    oval(67, -96, 1.9, 1.9, '#3a312b'),
    ...tufts(31, 44),
  ];
}

function sheep() {
  const ops = [oval(0, -30, 30, 18, '#cfc6b0')];
  for (const [x, y, r] of [
    [-20, -36, 14],
    [-4, -44, 17],
    [14, -40, 16],
    [-10, -30, 15],
    [10, -28, 15],
    [-28, -30, 10],
    [25, -32, 10],
  ]) {
    ops.push(oval(x, y, r, r, gradient(y - r, y + r, '#f2ecdc', '#e1d9c4')));
  }
  ops.push(
    tilted(36, -30, 9, 11, -12, '#5a4f47'),
    tilted(28, -38, 7, 3, 25, '#4a403a'),
    oval(34, -48, 6, 6, '#ece5d2'),
    oval(39, -33, 1.3, 1.3, '#d7cdbb'),
    ...tufts(32, 36),
  );
  return ops;
}

function cow(patch) {
  const skin = mix('#f3eee1', '#e3dcc8', 0.5);
  return [
    { t: 'path', d: 'M -50 -70 C -60 -64 -60 -42 -57 -24', stroke: patch, width: 4, cap: 'round' },
    oval(-57, -20, 4, 7, patch),
    oval(0, -60, 51, 25, gradient(-85, -35, '#f3eee1', '#dcd4c0')),
    {
      t: 'clip',
      x: 0,
      y: -60,
      rx: 51,
      ry: 25,
      ops: [
        oval(-18, -70, 20, 14, patch),
        oval(22, -52, 14, 11, patch),
        oval(-38, -52, 10, 12, patch),
      ],
    },
    oval(-18, -36, 9, 6, '#e3a79b'),
    tilted(44, -66, 17, 19, 20, skin),
    tilted(68, -61, 16, 11, 28, skin),
    tilted(80, -53, 8.5, 6.5, 28, '#e3a79b'),
    tilted(56, -76, 8, 3.8, -25, patch),
    tilted(62, -79, 3, 5, 15, '#e6dcc0'),
    oval(69, -65, 1.9, 1.9, '#3a312b'),
    ...tufts(33, 46),
  ];
}

/** The key of a set of leg textures: the legs of a horse follow its coat, the others are the same for every coat. */
export const legKey = (animal) => (animal.kind === 'horse' ? `horse-${animal.coat}` : animal.kind);

/** The colours of the legs of a kind: the far pair, the near pair, and the hooves (none for a sheep). */
function legColours(kind, coat) {
  if (kind === 'horse') {
    const [, c2, mane] = COATS[coat];
    return { far: darker(c2, 0.2), near: c2, hoof: mane, hoofHeight: 6 };
  }
  if (kind === 'cow') return { far: '#cdc4b0', near: '#ece5d3', hoof: '#5f5148', hoofHeight: 7 };
  return { far: '#4a4540', near: '#5c5650', hoof: null, hoofHeight: 0 };
}

/**
 * The two pieces of one leg, each drawn about its own joint (the origin of the picture is the hip for the upper leg and
 * the knee for the lower one, and the piece hangs straight down), so that the scene can turn them (game/gait.js).
 */
function legPiecePictures(rig, width, colour, colours) {
  const lower = width * 0.82;
  const thigh = makePicture(
    {
      x: -width / 2 - 1,
      y: -width / 2 - 1,
      width: width + 2,
      height: rig.thigh + width + 2,
      resolution: RESOLUTION,
    },
    [
      rect(-width / 2, -width / 2, width, rig.thigh + width / 2, colour, width / 2),
      oval(0, rig.thigh, width / 2, width / 2, colour), // the knee
    ],
  );
  const ops = [
    oval(0, 0, lower / 2, lower / 2, colour),
    rect(-lower / 2, 0, lower, rig.shin, colour, lower / 2),
  ];
  if (colours.hoof) {
    const h = colours.hoofHeight;
    ops.push(rect(-lower / 2 - 0.5, rig.shin - h, lower + 1, h, colours.hoof, 3));
  }
  const shin = makePicture(
    {
      x: -lower / 2 - 2,
      y: -lower / 2 - 1,
      width: lower + 4,
      height: rig.shin + lower / 2 + 2,
      resolution: RESOLUTION,
    },
    ops,
  );
  return { thigh, shin };
}

/**
 * The legs of one animal as pictures: an upper and a lower piece for the far pair (behind the body, darker) and for the
 * near pair (in front of it). Drawn with the dimensions of the rig (game/gait.js).
 * @returns {{far: {thigh: object, shin: object}, near: {thigh: object, shin: object}}}
 */
export function legPieces(kind, coat) {
  const rig = RIGS[kind];
  const colours = legColours(kind, coat);
  const widthOf = (layer) => rig.legs.find((leg) => leg.layer === layer).width;
  return {
    far: legPiecePictures(rig, widthOf('far'), colours.far, { hoof: null, hoofHeight: 0 }),
    near: legPiecePictures(rig, widthOf('near'), colours.near, colours),
  };
}

const FRAMES = {
  horse: { x: -74, y: -126, width: 170, height: 132 },
  cow: { x: -66, y: -92, width: 160, height: 100 },
  sheep: { x: -34, y: -66, width: 92, height: 72 },
};

/** The coats of the herd (game/animals.js `HERD`): `kind-coat`, the way `coatKey` names them. */
export const coatKey = (animal) => `${animal.kind}-${animal.coat}`;

/**
 * The picture of one coat.
 * @param {string} kind  'horse', 'cow' or 'sheep'
 * @param {string} coat  'brown', 'beige', 'brown-white', 'tan-white' or 'white'
 */
export function animalPicture(kind, coat) {
  const ops =
    kind === 'horse'
      ? horse(coat)
      : kind === 'sheep'
        ? sheep()
        : cow(coat === 'tan-white' ? '#b98c5a' : '#6a5444');
  return makePicture({ ...FRAMES[kind], resolution: RESOLUTION }, ops);
}

/** The hay that is scattered (rule R12): three low heaps with straw lines, drawn around the origin. */
export function hayPicture(seed = 12) {
  const rng = makeRng(seed);
  const ops = [];
  for (const [x, y, rx, ry] of [
    [-26, 0, 30, 11],
    [24, 2, 28, 10],
    [0, -6, 26, 12],
  ]) {
    ops.push(oval(x, y, rx, ry, gradient(y - ry, y + ry, '#e8cd74', '#c9a74e')));
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-50, 50);
    const y = rng.range(-14, 10);
    ops.push({
      t: 'path',
      d: `M ${n(x)} ${n(y)} L ${n(x + rng.range(-9, 9))} ${n(y - rng.range(3, 8))}`,
      stroke: ['#f0d98a', '#b8963e', '#d9b85a'][rng.int(0, 2)],
      width: 1.6,
      cap: 'round',
    });
  }
  return makePicture({ x: -64, y: -30, width: 128, height: 50, resolution: RESOLUTION }, ops);
}
