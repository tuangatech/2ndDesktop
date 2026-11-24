// Window rules and placement for window mode (FR-19, D22, tech design 3.7). Pure functions over plain rectangles,
// so they are unit-tested without Electron. All numbers are device-independent pixels, as Electron reports them.

export const WINDOW_RULES = Object.freeze({
  width: 480,
  height: 320,
  minWidth: 360,
  minHeight: 240,
  maxWidth: 1200,
  maxHeight: 800,
  /** The shape is always 3:2. */
  ratio: 3 / 2,
  /** Distance from the corner of the work area on the first launch. */
  margin: 24,
  /** How much of a remembered window must lie on a display for the position to be kept. */
  minVisibleWidth: 100,
  minVisibleHeight: 60,
});

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** A saved window rectangle with finite numbers and a positive size, or null. */
export function normalizeWindowBounds(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { x, y, width, height } = raw;
  if (![x, y, width, height].every(isNumber) || width <= 0 || height <= 0) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * The size limits for a window on a display: the rules, but never larger than the usable area of the display.
 * When the area is smaller than the rules' minimum, the minimum shrinks to fit (the window must stay on the display).
 * The limits keep the 3:2 shape: the width limits are the ones that decide.
 * @param {{width: number, height: number}} area
 */
export function sizeLimitsFor(area) {
  const maxWidth = Math.max(
    1,
    Math.floor(Math.min(WINDOW_RULES.maxWidth, area.width, area.height * WINDOW_RULES.ratio)),
  );
  const minWidth = Math.min(WINDOW_RULES.minWidth, maxWidth);
  return {
    minWidth,
    minHeight: Math.round(minWidth / WINDOW_RULES.ratio),
    maxWidth,
    maxHeight: Math.round(maxWidth / WINDOW_RULES.ratio),
  };
}

/** The size to use on a display: the wanted width (3:2) kept between the limits of that display. */
function fitSize(wantedWidth, area) {
  const limits = sizeLimitsFor(area);
  const width = Math.min(Math.max(Math.round(wantedWidth), limits.minWidth), limits.maxWidth);
  return { width, height: Math.round(width / WINDOW_RULES.ratio) };
}

function overlap(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

/**
 * Where the window opens (run once, at launch).
 * If the remembered rectangle has at least 100 x 60 px on some display's work area, the position is kept: the
 * window is moved just far enough to lie fully inside and its size is limited to that work area. Otherwise (first
 * launch, or the monitor is gone) the window goes to the bottom-right corner of the primary display's work area,
 * 24 px from the edges, with the remembered size when there is one.
 * @param {{x: number, y: number, width: number, height: number} | null | undefined} saved
 * @param {{workArea: {x: number, y: number, width: number, height: number}}[]} displays
 * @param {{workArea: {x: number, y: number, width: number, height: number}}} primary
 */
export function fitWindowToDisplays(saved, displays, primary) {
  const bounds = normalizeWindowBounds(saved);
  const wantedWidth = bounds ? bounds.width : WINDOW_RULES.width;

  if (bounds) {
    // The display where most of the window is. A tie goes to the first one listed.
    let best = null;
    for (const display of displays) {
      const { width, height } = overlap(bounds, display.workArea);
      const enough =
        width >= Math.min(WINDOW_RULES.minVisibleWidth, bounds.width) &&
        height >= Math.min(WINDOW_RULES.minVisibleHeight, bounds.height);
      if (enough && (!best || width * height > best.area)) best = { display, area: width * height };
    }
    if (best) {
      const area = best.display.workArea;
      const size = fitSize(wantedWidth, area);
      return {
        x: clamp(bounds.x, area.x, area.x + area.width - size.width),
        y: clamp(bounds.y, area.y, area.y + area.height - size.height),
        ...size,
      };
    }
  }

  const area = primary.workArea;
  const size = fitSize(wantedWidth, area);
  return {
    x: Math.max(area.x, area.x + area.width - size.width - WINDOW_RULES.margin),
    y: Math.max(area.y, area.y + area.height - size.height - WINDOW_RULES.margin),
    ...size,
  };
}
