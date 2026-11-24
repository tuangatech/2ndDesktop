import { describe, expect, it } from 'vitest';
import {
  buildText,
  describeGpuDevice,
  displayPath,
  sanitize,
  shortenPaths,
  tailLines,
} from '../../electron/diagnostics.js';

describe('sanitize', () => {
  it('removes a Windows home folder, with either kind of slash', () => {
    const who = { home: 'C:\\Users\\alex', userName: 'alex' };
    const text = sanitize(
      'a C:\\Users\\alex\\AppData\\Roaming\\x b C:/Users/alex/AppData c C:\\\\Users\\\\alex\\\\y',
      who,
    );
    expect(text).not.toMatch(/alex/i);
    expect(text).toContain('~');
  });

  it('removes a macOS home folder', () => {
    const text = sanitize('/Users/jane/Library/Application Support/2ndDesktop/log', {
      home: '/Users/jane',
      userName: 'jane',
    });
    expect(text).toBe('~/Library/Application Support/2ndDesktop/log');
  });

  it('removes a user folder even when the real home is not given', () => {
    expect(sanitize('C:\\Users\\Someone\\x')).not.toMatch(/Someone/);
    expect(sanitize('/home/alex/x /Users/alex/y')).toBe('~/x ~/y');
  });

  it('removes the user name wherever it appears, and leaves short names alone', () => {
    expect(sanitize('computer of Jordan: ok', { userName: 'jordan' })).toBe('computer of user: ok');
    expect(sanitize('ab ok', { userName: 'ab' })).toBe('ab ok');
  });
});

describe('buildText', () => {
  const data = {
    appInfo: {
      version: '0.0.1',
      platform: 'win32',
      arch: 'x64',
      electron: '45.0.0',
      chrome: '140',
    },
    mode: 'desktop',
    display: { width: 2560, height: 1600, scale: 1.5 },
    settings: { alwaysOnTop: false, sound: false },
    logLines: ['2026-11-21T10:00:00Z mode is now desktop', 'saved in C:\\Users\\alex\\AppData\\x'],
  };

  it('lists the version, system, mode, display and the recent log', () => {
    const text = buildText(data, { home: 'C:\\Users\\alex', userName: 'alex' });
    expect(text).toContain('Version: 0.0.1');
    expect(text).toContain('System: win32 x64');
    expect(text).toContain('Display mode: desktop');
    expect(text).toContain('Display: 2560 x 1600 at 150%');
    expect(text).toContain('sound: off');
    expect(text).toContain('mode is now desktop');
  });

  it('never contains the home folder or the user name', () => {
    const text = buildText(data, { home: 'C:\\Users\\alex', userName: 'alex' });
    expect(text).not.toMatch(/alex/i);
  });
});

describe('shortenPaths', () => {
  it('reduces file URLs and paths to the file name, keeping line and column', () => {
    expect(shortenPaths('at f (file:///C:/app/dist/renderer/index.js:10:5)')).toBe(
      'at f (index.js:10:5)',
    );
    expect(shortenPaths('at C:\\Fish\\electron\\main.js:42:7')).toBe('at main.js:42:7');
    expect(shortenPaths('at /Users/x/app/main.js:3:1 end')).toBe('at main.js:3:1 end');
  });

  it('leaves ordinary text and short slashes alone', () => {
    expect(shortenPaths('TypeError: x is undefined')).toBe('TypeError: x is undefined');
    expect(shortenPaths('read 3/4 of it')).toBe('read 3/4 of it');
  });
});

describe('tailLines', () => {
  it('keeps the last lines and skips empty ones', () => {
    expect(tailLines('a\r\nb\n\nc\nd\n', 2)).toEqual(['c', 'd']);
  });
});

describe('describeGpuDevice', () => {
  it('names the vendor and leaves out a device id of 0', () => {
    expect(describeGpuDevice({ vendorId: 0x106b, deviceId: 0, active: true })).toBe(
      'Apple (vendor 0x106b) (active)',
    );
    expect(describeGpuDevice({ vendorId: 0x10de, deviceId: 0x2684, active: true })).toBe(
      'NVIDIA (vendor 0x10de) device 0x2684 (active)',
    );
    expect(describeGpuDevice({ vendorId: 0x8086, deviceId: 0x46a6 })).toBe(
      'Intel (vendor 0x8086) device 0x46a6',
    );
  });

  it('keeps the raw ids for a vendor it does not know, and survives missing values', () => {
    expect(describeGpuDevice({ vendorId: 0x1234, deviceId: 0x5678 })).toBe(
      'vendor 0x1234 device 0x5678',
    );
    expect(describeGpuDevice()).toBe('unknown');
  });
});

describe('displayPath', () => {
  const winWhere = {
    platform: 'win32',
    home: 'C:\\Users\\Jane',
    appData: 'C:\\Users\\Jane\\AppData\\Roaming',
  };

  it('shows %APPDATA% on Windows and ~ on macOS, never the user name', () => {
    const win = displayPath('C:\\Users\\Jane\\AppData\\Roaming\\2ndDesktop\\records', winWhere);
    expect(win).toBe('%APPDATA%\\2ndDesktop\\records');
    const mac = displayPath('/Users/jane/Library/Application Support/2ndDesktop/records', {
      platform: 'darwin',
      home: '/Users/jane',
      appData: '/Users/jane/Library/Application Support',
    });
    expect(mac).toBe('~/Library/Application Support/2ndDesktop/records');
  });

  it('falls back to a sanitized path for a folder outside the usual place', () => {
    const odd = displayPath('C:\\Users\\Jane\\tank-test\\records', winWhere);
    expect(odd).not.toMatch(/Jane/);
    expect(displayPath('/tmp/x/records', { platform: 'darwin', home: '/Users/jane' })).toBe(
      '/tmp/x/records',
    );
  });
});

describe('the scene line of the diagnostics text', () => {
  const data = {
    appInfo: { version: '1', platform: 'win32', electron: '1', chrome: '1' },
    mode: 'window',
  };

  it('prints the line the scene reported, as it is', () => {
    const text = buildText({ ...data, sceneLine: 'Fish: 2, pellets fed in total: 4' });
    expect(text).toContain('Fish: 2, pellets fed in total: 4');
  });

  it('prints nothing when the scene reported nothing', () => {
    expect(buildText(data)).not.toContain('Fish:');
  });
});
