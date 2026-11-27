import { describe, expect, it } from 'vitest';
import { FIELD, HAY, HERD, animalsAt, canScatter, depthScale, hayWeight } from '../game/animals.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEED = 20261121;
const START = Date.UTC(2026, 9, 20, 12, 0, 0);
const ctx = (extra = {}) => ({ seed: SEED, dayIndex: 20381, ...extra });
const at = (seconds, extra) => animalsAt(START + seconds * 1000, ctx(extra));
const byId = (animals) => Object.fromEntries(animals.map((a) => [a.id, a]));

describe('R6 the herd', () => {
  it('is always seven animals in three kinds: two horses (brown and beige), two cows and three sheep', () => {
    expect(HERD).toHaveLength(7);
    const count = (kind) => HERD.filter((a) => a.kind === kind).length;
    expect([count('horse'), count('cow'), count('sheep')]).toEqual([2, 2, 3]);
    expect(HERD.filter((a) => a.kind === 'horse').map((a) => a.coat)).toEqual(['brown', 'beige']);
    for (let s = 0; s < 3 * 3600; s += 97) expect(at(s)).toHaveLength(7);
    expect(new Set(at(0).map((a) => a.id)).size).toBe(7);
  });

  it('are only in the field in front of the fence, at every moment of a day, also at night and in a storm', () => {
    for (const still of [0, 1]) {
      for (let s = 0; s < 24 * 3600; s += 61) {
        for (const a of at(s, { still })) {
          expect(a.depth).toBeGreaterThanOrEqual(FIELD.depthMin);
          expect(a.depth).toBeLessThanOrEqual(FIELD.depthMax);
          expect(a.x).toBeGreaterThanOrEqual(FIELD.xMin);
          expect(a.x).toBeLessThanOrEqual(FIELD.xMax);
        }
      }
    }
  });

  it('stay out of the icon strip when the scene gives bounds', () => {
    for (let s = 0; s < 3600; s += 17) {
      for (const a of at(s, { bounds: { xMin: 0.2, xMax: 0.95 } }))
        expect(a.x).toBeGreaterThanOrEqual(0.2);
    }
  });
});

describe('R7 near and far', () => {
  it('the size follows the depth: about half at the fence to 1.5 times at the bottom', () => {
    expect(depthScale(0)).toBe(0.5);
    expect(depthScale(1)).toBe(1.5);
    for (const a of at(1234)) expect(a.scale).toBeCloseTo(depthScale(a.depth), 10);
    const all = Array.from({ length: 500 }, (_, i) => at(i * 173).map((a) => a.scale)).flat();
    expect(Math.min(...all)).toBeGreaterThanOrEqual(0.5);
    expect(Math.max(...all)).toBeLessThanOrEqual(1.5);
    expect(Math.max(...all) - Math.min(...all)).toBeGreaterThan(0.6); // they really use the depth
  });

  it('are listed back to front', () => {
    for (let s = 0; s < 2000; s += 53) {
      const depths = at(s).map((a) => a.depth);
      expect(depths).toEqual([...depths].sort((x, y) => x - y));
    }
  });

  it('face left or right only', () => {
    for (let s = 0; s < 5000; s += 41)
      for (const a of at(s)) expect(['left', 'right']).toContain(a.facing);
  });
});

describe('R8 behaviour', () => {
  it('graze, wander and stand, and all of them are seen over a day', () => {
    const poses = new Set();
    for (let s = 0; s < 6 * 3600; s += 7) for (const a of at(s)) poses.add(a.pose);
    expect([...poses].sort()).toEqual(['graze', 'stand', 'walk']);
  });

  it('are a function of the time and the seed: the same moment gives the same herd, another seed another herd', () => {
    expect(at(5000)).toEqual(at(5000));
    expect(animalsAt(START, ctx({ seed: 1 }))).not.toEqual(animalsAt(START, ctx({ seed: 2 })));
  });

  it('a gap of any length lands in the right place at once: nothing is added up frame by frame', () => {
    const direct = at(8 * 3600);
    let frames;
    for (let s = 0; s <= 8 * 3600; s += 600) frames = at(s); // a scene that ran, sampled
    expect(frames).toEqual(at(8 * 3600));
    expect(direct).toEqual(frames);
  });

  it('move continuously and slowly: no jump in a tenth of a second, and a walk is never faster than a trot', () => {
    let last = byId(at(0));
    let fastest = 0;
    for (let ms = 100; ms <= 20 * 60 * 1000; ms += 100) {
      const now = byId(animalsAt(START + ms, ctx()));
      for (const id of Object.keys(now)) {
        const d = Math.hypot(now[id].x - last[id].x, (now[id].depth - last[id].depth) * 1.8);
        fastest = Math.max(fastest, d / 0.1);
        expect(d).toBeLessThan(0.01);
      }
      last = now;
    }
    expect(fastest).toBeLessThan(0.05); // field widths per second
  });

  it('the three sheep stay in a loose flock', () => {
    for (let s = 0; s < 3 * 3600; s += 113) {
      const sheep = at(s).filter((a) => a.kind === 'sheep');
      const xs = sheep.map((a) => a.x);
      const ds = sheep.map((a) => a.depth);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.3);
      expect(Math.max(...ds) - Math.min(...ds)).toBeLessThan(0.5);
    }
  });

  it('at night and in a storm they stand still: they go to resting places, and all stand', () => {
    for (const a of at(0, { still: 1 })) expect(a.pose).toBe('stand');
    // a resting herd does not move through the night: the same resting places all day
    const place = (animals) => animals.map(({ id, x, depth }) => ({ id, x, depth }));
    expect(place(at(0, { still: 1 }))).toEqual(place(at(6 * 3600, { still: 1 })));
    const calm = byId(at(100, { still: 0 }));
    const resting = byId(at(100, { still: 1 }));
    expect(Object.keys(calm).some((id) => calm[id].x !== resting[id].x)).toBe(true);
  });
});

describe('R12 Scatter hay', () => {
  const FIRST = START + 5000;
  const run = (s) => animalsAt(FIRST + s * 1000, ctx({ hayStartedAt: FIRST }));

  it('weight rises, holds for about a minute of eating, and falls', () => {
    expect(hayWeight(FIRST - 1000, FIRST)).toBe(0);
    expect(hayWeight(FIRST, null)).toBe(0);
    expect(hayWeight(FIRST + (HAY.gather / 2) * 1000, FIRST)).toBeGreaterThan(0.3);
    expect(hayWeight(FIRST + (HAY.gather / 2) * 1000, FIRST)).toBeLessThan(0.7);
    expect(hayWeight(FIRST + (HAY.gather + 30) * 1000, FIRST)).toBe(1);
    expect(HAY.eat).toBe(60);
    expect(hayWeight(FIRST + (HAY.gather + HAY.eat + HAY.leave) * 1000, FIRST)).toBe(0);
  });

  it('the animals gather at one spot and eat, then wander again', () => {
    const eating = run(HAY.gather + 30);
    expect(eating.every((a) => a.pose === 'eat')).toBe(true);
    for (const a of eating) {
      expect(Math.abs(a.x - HAY.spot[0])).toBeLessThan(0.15);
      expect(Math.abs(a.depth - HAY.spot[1])).toBeLessThan(0.15);
    }
    expect(new Set(eating.map((a) => `${a.x.toFixed(3)},${a.depth.toFixed(3)}`)).size).toBe(7); // not on each other
    const after = run(HAY.gather + HAY.eat + HAY.leave + 120);
    expect(after.some((a) => a.pose !== 'eat')).toBe(true);
    expect(after).toEqual(
      animalsAt(FIRST + (HAY.gather + HAY.eat + HAY.leave + 120) * 1000, ctx()),
    ); // as if never used
  });

  it('they walk to the hay without a jump, from wherever they are', () => {
    let last = byId(run(-1));
    for (let ms = 0; ms <= (HAY.gather + HAY.eat + HAY.leave) * 1000; ms += 100) {
      const now = byId(animalsAt(FIRST + ms, ctx({ hayStartedAt: FIRST })));
      for (const id of Object.keys(now))
        expect(Math.hypot(now[id].x - last[id].x, now[id].depth - last[id].depth)).toBeLessThan(
          0.02,
        );
      last = now;
    }
  });

  it('a second use is refused for half a minute after the first has finished eating', () => {
    expect(canScatter(FIRST, null)).toBe(true);
    expect(canScatter(FIRST + 10_000, FIRST)).toBe(false);
    expect(canScatter(FIRST + (HAY.gather + HAY.eat) * 1000, FIRST)).toBe(false);
    expect(canScatter(FIRST + (HAY.gather + HAY.eat + HAY.pause) * 1000 - 1, FIRST)).toBe(false);
    expect(canScatter(FIRST + (HAY.gather + HAY.eat + HAY.pause) * 1000, FIRST)).toBe(true);
  });
});

describe('the rules stay pure', () => {
  it('no file of game/ imports Pixi, the page or the host', () => {
    const dir = fileURLToPath(new URL('../game/', import.meta.url));
    for (const name of [
      'animals.js',
      'clockRules.js',
      'flowering.js',
      'hash.js',
      'season.js',
      'weather.js',
    ]) {
      const source = readFileSync(dir + name, 'utf8');
      const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
      for (const from of imports) expect(from.startsWith('./')).toBe(true);
      expect(source).not.toMatch(/Date\.now|new Date\(|performance\.now|Math\.random/);
    }
  });
});
