import { describe, expect, it, vi } from 'vitest';
import { SAVE_TIMEOUT_MS, createSceneSwitcher } from '../../app/main/scene-switch.js';

// A switcher with fakes that record the order of the steps.
function setup(overrides = {}) {
  const steps = [];
  let active = 'fishtank';
  const deps = {
    current: () => active,
    canChoose: (id) => ['fishtank', 'empty'].includes(id),
    askSave: async () => {
      steps.push('ask');
      return true;
    },
    flush: () => {
      steps.push('flush');
      return true;
    },
    activate: (id) => {
      steps.push(`activate ${id}`);
      active = id;
      return true;
    },
    reload: async () => {
      steps.push('reload');
      return true;
    },
    log: vi.fn(),
    ...overrides,
  };
  return { steps, deps, switcher: createSceneSwitcher(deps), active: () => active };
}

describe('createSceneSwitcher', () => {
  it('saves, writes the records, remembers the scene and only then loads the page again', async () => {
    const { steps, switcher, active } = setup();
    expect(await switcher.switchTo('empty')).toEqual({ ok: true });
    expect(steps).toEqual(['ask', 'flush', 'activate empty', 'reload']);
    expect(active()).toBe('empty');
  });

  it('refuses an unknown scene and the scene that already runs, without touching anything', async () => {
    const { steps, switcher } = setup();
    expect(await switcher.switchTo('nope')).toEqual({ ok: false, reason: 'unknown' });
    expect(await switcher.switchTo('../x')).toEqual({ ok: false, reason: 'unknown' });
    expect(await switcher.switchTo('fishtank')).toEqual({ ok: false, reason: 'same' });
    expect(steps).toEqual([]);
  });

  it('refuses while the window is not ready (a mode change, no window)', async () => {
    const { steps, switcher } = setup({ ready: () => false });
    expect(await switcher.switchTo('empty')).toEqual({ ok: false, reason: 'not-ready' });
    expect(steps).toEqual([]);
  });

  it('ignores a second switch while one is under way, and works again afterwards', async () => {
    let release;
    const { switcher, steps } = setup({
      askSave: () => new Promise((resolve) => (release = () => resolve(true))),
    });
    const first = switcher.switchTo('empty');
    expect(switcher.isBusy()).toBe(true);
    expect(await switcher.switchTo('empty')).toEqual({ ok: false, reason: 'busy' });
    release();
    expect(await first).toEqual({ ok: true });
    expect(switcher.isBusy()).toBe(false);
    expect(steps).toContain('reload');
  });

  it('goes on when the page does not answer in time, and says so in the log', async () => {
    const { switcher, deps } = setup({ askSave: async () => false });
    expect(await switcher.switchTo('empty')).toEqual({ ok: true });
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('did not answer'));
  });

  it('does not switch when a record is still unsaved: the old scene goes on', async () => {
    const { steps, switcher, active } = setup({ flush: () => false });
    expect(await switcher.switchTo('empty')).toEqual({ ok: false, reason: 'unsaved' });
    expect(steps).not.toContain('reload');
    expect(active()).toBe('fishtank');
    expect(switcher.isBusy()).toBe(false);
  });

  it('does not load the page when the choice could not be written', async () => {
    const { steps, switcher } = setup({ activate: () => false });
    expect(await switcher.switchTo('empty')).toEqual({ ok: false, reason: 'not-written' });
    expect(steps).not.toContain('reload');
  });

  it('reports a window that went away, and a load that throws, and is free again after both', async () => {
    const gone = setup({ reload: async () => false });
    expect(await gone.switcher.switchTo('empty')).toEqual({ ok: false, reason: 'no-window' });
    const broken = setup({
      reload: async () => {
        throw Object.assign(new Error('C:\\Users\\someone\\x'), { code: 'ERR_FAILED' });
      },
    });
    expect(await broken.switcher.switchTo('empty')).toEqual({ ok: false, reason: 'error' });
    expect(broken.switcher.isBusy()).toBe(false);
    // The log line carries the error code only, never the message (it can hold a path).
    expect(JSON.stringify(broken.deps.log.mock.calls)).not.toContain('someone');
  });

  it('gives the page one second to answer', () => {
    expect(SAVE_TIMEOUT_MS).toBe(1000);
  });
});
