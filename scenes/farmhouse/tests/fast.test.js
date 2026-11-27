import { describe, expect, it } from 'vitest';
import { FAST_DAYS_PER_DAY, fastDate, fastElapsed, monthOf } from '../game/fast.js';
import { seasonAt } from '../game/season.js';
import { motionAt, slowAt } from '../game/view.js';
import { createTime } from '../../../app/page/time.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = Date.UTC(2026, 10, 27, 14, 0);

describe('Fast mode', () => {
  it('starts in January and runs one month in a real day', () => {
    expect(fastDate(START, START)).toEqual({ dayOfYear: 1, dayIndex: 0 });
    expect(monthOf(fastDate(START, START).dayOfYear)).toBe('January');
    expect(monthOf(fastDate(START + DAY + HOUR, START).dayOfYear)).toBe('February');
    expect(monthOf(fastDate(START + 6 * DAY + HOUR, START).dayOfYear)).toBe('July');
    expect(monthOf(fastDate(START + 11 * DAY + HOUR, START).dayOfYear)).toBe('December');
    expect(fastElapsed(START + DAY, START)).toBeCloseTo(FAST_DAYS_PER_DAY, 9);
  });

  it('takes about 1.27 fast days from an hour, and a year in twelve real days', () => {
    expect(fastElapsed(START + HOUR, START)).toBeCloseTo(365 / 12 / 24, 9);
    expect(fastDate(START + 12 * DAY, START).dayOfYear).toBe(1); // and round again
  });

  it('moves forward without a jump, a day at a time, and is the same after a gap (R1)', () => {
    let last = fastDate(START, START).dayIndex;
    for (let h = 1; h < 24 * 14; h++) {
      const next = fastDate(START + h * HOUR, START).dayIndex;
      expect(next - last).toBeGreaterThanOrEqual(0);
      expect(next - last).toBeLessThanOrEqual(2);
      last = next;
    }
    expect(fastDate(START + 5 * DAY, START)).toEqual(fastDate(START + 5 * DAY, START));
  });

  it('does not run backwards before the switch, and the seasons follow the fast date', () => {
    expect(fastDate(START - DAY, START)).toEqual({ dayOfYear: 1, dayIndex: 0 });
    expect(seasonAt(fastDate(START, START).dayOfYear, 33.7).name).toBe('winter');
    expect(seasonAt(fastDate(START + 6.5 * DAY, START).dayOfYear, 33.7).name).toBe('summer');
    // In the south the same January is summer.
    expect(seasonAt(fastDate(START, START).dayOfYear, -33.9).name).toBe('summer');
  });

  it('puts the fast date into the view: the season, the weather seed day, never the real date', () => {
    const ms = START + 3 * DAY;
    const time = createTime({
      clock: { now: () => ms },
      readZone: () => 'America/New_York',
      latitude: () => 33.7,
    });
    const fast = fastDate(ms, START);
    const input = {
      ms,
      parts: time.parts(),
      sun: time.sun(),
      nightness: time.nightness(),
      latitude: 33.7,
      seed: 20261127,
    };
    const real = slowAt(input);
    const quick = slowAt({ ...input, fast });
    expect(real.when.dayOfYear).toBe(time.parts().dayOfYear);
    expect(quick.when.dayOfYear).toBe(fast.dayOfYear);
    expect(quick.when.dayIndex).toBe(fast.dayIndex);
    expect(quick.season.name).not.toBe(real.season.name);
    // A preview wins over Fast, and snow never lies in a fast July.
    expect(slowAt({ ...input, fast, previewSeason: 'summer' }).season.name).toBe('summer');
    const july = slowAt({
      ...input,
      ms: START + 6.5 * DAY,
      fast: fastDate(START + 6.5 * DAY, START),
    });
    expect(july.snowCover).toBe(0);
    expect(motionAt(ms, input.parts, quick, { seed: 20261127 }).animals).toHaveLength(7);
  });
});
