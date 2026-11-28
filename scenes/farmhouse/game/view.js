// Everything the scene shows at a moment, put together from the rules (docs/scenes/farmhouse.md section 4.1). Pure: the
// moment, the sun, the place and the seed go in, a plain description comes out, and the scene only draws it. `slowAt`
// is for what changes by the minute (season, weather, snow, lights, whether the truck goes); `motionAt` is for what
// moves every frame (smoke, truck, animals) and is cheap.

import { animalsAt } from './animals.js';
import { hayAllowed, shelterAt } from './barn.js';
import { smokeAmount, tripAllowed, truckAt, windowLights } from './clockRules.js';
import { floweringAt, SPECIES } from './flowering.js';
import { seasonAt, previewDay } from './season.js';
import { previewWeather, snowCoverAt, stormness, weatherAt } from './weather.js';
import { smooth } from './hash.js';

const DAY = 86_400_000;

/** A day number that changes by one each local day, for the weather's seed. */
export const dayIndexOf = (parts) =>
  Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY);

/**
 * @param {object} input
 * @param {number} input.ms  the moment (epoch ms)
 * @param {object} input.parts  the computer's wall clock then (`host.time.parts(ms)`)
 * @param {object} input.sun  `host.time.sun(ms)`
 * @param {number} input.nightness  `host.time.nightness(ms)`
 * @param {number} input.latitude  of the place
 * @param {number} input.seed
 * @param {string|null} [input.previewSeason]  a tray preview of a season (not saved)
 * @param {string|null} [input.previewKind]  a tray preview of a weather kind (not saved)
 * @param {{dayOfYear: number}|null} [input.fast]  the fast date (game/fast.js) in Fast mode: the season, the mean
 *        temperature and the snow follow it instead of the real date (the weather's seed stays the real day)
 */
export function slowAt({
  ms,
  parts,
  sun,
  nightness,
  latitude,
  seed,
  previewSeason = null,
  previewKind = null,
  fast = null,
}) {
  const dayOfYear = previewSeason
    ? previewDay(previewSeason, latitude)
    : (fast?.dayOfYear ?? parts.dayOfYear);
  // The weather always follows the real day and its four-hour blocks, so it changes as often as in Calendar mode and
  // cross-fades the same way; Fast mode moves only the season, the mean temperature and so the snow with the fast date.
  const dayIndex = dayIndexOf(parts);
  const when = { dayIndex, dayOfYear, minuteOfDay: parts.minuteOfDay };
  const simulated = weatherAt(seed, when, latitude);
  const weather = previewKind ? previewWeather(previewKind, simulated.temperature) : simulated;
  // A previewed snowfall also puts snow on the ground, so the picture shows it.
  const ground = snowCoverAt(seed, when, latitude);
  const snowCover = previewKind === 'snow' ? Math.max(ground, 0.5) : ground;
  return {
    ms,
    when,
    season: seasonAt(dayOfYear, latitude),
    trees: Object.fromEntries(
      SPECIES.map((species) => [species, floweringAt(species, dayOfYear, latitude)]),
    ),
    weather,
    snowCover,
    nightness,
    sun,
    lights: windowLights(ms, parts, sun, weather, seed),
    // Animals stand still at night and in a storm (without a barn); with one they go in (R13). Both are ramps (the night's
    // `nightness` and the storm's wind), so they walk to their places and never jump.
    still: Math.max(smooth((nightness - 0.5) / 0.4), stormness(weather)),
    // How much they want shelter, and whether Scatter hay can be used (only by day, R12).
    shelter: shelterAt(nightness, weather),
    hayAllowed: hayAllowed(shelterAt(nightness, weather)),
    // The morning side of the change (they face away from the door while they come out).
    morning: ms < sun.noon,
    tripAllowed: (startMs) => tripAllowed(startMs, sun, weather, snowCover),
  };
}

/** What moves every frame, from the slow view of the same moment. */
export function motionAt(ms, parts, slow, { seed, hayStartedAt = null, bounds, barn = null } = {}) {
  return {
    smoke: smokeAmount(ms, parts, slow.weather.temperature),
    truck: truckAt(ms, slow.tripAllowed),
    animals: animalsAt(ms, {
      seed,
      dayIndex: slow.when.dayIndex,
      // The resting places change at noon, when they are out walking, not at midnight when they are standing in them.
      restDay: dayIndexOf(parts) - (parts.minuteOfDay < 720 ? 1 : 0),
      still: slow.still,
      hayStartedAt,
      bounds,
      barn: barn ? { door: barn.door, shelter: slow.shelter, leaving: slow.morning } : null,
    }),
  };
}
