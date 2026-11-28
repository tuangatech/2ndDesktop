// The seven animals of the field and the hay (docs/scenes/farmhouse.md section 5, item 10; game/animals.js for where they
// are). Pure, like the other art modules: each coat is one picture, drawn once in its own space (the origin is the middle
// of the hooves on the ground, the nose to the right); the scene places it, mirrors it for 'left' and scales it by depth
// (rule R7), so there are five pictures for seven animals. Drawn at 1.5 times the design's resolution because an animal at
// the bottom of the screen is shown at 1.5 times its size.
import { makeRng } from '../../../shared/rng.js';
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

/**
 * The four legs of each kind, drawn apart from the body so that they can swing about the hip (the walk, index.js). `far`
 * is the pair on the far side (drawn behind the body, darker) and `near` the pair on this side (in front). `x` is the
 * middle of the leg at the hip, `pair` which two legs move together (a walk moves the legs of a diagonal together: the near
 * hind with the far fore, the near fore with the far hind), `amp` how far a leg swings (radians) and `length` its length
 * from the hip (y -length) to the ground.
 */
const LEGS = {
  horse: {
    length: 38,
    amp: 0.42,
    far: { w: 8, x: [-34, 26], pair: [1, 0] },
    near: { w: 9, x: [-25.5, 36.5], pair: [0, 1] },
  },
  cow: {
    length: 40,
    amp: 0.38,
    far: { w: 9, x: [-33.5, 28.5], pair: [1, 0] },
    near: { w: 10, x: [-25, 35], pair: [0, 1] },
  },
  sheep: {
    length: 22,
    amp: 0.5,
    far: { w: 5, x: [-15.5, 14.5], pair: [1, 0] },
    near: { w: 5, x: [-7.5, 21.5], pair: [0, 1] },
  },
};
export { LEGS };

/** The key of a set of leg textures: the legs of a horse follow its coat, the others are the same for every coat. */
export const legKey = (animal) => (animal.kind === 'horse' ? `horse-${animal.coat}` : animal.kind);

/** One leg of `w` wide, drawn from the hip (0, 0) down to the ground at y `length`. */
function legPicture(length, w, fill, hoof, hoofHeight) {
  const ops = [rect(-w / 2, 0, w, length, fill, w > 6 ? 4 : 2.5)];
  if (hoof) ops.push(rect(-w / 2, length - hoofHeight, w, hoofHeight, hoof, 3));
  return makePicture(
    { x: -w / 2 - 1, y: -1, width: w + 2, height: length + 2, resolution: RESOLUTION },
    ops,
  );
}

/**
 * The legs of one animal: two pictures (far and near) and where the four hips are (in the animal's own space, hooves at y
 * 0 and the nose to the right).
 * @returns {{far: object, near: object, hips: {layer: 'far'|'near', x: number, y: number, pair: number}[],
 *            length: number, amp: number}}
 */
export function legPictures(kind, coat) {
  const spec = LEGS[kind];
  const [c1, c2] =
    kind === 'horse'
      ? COATS[coat]
      : kind === 'cow'
        ? ['#cdc4b0', '#ece5d3']
        : ['#4a4540', '#5c5650'];
  const farFill = kind === 'horse' ? darker(c2, 0.2) : c1;
  const nearFill = kind === 'horse' ? c2 : kind === 'cow' ? '#ece5d3' : '#5c5650';
  const hoof = kind === 'horse' ? COATS[coat][2] : kind === 'cow' ? '#5f5148' : null;
  const hoofHeight = kind === 'horse' ? 6 : 7;
  const hips = [];
  for (const layer of ['far', 'near']) {
    spec[layer].x.forEach((x, i) =>
      hips.push({ layer, x, y: -spec.length, pair: spec[layer].pair[i] }),
    );
  }
  return {
    far: legPicture(spec.length, spec.far.w, farFill, null, 0),
    near: legPicture(spec.length, spec.near.w, nearFill, hoof, hoofHeight),
    hips,
    length: spec.length,
    amp: spec.amp,
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
