import { describe, expect, it } from 'vitest';
import {
  RELOAD_LIMIT,
  RELOAD_WINDOW_MS,
  decideReload,
  reloadAllowed,
} from '../../renderer/reloadGuard.js';

describe('decideReload', () => {
  it('reloads the first times and remembers when', () => {
    expect(decideReload([], 1000)).toEqual({ reload: true, times: [1000] });
    expect(decideReload([1000], 2000)).toEqual({ reload: true, times: [1000, 2000] });
  });

  it('stops after the limit within the window', () => {
    let times = [];
    const answers = [];
    for (let i = 0; i < RELOAD_LIMIT + 2; i++) {
      const decision = decideReload(times, 1000 + i * 100);
      answers.push(decision.reload);
      times = decision.times;
    }
    expect(answers).toEqual([true, true, true, false, false]);
    expect(times.length).toBe(RELOAD_LIMIT); // a refused reload is not counted
  });

  it('forgets reloads older than the window, so a later loss reloads again', () => {
    const old = [0, 100, 200];
    expect(decideReload(old, RELOAD_WINDOW_MS + 1000).reload).toBe(true);
    expect(decideReload(old, 5000).reload).toBe(false);
  });

  it('ignores damaged values', () => {
    expect(decideReload('nope', 10)).toEqual({ reload: true, times: [10] });
    expect(decideReload([NaN, 'x', null, 99999], 10).reload).toBe(true); // the future one is dropped too
  });
});

describe('reloadAllowed', () => {
  const memory = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  };

  it('allows the first reloads and then refuses', () => {
    const storage = memory();
    const answers = [0, 1, 2, 3, 4].map((i) => reloadAllowed(storage, 5000 + i));
    expect(answers).toEqual([true, true, true, false, false]);
  });

  it('keeps the old behaviour (reload) when storage is missing or throws', () => {
    expect(reloadAllowed(null)).toBe(true);
    const broken = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {},
    };
    expect(reloadAllowed(broken)).toBe(true);
  });
});
