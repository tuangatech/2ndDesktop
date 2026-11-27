// `host.safeArea` (docs/platform/01 sections 6 and 10): where things sit on top of the scene in desktop mode, so a scene
// keeps its focal points out of them. The taskbar, the menu bar and the Dock are the difference between the screen and
// its work area; the desktop icons are a strip at the left on Windows and at the right on the Mac. It is a hint, not a
// rule (icons can be anywhere or hidden; the notch is not reported), and it is read again when the screen changes.
// Pure (the screen numbers are passed in), so it is unit-tested; main.js feeds it `screen` and the page size.
// In a window nothing covers the scene: all zero and no icon strip.

/** @typedef {{top: number, right: number, bottom: number, left: number,
 *             iconStrip: {side: 'left'|'right', width: number}|null}} SafeArea  CSS pixels of the scene's own size */

const ZERO = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0, iconStrip: null });

/** The share of the width the icon column takes, and its largest size in CSS pixels. */
const ICON_STRIP_SHARE = 0.08;
const ICON_STRIP_MAX = 140;

const clean = (value, max) =>
  Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;

/**
 * @param {{mode: 'window'|'desktop', platform: string, width: number, height: number,
 *          screen?: {width: number, height: number, availLeft?: number, availTop?: number, availWidth: number, availHeight: number}}} input
 *        `width` and `height` are the scene's size; `screen` is the display the page is on
 * @returns {SafeArea}
 */
export function computeSafeArea({ mode, platform, width, height, screen }) {
  if (mode !== 'desktop' || !screen || !(width > 0) || !(height > 0)) return { ...ZERO };
  const availLeft = screen.availLeft ?? 0;
  const availTop = screen.availTop ?? 0;
  // The work area inside the screen, scaled to the scene (the scene covers the whole display in desktop mode).
  const sx = width / screen.width;
  const sy = height / screen.height;
  const left = clean(availLeft * sx, width);
  const top = clean(availTop * sy, height);
  const right = clean((screen.width - availLeft - screen.availWidth) * sx, width);
  const bottom = clean((screen.height - availTop - screen.availHeight) * sy, height);
  const side = platform === 'darwin' ? 'right' : 'left';
  return {
    top,
    right,
    bottom,
    left,
    iconStrip: { side, width: Math.round(Math.min(width * ICON_STRIP_SHARE, ICON_STRIP_MAX)) },
  };
}

/**
 * Builds `host.safeArea`: `get()` reads the numbers now. `read` gives the input of computeSafeArea and is called each
 * time, so a changed display or a moved Dock is seen without a restart.
 * @param {() => Parameters<typeof computeSafeArea>[0]} read
 */
export function createSafeArea(read) {
  return { get: () => computeSafeArea(read()) };
}
