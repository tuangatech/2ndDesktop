// The animals of the farm house (docs/scenes/farmhouse.md rules R6 to R8 and R12): seven in three kinds, only in the
// field in front of the fence, bigger when near. Pure, and a function of the time: where an animal is at a moment comes
// from the seed and the clock, not from a walk that a frame counter adds up, so a pause or a jump of the clock settles at
// once and nothing about them is saved (R1, R6).
//
// The field is one rectangle in the scene's own units: `x` from 0 (left) to 1 (right) across the painted width, `depth`
// from 0 at the fence to 1 at the bottom of the screen (the animals keep to the back three quarters, `FIELD.depthMax`). The size follows the depth (R7): `depthScale`.
//
// The homes and ranges in `x` below are shares of the width that is on the screen for the animals (`bounds`: the part of
// the field between the edges of the screen, less the icon strip), not of the painted width: on a narrow or a wide screen
// the herd keeps its order and its spacing instead of piling up against the edge it was clamped to (the cow and the
// brown horse overlapped on a 16:9 screen, `Re W-47`).

import { progressOf, visibility, walked } from './barn.js';
import { lerp, smooth, unit } from './hash.js';
import { NOMINAL, roam } from './roam.js';

// Each animal roams a wide zone of the field (R6, DEC-66). The two horses have the left and right halves of the width and
// the back of the field, the two cows the left and right halves and the front, so two of a kind never meet (a gap of 0.14
// of the width between their zones) and a horse and a cow are kept apart in depth by `keepApart` below. `home` is where
// the region of a cycle is drawn towards, `speed` is the pace in design units a second.
const BIG = { cycle: 240, stops: 7, stay: 0.1, pull: 0.2, local: [0.3, 0.3], minStop: 14 };
const zone = (x, depth, home, speed) => ({ ...BIG, x, depth, home, speed });
/** A sheep roams a small zone round its place in the flock (shares); the flock's centre roams the field (below). */
const SHEEP = {
  cycle: 150,
  stops: 6,
  stay: 0.25,
  minStop: 12,
  pull: 0,
  x: [-0.06, 0.06],
  depth: [-0.06, 0.06],
  home: [0, 0],
  local: [0.04, 0.05],
  speed: 20,
};
/** Seven animals, in three kinds: two horses (brown and beige), two cows, three sheep (no names, R6). */
export const HERD = Object.freeze([
  {
    id: 'horse-brown',
    kind: 'horse',
    coat: 'brown',
    home: [0.22, 0.25],
    roam: zone([0.03, 0.43], [0.04, 0.34], [0.22, 0.22], 30),
  },
  {
    id: 'horse-beige',
    kind: 'horse',
    coat: 'beige',
    home: [0.78, 0.25],
    roam: zone([0.57, 0.97], [0.04, 0.34], [0.78, 0.22], 30),
  },
  {
    id: 'cow-1',
    kind: 'cow',
    coat: 'brown-white',
    home: [0.2, 0.62],
    roam: zone([0.03, 0.43], [0.42, 0.74], [0.2, 0.6], 26),
  },
  {
    id: 'cow-2',
    kind: 'cow',
    coat: 'tan-white',
    home: [0.8, 0.62],
    roam: zone([0.57, 0.97], [0.42, 0.74], [0.8, 0.6], 26),
  },
  { id: 'sheep-1', kind: 'sheep', coat: 'white', flock: [-0.08, -0.06], roam: SHEEP },
  { id: 'sheep-2', kind: 'sheep', coat: 'white', flock: [0, 0.16], roam: SHEEP },
  { id: 'sheep-3', kind: 'sheep', coat: 'white', flock: [0.07, -0.12], roam: SHEEP },
]);
/** The sheep stay in a loose flock whose centre roams the field on its own, slowly. */
const FLOCK = Object.freeze({
  id: 'flock',
  home: [0.5, 0.4],
  roam: {
    cycle: 300,
    stops: 7,
    stay: 0.15,
    minStop: 15,
    pull: 0.3,
    x: [0.12, 0.88],
    depth: [0.26, 0.5],
    home: [0.5, 0.4],
    local: [0.2, 0.17],
    speed: 26,
  },
});

/** The field in front of the fence: never at the fence line itself, and never too near the screen (an animal at the bottom
 * of the screen is too big and too many: the owner asked for them a bit farther away). */
export const FIELD = Object.freeze({ depthMin: 0.04, depthMax: 0.74, xMin: 0.04, xMax: 0.96 });
/** Scatter hay (R12): seconds to gather, to eat, and to wander off again; and the pause after a use. */
export const HAY = Object.freeze({ gather: 20, eat: 60, leave: 20, pause: 30, spot: [0.5, 0.52] });

/** The size of an animal at a depth: about half at the fence to 1.5 times at the bottom of the screen (R7). */
export const depthScale = (depth) => 0.5 + depth;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Where the animals sleep or shelter: near home, a seeded spot for the day. */
function restSpot(seed, spec, index, centre, dayIndex) {
  const base = spec.flock ? [centre[0] + spec.flock[0], centre[1] + spec.flock[1]] : spec.home;
  return [
    base[0] + (unit(seed, index, dayIndex, 31) * 2 - 1) * 0.03,
    base[1] + (unit(seed, index, dayIndex, 32) * 2 - 1) * 0.04,
  ];
}

/**
 * How far into a Scatter hay use a moment is, as the weight of the gathering: 0 outside, rising over 20 seconds,
 * 1 while they eat (a minute), falling over 20 seconds.
 * @param {number} ms
 * @param {number|null} startedAt  epoch ms of the use, or null
 */
export function hayWeight(ms, startedAt) {
  if (startedAt === null || startedAt === undefined) return 0;
  const t = (ms - startedAt) / 1000;
  if (t < 0 || t >= HAY.gather + HAY.eat + HAY.leave) return 0;
  if (t < HAY.gather) return smooth(t / HAY.gather);
  if (t < HAY.gather + HAY.eat) return 1;
  return smooth((HAY.gather + HAY.eat + HAY.leave - t) / HAY.leave);
}

/**
 * Whether "Scatter hay" can be used now: a pause of half a minute after the last use has ended eating (R12).
 * @param {number} ms
 * @param {number|null} lastStartedAt
 */
export function canScatter(ms, lastStartedAt) {
  if (lastStartedAt === null || lastStartedAt === undefined) return true;
  return (ms - lastStartedAt) / 1000 >= HAY.gather + HAY.eat + HAY.pause;
}

/** Where the hay is put, and the spot of each animal around it (a ring, so they do not stand on each other). */
function haySpot(index) {
  const angle = (index / HERD.length) * Math.PI * 2;
  return [HAY.spot[0] + Math.cos(angle) * 0.09, HAY.spot[1] + Math.sin(angle) * 0.1];
}

/** Which of two kinds stands behind the other when they would overlap: horses behind sheep behind cows. */
const RANK = { horse: 0, sheep: 1, cow: 2 };
/** Half the width and the height of each kind's picture, in design units at scale 1. */
const HALF = { horse: 80, sheep: 36, cow: 75 };
const TALL = { horse: 120, sheep: 62, cow: 95 };

/**
 * A horse, a cow and a sheep do not stand on each other: when two of different kinds are side by side (in x), the one that
 * belongs behind (`RANK`) is moved back and the other forward until the one in front no longer hides most of the other's
 * body. The push grows smoothly as they come side by side and ends as they part, and the order never changes, so nothing
 * jumps; an animal at the edge of the field is not pushed out of it, the other takes the rest. Positions are shares.
 * @param {{kind: string, x: number, depth: number}[]} list  moved in place
 */
function keepApart(list) {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.kind === b.kind) continue;
        const [back, front] = RANK[a.kind] < RANK[b.kind] ? [a, b] : [b, a];
        const side =
          (HALF[a.kind] * depthScale(a.depth) + HALF[b.kind] * depthScale(b.depth)) * 0.8;
        const w = smooth((1 - (Math.abs(a.x - b.x) * NOMINAL.width) / (side * 1.7)) * 1.6);
        if (w <= 0) continue;
        const gap = (TALL[front.kind] * depthScale(front.depth) * 0.7) / NOMINAL.depth;
        const deficit = Math.max(0, gap - (front.depth - back.depth)) * w;
        if (deficit <= 0) continue;
        let pushBack = Math.min(deficit / 2, back.depth - FIELD.depthMin);
        const pushFront = Math.min(deficit - pushBack, FIELD.depthMax - front.depth);
        pushBack = Math.min(deficit - pushFront, back.depth - FIELD.depthMin);
        back.depth -= pushBack;
        front.depth += pushFront;
      }
    }
  }
}

/**
 * The seven animals at a moment, back to front.
 * @param {number} ms
 * @param {{seed: number, dayIndex: number, still?: number, hayStartedAt?: number|null,
 *          bounds?: {xMin: number, xMax: number},
 *          barn?: {door: [number, number], shelter: number, leaving?: boolean}|null}} context
 *        `still` is 0 to 1: without a barn, at night and in a storm they stand still (the herd goes to its resting places);
 *        `bounds` keeps them out of the icon strip;
 *        `barn` (R13): where the door is (x and depth in the field's units) and how much the animals want shelter
 *        (`shelterAt`, 0 to 1): they walk to the door one by one, the sheep first, and fade in it; `leaving` is whether it
 *        is the morning side of the change (so they face away from the door while they come out)
 * @returns {{id: string, kind: string, coat: string, x: number, depth: number, scale: number,
 *            facing: 'left'|'right', pose: 'walk'|'graze'|'stand'|'eat', alpha: number, inside: number}[]}
 *          `alpha` is how much of the animal is seen (0 in the barn) and `inside` how far in it is, 0 to 1
 */
export function animalsAt(
  ms,
  {
    seed,
    dayIndex,
    restDay = dayIndex,
    still = 0,
    hayStartedAt = null,
    bounds = FIELD,
    barn = null,
  },
) {
  const seconds = ms / 1000;
  // With a barn the animals do not stand about at night: they are in it, so there are no resting places.
  const rest = barn ? 0 : clamp(still, 0, 1);
  const hay = hayWeight(ms, hayStartedAt);
  const flock = roam(seed, FLOCK.roam, 100, seconds);
  const flockRest = restSpot(seed, { home: FLOCK.home }, 100, FLOCK.home, restDay);
  const flockAt = [
    lerp(flock.x, flockRest[0], smooth(rest)),
    lerp(flock.depth, flockRest[1], smooth(rest)),
  ];
  const xMin = Math.max(FIELD.xMin, bounds.xMin ?? FIELD.xMin);
  const xMax = Math.min(FIELD.xMax, bounds.xMax ?? FIELD.xMax);

  // Where each animal roams to (shares of the width and depth), then kept from standing on another of a different kind.
  const roamed = HERD.map((spec, index) => {
    // A sheep roams a little round its place in the flock; the flock's centre roams the field on its own, and when the
    // flock walks every sheep walks with it.
    const own = roam(seed, spec.roam, index, seconds);
    if (spec.flock && flock.walking) {
      own.pose = 'walk';
      own.facing = flock.facing;
    }
    let x = spec.flock ? flockAt[0] + spec.flock[0] + own.x : own.x;
    let depth = spec.flock ? flockAt[1] + spec.flock[1] + own.depth : own.depth;
    const resting = restSpot(seed, spec, index, flockRest, restDay);
    const toRest = smooth(rest);
    x = lerp(x, resting[0], toRest);
    depth = lerp(depth, resting[1], toRest);
    return { kind: spec.kind, own, x, depth };
  });
  keepApart(roamed);

  const animals = HERD.map((spec, index) => {
    const { own } = roamed[index];
    let { x, depth } = roamed[index];
    x = xMin + x * (xMax - xMin); // from a share of the width on the screen to the field's x (the hay's spot is not a share)
    // On its way to the barn an animal lets go of the hay.
    const progress = barn ? progressOf(barn.shelter, spec.id) : 0;
    const toBarn = barn ? walked(progress) : 0;
    const hayHere = hay * (1 - toBarn);
    const spot = haySpot(index);
    x = lerp(x, spot[0], hayHere);
    depth = lerp(depth, spot[1], hayHere);
    x = clamp(x, xMin, xMax);
    depth = clamp(depth, FIELD.depthMin, FIELD.depthMax);
    let facing = hayHere > 0.02 ? (x < spot[0] ? 'right' : 'left') : own.facing;
    let pose = own.pose;
    if (hayHere >= 0.97) pose = 'eat';
    else if (hayHere > 0.02) pose = 'walk';
    else if (rest >= 0.5) pose = 'stand';
    if (barn && toBarn > 0) {
      // The way to the door is a straight walk (after the clamp, so that the door is reached even at the screen's edge).
      x = lerp(x, barn.door[0], toBarn);
      depth = lerp(depth, barn.door[1], toBarn);
      const toward = x < barn.door[0] ? 'right' : 'left';
      facing = barn.leaving ? (toward === 'right' ? 'left' : 'right') : toward;
      pose = toBarn > 0.995 ? 'stand' : 'walk';
    }
    return {
      id: spec.id,
      kind: spec.kind,
      coat: spec.coat,
      x,
      depth,
      scale: depthScale(depth),
      facing,
      pose,
      alpha: barn ? visibility(progress) : 1,
      inside: barn ? progress : 0,
    };
  });
  // Back to front: the far ones (small depth) are drawn first.
  return animals.sort((a, b) => a.depth - b.depth);
}
