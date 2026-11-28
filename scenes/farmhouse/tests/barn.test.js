import { describe, expect, it } from 'vitest';
import { createTime } from '../../../app/page/time.js';
import { animalsAt, HERD } from '../game/animals.js';
import { BARN, ORDER, hayAllowed, progressOf, seen, shelterAt, walked } from '../game/barn.js';
import { motionAt, slowAt } from '../game/view.js';
import { previewWeather } from '../game/weather.js';

const SEED = 20261127;
const NY = 'America/New_York';
const DOOR = [0.2, BARN.doorDepth];
/** A moment given on the wall of New York in October (UTC-4). */
const at = (day, hour, minute, second = 0) => Date.UTC(2026, 9, day, hour + 4, minute, second);

function viewAt(ms, { kind = null } = {}) {
  const time = createTime({ clock: { now: () => ms }, readZone: () => NY, latitude: () => 33.7 });
  const parts = time.parts(ms);
  const slow = slowAt({
    ms,
    parts,
    sun: time.sun(ms),
    nightness: time.nightness(ms),
    latitude: 33.7,
    seed: SEED,
    previewKind: kind,
  });
  return { slow, motion: motionAt(ms, parts, slow, { seed: SEED, barn: { door: DOOR } }) };
}
const byId = (animals) => Object.fromEntries(animals.map((a) => [a.id, a]));

describe('R13 the barn: who wants shelter, and in what order', () => {
  it('is 0 by day, 1 at night and in a storm, and the storm is a ramp of the wind', () => {
    expect(shelterAt(0, { kind: 'clear', wind: 0.2 })).toBe(0);
    expect(shelterAt(1, { kind: 'clear', wind: 0.2 })).toBe(1);
    expect(shelterAt(0, { kind: 'storm', wind: 0.9 })).toBeGreaterThan(0.95);
    expect(shelterAt(0, { kind: 'rain', wind: 0.5 })).toBe(0);
    let last = 0;
    for (let wind = 0.5; wind <= 0.95; wind += 0.002) {
      const s = shelterAt(0, { wind });
      expect(s).toBeGreaterThanOrEqual(last);
      expect(s - last).toBeLessThan(0.02);
      last = s;
    }
  });

  it('sends the sheep first, then the cows, the horses last, and everyone is in at full shelter', () => {
    const order = Object.keys(ORDER);
    expect(order.slice(0, 3).every((id) => id.startsWith('sheep'))).toBe(true);
    expect(order.slice(3, 5).every((id) => id.startsWith('cow'))).toBe(true);
    expect(order.slice(5).every((id) => id.startsWith('horse'))).toBe(true);
    for (let i = 1; i < order.length; i++)
      expect(ORDER[order[i]]).toBeGreaterThan(ORDER[order[i - 1]]);
    for (const spec of HERD) {
      expect(progressOf(0, spec.id)).toBe(0);
      expect(progressOf(1, spec.id)).toBe(1);
    }
    for (let s = 0.05; s < 0.95; s += 0.05) {
      const progress = order.map((id) => progressOf(s, id));
      for (let i = 1; i < progress.length; i++)
        expect(progress[i]).toBeLessThanOrEqual(progress[i - 1]);
    }
  });

  it('the walk is smooth and the fade in the doorway comes at the end of it', () => {
    expect(walked(0)).toBe(0);
    expect(walked(1)).toBe(1);
    expect(seen(0.5)).toBe(1);
    expect(seen(1)).toBe(0);
    for (let p = 0; p < 1; p += 0.01) expect(walked(p + 0.01) - walked(p)).toBeLessThan(0.05);
  });

  it('allows Scatter hay only by day', () => {
    expect(hayAllowed(0)).toBe(true);
    expect(hayAllowed(0.01)).toBe(true);
    expect(hayAllowed(0.2)).toBe(false);
    expect(hayAllowed(1)).toBe(false);
  });
});

describe('R13 the animals and the barn', () => {
  it('are all in the field by day and all in the barn at night; there are always seven', () => {
    for (const [hour, minute, inside] of [
      [12, 0, 0],
      [15, 30, 0],
      [23, 30, 1],
      [2, 0, 1],
    ]) {
      const day = hour < 6 ? 21 : 20;
      const { motion } = viewAt(at(day, hour, minute));
      expect(motion.animals).toHaveLength(7);
      for (const a of motion.animals) {
        expect(a.inside).toBe(inside);
        expect(a.alpha).toBe(inside ? 0 : 1);
      }
    }
  });

  it('go in during a storm and come out again when it is over, also by day', () => {
    const calm = viewAt(at(20, 12, 0), { kind: 'clear' }).motion.animals;
    const storm = viewAt(at(20, 12, 0), { kind: 'storm' }).motion.animals;
    expect(calm.every((a) => a.alpha === 1)).toBe(true);
    expect(storm.every((a) => a.alpha < 0.05)).toBe(true);
    expect(viewAt(at(20, 12, 0), { kind: 'storm' }).slow.hayAllowed).toBe(false);
    expect(viewAt(at(20, 12, 0), { kind: 'clear' }).slow.hayAllowed).toBe(true);
  });

  it('go in one by one over the dusk: the sheep are through the door before the horses', () => {
    const doneAt = {};
    for (let m = 0; m < 3 * 60; m++) {
      const { motion } = viewAt(at(20, 17, 0) + m * 60_000);
      for (const a of motion.animals) if (a.alpha < 0.05) doneAt[a.id] ??= m;
    }
    expect(Object.keys(doneAt)).toHaveLength(7);
    for (const sheep of ['sheep-1', 'sheep-2', 'sheep-3'])
      for (const horse of ['horse-brown', 'horse-beige'])
        expect(doneAt[sheep]).toBeLessThan(doneAt[horse]);
    expect(doneAt['horse-beige'] - doneAt['sheep-1']).toBeGreaterThan(15);
    expect(doneAt['horse-beige'] - doneAt['sheep-1']).toBeLessThan(60);
  });

  it('come out in the morning, the horses first, and nobody is out at night', () => {
    const outAt = {};
    for (let m = 0; m < 4 * 60; m++) {
      const { motion } = viewAt(at(21, 4, 30) + m * 60_000);
      for (const a of motion.animals) if (a.alpha > 0.95) outAt[a.id] ??= m;
    }
    expect(Object.keys(outAt)).toHaveLength(7);
    expect(outAt['horse-beige']).toBeLessThan(outAt['sheep-1']);
  });

  it('have no steps: a second at a time through the whole dusk and the whole dawn, nothing jumps', () => {
    for (const [from, hours] of [
      [at(20, 17, 30), 2.5],
      [at(21, 5, 0), 3],
    ]) {
      let last = null;
      for (let s = 0; s <= hours * 3600; s += 1) {
        const { motion } = viewAt(from + s * 1000);
        const now = byId(motion.animals);
        if (last) {
          for (const id of Object.keys(now)) {
            // A walk is about 40 design units a second (a sheep with its flock and a push apart a little more); going to
            // the barn adds nothing like a step.
            const ground = Math.hypot(
              (now[id].x - last[id].x) * 2100,
              (now[id].depth - last[id].depth) * 185,
            );
            expect(ground).toBeLessThan(90);
            expect(Math.abs(now[id].inside - last[id].inside)).toBeLessThan(0.01);
            expect(Math.abs(now[id].alpha - last[id].alpha)).toBeLessThan(0.1);
          }
        }
        last = now;
      }
    }
  }, 120_000);

  it('walk straight to the door and let go of the hay on the way', () => {
    const base = { seed: SEED, dayIndex: 20381 };
    const ms = at(20, 12, 0);
    const hungry = animalsAt(ms, {
      ...base,
      hayStartedAt: ms - 40_000,
      barn: { door: DOOR, shelter: 0 },
    });
    const leaving = animalsAt(ms, {
      ...base,
      hayStartedAt: ms - 40_000,
      barn: { door: DOOR, shelter: 1 },
    });
    expect(hungry.every((a) => a.pose === 'eat')).toBe(true);
    for (const a of leaving) {
      expect(a.x).toBeCloseTo(DOOR[0], 5);
      expect(a.depth).toBeCloseTo(DOOR[1], 5);
      expect(a.alpha).toBe(0);
    }
  });

  it('turn towards the door on the way in and away from it on the way out', () => {
    const ms = at(20, 12, 0);
    const base = { seed: SEED, dayIndex: 20381 };
    const goingIn = animalsAt(ms, { ...base, barn: { door: DOOR, shelter: 0.5, leaving: false } });
    const coming = animalsAt(ms, { ...base, barn: { door: DOOR, shelter: 0.5, leaving: true } });
    for (const a of goingIn.filter((x) => x.inside > 0 && x.inside < 0.9 && x.x > DOOR[0]))
      expect(a.facing).toBe('left');
    for (const a of coming.filter((x) => x.inside > 0 && x.inside < 0.9 && x.x > DOOR[0]))
      expect(a.facing).toBe('right');
  });

  it('keeps the old behaviour without a barn: they stand still at night and in a storm', () => {
    const calm = animalsAt(at(20, 12, 0), { seed: SEED, dayIndex: 20381, still: 0 });
    const night = animalsAt(at(20, 12, 0), { seed: SEED, dayIndex: 20381, still: 1 });
    expect(calm.every((a) => a.alpha === 1 && a.inside === 0)).toBe(true);
    expect(night.every((a) => a.pose === 'stand' && a.alpha === 1)).toBe(true);
    expect(previewWeather('storm', 10).wind).toBeGreaterThan(0.8);
  });
});
