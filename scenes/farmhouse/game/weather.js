// Simulated weather for the farm house (docs/scenes/farmhouse.md sections 4 and 8): used in 0.2 for everyone, and in
// 0.4 whenever there is no network or no consent, and always in Fast mode. Pure and deterministic: the weather at a
// moment is a function of the seed, the date and time, and the place, never of how many frames ran, so two machines show
// the same sky and a pause or a jump of the clock settles at once (rule R1). It changes a few times a day (a block is 4
// hours); the amounts cross-fade over the first 30 minutes of a block, so the sky never jumps.
//
// `kinds` are those of the `weather@1` data kind: clear, partly, cloudy, fog, drizzle, rain, snow, storm.

import { HOME_LATITUDE, MAX_SHIFT_DEGREES, keyed, northernDay, seasonAt } from './season.js';
import { lerp, smooth, unit } from './hash.js';

export const KINDS = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm'];
export const BLOCK_HOURS = 4;
const BLOCKS_PER_DAY = 24 / BLOCK_HOURS;
const FADE_MINUTES = 30;
/** Snow falls only at or below this temperature (degrees C), and never in a summer month. */
export const SNOW_BELOW = 1.5;

// Mean daily temperature (degrees C) of Atlanta by day of the year; the year starts and ends at the same value.
const MEAN = [
  [1, 6.5],
  [46, 8.5],
  [74, 12],
  [105, 16.5],
  [135, 21],
  [166, 25],
  [197, 26.5],
  [227, 26],
  [258, 23],
  [288, 17],
  [319, 11],
  [349, 7.5],
  [365, 6.5],
];
// Cooling per degree of latitude away from Atlanta (towards the pole), degrees C.
const COOLING_PER_DEGREE = 0.7;

// Weights of the kinds of a block, by season of the northern curve: clear, partly, cloudy, fog, drizzle, rain, storm.
const WEIGHTS = {
  winter: [0.3, 0.2, 0.25, 0.05, 0.07, 0.13, 0],
  spring: [0.3, 0.2, 0.15, 0.07, 0.06, 0.15, 0.07],
  summer: [0.4, 0.25, 0.1, 0.02, 0.03, 0.08, 0.12],
  autumn: [0.3, 0.2, 0.2, 0.12, 0.06, 0.1, 0.02],
};
const ORDER = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'storm'];
/** How much sky each kind covers, how hard it rains, and how windy it is. */
const LOOK = {
  clear: { cloud: 0.05, rain: 0, fog: 0, wind: 0.25 },
  partly: { cloud: 0.35, rain: 0, fog: 0, wind: 0.35 },
  cloudy: { cloud: 0.8, rain: 0, fog: 0, wind: 0.4 },
  fog: { cloud: 0.7, rain: 0, fog: 1, wind: 0.1 },
  drizzle: { cloud: 0.85, rain: 0.25, fog: 0.2, wind: 0.3 },
  rain: { cloud: 0.95, rain: 0.6, fog: 0.1, wind: 0.45 },
  snow: { cloud: 0.9, rain: 0.5, fog: 0.15, wind: 0.3 },
  storm: { cloud: 1, rain: 1, fog: 0, wind: 0.9 },
};

/**
 * The part of the calendar the weather needs; a scene gets it from `host.time.parts()`, and Fast mode makes one of its
 * own (a fast date).
 * @typedef {{dayIndex: number, dayOfYear: number, minuteOfDay: number}} When
 *          `dayIndex` is a number that changes by one each day (days since some fixed date)
 */

/**
 * How much of a storm there is, 0 to 1. It follows the wind, which cross-fades between the blocks, so it goes up and down
 * over the half hour of the change and never as a step (rain's wind is at most 0.55, a storm's at least 0.8).
 * @param {{kind?: string, wind?: number}} weather
 */
export function stormness(weather) {
  const wind = weather.wind ?? (weather.kind === 'storm' ? 0.9 : 0);
  return smooth((wind - 0.6) / 0.25);
}

/** The mean temperature of a day at a place (degrees C), before the day's own variation. */
export function meanTemperature(dayOfYear, latitude) {
  const day = northernDay(dayOfYear, latitude);
  const away = Math.max(
    -MAX_SHIFT_DEGREES,
    Math.min(MAX_SHIFT_DEGREES, Math.abs(latitude) - HOME_LATITUDE),
  );
  return keyed(day, MEAN) - away * COOLING_PER_DEGREE;
}

/** The temperature (degrees C) at a time: the day's mean, a daily swing (coldest 06:00, warmest 15:00), a few degrees of
 *  variation from one day to the next (smooth through the day) and a little less under cloud. */
function temperatureAt(seed, when, latitude, cloud) {
  const anomaly = (dayIndex) => (unit(seed, dayIndex, 77) - 0.5) * 9;
  const t = when.minuteOfDay / 1440;
  const variation = lerp(anomaly(when.dayIndex), anomaly(when.dayIndex + 1), smooth(t));
  const swing = Math.cos(((when.minuteOfDay / 60 - 15) * Math.PI) / 12) * 5.5 * (1 - 0.4 * cloud);
  return meanTemperature(when.dayOfYear, latitude) + variation + swing;
}

/** The kind of a block before snow is decided (a heavier draw of the same weights, with some persistence). */
function drawKind(seed, dayIndex, block, dayOfYear, latitude) {
  const draw = (b, d) => {
    const season = seasonAt(dayOfYear, latitude).name;
    const weights = [...WEIGHTS[season]];
    // Fog forms in the early morning only; a summer storm comes in the afternoon and evening.
    const start = (((b % BLOCKS_PER_DAY) + BLOCKS_PER_DAY) % BLOCKS_PER_DAY) * BLOCK_HOURS;
    if (start < 4 || start >= 12) {
      weights[2] += weights[3];
      weights[3] = 0;
    }
    if (season === 'summer' && (start < 12 || start >= 20)) {
      weights[1] += weights[6];
      weights[6] = 0;
    }
    let pick = unit(seed, d, b, 1) * weights.reduce((a, w) => a + w, 0);
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i];
      if (pick < 0) return ORDER[i];
    }
    return 'clear';
  };
  const previous = block === 0 ? [dayIndex - 1, BLOCKS_PER_DAY - 1] : [dayIndex, block - 1];
  const fresh = draw(block, dayIndex);
  if (unit(seed, dayIndex, block, 9) >= 0.35) return fresh;
  // The weather of the block before goes on, unless it cannot happen at this hour (fog in the afternoon, a summer
  // storm in the morning).
  const kept = draw(previous[1], previous[0]);
  const start = block * BLOCK_HOURS;
  const season = seasonAt(dayOfYear, latitude).name;
  if (kept === 'fog' && (start < 4 || start >= 12)) return fresh;
  if (kept === 'storm' && season === 'summer' && (start < 12 || start >= 20)) return fresh;
  return kept;
}

/** A block's weather, with the temperature of the block's middle deciding rain or snow. */
function blockWeather(seed, dayIndex, block, dayOfYear, latitude) {
  let kind = drawKind(seed, dayIndex, block, dayOfYear, latitude);
  const middle = { dayIndex, dayOfYear, minuteOfDay: (block + 0.5) * BLOCK_HOURS * 60 };
  const temperature = temperatureAt(seed, middle, latitude, LOOK[kind].cloud);
  const summer = seasonAt(dayOfYear, latitude).name === 'summer';
  if (
    (kind === 'rain' || kind === 'drizzle' || kind === 'storm') &&
    temperature <= SNOW_BELOW &&
    !summer
  ) {
    kind = 'snow';
  }
  const look = LOOK[kind];
  const noise = (n) => (unit(seed, dayIndex, block, n) - 0.5) * 0.2;
  return {
    kind,
    cloud: Math.max(0, Math.min(1, look.cloud + noise(2))),
    precipitation: look.rain === 0 ? 0 : Math.max(0.1, Math.min(1, look.rain * (1 + noise(3) * 2))),
    fog: Math.max(0, Math.min(1, look.fog)),
    wind: Math.max(0, Math.min(1, look.wind + noise(4))),
  };
}

/**
 * The weather at a moment.
 * @param {number} seed
 * @param {When} when
 * @param {number} latitude
 * @returns {{kind: string, cloud: number, precipitation: number, fog: number, wind: number, snowShare: number,
 *            temperature: number}}
 *          `snowShare` (0 to 1) is how much of the precipitation falls as snow, cross-faded with the amounts; `kind` is the block's; the four amounts (0 to 1) cross-fade from the block before over its first 30 minutes
 */
export function weatherAt(seed, when, latitude = HOME_LATITUDE) {
  const block = Math.floor(when.minuteOfDay / (BLOCK_HOURS * 60));
  const now = blockWeather(seed, when.dayIndex, block, when.dayOfYear, latitude);
  const into = when.minuteOfDay - block * BLOCK_HOURS * 60;
  let mix = { ...now, snowShare: now.kind === 'snow' ? 1 : 0 };
  if (into < FADE_MINUTES) {
    // The block before: the previous one of the same day, or the last of the day before (its own day of the year).
    const before =
      block > 0
        ? blockWeather(seed, when.dayIndex, block - 1, when.dayOfYear, latitude)
        : blockWeather(
            seed,
            when.dayIndex - 1,
            BLOCKS_PER_DAY - 1,
            when.dayOfYear === 1 ? 365 : when.dayOfYear - 1,
            latitude,
          );
    const t = smooth(into / FADE_MINUTES);
    mix = {
      kind: now.kind,
      snowShare: lerp(before.kind === 'snow' ? 1 : 0, now.kind === 'snow' ? 1 : 0, t),
      cloud: lerp(before.cloud, now.cloud, t),
      precipitation: lerp(before.precipitation, now.precipitation, t),
      fog: lerp(before.fog, now.fog, t),
      wind: lerp(before.wind, now.wind, t),
    };
  }
  return { ...mix, temperature: temperatureAt(seed, when, latitude, mix.cloud) };
}

/**
 * How much of the ground is covered with snow, 0 to 1: it builds up while it snows and melts above freezing. A function
 * of the time too: it looks back over the last eight days, block by block, so no state is kept.
 * @param {number} seed
 * @param {When} when
 * @param {number} latitude
 */
export function snowCoverAt(seed, when, latitude = HOME_LATITUDE) {
  const DAYS = 8;
  let cover = 0;
  const nowBlock =
    when.dayIndex * BLOCKS_PER_DAY + Math.floor(when.minuteOfDay / (BLOCK_HOURS * 60));
  for (let b = nowBlock - DAYS * BLOCKS_PER_DAY; b <= nowBlock; b++) {
    const dayIndex = Math.floor(b / BLOCKS_PER_DAY);
    const block = b - dayIndex * BLOCKS_PER_DAY;
    const dayOfYear = ((((when.dayOfYear - 1 - (when.dayIndex - dayIndex)) % 365) + 365) % 365) + 1;
    const weather = weatherAt(
      seed,
      { dayIndex, dayOfYear, minuteOfDay: (block + 0.5) * BLOCK_HOURS * 60 },
      latitude,
    );
    if (weather.kind === 'snow') cover += 0.35 * weather.precipitation + 0.1;
    else if (weather.temperature > 0) cover -= 0.012 * weather.temperature;
    cover = Math.max(0, Math.min(1, cover));
  }
  return cover;
}

/**
 * The weather a tray preview pins (Clear, Cloudy, Fog, Rain, Snow, Storm ...): the look of a kind with the temperature
 * the simulation gave, and snow only as cold as snow needs. Not saved.
 * @param {string} kind  one of KINDS
 * @param {number} temperature
 */
export function previewWeather(kind, temperature) {
  const look = LOOK[kind];
  if (!look) throw new Error(`no weather kind "${kind}"`);
  return {
    kind,
    cloud: look.cloud,
    precipitation: look.rain,
    fog: look.fog,
    wind: look.wind,
    snowShare: kind === 'snow' ? 1 : 0,
    temperature: kind === 'snow' ? Math.min(temperature, 0) : temperature,
  };
}
