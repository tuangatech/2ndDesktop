import { describe, expect, it } from 'vitest';
import { makeRng } from '../../shared/rng.js';

describe('makeRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different sequences for different seeds', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('stays inside its ranges', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const r = rng.range(3, 5);
      expect(r).toBeGreaterThanOrEqual(3);
      expect(r).toBeLessThan(5);
      const k = rng.int(2, 4);
      expect([2, 3, 4]).toContain(k);
    }
  });

  it('picks from a list', () => {
    const rng = makeRng(9);
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(rng.pick(['a', 'b', 'c']));
    expect(seen.size).toBe(3);
  });
});
