import { describe, expect, it } from 'vitest';
import {
  createTime,
  dayOfYear,
  localParts,
  nightnessAt,
  standardOffsetMinutes,
  sunTimes,
  zoneOffsetMinutes,
} from '../../app/page/time.js';

const MIN = 60_000;
const NY = 'America/New_York';
const ATLANTA = 33.7;
// A moment given on the wall of a zone with a known offset (minutes east of UTC).
const at = (y, m, d, h, mi, offset) => Date.UTC(y, m - 1, d, h, mi) - offset * MIN;
const clockOf = (ms) => ({ now: () => ms });
const minutes = (ms) => ms / MIN;

describe('zone offsets', () => {
  it('reads the offset of a zone at a moment, with daylight saving', () => {
    expect(zoneOffsetMinutes(NY, at(2026, 1, 15, 12, 0, -300))).toBe(-300);
    expect(zoneOffsetMinutes(NY, at(2026, 7, 15, 12, 0, -240))).toBe(-240);
    expect(zoneOffsetMinutes('Asia/Ho_Chi_Minh', at(2026, 7, 15, 12, 0, 420))).toBe(420);
    expect(zoneOffsetMinutes('Australia/Sydney', at(2026, 1, 15, 12, 0, 660))).toBe(660);
  });

  it('the standard offset is the smaller one, in both hemispheres and for a zone with no daylight saving', () => {
    const july = at(2026, 7, 15, 12, 0, 0);
    expect(standardOffsetMinutes(NY, july)).toBe(-300);
    expect(standardOffsetMinutes('Australia/Sydney', july)).toBe(600);
    expect(standardOffsetMinutes('Asia/Ho_Chi_Minh', july)).toBe(420);
    expect(standardOffsetMinutes('UTC', july)).toBe(0);
  });
});

describe('local parts', () => {
  it('gives the date and time on the wall of the zone', () => {
    const parts = localParts(at(2026, 10, 20, 18, 30, -240), -240);
    expect(parts).toMatchObject({
      year: 2026,
      month: 10,
      day: 20,
      hour: 18,
      minute: 30,
      second: 0,
    });
    expect(parts.minuteOfDay).toBe(18 * 60 + 30);
    expect(parts.dayOfYear).toBe(dayOfYear(2026, 10, 20));
    expect(parts.weekday).toBe(2); // a Tuesday
  });

  it('counts the day of the year', () => {
    expect(dayOfYear(2026, 1, 1)).toBe(1);
    expect(dayOfYear(2026, 12, 31)).toBe(365);
    expect(dayOfYear(2028, 12, 31)).toBe(366);
  });

  it('a moment just after local midnight is the new day (the date follows the zone, not UTC)', () => {
    const parts = localParts(at(2026, 3, 1, 0, 5, -300), -300);
    expect(parts).toMatchObject({ month: 3, day: 1, hour: 0, minute: 5 });
  });
});

describe('sunrise and sunset', () => {
  const zoneAt = (offsetMinutes, standardOffsetMinutes) => ({
    offsetMinutes,
    standardOffsetMinutes,
  });

  it('the day is about 14 h 17 min long in Atlanta at midsummer and 9 h 58 min at midwinter', () => {
    const summer = sunTimes(at(2026, 6, 21, 12, 0, -240), ATLANTA, zoneAt(-240, -300));
    const winter = sunTimes(at(2026, 12, 21, 12, 0, -300), ATLANTA, zoneAt(-300, -300));
    expect(Math.abs(summer.dayLengthMinutes - (14 * 60 + 17))).toBeLessThan(8);
    expect(Math.abs(winter.dayLengthMinutes - (9 * 60 + 58))).toBeLessThan(8);
    expect(summer.polar).toBeNull();
  });

  it('solar noon follows the standard offset: close to 12:00 in winter and 13:00 in summer on the wall', () => {
    const summer = sunTimes(at(2026, 6, 21, 9, 0, -240), ATLANTA, zoneAt(-240, -300));
    const winter = sunTimes(at(2026, 12, 21, 9, 0, -300), ATLANTA, zoneAt(-300, -300));
    expect(Math.abs(minutes(summer.noon - at(2026, 6, 21, 13, 0, -240)))).toBeLessThan(4);
    expect(Math.abs(minutes(winter.noon - at(2026, 12, 21, 12, 0, -300)))).toBeLessThan(4);
  });

  it('noon in January and in July is the same standard moment (no hour of drift from daylight saving)', () => {
    // Both are measured against the standard offset: July noon on the wall is one hour later than January noon.
    const jan = sunTimes(at(2026, 1, 15, 8, 0, -300), ATLANTA, zoneAt(-300, -300));
    const jul = sunTimes(at(2026, 7, 15, 8, 0, -240), ATLANTA, zoneAt(-240, -300));
    const wallNoon = (sun, offset) => localParts(sun.noon, offset).minuteOfDay;
    expect(wallNoon(jul, -240) - wallNoon(jan, -300)).toBeGreaterThan(55);
    expect(wallNoon(jul, -240) - wallNoon(jan, -300)).toBeLessThan(65);
  });

  it('sunrise comes before noon and sunset after, for the same local day, wherever on the wall the moment is', () => {
    for (const hour of [0, 6, 12, 18, 23]) {
      const sun = sunTimes(at(2026, 4, 10, hour, 30, -240), ATLANTA, zoneAt(-240, -300));
      expect(sun.sunrise).toBeLessThan(sun.noon);
      expect(sun.sunset).toBeGreaterThan(sun.noon);
      expect(sun.noon).toBe(
        sunTimes(at(2026, 4, 10, 12, 0, -240), ATLANTA, zoneAt(-240, -300)).noon,
      );
    }
  });

  it('the southern hemisphere has the opposite year, and the equator has a day of about 12 hours', () => {
    const south = sunTimes(at(2026, 12, 21, 12, 0, 660), -33.9, zoneAt(660, 600));
    expect(south.dayLengthMinutes).toBeGreaterThan(14 * 60);
    const equator = sunTimes(at(2026, 3, 20, 12, 0, 420), 0, zoneAt(420, 420));
    expect(Math.abs(equator.dayLengthMinutes - 12 * 60)).toBeLessThan(10);
  });

  it('a day that is longer in June than in March than in December at one latitude', () => {
    const length = (m, d, offset) =>
      sunTimes(at(2026, m, d, 12, 0, offset), ATLANTA, zoneAt(offset, -300)).dayLengthMinutes;
    expect(length(6, 21, -240)).toBeGreaterThan(length(3, 20, -240));
    expect(length(3, 20, -300)).toBeGreaterThan(length(12, 21, -300));
  });

  it('polar day and polar night give no sunrise and do not throw', () => {
    const day = sunTimes(at(2026, 6, 21, 12, 0, 60), 80, zoneAt(60, 60));
    const night = sunTimes(at(2026, 12, 21, 12, 0, 60), 80, zoneAt(60, 60));
    expect(day).toMatchObject({ polar: 'day', sunrise: null, sunset: null });
    expect(night).toMatchObject({ polar: 'night', sunrise: null, sunset: null });
    expect(nightnessAt(day.noon, day)).toBe(0);
    expect(nightnessAt(night.noon, night)).toBe(1);
  });
});

describe('nightness', () => {
  const sun = sunTimes(at(2026, 10, 20, 12, 0, -240), ATLANTA, {
    offsetMinutes: -240,
    standardOffsetMinutes: -300,
  });

  it('is 0 at noon, 1 at midnight and falls smoothly through dusk and dawn', () => {
    expect(nightnessAt(sun.noon, sun)).toBe(0);
    expect(nightnessAt(sun.noon + 12 * 60 * MIN, sun)).toBe(1);
    let last = nightnessAt(sun.sunset - 30 * MIN, sun);
    for (let t = sun.sunset - 30 * MIN; t <= sun.sunset + 60 * MIN; t += MIN) {
      const n = nightnessAt(t, sun);
      expect(n).toBeGreaterThanOrEqual(last);
      expect(n - last).toBeLessThan(0.05); // no jump
      last = n;
    }
    expect(nightnessAt(sun.sunset, sun)).toBeGreaterThan(0.1);
    expect(nightnessAt(sun.sunset, sun)).toBeLessThan(0.9);
    expect(nightnessAt(sun.sunrise, sun)).toBeGreaterThan(0.1);
    expect(nightnessAt(sun.sunrise, sun)).toBeLessThan(0.9);
  });
});

describe('host.time', () => {
  it('follows the clock it is given, and the zone of the computer', () => {
    const ms = at(2026, 10, 20, 18, 30, -240);
    const time = createTime({ clock: clockOf(ms), readZone: () => NY, latitude: () => ATLANTA });
    expect(time.zone()).toBe(NY);
    expect(time.parts()).toMatchObject({ month: 10, day: 20, hour: 18, minute: 30 });
    const sun = time.sun();
    expect(sun.sunset).toBeGreaterThan(ms - 3 * 60 * MIN);
    expect(time.nightness()).toBeLessThan(0.5);
    expect(time.nightness(sun.sunset + 2 * 60 * MIN)).toBe(1);
  });

  it('reads the zone again when the computer travels (at most once a minute of clock time)', () => {
    let now = at(2026, 1, 15, 12, 0, -300);
    let zone = NY;
    let reads = 0;
    const time = createTime({
      clock: { now: () => now },
      readZone: () => {
        reads++;
        return zone;
      },
      latitude: () => ATLANTA,
    });
    expect(time.parts().hour).toBe(12);
    time.parts();
    time.parts();
    expect(reads).toBe(1); // cached within the minute
    zone = 'Europe/London';
    now += 2 * MIN;
    expect(time.parts().hour).toBe(17); // 12:00 in New York is 17:00 in London in January
    expect(reads).toBe(2);
  });

  it('the place sets the length of the day but never moves the clock', () => {
    const ms = at(2026, 6, 21, 12, 0, -240);
    const north = createTime({ clock: clockOf(ms), readZone: () => NY, latitude: () => 60 });
    const south = createTime({ clock: clockOf(ms), readZone: () => NY, latitude: () => ATLANTA });
    expect(north.parts()).toEqual(south.parts());
    expect(north.sun().noon).toBe(south.sun().noon);
    expect(north.sun().dayLengthMinutes).toBeGreaterThan(south.sun().dayLengthMinutes);
  });
});
