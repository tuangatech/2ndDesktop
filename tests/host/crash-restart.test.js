import { describe, expect, it, vi } from 'vitest';
import {
  CRASH_ONLY,
  MAX_COMMAND_LINE,
  RESTARTED_ARG,
  createCrashRestart,
  quoteArg,
  restartCommandLine,
} from '../../app/main/crash-restart.js';

describe('quoteArg', () => {
  it('leaves a plain argument alone and quotes one with spaces', () => {
    expect(quoteArg('--login')).toBe('--login');
    expect(quoteArg('C:\\Some App\\app')).toBe('"C:\\Some App\\app"');
    expect(quoteArg('')).toBe('""');
  });

  it('escapes quotes and trailing backslashes the way the Windows parser reads them back', () => {
    expect(quoteArg('say "hi"')).toBe('"say \\"hi\\""');
    expect(quoteArg('C:\\Some Folder\\')).toBe('"C:\\Some Folder\\\\"');
  });
});

describe('restartCommandLine', () => {
  it('is only the marker for an installed app', () => {
    expect(restartCommandLine()).toBe(RESTARTED_ARG);
  });

  it('starts with the app folder in a development run, quoted when it has spaces', () => {
    expect(restartCommandLine({ appPath: 'C:\\Projects\\fish-tank' })).toBe(
      `C:\\Projects\\fish-tank ${RESTARTED_ARG}`,
    );
    expect(restartCommandLine({ appPath: 'C:\\My Projects\\fish-tank' })).toBe(
      `"C:\\My Projects\\fish-tank" ${RESTARTED_ARG}`,
    );
  });

  it('keeps flags such as --login and never repeats the marker', () => {
    expect(restartCommandLine({ flags: ['--login', RESTARTED_ARG] })).toBe(
      `--login ${RESTARTED_ARG}`,
    );
  });

  it('gives up (null) when the line would be too long for Windows', () => {
    expect(restartCommandLine({ appPath: 'x'.repeat(MAX_COMMAND_LINE) })).toBeNull();
  });
});

function fakeApi(result = 0) {
  return {
    RegisterApplicationRestart: vi.fn(() => result),
    UnregisterApplicationRestart: vi.fn(() => 0),
  };
}

describe('createCrashRestart', () => {
  it('registers once with the crash-only flags, and not again for the same state', () => {
    const api = fakeApi();
    const restart = createCrashRestart({
      platform: 'win32',
      commandLine: () => '--restarted',
      loadApi: () => api,
    });
    expect(restart.set(true)).toBe(true);
    expect(restart.set(true)).toBe(true);
    expect(api.RegisterApplicationRestart).toHaveBeenCalledTimes(1);
    expect(api.RegisterApplicationRestart).toHaveBeenCalledWith('--restarted', CRASH_ONLY);
    expect(restart.isOn()).toBe(true);
  });

  it('restarts after a crash only, not after a hang, a patch or a reboot', () => {
    expect(CRASH_ONLY).toBe(2 | 4 | 8);
  });

  it('switches off again (a crashed window should not come back by itself)', () => {
    const api = fakeApi();
    const restart = createCrashRestart({
      platform: 'win32',
      commandLine: () => '--restarted',
      loadApi: () => api,
    });
    restart.set(true);
    expect(restart.set(false)).toBe(false);
    expect(api.UnregisterApplicationRestart).toHaveBeenCalledTimes(1);
    expect(restart.set(false)).toBe(false);
    expect(api.UnregisterApplicationRestart).toHaveBeenCalledTimes(1);
  });

  it('does nothing outside Windows', () => {
    const loadApi = vi.fn();
    const restart = createCrashRestart({ platform: 'darwin', commandLine: () => 'x', loadApi });
    expect(restart.set(true)).toBe(false);
    expect(loadApi).not.toHaveBeenCalled();
  });

  it('stays off, and says so, when Windows refuses or the line is too long', () => {
    const logs = [];
    const refused = createCrashRestart({
      platform: 'win32',
      commandLine: () => 'x',
      loadApi: () => fakeApi(0x80070057),
      log: (m) => logs.push(m),
    });
    expect(refused.set(true)).toBe(false);
    expect(logs.join()).toContain('0x80070057');

    const tooLong = createCrashRestart({
      platform: 'win32',
      commandLine: () => null,
      loadApi: () => fakeApi(),
      log: (m) => logs.push(m),
    });
    expect(tooLong.set(true)).toBe(false);
    expect(logs.join()).toContain('too long');
  });

  it('never throws, also when the native library cannot be loaded', () => {
    const restart = createCrashRestart({
      platform: 'win32',
      commandLine: () => 'x',
      loadApi: () => {
        throw new Error('no koffi');
      },
    });
    expect(restart.set(true)).toBe(false);
  });
});
