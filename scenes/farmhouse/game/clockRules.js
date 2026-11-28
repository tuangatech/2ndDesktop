// The rules of the farm house that follow the computer's clock (docs/scenes/farmhouse.md section 4.1): window lights
// (R3), chimney smoke (R4) and the truck (R5). Pure, no Pixi, no clock: every function takes the moment and what it
// needs (the sun, the weather) and gives the state at that moment. Nothing here is a timer, so after a pause of any
// length the scene is right at once (R1).

import { smooth, unit } from './hash.js';
import { stormness } from './weather.js';

const MIN = 60_000;
const SEC = 1000;

// ---------------------------------------------------------------------------------------------------------------------
// R3: window lights

/** The six lit windows: three upstairs, two downstairs, and the glass of the door. */
export const WINDOWS = ['up-left', 'up-mid', 'up-right', 'down-left', 'down-right', 'door'];
const FLOOR = {
  'up-left': 'up',
  'up-mid': 'up',
  'up-right': 'up',
  'down-left': 'down',
  'down-right': 'down',
  door: 'door',
};
/** Each window comes on within this long after sunset, and fades over `FADE_MS`. */
const COME_ON_WITHIN = 20 * MIN;
const FADE_MS = 30 * SEC;
/** Upstairs goes out between 22:00 and 22:30 of the computer's clock, downstairs between 23:00 and 23:30. */
const OUT_AT = { up: 22 * 60, down: 23 * 60 };
const OUT_WITHIN = 30;

const fade = (sinceMs) => smooth(sinceMs / FADE_MS);

/**
 * How lit each window is, 0 to 1.
 * @param {number} ms  the moment (epoch ms)
 * @param {{minuteOfDay: number}} parts  the computer's wall clock at that moment (`host.time.parts()`)
 * @param {{sunrise: number|null, sunset: number|null, polar: 'day'|'night'|null}} sun  of the day of `ms`
 * @param {{kind: string, fog: number}} weather  a storm or thick fog lights the windows by day too
 * @param {number} seed
 * @returns {Record<string, number>}
 */
export function windowLights(ms, parts, sun, weather, seed = 0) {
  // Both amounts cross-fade between the blocks of weather, so the windows light up over the half hour, never at once.
  const gloom = Math.max(stormness(weather), smooth((weather.fog - 0.7) / 0.3));
  const midnight = ms - parts.minuteOfDay * MIN;
  const lights = {};
  for (const [index, id] of WINDOWS.entries()) {
    const floor = FLOOR[id];
    let night = 0;
    if (sun.polar === 'night') {
      night = floor === 'door' ? 1 : outFade(ms, midnight, floor, index, seed);
    } else if (sun.polar !== 'day') {
      const onAt = sun.sunset + unit(seed, index, 11) * COME_ON_WITHIN;
      if (floor === 'door') {
        // The lamp stays on all night: it comes on after sunset and goes out a little after sunrise.
        const offAt = sun.sunrise + unit(seed, index, 12) * 10 * MIN;
        night = ms >= onAt ? fade(ms - onAt) : 1 - fade(ms - offAt);
      } else if (ms >= onAt) {
        night = fade(ms - onAt) * outFade(ms, midnight, floor, index, seed);
      }
    }
    // By day in a storm or thick fog, the lights are on (a little dimmer than at night).
    lights[id] = Math.max(night, 0.85 * gloom);
  }
  return lights;
}

/** 1 until the window's own time to go out (22:00 to 22:30 or 23:00 to 23:30 of that evening), then 0 after a fade. */
function outFade(ms, midnight, floor, index, seed) {
  const outAt = midnight + (OUT_AT[floor] + unit(seed, index, 13) * OUT_WITHIN) * MIN;
  return 1 - fade(ms - outAt);
}

// ---------------------------------------------------------------------------------------------------------------------
// R4: chimney smoke

/** Smoke shows only when it is this cool or cooler (degrees C), so there is hardly any in summer. */
export const SMOKE_AT_OR_BELOW = 15;
const SMOKE_FADE_IN = 10;
const SMOKE_FADE_OUT = 20;
const SMOKE_SECONDS = 120;

/**
 * The smoke amount, 0 to 1: light smoke from hh:00:00 to hh:02:00 at every full hour of the computer's clock, fading in
 * over about 10 seconds and out over about 20, only in the cool part of the year.
 * @param {number} ms
 * @param {{minute: number, second: number}} parts  the computer's wall clock at `ms`
 * @param {number} temperature  degrees C at the place (live, or simulated)
 */
export function smokeAmount(ms, parts, temperature) {
  if (!(temperature <= SMOKE_AT_OR_BELOW)) return 0;
  const second = parts.minute * 60 + parts.second + (((ms % 1000) + 1000) % 1000) / 1000;
  if (second >= SMOKE_SECONDS) return 0;
  if (second < SMOKE_FADE_IN) return smooth(second / SMOKE_FADE_IN);
  if (second > SMOKE_SECONDS - SMOKE_FADE_OUT)
    return smooth((SMOKE_SECONDS - second) / SMOKE_FADE_OUT);
  return 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// R5: the truck

/** A trip starts at :07, :22, :37 and :52. */
export const TRIP_MINUTE = 7;
const QUARTER = 900; // seconds
/** Seconds: reversing out (nose still to the left), turning, driving off forward; then away; then coming back forward. */
export const TRIP = Object.freeze({ reverse: 5, turn: 2, drive: 13, away: 300, back: 20 });
/** How far the truck backs out, as a share of the way to the edge of the screen. */
const BACKED_OUT = 0.06;

/**
 * Whether a trip that would start at `startMs` goes: by day only (from sunrise to six minutes before sunset, so it is
 * home before dark), and not in a storm or on deep snow. A trip that has begun always ends, whatever happens.
 * @param {number} startMs
 * @param {{sunrise: number|null, sunset: number|null, polar: 'day'|'night'|null}} sun
 * @param {{kind: string}} weather
 * @param {number} snowCover  0 to 1
 */
export function tripAllowed(startMs, sun, weather, snowCover) {
  if (weather.kind === 'storm' || snowCover >= 0.6) return false;
  if (sun.polar === 'night') return false;
  if (sun.polar === 'day') return true;
  return startMs >= sun.sunrise && startMs <= sun.sunset - 6 * MIN;
}

/**
 * Where the truck is, as a function of the minute of the quarter hour.
 * @param {number} ms
 * @param {(startMs: number) => boolean} allowed  whether the trip that started at `startMs` goes (see `tripAllowed`)
 * @returns {{phase: 'parked'|'reverse'|'turn'|'drive'|'away'|'back', x: number, facing: 'left'|'right', visible: boolean}}
 *          `x` is 0 parked at the drive, about 0.06 backed out, and 1 at the edge of the screen on the right; `facing` is
 *          the way the nose points (the sprite is mirrored for 'right')
 */
export function truckAt(ms, allowed) {
  const quarterSeconds = (((ms / SEC) % QUARTER) + QUARTER) % QUARTER;
  const t = (quarterSeconds - TRIP_MINUTE * 60 + QUARTER) % QUARTER; // seconds since the trip's start (:07 of the quarter)
  const startMs = ms - t * SEC;
  const parked = { phase: 'parked', x: 0, facing: 'left', visible: true };
  const total = TRIP.reverse + TRIP.turn + TRIP.drive + TRIP.away + TRIP.back;
  if (t >= total || !allowed(startMs)) return parked;
  let at = t;
  if (at < TRIP.reverse) {
    return {
      phase: 'reverse',
      x: BACKED_OUT * smooth(at / TRIP.reverse),
      facing: 'left',
      visible: true,
    };
  }
  at -= TRIP.reverse;
  if (at < TRIP.turn)
    return {
      phase: 'turn',
      x: BACKED_OUT,
      facing: at < TRIP.turn / 2 ? 'left' : 'right',
      visible: true,
    };
  at -= TRIP.turn;
  if (at < TRIP.drive) {
    const x = BACKED_OUT + (1 - BACKED_OUT) * (at / TRIP.drive) ** 2; // pulls away, speeding up
    return { phase: 'drive', x, facing: 'right', visible: x < 1 };
  }
  at -= TRIP.drive;
  if (at < TRIP.away) return { phase: 'away', x: 1, facing: 'right', visible: false };
  at -= TRIP.away;
  // Back from the right, forward with the nose to the left, slowing to a stop at the drive.
  const k = at / TRIP.back;
  const x = (1 - k) ** 2;
  return { phase: 'back', x: Math.max(0, x), facing: 'left', visible: x < 1 };
}
