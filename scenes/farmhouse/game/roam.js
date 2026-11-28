// How an animal roams the field (docs/scenes/farmhouse.md rule R6, DEC-66): freely across a wide zone of it, left and
// right, near and far and both at once, at a steady walking pace, and standing still for a long time between moves.
// Pure, and a function of the clock and the seed (R1): nothing is added up from frame to frame, so a pause or a jump of
// the clock settles at once.
//
// The time of an animal is cut into cycles (ten minutes or so). A cycle has a region of the field (a seeded point of the
// animal's zone, drawn towards its home) and a short list of stops near that region; each stop has its own length, from
// about a quarter of a minute to five, and some stops are the same place as the one before (it stays). The walk to a stop
// comes first and the rest is standing and grazing. Going from one cycle's last stop to the next cycle's first is the long
// walk across the field. The positions are shares of the width and depth of the field (as in animals.js).

import { lerp, unit } from './hash.js';

/** What a share of the width and of the depth stands for in design units, so that a walk takes the time it should. */
export const NOMINAL = Object.freeze({ width: 1300, depth: 185 });
/** How long a block of standing lasts before the animal may change between grazing and standing. */
const BLOCK = 45;
/** The share of the grazing and standing that is grazing. */
const GRAZE = 0.55;

/**
 * @typedef {object} RoamSpec
 * @property {[number, number]} x       the zone's width, as shares
 * @property {[number, number]} depth   the zone's depth, as shares
 * @property {[number, number]} home    where the region of a cycle is drawn towards
 * @property {number} pull              how much (0 to 1)
 * @property {[number, number]} local   how far the stops of a cycle lie from its region (x, depth)
 * @property {number} speed             design units a second
 * @property {number} cycle             seconds
 * @property {number} stops             stops in a cycle
 * @property {number} stay              the chance that a stop is the same place as the one before
 */

const plans = new Map();

/** The stops of one cycle and when each begins (seconds from the start of the cycle). */
function plan(seed, index, c, spec) {
  const key = `${seed}|${index}|${c}|${spec.cycle}`;
  const hit = plans.get(key);
  if (hit) return hit;
  const [x0, x1] = spec.x;
  const [d0, d1] = spec.depth;
  const cx = lerp(lerp(x0, x1, unit(seed, index, c, 41)), spec.home[0], spec.pull);
  const cd = lerp(lerp(d0, d1, unit(seed, index, c, 42)), spec.home[1], spec.pull);
  const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const points = [];
  const weights = [];
  let sum = 0;
  for (let j = 0; j < spec.stops; j++) {
    // Stops are of very different lengths: mostly short and medium, some long (the cube of a number from 0 to 1).
    const w = (j === 0 ? 1 : 0.3) + 5 * unit(seed, index, c, j, 45) ** 3;
    weights.push(w);
    sum += w;
    if (j > 0 && unit(seed, index, c, j, 43) < spec.stay) {
      points.push(points[j - 1]);
    } else {
      points.push([
        clampTo(cx + (unit(seed, index, c, j, 46) * 2 - 1) * spec.local[0], x0, x1),
        clampTo(cd + (unit(seed, index, c, j, 47) * 2 - 1) * spec.local[1], d0, d1),
      ]);
    }
  }
  const starts = [];
  let t = 0;
  for (const w of weights) {
    starts.push(t);
    t += (w / sum) * spec.cycle;
  }
  const made = { points, starts, length: spec.cycle };
  if (plans.size > 512) plans.clear();
  plans.set(key, made);
  return made;
}

/** The stop before stop `j` of cycle `c`, and the stop itself: where the walk of that segment goes from and to. */
function segment(seed, index, c, j, spec) {
  const now = plan(seed, index, c, spec);
  const from = j > 0 ? now.points[j - 1] : plan(seed, index, c - 1, spec).points[spec.stops - 1];
  return { from, to: now.points[j] };
}

/** A walk that starts and ends gently and goes at a steady pace in between: position (0 to 1) at progress f (0 to 1). */
function ease(f, a = 0.18) {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  if (f < a) return (f * f) / (2 * a * (1 - a));
  if (f > 1 - a) return 1 - ((1 - f) * (1 - f)) / (2 * a * (1 - a));
  return (f - a / 2) / (1 - a);
}

const moved = (from, to) =>
  Math.hypot((to[0] - from[0]) * NOMINAL.width, (to[1] - from[1]) * NOMINAL.depth);

/**
 * Where an animal is at `seconds`, which way its nose points and what it is doing.
 * @param {number} seed
 * @param {RoamSpec} spec
 * @param {number} index  the animal's number (its own stream of numbers)
 * @param {number} seconds
 * @returns {{x: number, depth: number, facing: 'left'|'right', pose: 'walk'|'graze'|'stand', walking: boolean}}
 */
export function roam(seed, spec, index, seconds) {
  const s = seconds + unit(seed, index, 20) * spec.cycle;
  const c = Math.floor(s / spec.cycle);
  const t = s - c * spec.cycle;
  const now = plan(seed, index, c, spec);
  let j = 0;
  while (j + 1 < spec.stops && now.starts[j + 1] <= t) j++;
  const end = j + 1 < spec.stops ? now.starts[j + 1] : spec.cycle;
  const length = end - now.starts[j];
  const { from, to } = segment(seed, index, c, j, spec);
  const distance = moved(from, to);
  // A steady pace; a stop too short to get there at that pace is reached a little faster.
  const walkTime = distance > 0 ? Math.min(distance / spec.speed, length * 0.9) : 0;
  const u = t - now.starts[j];
  const f = walkTime > 0 ? u / walkTime : 1;
  const e = ease(f);
  const walking = walkTime > 0 && f < 1 && distance > 3;

  // The way the nose points: the way it last walked; a stop with no walk keeps the way of the one before it.
  let facing = null;
  for (let back = 0, cc = c, jj = j; back < 2 * spec.stops && facing === null; back++) {
    const seg = segment(seed, index, cc, jj, spec);
    const dx = (seg.to[0] - seg.from[0]) * NOMINAL.width;
    if (Math.abs(dx) > 4) facing = dx > 0 ? 'right' : 'left';
    if (jj === 0) {
      cc -= 1;
      jj = spec.stops - 1;
    } else jj -= 1;
  }
  facing ??= unit(seed, index, 48) < 0.5 ? 'left' : 'right';

  let pose = 'walk';
  if (!walking) {
    const block = Math.floor(Math.max(0, u - walkTime) / BLOCK);
    pose = unit(seed, index, c, j, block, 44) < GRAZE ? 'graze' : 'stand';
  }
  return {
    x: lerp(from[0], to[0], e),
    depth: lerp(from[1], to[1], e),
    facing,
    pose,
    walking,
  };
}
