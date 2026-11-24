import { describe, expect, it } from 'vitest';
import {
  FALLBACK_NOTE,
  chooseStartMode,
  settingsForMode,
  settingsOnQuit,
} from '../../app/main/display-mode.js';

describe('chooseStartMode (the safe start, FR-64)', () => {
  it('opens a window on the first launch, when nothing is stored', () => {
    expect(chooseStartMode({}, undefined)).toEqual({
      mode: 'window',
      reason: null,
      remember: true,
    });
    expect(chooseStartMode(undefined, undefined).mode).toBe('window');
  });

  it('uses the remembered mode', () => {
    expect(chooseStartMode({ displayMode: 'window' }).mode).toBe('window');
    expect(chooseStartMode({ displayMode: 'desktop' }).mode).toBe('desktop');
    expect(chooseStartMode({ displayMode: 'desktop', desktopAttempt: 'ok' }).mode).toBe('desktop');
  });

  it('starts in a window, with a reason, when the last desktop attempt did not finish', () => {
    const start = chooseStartMode({ displayMode: 'desktop', desktopAttempt: 'trying' });
    expect(start.mode).toBe('window');
    expect(start.reason).toBeTruthy();
  });

  it('does not worry about a stale attempt when the player last used a window', () => {
    expect(chooseStartMode({ displayMode: 'window', desktopAttempt: 'trying' })).toEqual({
      mode: 'window',
      reason: null,
      remember: true,
    });
  });

  it('after a failure the player is in a window; choosing the desktop again tries again', () => {
    expect(chooseStartMode({ displayMode: 'window', desktopAttempt: 'failed' }).mode).toBe(
      'window',
    );
    expect(chooseStartMode({ displayMode: 'desktop', desktopAttempt: 'failed' }).mode).toBe(
      'desktop',
    );
  });

  it('uses a forced mode as is and remembers nothing', () => {
    expect(chooseStartMode({ displayMode: 'window' }, 'desktop')).toEqual({
      mode: 'desktop',
      reason: null,
      remember: false,
    });
    const forcedWindow = chooseStartMode(
      { displayMode: 'desktop', desktopAttempt: 'trying' },
      'window',
    );
    expect(forcedWindow.remember).toBe(false);
    expect(chooseStartMode({}, 'nonsense').remember).toBe(true); // not a mode: ignored
  });
});

describe('settingsOnQuit', () => {
  it('counts a normal quit during the first seconds on the desktop as a good attempt', () => {
    expect(settingsOnQuit({ displayMode: 'desktop', desktopAttempt: 'trying' })).toEqual({
      desktopAttempt: 'ok',
    });
  });

  it('changes nothing otherwise', () => {
    expect(settingsOnQuit({ displayMode: 'desktop', desktopAttempt: 'ok' })).toBeNull();
    expect(settingsOnQuit({ displayMode: 'window', desktopAttempt: 'failed' })).toBeNull();
    expect(settingsOnQuit({})).toBeNull();
    expect(settingsOnQuit(undefined)).toBeNull();
  });
});

describe('settingsForMode', () => {
  it('remembers the mode the app is in', () => {
    expect(settingsForMode('desktop')).toEqual({ displayMode: 'desktop' });
    expect(settingsForMode('window')).toEqual({ displayMode: 'window' });
  });

  it('remembers a window and a failed attempt when the desktop did not work', () => {
    expect(settingsForMode('window', 'attach failed')).toEqual({
      displayMode: 'window',
      desktopAttempt: 'failed',
    });
  });

  it('has a short note for the tray', () => {
    expect(FALLBACK_NOTE).toBe("Couldn't show on the desktop, showing in a window");
  });
});
