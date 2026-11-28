// The red barn (docs/scenes/farmhouse.md rule R13, DEC-64). At night and in a storm the animals walk to the barn door and
// go in; after sunrise, or when the storm is over, they come out again. Pure, and a function of the clock and the weather:
// nothing is added up from frame to frame, and nothing steps (the walk in is continuous and the fade at the door is a ramp).
//
// The barn stands at the back of the field, at the left edge of what is on the screen. Where it is and where its door is
// are the scene's (the screen's shape moves it); this file has what is the same for every screen.

import { smooth } from './hash.js';
import { stormness } from './weather.js';

/** The barn's own picture and where the animals go in. Design units, as in layout.js; x from the barn's left edge. */
export const BARN = Object.freeze({
  width: 250,
  height: 196,
  /** The gap between the left edge of the screen and the barn. */
  inset: 30,
  /** The depth of its base in the field (0 is the fence line): the back of the field. */
  depth: 0.04,
  /** The centre of the animals' door, from the barn's left edge. */
  doorX: 186,
  /** Where an animal stands to go in: a little in front of the door. */
  doorDepth: 0.1,
});

/**
 * Who goes in first: the sheep, then the cows, the horses last (and the horses come out first in the morning). A share
 * of the way through the dusk at which each starts.
 */
export const ORDER = Object.freeze({
  'sheep-1': 0,
  'sheep-2': 0.08,
  'sheep-3': 0.16,
  'cow-1': 0.28,
  'cow-2': 0.38,
  'horse-brown': 0.5,
  'horse-beige': 0.6,
});
/** How much of the shelter amount one animal's whole walk takes. */
const SPAN = 0.35;
/** The part of the walk spent walking; the rest is the fade in the doorway. */
const WALK_SHARE = 0.93;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * How much the animals want shelter, 0 to 1: the night (it falls and rises over the hour of dusk or dawn) or a storm (it
 * follows the cross-faded wind), whichever is more.
 * @param {number} nightness  `host.time.nightness`
 * @param {{kind?: string, wind?: number}} weather
 */
export const shelterAt = (nightness, weather) => Math.max(nightness, stormness(weather));

/**
 * How far one animal is on its way in, 0 (in the field) to 1 (through the door).
 * @param {number} shelter  `shelterAt`
 * @param {string} id  the animal
 */
export const progressOf = (shelter, id) => clamp01((shelter - (ORDER[id] ?? 0)) / SPAN);

/** How far to the door an animal has walked, 0 to 1 (it arrives at the door a little before it is through it). */
export const walked = (progress) => smooth(clamp01(progress / WALK_SHARE));

/** How much of an animal is seen: 1 outside, 0 inside; it fades in the doorway as it goes in. */
export const seen = (progress) => 1 - smooth(clamp01((progress - WALK_SHARE) / (1 - WALK_SHARE)));

/** Whether the tray's Scatter hay can be used: only by day (R12), when no animal is on its way to the barn. */
export const hayAllowed = (shelter) => shelter < 0.02;
