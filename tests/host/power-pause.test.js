import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { POWER_PAUSES, wirePowerPause } from '../../app/main/power-pause.js';

// The same bookkeeping as setPauseReason in app/main/desktop.js: paused while any reason is left.
function setup() {
  const monitor = new EventEmitter();
  const reasons = new Set();
  wirePowerPause(monitor, (reason, on) => (on ? reasons.add(reason) : reasons.delete(reason)));
  return { monitor, paused: () => reasons.size > 0 };
}

describe('power events and the pause (docs/platform/01 section 7)', () => {
  it('uses two reasons: the lock screen and the suspended computer', () => {
    expect(new Set(POWER_PAUSES.map(([, reason]) => reason))).toEqual(
      new Set(['locked', 'asleep']),
    );
    expect(POWER_PAUSES.map(([event]) => event).sort()).toEqual([
      'lock-screen',
      'resume',
      'suspend',
      'unlock-screen',
    ]);
  });

  it('pauses on lock and resumes on unlock', () => {
    const { monitor, paused } = setup();
    monitor.emit('lock-screen');
    expect(paused()).toBe(true);
    monitor.emit('unlock-screen');
    expect(paused()).toBe(false);
  });

  it('pauses on suspend and resumes on resume', () => {
    const { monitor, paused } = setup();
    monitor.emit('suspend');
    expect(paused()).toBe(true);
    monitor.emit('resume');
    expect(paused()).toBe(false);
  });

  it('stays paused after a wake while the screen is still locked', () => {
    const { monitor, paused } = setup();
    monitor.emit('lock-screen');
    monitor.emit('suspend');
    monitor.emit('resume');
    expect(paused()).toBe(true);
    monitor.emit('unlock-screen');
    expect(paused()).toBe(false);
  });

  it('stays paused after an unlock while the computer is still suspended', () => {
    const { monitor, paused } = setup();
    monitor.emit('suspend');
    monitor.emit('lock-screen');
    monitor.emit('unlock-screen');
    expect(paused()).toBe(true);
    monitor.emit('resume');
    expect(paused()).toBe(false);
  });
});
