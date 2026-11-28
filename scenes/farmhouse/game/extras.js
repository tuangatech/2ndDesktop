// The small things that follow the clock (docs/scenes/farmhouse.md rules R16 to R18, DEC-64): the owl at the barn's loft
// window, the weathervane on its roof, and the breath of the horses and cows in the cold. Pure, and a function of the
// moment, the seed and the weather: no timers, nothing added up from frame to frame, no steps (every amount is a ramp).

import { hash, smooth, unit } from './hash.js';
import { stormness } from './weather.js';

/** The owl (R16): it is at the loft window for a stretch of one half hour, in some of the half hours of a clear night. */
export const OWL = Object.freeze({
  blockMinutes: 30,
  chance: 0.4,
  fadeMinutes: 1.5,
  blinkEvery: 6.5,
});

const presentIn = (seed, dayIndex, block) => unit(seed, dayIndex, block, 90) < OWL.chance;

/** Day and block of `block` steps from a block, across midnight. */
function neighbour(dayIndex, block, step) {
  const perDay = 1440 / OWL.blockMinutes;
  const b = block + step;
  if (b < 0) return [dayIndex - 1, perDay - 1];
  if (b >= perDay) return [dayIndex + 1, 0];
  return [dayIndex, b];
}

/**
 * Whether the owl is at its window, and how closed its eyes are.
 * @param {number} ms
 * @param {{seed: number, dayIndex: number, minuteOfDay: number, nightness: number,
 *          weather: {cloud: number, precipitation: number, wind?: number, kind?: string}}} context
 * @returns {{amount: number, blink: number}}  `amount` 0 to 1 (a ramp), `blink` 0 (open) to 1 (shut)
 */
export function owlAt(ms, { seed, dayIndex, minuteOfDay, nightness, weather }) {
  const block = Math.floor(minuteOfDay / OWL.blockMinutes);
  const inBlock = minuteOfDay - block * OWL.blockMinutes;
  let amount = presentIn(seed, dayIndex, block) ? 1 : 0;
  if (amount > 0) {
    const [pd, pb] = neighbour(dayIndex, block, -1);
    const [nd, nb] = neighbour(dayIndex, block, 1);
    if (!presentIn(seed, pd, pb)) amount *= smooth(inBlock / OWL.fadeMinutes);
    if (!presentIn(seed, nd, nb)) amount *= smooth((OWL.blockMinutes - inBlock) / OWL.fadeMinutes);
  }
  // Only on a dark, clear night.
  const dark = smooth((nightness - 0.8) / 0.2);
  const clear =
    (1 - smooth((weather.cloud - 0.4) / 0.4)) *
    (1 - smooth(weather.precipitation / 0.15)) *
    (1 - stormness(weather));
  const t = ms / 1000;
  const u = (t / OWL.blinkEvery + unit(seed, 91)) % 1;
  const blink = u < 0.04 ? Math.sin((u / 0.04) * Math.PI) : 0;
  return { amount: amount * dark * clear, blink };
}

/**
 * The weathervane (R18): how it points, as an angle round the vertical axis (0 points left, into the wind that blows to
 * the right as the smoke and the leaves do; PI points right). In a calm it idles slowly from side to side; in wind it
 * swings round into it and holds, with a flutter.
 * @param {number} seconds
 * @param {number} wind  0 to 1
 */
export function vaneHeading(seconds, wind) {
  const calm = Math.PI / 2 + Math.sin(seconds / 9) * 1.1 + Math.sin(seconds / 3.7) * 0.35;
  const held = Math.sin(seconds * 1.3) * 0.12 * Math.min(1, wind * 2);
  return calm + (held - calm) * smooth(wind / 0.5);
}

/** How wide the vane's arrow shows from the side: the cosine of its angle, never quite edge-on. */
export function vaneWidth(heading) {
  const c = Math.cos(heading);
  return (c < 0 ? -1 : 1) * Math.max(0.14, Math.abs(c));
}

/**
 * The breath of a horse or cow (R17): none above 3 degrees, rising to full at 0 degrees C and colder (a ramp, so there is
 * no step at the freezing point).
 * @param {number} temperature  degrees C
 */
export const breathAmount = (temperature) => smooth((3 - temperature) / 3);

/** A puff cycles every few seconds; the part of the cycle during which it is out. */
export const BREATH = Object.freeze({ cycle: 4.6, out: 0.45 });

/**
 * Where one animal's puff is in its life, 0 (just breathed out) to 1 (gone), or null between puffs.
 * @param {number} seconds
 * @param {number} index  the animal's place in the herd (a puff each, out of step)
 */
export function puffProgress(seconds, index) {
  const k = (seconds / BREATH.cycle + (hash(index, 92) % 1000) / 1000) % 1;
  return k < BREATH.out ? k / BREATH.out : null;
}
