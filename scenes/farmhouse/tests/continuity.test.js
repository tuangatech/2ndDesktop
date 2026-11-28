import { describe, expect, it } from 'vitest';
import { createTime } from '../../../app/page/time.js';
import { floweringAt } from '../game/flowering.js';
import { fastDate } from '../game/fast.js';
import { fallingAt, gradeAt, skyColours, timeOfDay } from '../game/sky.js';
import { motionAt, slowAt } from '../game/view.js';
import { meanTemperature, stormness } from '../game/weather.js';

// The Mac walked the real rules one second at a time (Re W-33 to W-39) and found animals jumping a sixth of the field at
// dusk and dawn, at the start of a storm and at midnight, and windows going from dark to lit in a second. Nothing in the
// picture may step: these tests walk whole days a second at a time and look for the largest step.
const NY = 'America/New_York';
const ATLANTA = 33.7;
const SEED = 20261127;
const SECOND = 1000;
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
/** The largest change of any channel between two colours, 0 to 1. */
const colourStep = (a, b) => Math.max(...channels(a).map((v, i) => Math.abs(v - channels(b)[i])));
const at = (year, month, day, hour, offsetMin) =>
  Date.UTC(year, month - 1, day, hour, 0) - offsetMin * 60_000;

/** Walks the seconds of one stretch and returns the largest step of each thing and how many seconds were a storm. */
function walk(
  start,
  seconds,
  state = { worst: { animal: 0, light: 0, still: 0, sky: 0, grade: 0, falling: 0 }, storm: 0 },
) {
  let last = null;
  for (let s = 0; s <= seconds; s++) {
    const ms = start + s * SECOND;
    const time = createTime({
      clock: { now: () => ms },
      readZone: () => NY,
      latitude: () => ATLANTA,
    });
    const parts = time.parts();
    const slow = slowAt({
      ms,
      parts,
      sun: time.sun(),
      nightness: time.nightness(),
      latitude: ATLANTA,
      seed: SEED,
    });
    const motion = motionAt(ms, parts, slow, { seed: SEED });
    const tod = timeOfDay(ms, time.sun(), time.nightness());
    const look = {
      sky: skyColours(tod, slow.weather),
      grade: gradeAt(tod, slow.weather).multiply,
      falling: fallingAt(slow.weather, slow.season, slow.snowCover, 0),
    };
    if (slow.weather.kind === 'storm') state.storm++;
    if (last) {
      // The animals come back sorted by depth, so match them by name.
      for (const a of motion.animals) {
        const b = last.motion.animals.find((o) => o.id === a.id);
        state.worst.animal = Math.max(
          state.worst.animal,
          Math.abs(a.x - b.x),
          Math.abs(a.depth - b.depth),
        );
      }
      for (const id of Object.keys(slow.lights)) {
        state.worst.light = Math.max(
          state.worst.light,
          Math.abs(slow.lights[id] - last.slow.lights[id]),
        );
      }
      state.worst.still = Math.max(state.worst.still, Math.abs(slow.still - last.slow.still));
      state.worst.sky = Math.max(
        state.worst.sky,
        colourStep(look.sky.top, last.look.sky.top),
        colourStep(look.sky.bottom, last.look.sky.bottom),
      );
      state.worst.grade = Math.max(state.worst.grade, colourStep(look.grade, last.look.grade));
      state.worst.falling = Math.max(
        state.worst.falling,
        Math.abs(look.falling.rain - last.look.falling.rain) / 420,
        Math.abs(look.falling.snow - last.look.falling.snow) / 360,
      );
    }
    last = { motion, slow, look };
  }
  return state;
}

describe('nothing in the picture steps', () => {
  it('animals, windows and the resting weight move smoothly at the places where they used to jump', () => {
    const state = {
      worst: { animal: 0, light: 0, still: 0, sky: 0, grade: 0, falling: 0 },
      storm: 0,
    };
    // Where it happened: dusk and dawn, the start of each four-hour block of weather (a storm begins there), midnight
    // (the resting places used to change) and noon (they change now), on a winter day and on summer days with storms.
    const sunset = [-300, 17 * 60 + 15];
    const days = [
      [2026, 11, 27, -300],
      [2026, 6, 4, -240], // a storm begins at noon
      [2026, 6, 10, -240], // a storm begins at 16:00
      [2026, 7, 2, -240],
    ];
    for (const [n, [y, m, d, offset]] of days.entries()) {
      const day = at(y, m, d, 0, offset);
      for (let hour = 0; hour < 24; hour += 4)
        walk(day + hour * 3_600_000 - 150 * SECOND, 300, state);
      walk(day + 12 * 3_600_000 - 60 * SECOND, 120, state); // noon
      if (n > 1) continue; // dusk and dawn on the winter day and the first summer day
      walk(day + (m === 11 ? sunset[1] : 20 * 60 + 15) * 60_000 - 600 * SECOND, 1200, state); // dusk
      walk(day + (m === 11 ? 6 * 60 + 30 : 5 * 60 + 40) * 60_000 - 600 * SECOND, 1200, state); // dawn
    }
    expect(state.storm).toBeGreaterThan(0); // the summer days really do have a storm in them
    expect(state.worst.animal).toBeLessThan(0.05); // normal walking is at most about 0.023 a second
    expect(state.worst.light).toBeLessThan(0.08);
    expect(state.worst.still).toBeLessThan(0.02);
    expect(state.worst.sky).toBeLessThan(0.01); // the sky and the grade once went from clear to storm in one frame
    expect(state.worst.grade).toBeLessThan(0.01);
    expect(state.worst.falling).toBeLessThan(0.02);
  }, 30_000);

  it('in Fast mode the weather does not snap when the fast day changes (every 47 minutes)', () => {
    const startedAt = at(2026, 11, 27, 10, -300);
    let worst = { amount: 0, temperature: 0 };
    for (let k = 1; k <= 40; k++) {
      // The k-th change of the fast day, a second either side of it.
      const change = startedAt + Math.ceil((k * 86_400_000) / (365 / 12));
      let last = null;
      for (let s = -3; s <= 3; s++) {
        const ms = change + s * SECOND;
        const time = createTime({
          clock: { now: () => ms },
          readZone: () => NY,
          latitude: () => ATLANTA,
        });
        const slow = slowAt({
          ms,
          parts: time.parts(),
          sun: time.sun(),
          nightness: time.nightness(),
          latitude: ATLANTA,
          seed: SEED,
          fast: fastDate(ms, startedAt),
        });
        const w = slow.weather;
        if (last) {
          for (const key of ['cloud', 'precipitation', 'fog', 'wind']) {
            worst.amount = Math.max(worst.amount, Math.abs(w[key] - last[key]));
          }
          worst.temperature = Math.max(
            worst.temperature,
            Math.abs(w.temperature - last.temperature),
          );
        }
        last = w;
      }
    }
    expect(worst.amount).toBeLessThan(0.02);
    expect(worst.temperature).toBeLessThan(0.5); // it was 7 degrees
  });

  it('the storm amount rises and falls with the wind, and is nothing in rain', () => {
    expect(stormness({ kind: 'storm' })).toBeGreaterThan(0.9);
    expect(stormness({ kind: 'rain', wind: 0.55 })).toBe(0);
    expect(stormness({ kind: 'storm', wind: 0.8 })).toBeGreaterThan(0.5);
    expect(stormness({ kind: 'storm', wind: 0.7 })).toBeGreaterThan(0);
    expect(stormness({ kind: 'storm', wind: 0.7 })).toBeLessThan(stormness({ wind: 0.8 }));
    expect(stormness({ kind: 'clear' })).toBe(0);
  });
});

describe('places far from Atlanta', () => {
  it('shifts the temperature and the trees by at most twelve degrees of latitude', () => {
    // Singapore was 49 degrees in July and Oslo blossomed in July before the limit.
    expect(meanTemperature(196, 1.3)).toBeLessThan(40);
    expect(meanTemperature(196, 59.9)).toBeGreaterThan(14);
    expect(meanTemperature(15, 59.9)).toBeLessThan(meanTemperature(15, 33.7));
    const oslo = floweringAt('cherry', 150, 59.9);
    expect(oslo.blossom).toBe(floweringAt('cherry', 150, 45.7).blossom);
    expect(floweringAt('cherry', 150, 59.9)).toEqual(floweringAt('cherry', 150, 45.7));
  });
});
