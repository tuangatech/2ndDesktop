// Pure decision: does a window cover the desktop of the primary display? (tech design 3.8, FR-22)
// decideCovered is for Windows (the caller fills `win` from Win32 calls), decideCoveredMac for macOS. No side effects.

const SHELL_CLASSES = new Set([
  'Progman',
  'WorkerW',
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd',
  'SHELLDLL_DefView',
]);

// How much of the display a window must span to count as "as large as the display".
const EDGE_SLACK = 2;

/**
 * @param {object|null} win  { visible, iconic, cloaked, zoomed, className, pid, rect: {left, top, right, bottom} }
 * @param {{left:number, top:number, right:number, bottom:number}} primary  physical pixels
 * @param {number} selfPid
 * @returns {boolean}
 */
export function decideCovered(win, primary, selfPid) {
  if (!win) return false;
  if (win.pid === selfPid) return false;
  if (SHELL_CLASSES.has(win.className)) return false;
  if (!win.visible || win.iconic || win.cloaked) return false;

  const { left, top, right, bottom } = win.rect;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const onPrimary =
    centerX >= primary.left &&
    centerX < primary.right &&
    centerY >= primary.top &&
    centerY < primary.bottom;
  if (!onPrimary) return false;

  if (win.zoomed) return true;

  return (
    left <= primary.left + EDGE_SLACK &&
    top <= primary.top + EDGE_SLACK &&
    right >= primary.right - EDGE_SLACK &&
    bottom >= primary.bottom - EDGE_SLACK
  );
}

/** Electron rectangles are {x, y, width, height}; decideCovered() wants {left, top, right, bottom}. */
export function rectToEdges(rect) {
  return { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height };
}

// macOS: share of the primary display's work area (below the menu bar, beside the Dock) that other apps'
// windows must hide together before the tank counts as covered. Not 1, so tiled windows with the small
// gaps of macOS window tiling still count.
export const MAC_COVER_SHARE = 0.96;

/**
 * macOS: share (0 to 1) of the primary display's work area that normal, visible windows of other processes
 * hide together (FR-22). The tank counts as covered at MAC_COVER_SHARE or more. Unlike decideCovered() this
 * looks at every window on screen, not only the front one, so two windows side by side count too. The caller
 * fills `windows` from CGWindowListCopyWindowInfo (app/main/desktop-mac.js).
 * @param {Array<{pid:number, layer:number, alpha:number, bounds:{x:number, y:number, width:number, height:number}}>} windows
 *   on-screen windows, in points, with the origin at the top left of the primary display (as Electron's screen)
 * @param {{x:number, y:number, width:number, height:number}} workArea  screen.getPrimaryDisplay().workArea
 * @param {number} selfPid
 * @returns {number}
 */
export function coveredShare(windows, workArea, selfPid) {
  const area = rectToEdges(workArea);
  const total = workArea.width * workArea.height;
  if (!(total > 0)) return 0;
  const rects = [];
  for (const w of windows) {
    // Layer 0 holds normal app windows; the menu bar, the Dock, menus and notifications sit on other layers.
    if (w.pid === selfPid || w.layer !== 0 || !(w.alpha > 0)) continue;
    const r = rectToEdges(w.bounds);
    const left = Math.max(r.left, area.left);
    const top = Math.max(r.top, area.top);
    const right = Math.min(r.right, area.right);
    const bottom = Math.min(r.bottom, area.bottom);
    if (right > left && bottom > top) rects.push({ left, top, right, bottom });
  }
  if (rects.length === 0) return 0;
  // Area of the union: cut the plane at every window edge and add up the cells that some window holds.
  // A handful of windows makes this a few thousand steps every 2 seconds.
  const xs = [...new Set(rects.flatMap((r) => [r.left, r.right]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.top, r.bottom]))].sort((a, b) => a - b);
  let hidden = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < ys.length - 1; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (rects.some((r) => cx > r.left && cx < r.right && cy > r.top && cy < r.bottom)) {
        hidden += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      }
    }
  }
  return hidden / total;
}
