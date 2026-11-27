// The sky, the light and the weather as the scene shows them (docs/scenes/farmhouse.md section 5, items 1, 2, 10 and 11).
// Pure, no Pixi and no clock: the moment, the sun and the weather go in, plain numbers and colours come out, and the
// scene only draws them. So every look of the sky can be tested without a screen.
import { lerp, smooth, unit } from './hash.js';
import { stormness } from './weather.js';

const MIN = 60_000;
const DAY = 86_400_000;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
/** A mix of two '#rrggbb' colours: `t` 0 gives `a`, 1 gives `b`. */
export const blend = (a, b, t) => {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A.map((v, i) => lerp(v, B[i], clamp01(t))));
};
/** The product of two colours, channel by channel (what a multiply blend does on the screen). */
export const multiply = (a, b) => {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A.map((v, i) => (v * B[i]) / 255));
};

/**
 * Where the day is.
 * @param {number} ms
 * @param {{sunrise: number|null, sunset: number|null, polar: 'day'|'night'|null}} sun  of the day of `ms`
 * @param {number} nightness  0 (day) to 1 (night), from `host.time.nightness()`
 * @returns {{night: number, golden: number, sun: number|null, moon: number|null}}
 *          `golden` is the warm light of the hour around sunrise and sunset; `sun` and `moon` are how far along its
 *          way across the sky each one is, 0 to 1, or null when it is not up
 */
export function timeOfDay(ms, sun, nightness) {
  let golden = 0;
  let sunArc = null;
  let moonArc = null;
  if (sun.polar === 'day') {
    sunArc = 0.5;
  } else if (sun.polar === 'night') {
    moonArc = 0.5;
  } else {
    const near = (t) => Math.max(0, 1 - Math.abs(ms - t) / (50 * MIN));
    golden = smooth(Math.max(near(sun.sunrise), near(sun.sunset)));
    if (ms >= sun.sunrise && ms <= sun.sunset) {
      sunArc = (ms - sun.sunrise) / (sun.sunset - sun.sunrise);
    } else {
      const start = ms > sun.sunset ? sun.sunset : sun.sunset - DAY;
      const end = ms > sun.sunset ? sun.sunrise + DAY : sun.sunrise;
      moonArc = clamp01((ms - start) / (end - start));
    }
  }
  return { night: nightness, golden, sun: sunArc, moon: moonArc };
}

const SKY = {
  day: ['#a9c3d6', '#e6e4d6'],
  golden: ['#9fb3cf', '#f1c79c'],
  night: ['#1d2745', '#37466b'],
  grey: ['#aab4b8', '#d3d6d0'],
  storm: ['#6c777f', '#9aa3a6'],
};

/**
 * The two colours of the sky gradient (top, bottom): blue by day, warm at sunrise and sunset, deep blue at night, going
 * grey with cloud and dark in a storm.
 * @param {{night: number, golden: number}} tod
 * @param {{kind: string, cloud: number}} weather
 */
export function skyColours(tod, weather) {
  const out = [0, 1].map((i) => {
    let c = blend(SKY.day[i], SKY.golden[i], tod.golden * 0.85);
    c = blend(c, SKY.grey[i], clamp01(weather.cloud * 0.8));
    c = blend(c, SKY.storm[i], 0.7 * stormness(weather));
    return blend(c, SKY.night[i], tod.night);
  });
  return { top: out[0], bottom: out[1] };
}

const step = (v, size) => Math.round(v / size);
/** The key of the sky's look: the sky picture is drawn again only when it changes (a few steps an hour at most). */
export const skyKey = (tod, weather) =>
  [
    step(tod.night, 0.05),
    step(tod.golden, 0.1),
    step(weather.cloud, 0.1),
    step(stormness(weather), 0.1),
  ].join('.');

/**
 * The grade over the whole picture: a colour that is multiplied into it (white is no change), and a haze of grey on top.
 * @param {{night: number, golden: number}} tod
 * @param {{kind: string, cloud: number}} weather
 * @param {number} [dim]  0 to 1, a flash of lightning as a short darkening
 * @returns {{multiply: string, haze: number}}
 */
export function gradeAt(tod, weather, dim = 0) {
  let colour = '#ffffff';
  colour = multiply(colour, blend('#ffffff', '#7581ab', tod.night));
  colour = multiply(colour, blend('#ffffff', '#ffdcb4', tod.golden * 0.7 * (1 - tod.night)));
  colour = multiply(colour, blend('#ffffff', '#d4dadc', clamp01(weather.cloud) * 0.45));
  colour = multiply(colour, blend('#ffffff', '#bcc3c8', stormness(weather)));
  colour = multiply(colour, blend('#ffffff', '#4a4f5c', dim * 0.55));
  return { multiply: colour, haze: clamp01(weather.cloud) * 0.08 };
}

/**
 * A flash of lightning, as a short darkening and never a bright flash: in a storm, every 18 seconds of the clock, most
 * slots have one pulse of about a second at a seeded moment.
 * @returns {number}  0 to 1
 */
export function lightningDim(ms, weather, seed = 0) {
  const storm = stormness(weather);
  if (storm === 0) return 0;
  const SLOT = 18_000;
  const slot = Math.floor(ms / SLOT);
  if (unit(seed, slot, 41) > 0.6) return 0;
  const at = slot * SLOT + unit(seed, slot, 42) * (SLOT - 2000);
  const t = (ms - at) / 1100;
  return t < 0 || t > 1 ? 0 : storm * Math.sin(Math.PI * t) ** 2;
}

/**
 * How many of each falling thing, and how many clouds, the weather and the season ask for (the scene keeps a pool of the
 * most: the counts are caps, so a stormy day is never more than a few hundred sprites).
 * @param {{kind: string, precipitation: number}} weather
 * @param {{turn: number, leaf: number}} season
 * @param {number} snowCover  0 to 1
 * @param {number} petals  0 to 1, the most falling blossom of the flowering trees
 */
export function fallingAt(weather, season, snowCover, petals) {
  const leafFall = Math.max(0, season.turn - 0.2) * Math.min(1, season.leaf * 4) * (1 - snowCover);
  // What falls is the amount of precipitation, which cross-fades between the blocks of weather, shared between snow and
  // rain by `snowShare`, which cross-fades with it: a storm that gives way to clear sky rains out, and nothing steps.
  const snowShare = weather.snowShare ?? (weather.kind === 'snow' ? 1 : 0);
  const calm = weather.precipitation > 0.05 ? 0.3 : 1;
  return {
    rain: Math.round(weather.precipitation * 420 * (1 - snowShare)),
    snow: Math.round(weather.precipitation * 360 * snowShare),
    leaves: Math.round(60 * leafFall * calm),
    petals: Math.round(50 * clamp01(petals) * calm),
  };
}

export const CLOUDS = 9;
/**
 * How strong each of the nine clouds is, 0 to 1: they come in one after another as the cover grows (a clear day has
 * almost none, an overcast one all nine).
 */
export function cloudStrengths(weather) {
  return Array.from({ length: CLOUDS }, (_, i) =>
    clamp01((weather.cloud - i / (CLOUDS + 1)) * 3.2),
  );
}

/**
 * The three banks of fog (over the top of the mountain, over the forest, low over the field), 0 to 1 each. Low cloud
 * lowers a cap of fog onto the mountain top; rain brings a little mist near the ground.
 * @param {{fog: number, cloud: number, precipitation: number}} weather
 */
export function fogAt(weather) {
  return {
    cap: clamp01(weather.fog + Math.max(0, weather.cloud - 0.7) * 0.5),
    mid: clamp01(weather.fog * 0.9),
    low: clamp01(Math.max(weather.fog * 0.8, weather.precipitation * 0.25)),
  };
}
