import { describe, expect, it } from 'vitest';
import { nextRecord } from '../state.js';

describe('the record of the empty scene', () => {
  it('starts at 1 when there is no record', () => {
    expect(nextRecord({ status: 'missing' })).toEqual({ schema: 1, opened: 1 });
    expect(nextRecord(undefined)).toEqual({ schema: 1, opened: 1 });
  });

  it('counts one more start', () => {
    expect(nextRecord({ status: 'ok', data: { schema: 1, opened: 4 } })).toEqual({
      schema: 1,
      opened: 5,
    });
  });

  it('starts again from 1 when the record is damaged or makes no sense', () => {
    for (const loaded of [
      { status: 'corrupt' },
      { status: 'ok', data: null },
      { status: 'ok', data: { opened: -3 } },
      { status: 'ok', data: { opened: 2.5 } },
      { status: 'ok', data: { opened: '7' } },
      { status: 'ok', data: { opened: 2_000_000_000 } },
    ]) {
      expect(nextRecord(loaded).opened).toBe(1);
    }
  });
});
