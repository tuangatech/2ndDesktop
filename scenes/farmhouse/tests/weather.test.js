import { describe, expect, it } from 'vitest';
import {
  BLOCK_HOURS,
  KINDS,
  SNOW_BELOW,
  meanTemperature,
  snowCoverAt,
  weatherAt,
} from '../game/weather.js';

const ATLANTA = 33.7;
const SEED = 20261121;
/** A moment as the weather wants it: a day number, its day of the year, and the minute of the day. */
const when = (dayIndex, dayOfYear, hour = 12, minute = 0) => ({
  dayIndex,
  dayOfYear,
  minuteOfDay: hour * 60 + minute,
});
/** Every half hour of a day. */
function* day(dayIndex, dayOfYear) {
  for (let m = 0; m < 1440; m += 30) yield when(dayIndex, dayOfYear, 0, m);
}
/** A year of days: day index 20000 + n, day of year n + 1. */
const year = () => Array.from({ length: 365 }, (_, n) => [20000 + n, n + 1]);

describe('simulated weather', () => {
  it('is the same for the same seed, date and place, and different for another seed', () => {
    const a = weatherAt(SEED, when(20300, 120, 9, 10), ATLANTA);
    const b = weatherAt(SEED, when(20300, 120, 9, 10), ATLANTA);
    expect(a).toEqual(b);
    const kinds = (seed) =>
      year()
        .map(([i, d]) => weatherAt(seed, when(i, d, 15), ATLANTA).kind)
        .join();
    expect(kinds(SEED)).toBe(kinds(SEED));
    expect(kinds(SEED)).not.toBe(kinds(SEED + 1));
  });

  it('only gives the kinds of weather@1, with amounts between 0 and 1', () => {
    const seen = new Set();
    for (const [i, d] of year()) {
      for (const w of day(i, d)) {
        const r = weatherAt(SEED, w, ATLANTA);
        seen.add(r.kind);
        expect(KINDS).toContain(r.kind);
        for (const key of ['cloud', 'precipitation', 'fog', 'wind']) {
          expect(r[key]).toBeGreaterThanOrEqual(0);
          expect(r[key]).toBeLessThanOrEqual(1);
        }
        expect(Number.isFinite(r.temperature)).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual([...KINDS].sort()); // a year shows every kind
  });

  it('changes a few times a day, not every half hour and not once a week', () => {
    let changes = 0;
    let days = 0;
    for (const [i, d] of year().slice(0, 120)) {
      let last = null;
      for (const w of day(i, d)) {
        const kind = weatherAt(SEED, w, ATLANTA).kind;
        if (last !== null && kind !== last) changes++;
        last = kind;
      }
      days++;
    }
    const perDay = changes / days;
    expect(perDay).toBeGreaterThan(1);
    expect(perDay).toBeLessThan(BLOCK_HOURS + 1);
  });

  it('never jumps: the amounts move slowly, also over midnight and over a block edge', () => {
    let last = weatherAt(SEED, when(20000, 1, 0, 0), ATLANTA);
    for (const [i, d] of year().slice(0, 60)) {
      for (let m = 0; m < 1440; m += 5) {
        const now = weatherAt(SEED, when(i, d, 0, m), ATLANTA);
        for (const key of ['cloud', 'precipitation', 'fog', 'wind']) {
          expect(Math.abs(now[key] - last[key])).toBeLessThan(0.25);
        }
        expect(Math.abs(now.temperature - last.temperature)).toBeLessThan(1.2);
        last = now;
      }
    }
  });

  it('snow falls only when it is cold, and never in a summer month', () => {
    let snowy = 0;
    for (const [i, d] of year()) {
      for (let h = 0; h < 24; h += 4) {
        const w = weatherAt(SEED, when(i, d, h, 30), ATLANTA);
        if (w.kind === 'snow') {
          snowy++;
          // the block's temperature decided it: the temperature at the block's middle is at or under the limit
          const middle = weatherAt(SEED, when(i, d, Math.floor(h / 4) * 4 + 2, 0), ATLANTA);
          expect(middle.temperature).toBeLessThan(SNOW_BELOW + 3);
          expect(d < 152 || d >= 244).toBe(true); // not June, July, August
        }
      }
    }
    expect(snowy).toBeGreaterThan(0);
    // Atlanta in July: no snow in any year at any hour.
    for (let i = 0; i < 31; i++)
      for (const w of day(20196 + i, 196 + i))
        expect(weatherAt(SEED, w, ATLANTA).kind).not.toBe('snow');
  });

  it('is warm in July, cold in January, and a place nearer the pole is colder', () => {
    expect(meanTemperature(196, ATLANTA)).toBeGreaterThan(24);
    expect(meanTemperature(15, ATLANTA)).toBeLessThan(9);
    expect(meanTemperature(196, ATLANTA + 15)).toBeLessThan(meanTemperature(196, ATLANTA));
    // Southern half-year shift: January in Sydney is as warm as July in Atlanta (minus the cooling).
    expect(meanTemperature(15, -33.7)).toBeCloseTo(meanTemperature(197, 33.7), 0);
    // warmest in the afternoon, coldest near dawn
    const a = (hour) => weatherAt(SEED, when(20200, 200, hour, 0), ATLANTA).temperature;
    expect(a(15)).toBeGreaterThan(a(6));
  });

  it('the climate of the month decides: fog is a morning thing, storms an afternoon summer thing', () => {
    for (const [i, d] of year()) {
      const night = weatherAt(SEED, when(i, d, 14, 0), ATLANTA); // afternoon block: no fog
      expect(night.kind).not.toBe('fog');
      const summer = d >= 152 && d < 244;
      const morning = weatherAt(SEED, when(i, d, 9, 0), ATLANTA);
      if (summer) expect(morning.kind).not.toBe('storm');
    }
  });

  it('snow cover builds when it snows and melts when it warms, and never in July', () => {
    let maxWinter = 0;
    for (const [i, d] of year().filter(([, d]) => d < 60 || d > 335)) {
      maxWinter = Math.max(maxWinter, snowCoverAt(SEED, when(i, d, 12), ATLANTA));
    }
    expect(maxWinter).toBeGreaterThan(0.1);
    for (let n = 0; n < 31; n++)
      expect(snowCoverAt(SEED, when(20196 + n, 196 + n, 12), ATLANTA)).toBe(0);
    // an unusually cold place keeps snow
    const cold = year().map(([i, d]) => snowCoverAt(SEED, when(i, d, 12), 60));
    expect(Math.max(...cold)).toBeGreaterThan(0.5);
    for (const c of cold) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
