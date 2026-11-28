// The animals of the farm house (docs/scenes/farmhouse.md rules R6 to R8 and R12): seven in three kinds, only in the
// field in front of the fence, bigger when near. Pure, and a function of the time: where an animal is at a moment comes
// from the seed and the clock, not from a walk that a frame counter adds up, so a pause or a jump of the clock settles at
// once and nothing about them is saved (R1, R6).
//
// The field is one rectangle in the scene's own units: `x` from 0 (left) to 1 (right) across the painted width, `depth`
// from 0 at the fence to 1 at the bottom of the screen. The size follows the depth (R7): `depthScale`.
//
// The homes and ranges in `x` below are shares of the width that is on the screen for the animals (`bounds`: the part of
// the field between the edges of the screen, less the icon strip), not of the painted width: on a narrow or a wide screen
// the herd keeps its order and its spacing instead of piling up against the edge it was clamped to (the cow and the
// brown horse overlapped on a 16:9 screen, `Re W-47`).

import { progressOf, seen, walked } from './barn.js';
import { lerp, smooth, unit } from './hash.js';

/** Seven animals, in three kinds: two horses (brown and beige), two cows, three sheep (no names, R6). */
export const HERD = Object.freeze([
  {
    id: 'horse-brown',
    kind: 'horse',
    coat: 'brown',
    home: [0.3, 0.42],
    range: [0.04, 0.1],
    period: 55,
  },
  {
    id: 'horse-beige',
    kind: 'horse',
    coat: 'beige',
    home: [0.76, 0.5],
    range: [0.04, 0.1],
    period: 61,
  },
  {
    id: 'cow-1',
    kind: 'cow',
    coat: 'brown-white',
    home: [0.05, 0.9],
    range: [0.03, 0.1],
    period: 70,
  },
  {
    id: 'cow-2',
    kind: 'cow',
    coat: 'tan-white',
    home: [0.98, 0.84],
    range: [0.02, 0.08],
    period: 66,
  },
  {
    id: 'sheep-1',
    kind: 'sheep',
    coat: 'white',
    flock: [-0.08, -0.06],
    range: [0.03, 0.04],
    period: 37,
  },
  {
    id: 'sheep-2',
    kind: 'sheep',
    coat: 'white',
    flock: [0, 0.16],
    range: [0.03, 0.04],
    period: 43,
  },
  {
    id: 'sheep-3',
    kind: 'sheep',
    coat: 'white',
    flock: [0.07, -0.12],
    range: [0.03, 0.04],
    period: 41,
  },
]);
/** The sheep stay in a loose flock whose centre wanders on its own. */
const FLOCK = Object.freeze({ id: 'flock', home: [0.53, 0.2], range: [0.02, 0.1], period: 60 });

/** The field in front of the fence: never at the fence line itself, never off the bottom. */
export const FIELD = Object.freeze({ depthMin: 0.04, depthMax: 0.96, xMin: 0.04, xMax: 0.96 });
/** The share of a segment an animal spends walking to its next spot; the rest is grazing or standing. */
const WALK = 0.35;
/** Scatter hay (R12): seconds to gather, to eat, and to wander off again; and the pause after a use. */
export const HAY = Object.freeze({ gather: 20, eat: 60, leave: 20, pause: 30, spot: [0.5, 0.52] });

/** The size of an animal at a depth: about half at the fence to 1.5 times at the bottom of the screen (R7). */
export const depthScale = (depth) => 0.5 + depth;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Where an animal is going in segment `k` of its walk: its home and a seeded offset. */
function target(seed, spec, index, k) {
  const [hx, ht] = spec.home;
  return [
    hx + (unit(seed, index, k, 21) * 2 - 1) * spec.range[0],
    ht + (unit(seed, index, k, 22) * 2 - 1) * spec.range[1],
  ];
}

/** The wandering position of one walker at `seconds`, and what it is doing. */
function wander(seed, spec, index, seconds) {
  const phase = unit(seed, index, 20) * spec.period;
  const s = seconds + phase;
  const k = Math.floor(s / spec.period);
  const f = (s - k * spec.period) / spec.period;
  const from = target(seed, spec, index, k - 1);
  const to = target(seed, spec, index, k);
  const w = f < WALK ? smooth(f / WALK) : 1;
  const dx = to[0] - from[0];
  const walking = f < WALK && Math.abs(dx) + Math.abs(to[1] - from[1]) > 0.01;
  return {
    x: lerp(from[0], to[0], w),
    depth: lerp(from[1], to[1], w),
    // The way the nose points: the way it last walked (a function of the segment, so no memory is needed).
    facing:
      Math.abs(dx) > 0.002
        ? dx > 0
          ? 'right'
          : 'left'
        : unit(seed, index, k, 23) < 0.5
          ? 'left'
          : 'right',
    pose: walking ? 'walk' : unit(seed, index, k, 24) < 0.65 ? 'graze' : 'stand',
  };
}

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
  const flock = wander(seed, FLOCK, 100, seconds);
  const flockRest = restSpot(seed, { home: FLOCK.home }, 100, FLOCK.home, restDay);
  const flockAt = [
    lerp(flock.x, flockRest[0], smooth(rest)),
    lerp(flock.depth, flockRest[1], smooth(rest)),
  ];
  const xMin = Math.max(FIELD.xMin, bounds.xMin ?? FIELD.xMin);
  const xMax = Math.min(FIELD.xMax, bounds.xMax ?? FIELD.xMax);

  const animals = HERD.map((spec, index) => {
    // A sheep wanders a little around its place in the flock; the flock's centre wanders on its own.
    const own = wander(
      seed,
      spec.flock ? { home: [0, 0], range: spec.range, period: spec.period } : spec,
      index,
      seconds,
    );
    let x = spec.flock ? flockAt[0] + spec.flock[0] + own.x : own.x;
    let depth = spec.flock ? flockAt[1] + spec.flock[1] + own.depth : own.depth;
    const resting = restSpot(seed, spec, index, flockRest, restDay);
    const toRest = smooth(rest);
    x = lerp(x, resting[0], toRest);
    depth = lerp(depth, resting[1], toRest);
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
      alpha: barn ? seen(progress) : 1,
      inside: barn ? progress : 0,
    };
  });
  // Back to front: the far ones (small depth) are drawn first.
  return animals.sort((a, b) => a.depth - b.depth);
}
