import { describe, expect, it } from 'vitest';
import {
  WINDOW_RULES,
  fitWindowToDisplays,
  normalizeWindowBounds,
  sizeLimitsFor,
} from '../../app/main/placement.js';

const display = (x, y, width, height) => ({ workArea: { x, y, width, height } });
// A 1920 x 1080 screen with a 40 px taskbar at the bottom.
const main = display(0, 0, 1920, 1040);
const inside = (rect, area) =>
  rect.x >= area.x &&
  rect.y >= area.y &&
  rect.x + rect.width <= area.x + area.width &&
  rect.y + rect.height <= area.y + area.height;

describe('first launch (nothing saved)', () => {
  it('opens at the default size in the bottom-right corner, 24 px from the edges', () => {
    expect(fitWindowToDisplays(null, [main], main)).toEqual({
      x: 1920 - 480 - 24,
      y: 1040 - 320 - 24,
      width: 480,
      height: 320,
    });
  });

  it('keeps clear of a taskbar or menu bar on any edge', () => {
    const left = display(60, 0, 1860, 1080); // taskbar on the left
    const top = display(0, 25, 1920, 1055); // macOS menu bar
    for (const screen of [left, top]) {
      const placed = fitWindowToDisplays(undefined, [screen], screen);
      expect(inside(placed, screen.workArea)).toBe(true);
      expect(placed.x + placed.width).toBe(screen.workArea.x + screen.workArea.width - 24);
      expect(placed.y + placed.height).toBe(screen.workArea.y + screen.workArea.height - 24);
    }
  });

  it('uses the primary display, also when it is not the first one listed', () => {
    const left = display(-1920, 0, 1920, 1040);
    const placed = fitWindowToDisplays(null, [left, main], main);
    expect(placed.x).toBeGreaterThanOrEqual(0);
  });

  it('ignores a saved rectangle that is damaged', () => {
    const fresh = fitWindowToDisplays(null, [main], main);
    expect(fitWindowToDisplays({ x: 'a', y: 1, width: 500, height: 300 }, [main], main)).toEqual(
      fresh,
    );
    expect(fitWindowToDisplays({ x: 1, y: 1, width: 0, height: 300 }, [main], main)).toEqual(fresh);
    expect(fitWindowToDisplays({ x: NaN, y: 1, width: 480, height: 320 }, [main], main)).toEqual(
      fresh,
    );
  });
});

describe('a remembered window', () => {
  it('keeps its position and size when it is on a display', () => {
    const saved = { x: 300, y: 200, width: 600, height: 400 };
    expect(fitWindowToDisplays(saved, [main], main)).toEqual(saved);
  });

  it('keeps the 3:2 shape and the size limits of a saved size', () => {
    const wide = fitWindowToDisplays({ x: 0, y: 0, width: 900, height: 300 }, [main], main);
    expect(wide.width / wide.height).toBeCloseTo(1.5, 1);
    const tiny = fitWindowToDisplays({ x: 0, y: 0, width: 100, height: 60 }, [main], main);
    expect(tiny).toMatchObject({ width: WINDOW_RULES.minWidth, height: WINDOW_RULES.minHeight });
    const huge = fitWindowToDisplays({ x: 0, y: 0, width: 5000, height: 3000 }, [main], main);
    expect(huge).toMatchObject({ width: WINDOW_RULES.maxWidth, height: WINDOW_RULES.maxHeight });
  });

  it('shifts a window that is half off the screen back inside', () => {
    const saved = { x: 1700, y: 900, width: 480, height: 320 };
    const placed = fitWindowToDisplays(saved, [main], main);
    expect(placed).toEqual({ x: 1920 - 480, y: 1040 - 320, width: 480, height: 320 });
    const above = fitWindowToDisplays({ x: -300, y: -200, width: 480, height: 320 }, [main], main);
    expect(above).toMatchObject({ x: 0, y: 0 });
  });

  it('moves to the primary display when it is barely visible (under 100 x 60 px)', () => {
    const saved = { x: 1900, y: 1030, width: 480, height: 320 }; // 20 x 10 px on the screen
    expect(fitWindowToDisplays(saved, [main], main)).toEqual(
      fitWindowToDisplays(null, [main], main),
    );
  });

  it('stays on a second display', () => {
    const second = display(1920, 0, 1920, 1080);
    const saved = { x: 2400, y: 300, width: 480, height: 320 };
    expect(fitWindowToDisplays(saved, [main, second], main)).toEqual(saved);
  });

  it('picks the display where most of the window is', () => {
    const second = display(1920, 0, 1920, 1080);
    // 400 px on the first display, 200 px on the second: the first one wins.
    const saved = { x: 1520, y: 300, width: 600, height: 400 };
    const placed = fitWindowToDisplays(saved, [main, second], main);
    expect(inside(placed, main.workArea)).toBe(true);
  });

  it('opens on the primary display, with the saved size, when the second display is gone', () => {
    const saved = { x: 2400, y: 300, width: 720, height: 480 };
    const placed = fitWindowToDisplays(saved, [main], main);
    expect(placed).toEqual({ x: 1920 - 720 - 24, y: 1040 - 480 - 24, width: 720, height: 480 });
  });

  it('handles a display left of or above the primary one (negative coordinates)', () => {
    const left = display(-1280, -100, 1280, 960);
    const saved = { x: -900, y: 50, width: 480, height: 320 };
    expect(fitWindowToDisplays(saved, [left, main], main)).toEqual(saved);
  });

  it('limits the size to a smaller display (mixed scale factors give different work areas)', () => {
    // A 1280 x 800 laptop screen next to a large monitor; the window was 1200 x 800 on the large one.
    const laptop = display(1920, 0, 1280, 760);
    const saved = { x: 1950, y: 10, width: 1200, height: 800 };
    const placed = fitWindowToDisplays(saved, [main, laptop], main);
    expect(inside(placed, laptop.workArea)).toBe(true);
    expect(placed.height).toBeLessThanOrEqual(760);
    expect(placed.width / placed.height).toBeCloseTo(1.5, 1);
  });
});

describe('a small work area', () => {
  it('shrinks below the normal minimum and still fits (work area 300 x 200)', () => {
    const tiny = display(0, 0, 300, 200);
    const placed = fitWindowToDisplays(null, [tiny], tiny);
    expect(inside(placed, tiny.workArea)).toBe(true);
    expect(placed.width).toBeLessThanOrEqual(300);
    expect(placed.height).toBeLessThanOrEqual(200);
    expect(placed.width / placed.height).toBeCloseTo(1.5, 1);
  });

  it('fits a very narrow strip by its height, because the shape is 3:2', () => {
    const wide = display(0, 0, 1200, 150);
    const placed = fitWindowToDisplays(null, [wide], wide);
    expect(placed.height).toBeLessThanOrEqual(150);
    expect(inside(placed, wide.workArea)).toBe(true);
  });
});

describe('sizeLimitsFor', () => {
  it('is the normal rules on a big display', () => {
    expect(sizeLimitsFor({ width: 1920, height: 1040 })).toEqual({
      minWidth: 360,
      minHeight: 240,
      maxWidth: 1200,
      maxHeight: 800,
    });
  });

  it('is limited by the usable area', () => {
    const limits = sizeLimitsFor({ width: 1000, height: 600 });
    expect(limits.maxWidth).toBe(900);
    expect(limits.maxHeight).toBe(600);
  });

  it('lowers the minimum when the area is smaller than it', () => {
    const limits = sizeLimitsFor({ width: 300, height: 200 });
    expect(limits.minWidth).toBe(300);
    expect(limits.minHeight).toBe(200);
    expect(limits.maxWidth).toBe(300);
  });
});

describe('normalizeWindowBounds', () => {
  it('rounds a valid rectangle and refuses everything else', () => {
    expect(normalizeWindowBounds({ x: 10.4, y: 20.6, width: 480.2, height: 320.1 })).toEqual({
      x: 10,
      y: 21,
      width: 480,
      height: 320,
    });
    expect(normalizeWindowBounds(null)).toBeNull();
    expect(normalizeWindowBounds('x')).toBeNull();
    expect(normalizeWindowBounds({ x: 1, y: 1, width: -5, height: 5 })).toBeNull();
    expect(normalizeWindowBounds({ x: Infinity, y: 1, width: 5, height: 5 })).toBeNull();
  });
});
