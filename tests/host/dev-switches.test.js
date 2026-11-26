import { describe, expect, it } from 'vitest';
import { devSwitchesAllowed, removeDevSwitches } from '../../app/main/dev-switches.js';

describe('devSwitchesAllowed', () => {
  it('allows a run from source and the test build', () => {
    expect(devSwitchesAllowed({ packaged: false, channel: 'release' })).toBe(true);
    expect(devSwitchesAllowed({ packaged: true, channel: 'test' })).toBe(true);
  });

  it('refuses an installed release', () => {
    expect(devSwitchesAllowed({ packaged: true, channel: 'release' })).toBe(false);
    expect(devSwitchesAllowed({ packaged: true, channel: undefined })).toBe(false);
  });
});

describe('removeDevSwitches', () => {
  it('removes the DESKTOP2_ variables and the dev server address, and nothing else', () => {
    const env = {
      DESKTOP2_CHROMIUM_FLAGS: 'no-sandbox',
      DESKTOP2_TEST: '1',
      VITE_DEV_SERVER_URL: 'http://example.org',
      PATH: '/usr/bin',
      HOME: '/home/alex',
    };
    removeDevSwitches(env);
    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/home/alex' });
  });
});
