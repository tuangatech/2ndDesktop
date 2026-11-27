import { describe, expect, it } from 'vitest';
import { createTime } from '../../../app/page/time.js';
import { motionAt, slowAt } from '../game/view.js';

const MIN = 60_000;
const NY = 'America/New_York';
const ATLANTA = 33.7;
const SEED = 20261127;
const at = (m, d, h, mi, s = 0) =>
  Date.UTC(2026, m - 1, d, h, mi, s) - (m >= 4 && m <= 10 ? -240 : -300) * MIN;
const make = (ms, extra = {}) => {
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
    ...extra,
  });
  return { parts, slow, motion: motionAt(ms, parts, slow, { seed: SEED }) };
};

describe('the view of a moment', () => {
  it('puts the rules together: season, weather, lights, smoke, truck, animals', () => {
    const { slow, motion } = make(at(10, 20, 12, 0, 30));
    expect(slow.season.name).toBe('autumn');
    expect(Object.keys(slow.trees).sort()).toEqual(['cherry', 'dogwood', 'peach', 'redbud']);
    expect(Object.keys(slow.lights)).toHaveLength(6);
    expect(motion.animals).toHaveLength(7);
    expect(motion.truck.phase).toBe('parked');
    expect(motion.smoke === 0 || motion.smoke === 1).toBe(true);
  });

  it('is the same for the same moment, whatever came before (R1)', () => {
    const ms = at(11, 3, 17, 30);
    const plain = ({ slow, ...rest }) => ({
      ...rest,
      slow: { ...slow, tripAllowed: slow.tripAllowed(ms) },
    });
    expect(plain(make(ms))).toEqual(plain(make(ms)));
  });

  it('a season preview pins the middle of that season and is not the real date', () => {
    const july = make(at(1, 20, 12, 0), { previewSeason: 'summer' }).slow;
    expect(july.season.name).toBe('summer');
    expect(july.when.dayOfYear).toBe(196);
    expect(make(at(7, 20, 12, 0), { previewSeason: 'winter' }).slow.season.name).toBe('winter');
  });

  it('a weather preview pins the kind (snow puts snow on the ground); the simulation is left alone', () => {
    const plain = make(at(10, 20, 12, 0)).slow;
    const storm = make(at(10, 20, 12, 0), { previewKind: 'storm' }).slow;
    expect(storm.weather).toMatchObject({ kind: 'storm', precipitation: 1 });
    expect(storm.tripAllowed(at(10, 20, 12, 7))).toBe(false); // the truck stays home in a storm
    expect(Object.values(storm.lights).every((v) => v > 0.8)).toBe(true);
    const snow = make(at(10, 20, 12, 0), { previewKind: 'snow' }).slow;
    expect(snow.snowCover).toBeGreaterThanOrEqual(0.5);
    expect(snow.weather.temperature).toBeLessThanOrEqual(0);
    expect(make(at(10, 20, 12, 0)).slow.weather).toEqual(plain.weather);
    expect(() => make(at(10, 20, 12, 0), { previewKind: 'hail' })).toThrow();
  });

  it('the animals stand still at night and in a storm, and the truck stays in the drive at night', () => {
    const night = make(at(12, 21, 23, 55));
    expect(night.slow.still).toBe(1);
    expect(night.motion.animals.every((a) => a.pose === 'stand')).toBe(true);
    expect(make(at(10, 20, 12, 0), { previewKind: 'storm' }).slow.still).toBe(1);
    expect(make(at(10, 20, 12, 0)).slow.still).toBe(0);
    for (let m = 0; m < 60; m++) expect(make(at(12, 21, 23, m)).motion.truck.phase).toBe('parked');
  });
});
