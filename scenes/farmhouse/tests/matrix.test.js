import { describe, expect, it } from 'vitest';
import { createTime } from '../../../app/page/time.js';
import { KINDS } from '../game/weather.js';
import {
  fallingAt,
  gradeAt,
  skyColours,
  skyKey,
  timeOfDay,
  cloudStrengths,
  fogAt,
} from '../game/sky.js';
import { motionAt, slowAt } from '../game/view.js';
import { fastDate } from '../game/fast.js';

// Every kind of weather in every month, at the three hours that look most different, in the north and in the south, and
// in Fast mode: the view must be whole numbers in range (no NaN, no light above 1, no more sprites than the pools hold).
const MIN = 60_000;
const SEED = 20261127;
const HEX = /^#[0-9a-f]{6}$/;
const PLACES = [
  {
    name: 'Atlanta',
    zone: 'America/New_York',
    latitude: 33.7,
    offset: (m) => (m >= 3 && m <= 10 ? -240 : -300),
  },
  {
    name: 'Sydney',
    zone: 'Australia/Sydney',
    latitude: -33.9,
    offset: (m) => (m >= 4 && m <= 9 ? 600 : 660),
  },
];
/** Every number inside is finite (a null is allowed: no sun at night, no moon by day). */
const finite = (value) =>
  typeof value === 'number'
    ? Number.isFinite(value)
    : value && typeof value === 'object'
      ? Object.values(value).every(finite)
      : true;

function look(place, ms, extra = {}) {
  const time = createTime({
    clock: { now: () => ms },
    readZone: () => place.zone,
    latitude: () => place.latitude,
  });
  const parts = time.parts();
  const slow = slowAt({
    ms,
    parts,
    sun: time.sun(),
    nightness: time.nightness(),
    latitude: place.latitude,
    seed: SEED,
    ...extra,
  });
  const tod = timeOfDay(ms, time.sun(), time.nightness());
  const motion = motionAt(ms, parts, slow, { seed: SEED });
  const petals = Math.max(0, ...Object.values(slow.trees).map((t) => t.petals));
  return {
    slow,
    tod,
    motion,
    falling: fallingAt(slow.weather, slow.season, slow.snowCover, petals),
  };
}

function check(view) {
  const { slow, tod, motion, falling } = view;
  expect(
    finite([slow.weather, slow.season, slow.trees, slow.lights, slow.snowCover, tod, motion]),
  ).toBe(true);
  expect(Object.values(slow.lights).every((v) => v >= 0 && v <= 1)).toBe(true);
  expect(slow.snowCover).toBeGreaterThanOrEqual(0);
  expect(slow.snowCover).toBeLessThanOrEqual(1);
  const sky = skyColours(tod, slow.weather);
  expect(sky.top).toMatch(HEX);
  expect(sky.bottom).toMatch(HEX);
  expect(gradeAt(tod, slow.weather, 0.5).multiply).toMatch(HEX);
  expect(skyKey(tod, slow.weather)).not.toMatch(/NaN/);
  expect(falling.rain).toBeLessThanOrEqual(420);
  expect(falling.snow).toBeLessThanOrEqual(360);
  expect(falling.leaves).toBeLessThanOrEqual(36);
  expect(falling.petals).toBeLessThanOrEqual(50);
  expect(falling.rain === 0 || falling.snow === 0 || slow.weather.snowShare > 0).toBe(true);
  expect(cloudStrengths(slow.weather)).toHaveLength(9);
  const fog = fogAt(slow.weather);
  for (const v of Object.values(fog)) expect(v).toBeGreaterThanOrEqual(0);
  expect(motion.animals).toHaveLength(7);
  expect(motion.animals.every((a) => a.x >= 0 && a.x <= 1 && a.scale > 0)).toBe(true);
}

describe('every weather in every month', () => {
  for (const place of PLACES) {
    it(`${place.name}: the twelve months, morning, midday and night, the simulation and each kind of weather`, () => {
      let views = 0;
      for (let month = 1; month <= 12; month++) {
        for (const [hour, minute] of [
          [6, 30],
          [12, 0],
          [22, 30],
        ]) {
          const ms = Date.UTC(2026, month - 1, 15, hour, minute) - place.offset(month) * MIN;
          check(look(place, ms));
          views++;
          for (const kind of KINDS) {
            const view = look(place, ms, { previewKind: kind });
            check(view);
            expect(view.slow.weather.kind).toBe(kind);
            views++;
          }
        }
      }
      expect(views).toBe(12 * 3 * (1 + KINDS.length));
    });
  }

  it('the four season previews with each kind, and Fast mode through a whole fast year', () => {
    const place = PLACES[0];
    const ms = Date.UTC(2026, 9, 20, 16, 0);
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      for (const kind of [null, ...KINDS]) {
        const view = look(place, ms, { previewSeason: season, previewKind: kind });
        check(view);
        expect(view.slow.season.name).toBe(season);
      }
    }
    // Twelve real days of Fast mode, every six hours: all twelve months come by, in order.
    const startedAt = Date.UTC(2026, 10, 27, 15, 0);
    const seen = new Set();
    for (let step = 0; step < 12 * 4; step++) {
      const at = startedAt + step * 6 * 60 * MIN;
      const view = look(place, at, { fast: fastDate(at, startedAt) });
      check(view);
      seen.add(view.slow.season.name);
    }
    expect([...seen].sort()).toEqual(['autumn', 'spring', 'summer', 'winter']);
  });
});
