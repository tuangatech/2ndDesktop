import { describe, expect, it } from 'vitest';
import { MAC_COVER_SHARE, coveredShare, decideCovered, rectToEdges } from '../../app/main/cover.js';

const primary = { left: 0, top: 0, right: 2560, bottom: 1600 };
const base = {
  visible: true,
  iconic: false,
  cloaked: false,
  zoomed: false,
  className: 'Chrome_WidgetWin_1',
  pid: 100,
  rect: { left: 100, top: 100, right: 800, bottom: 600 },
};
const make = (patch) => ({ ...base, ...patch });

describe('decideCovered', () => {
  it('is false without a foreground window', () => {
    expect(decideCovered(null, primary, 1)).toBe(false);
  });

  it('is false for a small window', () => {
    expect(decideCovered(base, primary, 1)).toBe(false);
  });

  it('is true for a maximized window on the primary display', () => {
    const win = make({ zoomed: true, rect: { left: -8, top: -8, right: 2568, bottom: 1560 } });
    expect(decideCovered(win, primary, 1)).toBe(true);
  });

  it('is true for a full-screen window that is not flagged as maximized', () => {
    const win = make({ rect: { left: 0, top: 0, right: 2560, bottom: 1600 } });
    expect(decideCovered(win, primary, 1)).toBe(true);
  });

  it('ignores the shell windows and the taskbar', () => {
    for (const className of ['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']) {
      const win = make({ className, zoomed: true });
      expect(decideCovered(win, primary, 1)).toBe(false);
    }
  });

  it('ignores our own window', () => {
    expect(decideCovered(make({ zoomed: true, pid: 7 }), primary, 7)).toBe(false);
  });

  it('ignores minimized, hidden and cloaked windows', () => {
    expect(decideCovered(make({ zoomed: true, iconic: true }), primary, 1)).toBe(false);
    expect(decideCovered(make({ zoomed: true, visible: false }), primary, 1)).toBe(false);
    expect(decideCovered(make({ zoomed: true, cloaked: true }), primary, 1)).toBe(false);
  });

  it('ignores a maximized window on another display', () => {
    const win = make({ zoomed: true, rect: { left: 2560, top: 0, right: 4480, bottom: 1080 } });
    expect(decideCovered(win, primary, 1)).toBe(false);
  });
});

describe('rectToEdges', () => {
  it('turns an Electron rectangle into edges that decideCovered understands', () => {
    const primary = rectToEdges({ x: 0, y: 0, width: 2561, height: 1601 });
    expect(primary).toEqual({ left: 0, top: 0, right: 2561, bottom: 1601 });
    // The maximized window seen on the test machine, with the taskbar leaving the bottom short.
    const maximized = {
      visible: true,
      iconic: false,
      cloaked: false,
      zoomed: true,
      className: 'Chrome_WidgetWin_1',
      pid: 1,
      rect: { left: -11, top: -11, right: 2571, bottom: 1539 },
    };
    expect(decideCovered(maximized, primary, 99)).toBe(true);
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
