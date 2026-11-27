import { describe, expect, it } from 'vitest';
import { createTime } from '../../../app/page/time.js';
import {
  CLOUDS,
  blend,
  cloudStrengths,
  fallingAt,
  fogAt,
  gradeAt,
  lightningDim,
  multiply,
  skyColours,
  skyKey,
  timeOfDay,
} from '../game/sky.js';
import { seasonAt } from '../game/season.js';

const MIN = 60_000;
const NY = 'America/New_York';
const at = (m, d, h, mi) =>
  Date.UTC(2026, m - 1, d, h, mi) - (m >= 4 && m <= 10 ? -240 : -300) * MIN;
const today = (ms) => {
  const time = createTime({ clock: { now: () => ms }, readZone: () => NY, latitude: () => 33.7 });
  return { sun: time.sun(), night: time.nightness() };
};
const tod = (ms) => {
  const { sun, night } = today(ms);
  return timeOfDay(ms, sun, night);
};
const clear = { kind: 'clear', cloud: 0.05, precipitation: 0, fog: 0, wind: 0.2 };
const brightness = (c) =>
  parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16);

describe('the colours', () => {
  it('blend and multiply like a painter would', () => {
    expect(blend('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(blend('#102030', '#ffffff', 0)).toBe('#102030');
    expect(multiply('#ffffff', '#336699')).toBe('#336699');
    expect(multiply('#808080', '#808080')).toBe('#404040');
  });
});

describe('the time of day', () => {
  it('has the sun up at noon, the moon at midnight, and warm light around sunset', () => {
    const noon = tod(at(10, 20, 13, 0));
    expect(noon.sun).toBeGreaterThan(0.3);
    expect(noon.sun).toBeLessThan(0.7);
    expect(noon.moon).toBeNull();
    expect(noon.night).toBe(0);
    expect(noon.golden).toBe(0);
    const midnight = tod(at(10, 20, 23, 59));
    expect(midnight.sun).toBeNull();
    expect(midnight.moon).toBeGreaterThan(0);
    expect(midnight.night).toBe(1);
    const { sun } = today(at(10, 20, 12, 0));
    expect(tod(sun.sunset).golden).toBeGreaterThan(0.95);
    expect(tod(sun.sunset + 90 * MIN).golden).toBe(0);
  });

  it('moves the sun from the east to the west and the moon through the night', () => {
    const { sun } = today(at(10, 20, 12, 0));
    expect(tod(sun.sunrise + MIN).sun).toBeLessThan(0.05);
    expect(tod(sun.sunset - MIN).sun).toBeGreaterThan(0.95);
    expect(tod(sun.sunset + 2 * MIN).moon).toBeLessThan(0.05);
    expect(tod(at(10, 21, 3, 0)).moon).toBeGreaterThan(0.3);
  });

  it('has a sun at midday and a moon at midnight in the polar day and night', () => {
    expect(timeOfDay(0, { polar: 'day' }, 0).sun).toBe(0.5);
    expect(timeOfDay(0, { polar: 'night' }, 1).moon).toBe(0.5);
  });
});

describe('the sky and the grade', () => {
  it('has a blue sky by day, a dark one at night, a warm one at dusk and a grey one under cloud', () => {
    const day = skyColours({ night: 0, golden: 0 }, clear);
    const night = skyColours({ night: 1, golden: 0 }, clear);
    const dusk = skyColours({ night: 0, golden: 1 }, clear);
    const grey = skyColours({ night: 0, golden: 0 }, { kind: 'cloudy', cloud: 1 });
    expect(brightness(night.top)).toBeLessThan(brightness(day.top) / 2);
    expect(dusk.bottom).not.toBe(day.bottom);
    expect(grey.top).not.toBe(day.top);
    expect(skyColours({ night: 0, golden: 0 }, { kind: 'storm', cloud: 1 }).top).not.toBe(grey.top);
  });

  it('has a sky key that moves in steps', () => {
    const a = skyKey({ night: 0, golden: 0 }, clear);
    expect(skyKey({ night: 0.01, golden: 0.02 }, clear)).toBe(a);
    expect(skyKey({ night: 0.5, golden: 0 }, clear)).not.toBe(a);
    expect(skyKey({ night: 0, golden: 0 }, { ...clear, kind: 'storm', wind: 0.9 })).not.toBe(a);
  });

  it('leaves the picture alone at midday in clear weather and darkens it at night and in a storm', () => {
    expect(gradeAt({ night: 0, golden: 0 }, { kind: 'clear', cloud: 0 }).multiply).toBe('#ffffff');
    const night = gradeAt({ night: 1, golden: 0 }, clear).multiply;
    expect(parseInt(night.slice(1, 3), 16)).toBeLessThan(150);
    const storm = gradeAt({ night: 0, golden: 0 }, { kind: 'storm', cloud: 1 }).multiply;
    expect(storm).not.toBe('#ffffff');
    expect(gradeAt({ night: 0, golden: 0 }, clear, 1).multiply).not.toBe(
      gradeAt({ night: 0, golden: 0 }, clear, 0).multiply,
    );
  });
});

describe('lightning', () => {
  it('is only a short darkening, only in a storm, and the same for the same moment', () => {
    const storm = { kind: 'storm' };
    let seen = 0;
    for (let s = 0; s < 600; s++) {
      const dim = lightningDim(s * 1000, storm, 7);
      expect(dim).toBeGreaterThanOrEqual(0);
      expect(dim).toBeLessThanOrEqual(1);
      if (dim > 0) seen++;
      expect(lightningDim(s * 1000, storm, 7)).toBe(dim);
      expect(lightningDim(s * 1000, { kind: 'rain' }, 7)).toBe(0);
    }
    expect(seen).toBeGreaterThan(5);
    expect(seen).toBeLessThan(120); // a flash is a moment, not a state
  });
});

describe('what falls, the clouds and the fog', () => {
  const season = (d) => seasonAt(d, 33.7);
  const dry = { kind: 'clear', precipitation: 0 };

  it('rains in rain, snows in snow, drops leaves in October and petals in April, never more than the pools', () => {
    expect(
      fallingAt({ kind: 'rain', precipitation: 1 }, season(293), 0, 0).rain,
    ).toBeLessThanOrEqual(420);
    expect(fallingAt({ kind: 'rain', precipitation: 0.6 }, season(293), 0, 0).snow).toBe(0);
    expect(
      fallingAt({ kind: 'snow', precipitation: 1 }, season(15), 0.5, 0).snow,
    ).toBeLessThanOrEqual(360);
    expect(fallingAt(dry, season(293), 0, 0).leaves).toBeGreaterThan(10);
    expect(fallingAt(dry, season(196), 0, 0).leaves).toBe(0);
    expect(fallingAt(dry, season(100), 0, 1).petals).toBeGreaterThan(20);
    expect(fallingAt(dry, season(196), 0, 0).petals).toBe(0);
  });

  it('brings the clouds in one after another and the fog down with the cover', () => {
    expect(cloudStrengths({ cloud: 0 }).every((s) => s === 0)).toBe(true);
    const some = cloudStrengths({ cloud: 0.5 }).filter((s) => s > 0).length;
    expect(some).toBeGreaterThan(2);
    expect(some).toBeLessThan(CLOUDS);
    expect(cloudStrengths({ cloud: 1 }).every((s) => s > 0.5)).toBe(true);
    expect(fogAt({ fog: 0, cloud: 0.2, precipitation: 0 })).toEqual({ cap: 0, mid: 0, low: 0 });
    const thick = fogAt({ fog: 1, cloud: 0.7, precipitation: 0 });
    expect(thick.cap).toBe(1);
    expect(thick.low).toBeGreaterThan(0.5);
    expect(fogAt({ fog: 0, cloud: 1, precipitation: 0.6 }).low).toBeGreaterThan(0);
  });
});
