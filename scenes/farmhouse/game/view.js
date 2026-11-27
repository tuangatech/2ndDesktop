// Everything the scene shows at a moment, put together from the rules (docs/scenes/farmhouse.md section 4.1). Pure: the
// moment, the sun, the place and the seed go in, a plain description comes out, and the scene only draws it. `slowAt`
// is for what changes by the minute (season, weather, snow, lights, whether the truck goes); `motionAt` is for what
// moves every frame (smoke, truck, animals) and is cheap.

import { animalsAt } from './animals.js';
import { smokeAmount, tripAllowed, truckAt, windowLights } from './clockRules.js';
import { floweringAt, SPECIES } from './flowering.js';
import { seasonAt, previewDay } from './season.js';
import { previewWeather, snowCoverAt, weatherAt } from './weather.js';

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
}) {
  const dayOfYear = previewSeason ? previewDay(previewSeason, latitude) : parts.dayOfYear;
  const when = { dayIndex: dayIndexOf(parts), dayOfYear, minuteOfDay: parts.minuteOfDay };
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
    // Animals stand still at night and in a storm.
    still: Math.max(nightness > 0.8 ? 1 : 0, weather.kind === 'storm' ? 1 : 0),
    tripAllowed: (startMs) => tripAllowed(startMs, sun, weather, snowCover),
  };
}

/** What moves every frame, from the slow view of the same moment. */
export function motionAt(ms, parts, slow, { seed, hayStartedAt = null, bounds } = {}) {
  return {
    smoke: smokeAmount(ms, parts, slow.weather.temperature),
    truck: truckAt(ms, slow.tripAllowed),
    animals: animalsAt(ms, {
      seed,
      dayIndex: slow.when.dayIndex,
      still: slow.still,
      hayStartedAt,
      bounds,
    }),
  };
}
