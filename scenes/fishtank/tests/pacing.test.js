import { describe, expect, it } from 'vitest';
import { PATTERNS, simulate } from '../../../scripts/pacing-sim.js';
import { makeRng } from '../../../shared/rng.js';

// The promises of functional spec 7.2. A change to scenes/fishtank/game/config.js that breaks them fails the build.
const run = (name, seed = 1) => simulate(PATTERNS[name](30, makeRng(seed)), { seed });

describe('pacing promises', () => {
  it('a daily visitor: juvenile at visit 3, adult at visit 10, first egg by visit 3', () => {
    const r = run('daily, same hour');
    expect(r.juvenileVisit).toBe(3);
    expect(r.adultVisit).toBe(10);
    expect(r.firstEggVisit).toBeLessThanOrEqual(3);
  });

  // Finding from the simulator: a visit less than 24 hours after the last one finds a fish only half hungry, so a
  // player who comes at a different hour every day feeds about 1.5 pellets per fish a day, not 2, and the original
  // fish become adults after about 14 visits instead of 10.
  it('a daily visitor at a random hour is a few visits slower, not days slower', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = run('daily, random hour', seed);
      expect(r.juvenileVisit).toBeLessThanOrEqual(5);
      expect(r.adultVisit).toBeLessThanOrEqual(15);
    }
  });

  it('a daily visitor reaches 8 fish within about 10 days of the first egg', () => {
    const r = run('daily, same hour');
    expect(r.eighthFishDay).not.toBeNull();
    expect(r.eighthFishDay).toBeLessThanOrEqual(20);
  });

  it('a player who never visits gets no growth and no eggs', () => {
    const r = run('never');
    expect(r.finalPoints).toEqual([0, 0]);
    expect(r.firstEggVisit).toBeNull();
    expect(r.fishCount).toBe(2);
  });

  it('visiting every 12 hours feeds a fish about 2 pellets a day at most', () => {
    expect(run('every 12 hours').pelletsPerOriginalFishPerDay).toBeLessThanOrEqual(2.1);
  });

  it('visiting every 3 days still makes progress, only slower', () => {
    const slow = run('every 3 days');
    const daily = run('daily, same hour');
    expect(slow.finalPoints.every((p) => p > 0)).toBe(true);
    expect(Math.min(...slow.finalPoints)).toBeLessThan(Math.min(...daily.finalPoints));
  });
});
