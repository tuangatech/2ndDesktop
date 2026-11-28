// The small movements that make a standing animal alive (docs/scenes/farmhouse.md rule R22, DEC-68): the head and neck (they
// nod in the walk, go down to graze with a chew and come up now and then to look, and drift while it stands), the ear (it
// twitches now and then), the tail (it sways, and swishes at a fly) and the breath and the slow sway of the body. Pure, like
// the gait: everything is a function of the clock and the animal's own numbers (R1), nothing is kept from one frame to the
// next, and every number is smooth in time (no step, no NaN), so a pause or a jump of the clock settles at once.
//
// Angles are rotations for a drawing: positive turns clockwise on the screen (the nose goes down), about the joint of the
// part (the base of the neck, the root of the ear, the root of the tail; art/animals.js `JOINTS`).

import { unit } from './hash.js';

const TAU = Math.PI * 2;

/** How the kinds differ: how far the head goes down to graze, how far it reaches down (units), the sizes of the others. */
export const STYLE = Object.freeze({
  horse: {
    down: 1.3,
    reach: 8,
    nod: 0.07,
    carry: -0.05,
    tail: 0.1,
    swish: 0.35,
    ear: 0.4,
    sway: 0.012,
  },
  cow: {
    down: 1.1,
    reach: 14,
    nod: 0.05,
    carry: -0.02,
    tail: 0.14,
    swish: 0.4,
    ear: 0.35,
    sway: 0.01,
  },
  sheep: { down: 0.9, reach: 6, nod: 0.05, carry: 0, tail: 0, swish: 0, ear: 0.45, sway: 0.014 },
});

/** A smooth bump: 0 at both ends of 0..1 and 1 in the middle. */
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2);

/**
 * A thing that happens now and then: one slot of `period` seconds after another, each slot has the event with the given
 * chance, at a place of its own in the slot. Returns how far into the event it is (0 to 1) or -1 when none is going on.
 */
export function eventAt(seconds, seed, index, salt, period, chance, length) {
  const shifted = seconds + unit(seed, index, salt, 1) * period;
  const slot = Math.floor(shifted / period);
  if (unit(seed, index, salt, 2, slot) >= chance) return -1;
  const start = unit(seed, index, salt, 3, slot) * (period - length);
  const x = (shifted - slot * period - start) / length;
  return x > 0 && x < 1 ? x : -1;
}

/** The weight of an event, 0 to 1 and smooth (see `eventAt`). */
export const pulse = (seconds, seed, index, salt, period, chance, length) =>
  bump(eventAt(seconds, seed, index, salt, period, chance, length));

/** A slow wandering number between -1 and 1: two waves of unrelated periods, each with a phase of its own. */
function wander(seconds, seed, index, salt, period) {
  const a = TAU * unit(seed, index, salt, 11);
  const b = TAU * unit(seed, index, salt, 12);
  return (
    0.65 * Math.sin((TAU * seconds) / period + a) +
    0.35 * Math.sin((TAU * seconds) / (period * 0.37) + b)
  );
}

/**
 * @param {'horse'|'cow'|'sheep'} kind
 * @param {object} state
 * @param {number} state.seconds  the clock, in seconds
 * @param {number} state.seed
 * @param {number} state.index    the animal's number
 * @param {number} state.phase    the phase of the walk, 0 to 1 (game/gait.js)
 * @param {number} state.swing    how much it walks, 0 to 1
 * @param {number} state.down     how much its head is down to graze or eat, 0 to 1
 * @returns {{head: number, reach: number, ear: number, tail: number, breath: number, sway: number}}
 *   `head` the rotation of the head and neck, `reach` how far the head is lowered with it (units), `ear` and `tail` their
 *   rotations, `breath` the stretch of the body up and down (1 is none) and `sway` the slow rocking of the body.
 */
export function secondaryAt(kind, { seconds, seed, index, phase, swing, down }) {
  const style = STYLE[kind];
  const idle = 1 - swing;
  // The head comes up to look about now and then while it grazes (and goes down less for a moment).
  const look = pulse(seconds, seed, index, 21, 32, 0.8, 4.5);
  const low = down * (1 - 0.75 * look);
  // The chew: a small quick nod, only while the head is down.
  const chew = down * 0.03 * Math.sin(TAU * 1.7 * seconds + TAU * unit(seed, index, 22));
  // Looking about: the head drifts a little up and down and, now and then, lifts to look at something.
  const lift = pulse(seconds, seed, index, 23, 24, 0.5, 5);
  const drift = (0.05 * wander(seconds, seed, index, 24, 11) - 0.07 * lift) * (1 - down) * idle;
  const nod = swing * style.nod * Math.sin(TAU * phase + 0.6);
  const head = style.down * low + chew + drift + nod + style.carry * swing * (1 - down);

  // A twitch: the ear flicks back and returns, in about half a second.
  const twitch = pulse(seconds, seed, index, 31, 8, 0.55, 0.55);
  const ear =
    -0.05 +
    0.04 * wander(seconds, seed, index, 32, 9) -
    style.ear * twitch +
    swing * 0.04 * Math.sin(TAU * 2 * phase + 1.3);

  const flies = eventAt(seconds, seed, index, 41, 13, 0.6, 2.8);
  const swish = flies < 0 ? 0 : bump(flies) * style.swish * Math.sin(TAU * 1.8 * flies * 2.8 + 0.4);
  const tail =
    style.tail *
      (0.6 * wander(seconds, seed, index, 42, 6) + swing * 1.2 * Math.sin(TAU * phase + 1.0)) +
    swish;

  const breath =
    1 + 0.014 * Math.sin((TAU * seconds) / 4.2 + TAU * unit(seed, index, 51)) * (1 - 0.6 * swing);
  const sway = style.sway * wander(seconds, seed, index, 52, 9) * idle;
  return { head, reach: style.reach * low, ear, tail, breath, sway };
}
