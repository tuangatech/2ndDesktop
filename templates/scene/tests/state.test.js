import { describe, expect, it } from 'vitest';
import { resetTaps, startState, tap } from '../state.js';

describe('the record of the scene', () => {
  it('starts at one start and no taps when there is no record', () => {
    expect(startState({ status: 'missing' })).toEqual({ schema: 1, opened: 1, taps: 0 });
    expect(startState(undefined)).toEqual({ schema: 1, opened: 1, taps: 0 });
  });

  it('counts one more start and keeps the taps', () => {
    expect(startState({ status: 'ok', data: { schema: 1, opened: 4, taps: 9 } })).toEqual({
      schema: 1,
      opened: 5,
      taps: 9,
    });
  });

  it('starts again from nothing when the record is damaged or makes no sense', () => {
    for (const loaded of [
      { status: 'corrupt' },
      { status: 'ok', data: null },
      { status: 'ok', data: 'text' },
      { status: 'ok', data: { opened: -3, taps: 2.5 } },
      { status: 'ok', data: { opened: '7', taps: '1' } },
    ]) {
      expect(startState(loaded)).toEqual({ schema: 1, opened: 1, taps: 0 });
    }
  });

  it('taps and resets without changing the other fields', () => {
    const state = { schema: 1, opened: 2, taps: 0 };
    expect(tap(tap(state))).toEqual({ schema: 1, opened: 2, taps: 2 });
    expect(resetTaps({ schema: 1, opened: 2, taps: 5 })).toEqual(state);
  });
});
