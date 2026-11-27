// The four flowering trees in front of the house (table 4.2 of docs/scenes/farmhouse.md): what each shows on a day of
// the year. Pure. The dates are Atlanta's (the default place, DEC-60). For a typed city (0.4) the spring events move
// about 4 days later for each degree of latitude further from the equator than Atlanta and the autumn ones earlier (a
// rule of thumb to be tuned by eye, not a climate model); a southern city is shifted by half a year.

import { HOME_LATITUDE, MAX_SHIFT_DEGREES, YEAR, northernDay } from './season.js';
import { smooth } from './hash.js';

export const SPECIES = ['redbud', 'cherry', 'dogwood', 'peach'];
export const DAYS_PER_DEGREE = 4;

// Day-of-year events on the northern curve for Atlanta. blossom: [from, full, full ends, gone]; leafIn: [from, full];
// leafOut: [from, bare]; turn: [from, full colour]; fruit and berries: [from, full, full ends, gone].
const TREES = {
  // Magenta-pink blossom on bare branches in March and April, then heart-shaped green leaves, yellow in October.
  redbud: {
    blossom: [69, 84, 105, 118],
    leafIn: [110, 135],
    turn: [274, 298],
    leafOut: [300, 319],
  },
  // Pink and white blossom in late March and April with petals falling, dark green leaves with a bronze tint, orange-red.
  cherry: {
    blossom: [78, 90, 106, 122],
    leafIn: [105, 130],
    turn: [272, 305],
    leafOut: [308, 324],
  },
  // White blossom in flat tiers in April, deep red leaves and red berries in October and November.
  dogwood: {
    blossom: [95, 106, 120, 132],
    leafIn: [112, 135],
    turn: [280, 312],
    leafOut: [316, 335],
    berries: [284, 296, 322, 340],
  },
  // Pink blossom in March, small green fruit in May, a few peaches in July, yellow leaves.
  peach: {
    blossom: [64, 75, 90, 102],
    leafIn: [96, 121],
    fruit: [120, 150, 200, 232],
    turn: [286, 306],
    leafOut: [310, 329],
  },
};

const up = (day, [a, b]) => smooth((day - a) / (b - a));
const bump = (day, [a, b, c, d]) => smooth((day - a) / (b - a)) * (1 - smooth((day - c) / (d - c)));

/**
 * What a flowering tree shows.
 * @param {string} species  one of SPECIES
 * @param {number} dayOfYear
 * @param {number} [latitude]  the place; Atlanta by default
 * @returns {{blossom: number, leaf: number, turn: number, fruit: number, berries: number, petals: number}}
 *          all 0 to 1; `leaf` is how many leaves there are (0 bare), `turn` how far the autumn colour has gone,
 *          `petals` the falling blossom (while the blossom fades)
 */
export function floweringAt(species, dayOfYear, latitude = HOME_LATITUDE) {
  const spec = TREES[species];
  if (!spec) throw new Error(`no tree "${species}"`);
  const away = Math.max(
    -MAX_SHIFT_DEGREES,
    Math.min(MAX_SHIFT_DEGREES, Math.abs(latitude) - HOME_LATITUDE),
  );
  const shift = away * DAYS_PER_DEGREE;
  const day = northernDay(dayOfYear, latitude);
  const spring = day - shift; // a later spring is an earlier day on the table
  const autumn = day + shift; // an earlier autumn is a later day on the table
  const wrap = (d) => Math.max(1, Math.min(YEAR, d));
  const s = wrap(spring);
  const a = wrap(autumn);
  const leaf = up(s, spec.leafIn) * (1 - up(a, spec.leafOut));
  const blossom = bump(s, spec.blossom);
  const fading =
    blossom > 0 ? smooth((s - spec.blossom[2]) / (spec.blossom[3] - spec.blossom[2])) : 0;
  return {
    blossom,
    leaf,
    turn: up(a, spec.turn) * (leaf > 0 ? 1 : 0),
    fruit: spec.fruit ? bump(s, spec.fruit) : 0,
    berries: spec.berries ? bump(a, spec.berries) : 0,
    petals: fading > 0 && fading < 1 ? Math.sin(Math.PI * fading) * blossom : 0,
  };
}
