import { describe, expect, it } from 'vitest';
import {
  SEASONS,
  PREVIEW_DAY,
  northernDay,
  previewDay,
  seasonAt,
  wrapDay,
} from '../game/season.js';
import { SPECIES, floweringAt } from '../game/flowering.js';

const ATLANTA = 33.7;
const SYDNEY = -33.9;

describe('the season curve', () => {
  it('has no jump over 365 days, at the turn of the year too, in either hemisphere', () => {
    for (const latitude of [ATLANTA, SYDNEY, 60]) {
      let last = seasonAt(365, latitude);
      for (let day = 1; day <= 366; day++) {
        const now = seasonAt(day, latitude);
        for (const key of ['leaf', 'grass', 'winter']) {
          expect(Math.abs(now[key] - last[key])).toBeLessThan(0.1);
        }
        // The colour only shows on leaves: weigh it by the leaves.
        expect(Math.abs(now.turn * now.leaf - last.turn * last.leaf)).toBeLessThan(0.1);
        last = now;
      }
    }
  });

  it('shows the look of table 4.2 in Atlanta: bare in January, fresh green in April, full in July, red in late October', () => {
    expect(seasonAt(20, ATLANTA)).toMatchObject({ name: 'winter' });
    expect(seasonAt(20, ATLANTA).leaf).toBe(0);
    expect(seasonAt(20, ATLANTA).winter).toBeGreaterThan(0.9);
    const april = seasonAt(105, ATLANTA);
    expect(april.name).toBe('spring');
    expect(april.leaf).toBeGreaterThan(0.4);
    expect(april.leaf).toBeLessThan(0.8);
    expect(april.turn).toBe(0);
    const july = seasonAt(196, ATLANTA);
    expect(july).toMatchObject({ name: 'summer', leaf: 1, turn: 0, winter: 0 });
    const october = seasonAt(PREVIEW_DAY.autumn, ATLANTA);
    expect(october.name).toBe('autumn');
    expect(october.leaf).toBeGreaterThan(0.95);
    expect(october.turn).toBeGreaterThan(0.6);
    const november = seasonAt(325, ATLANTA);
    expect(november.leaf).toBeLessThan(0.5);
    expect(november.turn).toBe(1);
  });

  it('the southern hemisphere is the same curve half a year later', () => {
    for (const day of [10, 95, 196, 293, 340]) {
      const north = seasonAt(day, ATLANTA);
      const south = seasonAt(wrapDay(day + 182), SYDNEY);
      expect(south).toEqual(north);
    }
    expect(seasonAt(15, SYDNEY).name).toBe('summer'); // January in Sydney
    expect(northernDay(1, SYDNEY)).toBe(184);
  });

  it('the preview of a season pins its middle, and in the south the same season of that place', () => {
    expect(PREVIEW_DAY).toEqual({ spring: 95, summer: 196, autumn: 293, winter: 15 });
    for (const name of SEASONS) {
      expect(seasonAt(previewDay(name, ATLANTA), ATLANTA).name).toBe(name);
      expect(seasonAt(previewDay(name, SYDNEY), SYDNEY).name).toBe(name);
    }
    expect(() => previewDay('monsoon', ATLANTA)).toThrow();
  });
});

describe('the flowering trees', () => {
  const at = (species, day, latitude) => floweringAt(species, day, latitude);

  it('each tree shows the states of table 4.2 in Atlanta', () => {
    // Redbud: magenta blossom on bare branches in March to April, green leaves in May, yellow in October, bare in November.
    expect(at('redbud', 90).blossom).toBeGreaterThan(0.9);
    expect(at('redbud', 90).leaf).toBe(0);
    expect(at('redbud', 140).leaf).toBe(1);
    expect(at('redbud', 140).blossom).toBe(0);
    expect(at('redbud', 290).turn).toBeGreaterThan(0.5);
    expect(at('redbud', 330).leaf).toBe(0);
    // Cherry: blossom late March to April with petals falling, green summer leaves, orange-red autumn.
    expect(at('cherry', 95).blossom).toBeGreaterThan(0.9);
    expect(at('cherry', 115).petals).toBeGreaterThan(0);
    expect(at('cherry', 200).leaf).toBe(1);
    expect(at('cherry', 300).turn).toBeGreaterThan(0.8);
    // Dogwood: blossom in April, deep red leaves and berries in October and November.
    expect(at('dogwood', 110).blossom).toBeGreaterThan(0.9);
    expect(at('dogwood', 300).berries).toBeGreaterThan(0.9);
    expect(at('dogwood', 300).turn).toBeGreaterThan(0.5);
    // Peach: blossom in March, small fruit in May, a few peaches in July, bare in winter.
    expect(at('peach', 75).blossom).toBeGreaterThan(0.9);
    expect(at('peach', 150).fruit).toBeGreaterThan(0.9);
    expect(at('peach', 196).fruit).toBeGreaterThan(0.5);
    expect(at('peach', 15).leaf).toBe(0);
    for (const species of SPECIES)
      expect(at(species, 15)).toMatchObject({ blossom: 0, leaf: 0, fruit: 0, berries: 0 });
  });

  it('every value stays between 0 and 1 and moves smoothly day by day', () => {
    for (const species of SPECIES) {
      let last = floweringAt(species, 1);
      for (let day = 2; day <= 365; day++) {
        const now = floweringAt(species, day);
        for (const key of ['blossom', 'leaf', 'fruit', 'berries', 'petals']) {
          expect(now[key]).toBeGreaterThanOrEqual(0);
          expect(now[key]).toBeLessThanOrEqual(1);
          expect(Math.abs(now[key] - last[key])).toBeLessThan(0.25);
        }
        expect(Math.abs(now.turn * now.leaf - last.turn * last.leaf)).toBeLessThan(0.25);
        last = now;
      }
    }
  });

  it('a city further from the equator blossoms later and turns earlier (about 4 days per degree)', () => {
    // The peak of the cherry blossom is day 90 in Atlanta; ten degrees further north it is about 40 days later.
    const peak = (latitude) => {
      let best = 1;
      for (let d = 1; d < 200; d++)
        if (
          floweringAt('cherry', d, latitude).blossom > floweringAt('cherry', best, latitude).blossom
        )
          best = d;
      return best;
    };
    const home = peak(ATLANTA);
    const north = peak(ATLANTA + 10);
    expect(north - home).toBeGreaterThan(34);
    expect(north - home).toBeLessThan(46);
    const turn = (latitude) => {
      for (let d = 200; d < 365; d++) if (floweringAt('dogwood', d, latitude).turn > 0.5) return d;
      return 365;
    };
    expect(turn(ATLANTA + 10)).toBeLessThan(turn(ATLANTA));
    expect(turn(ATLANTA - 10)).toBeGreaterThan(turn(ATLANTA));
  });

  it('a southern city is the same year half a year later', () => {
    expect(floweringAt('cherry', wrapDay(90 + 182), -ATLANTA)).toEqual(
      floweringAt('cherry', 90, ATLANTA),
    );
    expect(() => floweringAt('oak', 10)).toThrow();
  });
});
