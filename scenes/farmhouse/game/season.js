// The season of the farm house as a smooth curve over the day of the year (docs/scenes/farmhouse.md section 4 and table
// 4.2), not four switches. Pure: no Pixi, no clock. The keys below are for the default place (Atlanta, in the north);
// a place in the southern hemisphere is the same curve shifted by half a year, and the flowering trees move with the
// latitude (flowering.js).

import { smooth } from './hash.js';

export const YEAR = 365;
/** Half a year, as whole days: a southern place is this far from the northern curve (and back: 182 + 183 = 365). */
export const HALF_YEAR = 183;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
/** Atlanta's latitude, the place the keys are written for. */
export const HOME_LATITUDE = 33.7;

/** A day of the year folded into 1 to 365 (a leap day counts as the 365th). */
export const wrapDay = (day) => ((((Math.round(day) - 1) % YEAR) + YEAR) % YEAR) + 1;

/** The day on the northern curve: a southern place is half a year later. */
export const northernDay = (dayOfYear, latitude) =>
  latitude < 0 ? wrapDay(dayOfYear + HALF_YEAR) : wrapDay(dayOfYear);

/**
 * A value that moves smoothly (an S curve) between `[day, value]` keys. The keys cover day 1 to day 365 and start and
 * end at the same value, so the year has no jump.
 * @param {number} day  1 to 365, may have a fraction
 * @param {[number, number][]} keys
 */
export function keyed(day, keys) {
  const d = Math.max(keys[0][0], Math.min(keys.at(-1)[0], day));
  for (let i = 1; i < keys.length; i++) {
    if (d <= keys[i][0]) {
      const [d0, v0] = keys[i - 1];
      const [d1, v1] = keys[i];
      return v0 + (v1 - v0) * smooth((d - d0) / (d1 - d0));
    }
  }
  return keys.at(-1)[1];
}

// Leaves on the forest: none in winter, fresh in April, full from May, falling from mid-November.
const LEAF = [
  [1, 0],
  [60, 0],
  [85, 0.15],
  [105, 0.6],
  [125, 1],
  [290, 1],
  [315, 0.55],
  [335, 0.1],
  [350, 0],
  [365, 0],
];
// Colour of the leaves: 0 green, about 0.35 first yellow, 0.8 red and orange at the peak (late October), 1 brown.
const TURN = [
  [1, 0],
  [255, 0],
  [275, 0.35],
  [295, 0.8],
  [325, 1],
  [345, 1],
  [365, 0],
];
// The field: pale in winter, bright green in spring, deep in summer, straw patches in autumn.
const GRASS = [
  [1, 0.15],
  [60, 0.3],
  [90, 0.8],
  [120, 1],
  [200, 0.95],
  [250, 0.8],
  [290, 0.55],
  [330, 0.3],
  [365, 0.15],
];
// How wintry the date is (snow is allowed only when this is above 0 or it is cold enough, see weather.js).
const WINTER = [
  [1, 1],
  [50, 0.9],
  [80, 0],
  [330, 0],
  [350, 0.8],
  [365, 1],
];

/** The name of the season of a northern day (meteorological: March, June, September, December). */
export function seasonName(northDay) {
  if (northDay >= 60 && northDay < 152) return 'spring';
  if (northDay >= 152 && northDay < 244) return 'summer';
  if (northDay >= 244 && northDay < 335) return 'autumn';
  return 'winter';
}

/**
 * The season at a day of the year for a place.
 * @param {number} dayOfYear  1 to 366
 * @param {number} latitude  degrees, north positive
 * @returns {{name: string, day: number, leaf: number, turn: number, grass: number, winter: number}}
 *          `day` is the day on the northern curve; the four numbers are 0 to 1
 */
export function seasonAt(dayOfYear, latitude) {
  const day = northernDay(dayOfYear, latitude);
  return {
    name: seasonName(day),
    day,
    leaf: keyed(day, LEAF),
    turn: keyed(day, TURN),
    grass: keyed(day, GRASS),
    winter: keyed(day, WINTER),
  };
}

/** The middle of each season on the northern curve (rule R2): 5 April, 15 July, 20 October, 15 January. */
export const PREVIEW_DAY = Object.freeze({ spring: 95, summer: 196, autumn: 293, winter: 15 });

/**
 * The day of the year a tray preview pins the scene to: the northern day, half a year later in the south, so the
 * preview "Autumn" is autumn at the place.
 * @param {string} name  one of SEASONS
 * @param {number} latitude
 */
export function previewDay(name, latitude) {
  const day = PREVIEW_DAY[name];
  if (day === undefined) throw new Error(`no season "${name}"`);
  return latitude < 0 ? wrapDay(day + 182) : day;
}
