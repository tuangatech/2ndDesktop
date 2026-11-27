import { describe, expect, it } from 'vitest';
import { createTime, localParts } from '../../../app/page/time.js';
import {
  SMOKE_AT_OR_BELOW,
  TRIP,
  WINDOWS,
  smokeAmount,
  tripAllowed,
  truckAt,
  windowLights,
} from '../game/clockRules.js';

const MIN = 60_000;
const SEC = 1000;
const NY = 'America/New_York';
const ATLANTA = 33.7;
const CLEAR = { kind: 'clear', fog: 0 };
/** A moment on the wall of New York (the offset of that date: -240 from March to November, else -300). */
const at = (y, m, d, h, mi, s = 0) => {
  const offset = m >= 4 && m <= 10 ? -240 : -300;
  return Date.UTC(y, m - 1, d, h, mi, s) - offset * MIN;
};
const timeAt = (ms) =>
  createTime({ clock: { now: () => ms }, readZone: () => NY, latitude: () => ATLANTA });
const lightsAt = (ms, weather = CLEAR, seed = 7) => {
  const time = timeAt(ms);
  return windowLights(ms, time.parts(), time.sun(), weather, seed);
};
const values = (lights) => WINDOWS.map((id) => lights[id]);

describe('R3 window lights', () => {
  it('are dark by day in fair weather', () => {
    for (const [m, d] of [
      [6, 21],
      [10, 20],
      [12, 21],
    ]) {
      expect(values(lightsAt(at(2026, m, d, 12, 0)))).toEqual([0, 0, 0, 0, 0, 0]);
    }
  });

  it('come on within 20 minutes after sunset, each at its own time, with a fade', () => {
    for (const [m, d] of [
      [6, 21],
      [10, 20],
      [12, 21],
    ]) {
      const noon = at(2026, m, d, 12, 0);
      const sun = timeAt(noon).sun();
      const light = (offsetMin) => lightsAt(sun.sunset + offsetMin * MIN);
      expect(values(light(-5)).every((v) => v === 0)).toBe(true); // not before sunset
      const during = values(light(10));
      expect(during.some((v) => v > 0)).toBe(true);
      expect(during.some((v) => v < 1)).toBe(true); // they do not all switch at once
      expect(values(light(21)).every((v) => v > 0.99)).toBe(true);
    }
  });

  it('upstairs goes out between 22:00 and 22:30, downstairs between 23:00 and 23:30, the door lamp stays on all night', () => {
    const l = (h, mi) => lightsAt(at(2026, 10, 20, h, mi));
    const up = ['up-left', 'up-mid', 'up-right'];
    const down = ['down-left', 'down-right'];
    expect(up.every((id) => l(21, 59)[id] > 0.99)).toBe(true);
    expect(up.every((id) => l(22, 31)[id] === 0)).toBe(true);
    // each window has its own moment inside the half hour (a fade of 30 seconds, so a minute scan sees it)
    for (const id of up) {
      const out = Array.from({ length: 40 }, (_, i) => l(21, 50 + i)[id]).findIndex((v) => v === 0);
      expect(out).toBeGreaterThanOrEqual(10);
      expect(out).toBeLessThanOrEqual(41);
    }
    expect(down.every((id) => l(22, 59)[id] > 0.99)).toBe(true);
    expect(down.every((id) => l(23, 31)[id] === 0)).toBe(true);
    for (const [h, mi] of [
      [19, 0],
      [22, 31],
      [23, 31],
      [2, 0],
      [5, 0],
    ]) {
      expect(l(h, mi).door).toBeGreaterThan(0.99);
    }
    // and in the morning: out a little after sunrise, dark by day
    expect(l(12, 0).door).toBe(0);
    for (const id of [...up, ...down]) expect(l(5, 0)[id]).toBe(0); // out since the evening, not on again before dusk
  });

  it('follows the season: dusk is earlier in December and later in June, and 7 PM is not the rule', () => {
    const lit = (m, d, h, mi) => lightsAt(at(2026, m, d, h, mi))['up-mid'];
    expect(lit(12, 21, 17, 45)).toBeGreaterThan(0.9); // already lit at 17:45 in midwinter
    expect(lit(6, 21, 19, 0)).toBe(0); // still light at 19:00 at midsummer
    expect(lit(6, 21, 21, 0)).toBeGreaterThan(0.9);
  });

  it('are on by day in a storm or in thick fog, and not in light fog or rain', () => {
    const noon = at(2026, 10, 20, 12, 0);
    expect(values(lightsAt(noon, { kind: 'storm', fog: 0 })).every((v) => v > 0.8)).toBe(true);
    expect(values(lightsAt(noon, { kind: 'fog', fog: 1 })).every((v) => v > 0.8)).toBe(true);
    expect(values(lightsAt(noon, { kind: 'fog', fog: 0.5 })).every((v) => v === 0)).toBe(true);
    expect(values(lightsAt(noon, { kind: 'rain', fog: 0.1 })).every((v) => v === 0)).toBe(true);
  });

  it('are the same for the same moment and seed, and a gap of any length lands in the right state', () => {
    const t = at(2026, 12, 21, 20, 0);
    expect(lightsAt(t)).toEqual(lightsAt(t));
    const dusk = timeAt(t).sun().sunset + 5 * MIN;
    expect(lightsAt(dusk, CLEAR, 1)).not.toEqual(lightsAt(dusk, CLEAR, 2));
    // a state is a function of the time: nothing to catch up
    const day = (n) => lightsAt(at(2026, 12, 21, 20, 0) + n * 86_400_000);
    expect(Object.values(day(0)).every((v) => v > 0.99)).toBe(true);
  });

  it('polar night and polar day do not throw', () => {
    const polar = { sunrise: null, sunset: null };
    const parts = localParts(at(2026, 12, 21, 12, 0), -300);
    expect(() =>
      windowLights(at(2026, 12, 21, 12, 0), parts, { ...polar, polar: 'night' }, CLEAR),
    ).not.toThrow();
    expect(
      values(windowLights(0, parts, { ...polar, polar: 'day' }, CLEAR)).every((v) => v === 0),
    ).toBe(true);
    expect(windowLights(0, parts, { ...polar, polar: 'night' }, CLEAR).door).toBe(1);
  });
});

describe('R4 chimney smoke', () => {
  const smoke = (h, mi, s, temp = 12, offset = -240) => {
    const ms = Date.UTC(2026, 9, 20, h, mi, s) - offset * MIN;
    return smokeAmount(ms, localParts(ms, offset), temp);
  };

  it('shows from hh:00:00 to hh:02:00 and not outside, at every full hour', () => {
    for (const h of [0, 7, 9, 12, 15, 23]) {
      expect(smoke(h, 59, 59)).toBe(0);
      expect(smoke(h, 0, 0)).toBe(0);
      expect(smoke(h, 0, 30)).toBe(1);
      expect(smoke(h, 1, 30)).toBe(1);
      expect(smoke(h, 2, 0)).toBe(0);
      expect(smoke(h, 2, 1)).toBe(0);
      expect(smoke(h, 30, 0)).toBe(0);
    }
  });

  it('fades in over about 10 seconds and out over about 20, without a jump', () => {
    let last = 0;
    for (let ms = 0; ms <= 125 * SEC; ms += 250) {
      const base = Date.UTC(2026, 9, 20, 12, 0, 0) + ms;
      const v = smokeAmount(base, localParts(base, 0), 12);
      expect(Math.abs(v - last)).toBeLessThan(0.1);
      last = v;
    }
    expect(smoke(12, 0, 5)).toBeGreaterThan(0.2);
    expect(smoke(12, 0, 5)).toBeLessThan(0.8);
    expect(smoke(12, 1, 50)).toBeGreaterThan(0.2);
    expect(smoke(12, 1, 50)).toBeLessThan(0.8);
  });

  it('only in the cool part of the year: 15 degrees or cooler', () => {
    expect(SMOKE_AT_OR_BELOW).toBe(15);
    expect(smoke(12, 0, 30, 15)).toBe(1);
    expect(smoke(12, 0, 30, 15.1)).toBe(0);
    expect(smoke(12, 0, 30, 28)).toBe(0);
    expect(smoke(12, 0, 30, -5)).toBe(1);
    expect(smoke(12, 0, 30, NaN)).toBe(0);
  });

  it('follows the full hour of the computer, also in a zone with a half-hour offset', () => {
    // India is UTC+5:30: its full hour is 30 minutes off the UTC hour.
    expect(smoke(12, 0, 30, 12, 330)).toBe(1);
    const ms = Date.UTC(2026, 9, 20, 12, 30, 30) - 0; // 18:00:30 on the wall of India
    expect(smokeAmount(ms, localParts(ms, 330), 12)).toBe(1);
    const off = Date.UTC(2026, 9, 20, 12, 0, 30);
    expect(smokeAmount(off, localParts(off, 330), 12)).toBe(0); // 17:30:30 on that wall
  });
});

describe('R5 the truck', () => {
  const always = () => true;
  const truck = (h, mi, s = 0, allowed = always) =>
    truckAt(at(2026, 10, 20, h, mi, 0) + s * SEC, allowed);

  it('is parked at the drive nose to the left, except on a trip that starts at :07, :22, :37 and :52', () => {
    for (const mi of [0, 5, 6, 14, 15, 20, 21, 30, 36, 45, 51])
      expect(truck(12, mi).phase).toBe('parked');
    for (const mi of [7, 22, 37, 52]) {
      expect(truck(12, mi, 4).phase).toBe('reverse');
      expect(truck(12, mi, 0).phase).toBe('reverse');
    }
    expect(truck(12, 6, 59)).toMatchObject({
      phase: 'parked',
      x: 0,
      facing: 'left',
      visible: true,
    });
  });

  it('backs out with the nose to the left, turns, drives off forward, is away, and comes back forward', () => {
    expect(truck(12, 7, 3)).toMatchObject({ phase: 'reverse', facing: 'left' });
    expect(truck(12, 7, 3).x).toBeGreaterThan(0);
    expect(truck(12, 7, 5.5)).toMatchObject({ phase: 'turn', facing: 'left' });
    expect(truck(12, 7, 6.5)).toMatchObject({ phase: 'turn', facing: 'right' });
    expect(truck(12, 7, 12)).toMatchObject({ phase: 'drive', facing: 'right', visible: true });
    expect(truck(12, 7, 25)).toMatchObject({ phase: 'away', visible: false });
    expect(truck(12, 10, 0)).toMatchObject({ phase: 'away', visible: false }); // 5 minutes away
    expect(truck(12, 12, 30)).toMatchObject({ phase: 'back', facing: 'left', visible: true });
    expect(truck(12, 12, 50)).toMatchObject({ phase: 'parked', x: 0, facing: 'left' });
  });

  it('a trip is about 20 seconds out, 5 minutes away and 20 seconds back', () => {
    expect(TRIP.reverse + TRIP.turn + TRIP.drive).toBe(20);
    expect(TRIP.away).toBe(300);
    expect(TRIP.back).toBe(20);
  });

  it('moves continuously: no jump of the place from one tenth of a second to the next, and never outside the lane', () => {
    let last = truckAt(at(2026, 10, 20, 12, 6, 50), always);
    for (let ms = 0; ms <= 60 * SEC * 2; ms += 100) {
      const now = truckAt(at(2026, 10, 20, 12, 7, 0) + ms - 10_000, always);
      expect(now.x).toBeGreaterThanOrEqual(0);
      expect(now.x).toBeLessThanOrEqual(1);
      expect(Math.abs(now.x - last.x)).toBeLessThan(0.02);
      last = now;
    }
    for (let ms = 0; ms <= 60 * SEC; ms += 100) {
      const now = truckAt(at(2026, 10, 20, 12, 12, 20) + ms, always);
      expect(Math.abs(now.x - last.x)).toBeLessThan(0.02);
      last = now;
    }
  });

  it('is at the same place for the same minute of the quarter hour, on any quarter', () => {
    const a = truck(12, 7, 14);
    for (const [h, mi] of [
      [12, 22],
      [12, 37],
      [12, 52],
      [15, 7],
    ])
      expect(truck(h, mi, 14)).toEqual(a);
  });

  it('stays parked when the trip is not allowed (night, storm, deep snow), and a started trip always ends', () => {
    expect(truck(12, 7, 12, () => false)).toMatchObject({ phase: 'parked', x: 0 });
    const noon = at(2026, 10, 20, 12, 0);
    const sun = timeAt(noon).sun();
    const fine = { kind: 'clear' };
    expect(tripAllowed(noon, sun, fine, 0)).toBe(true);
    expect(tripAllowed(noon, sun, { kind: 'storm' }, 0)).toBe(false);
    expect(tripAllowed(noon, sun, fine, 0.8)).toBe(false);
    expect(tripAllowed(sun.sunrise - 5 * MIN, sun, fine, 0)).toBe(false); // before sunrise
    expect(tripAllowed(sun.sunset - 3 * MIN, sun, fine, 0)).toBe(false); // too late to be home before dark
    expect(tripAllowed(sun.sunset + 30 * MIN, sun, fine, 0)).toBe(false); // night
    expect(tripAllowed(noon, { sunrise: null, sunset: null, polar: 'night' }, fine, 0)).toBe(false);
    expect(tripAllowed(noon, { sunrise: null, sunset: null, polar: 'day' }, fine, 0)).toBe(true);
    // the allowed test is made at the trip's start, so a trip that began before sunset finishes after it
    const start = Math.floor((sun.sunset - 8 * MIN) / (15 * MIN)) * 15 * MIN + 7 * MIN;
    const allowed = (startMs) => tripAllowed(startMs, sun, fine, 0);
    const inTrip = truckAt(start + 200 * SEC, allowed);
    expect(allowed(start)).toBe(start <= sun.sunset - 6 * MIN);
    expect(inTrip.phase === 'away' || inTrip.phase === 'parked').toBe(true);
  });

  it('all through a day and a night, the truck is never seen at night in fair weather', () => {
    const noon = at(2026, 12, 21, 12, 0);
    const time = timeAt(noon);
    const sun = time.sun();
    const allowed = (startMs) => tripAllowed(startMs, sun, CLEAR, 0);
    for (let ms = sun.sunset + 10 * MIN; ms < sun.sunset + 12 * 60 * MIN; ms += 10 * SEC) {
      expect(truckAt(ms, allowed).phase).toBe('parked');
    }
  });
});
