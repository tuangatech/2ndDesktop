import { describe, expect, it } from 'vitest';
import { RECORD_SCHEMA, seen, startFast, startState, stopFast } from '../state.js';

const ok = (data) => ({ status: 'ok', data });

describe('the record of the farm house', () => {
  it('starts from nothing when there is no record, a damaged one or a strange one', () => {
    for (const loaded of [
      undefined,
      { status: 'missing' },
      { status: 'corrupt' },
      ok(null),
      ok('x'),
      ok(5),
      ok([]),
    ]) {
      expect(startState(loaded)).toEqual({
        schema: RECORD_SCHEMA,
        opened: 1,
        lastSeenAt: null,
        lastWeather: null,
        seasonMode: 'calendar',
        fastStartedAt: null,
      });
    }
  });

  it('counts the starts and keeps what was saved', () => {
    const state = startState(
      ok({
        opened: 4,
        lastSeenAt: 1_700_000_000_000,
        lastWeather: 'rain',
        seasonMode: 'fast',
        fastStartedAt: 1_699_000_000_000,
      }),
    );
    expect(state).toEqual({
      schema: 1,
      opened: 5,
      lastSeenAt: 1_700_000_000_000,
      lastWeather: 'rain',
      seasonMode: 'fast',
      fastStartedAt: 1_699_000_000_000,
    });
  });

  it('never trusts the file: numbers, words and modes are checked', () => {
    const state = startState(
      ok({
        opened: -3,
        lastSeenAt: 'yesterday',
        lastWeather: '<script>',
        seasonMode: 'monthly',
        fastStartedAt: NaN,
      }),
    );
    expect(state).toMatchObject({
      opened: 1,
      lastSeenAt: null,
      lastWeather: null,
      seasonMode: 'calendar',
      fastStartedAt: null,
    });
    expect(startState(ok({ opened: 1e12 })).opened).toBe(1);
    expect(startState(ok({ lastSeenAt: 1e30 })).lastSeenAt).toBeNull();
  });

  it('Fast mode without the moment it was switched on starts again as Calendar', () => {
    expect(startState(ok({ seasonMode: 'fast' }))).toMatchObject({
      seasonMode: 'calendar',
      fastStartedAt: null,
    });
    expect(startState(ok({ seasonMode: 'calendar', fastStartedAt: 5 })).fastStartedAt).toBeNull();
  });

  it('switching Fast mode on keeps the moment, off forgets it, and what was seen is kept', () => {
    const base = startState(undefined);
    const fast = startFast(base, 1_700_000_000_123.9);
    expect(fast).toMatchObject({ seasonMode: 'fast', fastStartedAt: 1_700_000_000_123 });
    expect(stopFast(fast)).toMatchObject({ seasonMode: 'calendar', fastStartedAt: null });
    expect(seen(fast, 1_700_000_100_000, 'fog')).toMatchObject({
      lastSeenAt: 1_700_000_100_000,
      lastWeather: 'fog',
      seasonMode: 'fast',
    });
  });

  it('is plain data that JSON keeps, and has no animal in it (no names, no positions, R6)', () => {
    const state = seen(startFast(startState(undefined), 5), 10, 'clear');
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(Object.keys(state).sort()).toEqual([
      'fastStartedAt',
      'lastSeenAt',
      'lastWeather',
      'opened',
      'schema',
      'seasonMode',
    ]);
  });
});
