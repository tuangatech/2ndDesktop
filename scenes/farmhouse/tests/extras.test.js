import { describe, expect, it } from 'vitest';
import {
  BREATH,
  OWL,
  breathAmount,
  owlAt,
  puffProgress,
  vaneHeading,
  vaneWidth,
} from '../game/extras.js';

const SEED = 20261127;
const CLEAR = { cloud: 0.1, precipitation: 0, wind: 0.2, kind: 'clear' };
const owl = (day, minute, extra = {}) =>
  owlAt(day * 86_400_000 + minute * 60_000, {
    seed: SEED,
    dayIndex: day,
    minuteOfDay: minute,
    nightness: 1,
    weather: CLEAR,
    ...extra,
  });

describe('R16 the owl', () => {
  it('shows in some of the half hours of a clear night and not in others, about two in five', () => {
    let shown = 0;
    let total = 0;
    for (let day = 20000; day < 20060; day++) {
      for (let minute = 15; minute < 1440; minute += 30) {
        total++;
        if (owl(day, minute).amount > 0.99) shown++;
      }
    }
    expect(shown / total).toBeGreaterThan(OWL.chance - 0.08);
    expect(shown / total).toBeLessThan(OWL.chance + 0.08);
  });

  it('is never there by day, in cloud, in rain or in a storm', () => {
    for (let day = 20000; day < 20030; day++) {
      for (let minute = 0; minute < 1440; minute += 30) {
        expect(owl(day, minute, { nightness: 0 }).amount).toBe(0);
        expect(owl(day, minute, { weather: { ...CLEAR, cloud: 0.95 } }).amount).toBe(0);
        expect(owl(day, minute, { weather: { ...CLEAR, precipitation: 0.5 } }).amount).toBe(0);
        expect(owl(day, minute, { weather: { ...CLEAR, kind: 'storm', wind: 0.9 } }).amount).toBe(
          0,
        );
      }
    }
  });

  it('comes and goes by ramps: a second at a time over three nights, no step and the eyes shut only briefly', () => {
    let last = null;
    let shut = 0;
    let n = 0;
    for (let s = 0; s < 3 * 86_400; s++) {
      const day = 20000 + Math.floor(s / 86_400);
      const minute = (s % 86_400) / 60;
      const o = owl(day, minute);
      if (last !== null) expect(Math.abs(o.amount - last)).toBeLessThan(0.02);
      last = o.amount;
      expect(o.blink).toBeGreaterThanOrEqual(0);
      expect(o.blink).toBeLessThanOrEqual(1);
      if (o.amount > 0.99) {
        n++;
        if (o.blink > 0.5) shut++;
      }
    }
    expect(n).toBeGreaterThan(1000);
    expect(shut / n).toBeLessThan(0.05);
  }, 60_000);

  it('keeps going across midnight when both half hours have the owl (no fade at the seam)', () => {
    let seams = 0;
    for (let day = 20000; day < 20400; day++) {
      const before = owl(day, 1439.5);
      const after = owl(day + 1, 0.5);
      if (before.amount > 0.99 && after.amount > 0.99) {
        seams++;
        expect(Math.abs(owl(day, 1440 - 0.01).amount - owl(day + 1, 0.01).amount)).toBeLessThan(
          0.01,
        );
      }
    }
    expect(seams).toBeGreaterThan(0);
  });
});

describe('R18 the weathervane', () => {
  it('idles from side to side in a calm and holds into the wind when it blows', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 600; t += 0.5) {
      const h = vaneHeading(t, 0);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    expect(hi - lo).toBeGreaterThan(1.5); // it swings
    for (let t = 0; t < 600; t += 0.5) {
      expect(Math.abs(vaneHeading(t, 0.9))).toBeLessThan(0.15); // pointing left, into the wind
      expect(vaneWidth(vaneHeading(t, 0.9))).toBeGreaterThan(0.9);
    }
  });

  it('turns smoothly with the clock and with the wind, and is never edge-on', () => {
    let last = vaneHeading(0, 0.3);
    for (let t = 0.05; t < 300; t += 0.05) {
      const h = vaneHeading(t, 0.3);
      expect(Math.abs(h - last)).toBeLessThan(0.1);
      last = h;
    }
    let lastWind = vaneHeading(1000, 0);
    for (let w = 0.001; w <= 1; w += 0.001) {
      const h = vaneHeading(1000, w);
      expect(Math.abs(h - lastWind)).toBeLessThan(0.05);
      lastWind = h;
    }
    for (let a = 0; a < 6.3; a += 0.01) expect(Math.abs(vaneWidth(a))).toBeGreaterThanOrEqual(0.14);
  });
});

describe('R17 the breath', () => {
  it('is none above 3 degrees and full at 0 degrees and colder, with no step between', () => {
    expect(breathAmount(10)).toBe(0);
    expect(breathAmount(3)).toBe(0);
    expect(breathAmount(0)).toBe(1);
    expect(breathAmount(-8)).toBe(1);
    let last = 0;
    for (let temperature = 3; temperature >= 0; temperature -= 0.01) {
      const a = breathAmount(temperature);
      expect(a).toBeGreaterThanOrEqual(last);
      expect(a - last).toBeLessThan(0.02);
      last = a;
    }
  });

  it('puffs out of step for each animal: out for under half of each cycle, in from 0 to 1', () => {
    for (let index = 0; index < 7; index++) {
      let out = 0;
      let total = 0;
      for (let t = 0; t < BREATH.cycle * 40; t += 0.1) {
        total++;
        const p = puffProgress(t, index);
        if (p !== null) {
          out++;
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(1);
        }
      }
      expect(out / total).toBeCloseTo(BREATH.out, 1);
    }
    let apart = 0;
    for (let t = 0; t < 60; t += 0.5) if (puffProgress(t, 2) !== puffProgress(t, 3)) apart++;
    expect(apart).toBeGreaterThan(40); // not in step
  });
});
