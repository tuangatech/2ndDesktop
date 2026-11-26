import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WHEN_COVERED,
  WHEN_COVERED,
  WHEN_COVERED_LABELS,
  normalizeWhenCovered,
  shouldPauseWhenCovered,
} from '../../app/main/cover-policy.js';

describe('the setting "When the desktop is covered" (docs/platform/01 section 7.1)', () => {
  it('has three words, and "Always pause" is the default', () => {
    expect(WHEN_COVERED).toEqual(['always', 'auto', 'never']);
    expect(DEFAULT_WHEN_COVERED).toBe('always');
    expect(Object.keys(WHEN_COVERED_LABELS)).toEqual(WHEN_COVERED);
    expect(Object.values(WHEN_COVERED_LABELS)).toEqual([
      'Always pause',
      'Pause on battery only',
      'Never pause',
    ]);
  });

  // The 3 x 3 table: the setting against AC power, battery power and a power state that cannot be read.
  it.each([
    ['always', false, true],
    ['always', true, true],
    ['always', null, true],
    ['auto', false, false],
    ['auto', true, true],
    ['auto', null, true],
    ['never', false, false],
    ['never', true, false],
    ['never', null, false],
  ])('%s, on battery: %s -> pauses: %s', (setting, onBattery, pauses) => {
    expect(shouldPauseWhenCovered(setting, onBattery)).toBe(pauses);
  });

  it('treats a missing power state like an unknown one', () => {
    expect(shouldPauseWhenCovered('auto', undefined)).toBe(true);
  });

  it('counts anything that is not one of the words as the default, so a damaged file stays quiet', () => {
    for (const bad of [undefined, null, '', 'Auto', 'sometimes', 7, {}]) {
      expect(normalizeWhenCovered(bad)).toBe('always');
      expect(shouldPauseWhenCovered(bad, false)).toBe(true);
    }
    expect(normalizeWhenCovered('never')).toBe('never');
  });
});
