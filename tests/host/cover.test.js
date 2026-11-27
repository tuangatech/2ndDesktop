import { describe, expect, it } from 'vitest';
import {
  MAC_COVER_SHARE,
  WIN_COVER_SHARE,
  coverWindowsWin,
  coveredShare,
  isShowDesktopMac,
  rectToEdges,
} from '../../app/main/cover.js';

describe('the Windows cover check (docs/platform/03, DEC-45)', () => {
  // A 2560 x 1440 primary display with a 48-pixel taskbar at the bottom, and a second display to its right.
  const workArea = { x: 0, y: 0, width: 2560, height: 1392 };
  const raw = (left, top, right, bottom, patch = {}) => ({
    visible: true,
    iconic: false,
    cloaked: false,
    className: 'Chrome_WidgetWin_1',
    pid: 100,
    exStyle: 0,
    rect: { left, top, right, bottom },
    ...patch,
  });
  const share = (windows) => coveredShare(coverWindowsWin(windows, 1), workArea, 1);
  const covered = (windows) => share(windows) >= WIN_COVER_SHARE;

  it('is not covered with no windows, or with a small one', () => {
    expect(share([])).toBe(0);
    expect(covered([raw(100, 100, 800, 600)])).toBe(false);
  });

  it('is covered by a maximized window (its visible frame fills the work area)', () => {
    expect(covered([raw(0, 0, 2560, 1392)])).toBe(true);
  });

  it('is covered by a full-screen window that also hides the taskbar', () => {
    expect(covered([raw(0, 0, 2560, 1440)])).toBe(true);
  });

  it('is covered by two snapped windows side by side, also with small gaps', () => {
    expect(covered([raw(0, 0, 1280, 1392), raw(1280, 0, 2560, 1392)])).toBe(true);
    expect(covered([raw(4, 4, 1276, 1388), raw(1284, 4, 2556, 1388)])).toBe(true);
  });

  it('is not covered by one window on the left half, or two overlapping small ones', () => {
    expect(covered([raw(0, 0, 1280, 1392)])).toBe(false);
    expect(covered([raw(0, 0, 1400, 900), raw(300, 200, 1500, 1000)])).toBe(false);
  });

  it('sees a maximized window on the primary display whatever has the focus (the old finding)', () => {
    // The list is front to back: a window on the second display is in front, the maximized one behind it.
    expect(covered([raw(2560, 0, 4480, 1032), raw(0, 0, 2560, 1392)])).toBe(true);
  });

  it('does not count a maximized window that is only on the second display', () => {
    expect(covered([raw(2560, 0, 4480, 1032)])).toBe(false);
  });

  it('counts only the part of a window that is on the primary display', () => {
    expect(share([raw(1280, 0, 3840, 1392)])).toBeCloseTo(0.5, 5);
  });

  it('is not covered after Show Desktop (Win+D): every window is minimized', () => {
    expect(
      covered([raw(0, 0, 2560, 1392, { iconic: true }), raw(0, 0, 1280, 1392, { iconic: true })]),
    ).toBe(false);
  });

  it('leaves out hidden, minimized and cloaked windows (another virtual desktop, a suspended app)', () => {
    expect(coverWindowsWin([raw(0, 0, 2560, 1392, { visible: false })], 1)).toEqual([]);
    expect(coverWindowsWin([raw(0, 0, 2560, 1392, { iconic: true })], 1)).toEqual([]);
    expect(coverWindowsWin([raw(0, 0, 2560, 1392, { cloaked: true })], 1)).toEqual([]);
  });

  it('leaves out the shell: the desktop, the taskbar and the icon layer', () => {
    for (const className of [
      'Progman',
      'WorkerW',
      'Shell_TrayWnd',
      'Shell_SecondaryTrayWnd',
      'SHELLDLL_DefView',
    ]) {
      expect(covered([raw(0, 0, 2560, 1440, { className })])).toBe(false);
    }
  });

  it('leaves out our own windows', () => {
    expect(coverWindowsWin([raw(0, 0, 2560, 1392, { pid: 1 })], 1)).toEqual([]);
  });

  it('leaves out windows that are not normal app windows: tool windows, no-activate overlays, click-through overlays', () => {
    const WS_EX_TRANSPARENT = 0x20;
    const WS_EX_TOOLWINDOW = 0x80;
    const WS_EX_NOACTIVATE = 0x08000000;
    for (const exStyle of [
      WS_EX_TRANSPARENT,
      WS_EX_TOOLWINDOW,
      WS_EX_NOACTIVATE,
      0x00080000 | WS_EX_TOOLWINDOW,
    ]) {
      expect(covered([raw(0, 0, 2560, 1392, { exStyle })])).toBe(false);
    }
    // A layered window is an ordinary app window (many apps use the style); only the flags above exclude one.
    expect(covered([raw(0, 0, 2560, 1392, { exStyle: 0x00080000 })])).toBe(true);
  });

  it('keeps the class name and the process for the log, and the size as bounds', () => {
    expect(coverWindowsWin([raw(10, 20, 110, 220)], 1)).toEqual([
      {
        pid: 100,
        layer: 0,
        alpha: 1,
        className: 'Chrome_WidgetWin_1',
        bounds: { x: 10, y: 20, width: 100, height: 200 },
      },
    ]);
  });
});

describe('rectToEdges', () => {
  it('turns an Electron rectangle into edges', () => {
    expect(rectToEdges({ x: 0, y: 0, width: 2561, height: 1601 })).toEqual({
      left: 0,
      top: 0,
      right: 2561,
      bottom: 1601,
    });
  });
});

describe('coveredShare (macOS)', () => {
  // A 1512 x 982 display with a 33-point menu bar and the Dock at the bottom.
  const workArea = { x: 0, y: 33, width: 1512, height: 859 };
  const win = (x, y, width, height, patch = {}) => ({
    pid: 100,
    layer: 0,
    alpha: 1,
    bounds: { x, y, width, height },
    ...patch,
  });
  const covered = (windows) => coveredShare(windows, workArea, 1) >= MAC_COVER_SHARE;

  it('is 0 with no windows', () => {
    expect(coveredShare([], workArea, 1)).toBe(0);
  });

  it('a window that fills the work area covers it', () => {
    expect(coveredShare([win(0, 33, 1512, 859)], workArea, 1)).toBe(1);
  });

  it('a window larger than the display counts only inside the work area', () => {
    expect(coveredShare([win(-50, 0, 1700, 1000)], workArea, 1)).toBe(1);
  });

  it('a small window does not cover the desktop', () => {
    expect(covered([win(100, 100, 800, 500)])).toBe(false);
  });

  it('two tiled halves with small gaps cover it together', () => {
    expect(covered([win(4, 37, 750, 851), win(758, 37, 750, 851)])).toBe(true);
  });

  it('overlapping windows are not counted twice', () => {
    const half = win(0, 33, 756, 859);
    expect(coveredShare([half, half, win(300, 33, 456, 859)], workArea, 1)).toBeCloseTo(0.5, 5);
  });

  it('a window most of the way across leaves the desktop visible', () => {
    expect(covered([win(0, 33, 1300, 859)])).toBe(false);
  });

  it('skips our own windows, other layers and invisible windows', () => {
    const full = [0, 33, 1512, 859];
    expect(covered([win(...full, { pid: 1 })])).toBe(false);
    expect(covered([win(...full, { layer: 25 })])).toBe(false);
    expect(covered([win(...full, { alpha: 0 })])).toBe(false);
  });

  it('a window on another display does not count', () => {
    expect(covered([win(1512, 0, 1920, 1080)])).toBe(false);
  });

  it('an empty work area is never covered', () => {
    expect(coveredShare([win(0, 0, 100, 100)], { x: 0, y: 0, width: 0, height: 0 }, 1)).toBe(0);
  });
});

describe('isShowDesktopMac', () => {
  const display = { width: 1512, height: 982 };
  const at = (layer, width, height) => ({ layer, bounds: { x: 0, y: 0, width, height } });

  it('is true for a display-sized window on the Show Desktop layer', () => {
    expect(isShowDesktopMac([at(0, 800, 600), at(18, 1512, 982)], display)).toBe(true);
  });

  it('is false for a display-sized window on another layer', () => {
    expect(isShowDesktopMac([at(0, 1512, 982), at(20, 1512, 982)], display)).toBe(false);
  });

  it('is false for a small window on the Show Desktop layer, or no windows', () => {
    expect(isShowDesktopMac([at(18, 300, 200)], display)).toBe(false);
    expect(isShowDesktopMac([], display)).toBe(false);
  });
});
