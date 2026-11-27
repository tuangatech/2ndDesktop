// Pure decisions: does something cover the desktop of the primary display? (tech design 3.8, FR-22)
// Both systems list every window on screen and ask `coveredShare` how much of the primary display's work area they hide
// together: macOS through CoreGraphics (desktop-mac.js), Windows through the Win32 window list (desktop-win.js,
// `coverWindowsWin` below, DEC-45). No side effects.

const SHELL_CLASSES = new Set([
  'Progman',
  'WorkerW',
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd',
  'SHELLDLL_DefView',
]);

// How much of the display a window must span to count as "as large as the display".
const EDGE_SLACK = 2;

// Windows: share of the primary display's work area (the screen without the taskbar) that other windows must hide
// together before the tank counts as covered. The same 0.96 as the Mac, for the small gaps between snapped windows;
// to be tuned by hand on a real snap layout (the log prints the share).
export const WIN_COVER_SHARE = 0.96;

// Extended window styles that mark a window that is not a normal app window: a tool window (palettes, the Alt-Tab
// list), a window that never takes the focus (overlays, toasts) and a click-through window (screen overlays).
const WS_EX_TRANSPARENT = 0x00000020;
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_NOACTIVATE = 0x08000000;
const NOT_A_NORMAL_WINDOW = WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;

/**
 * Windows: the top-level windows that can hide the desktop, in the shape `coveredShare` takes. Left out: our own
 * windows, the shell (desktop, taskbar), windows that are hidden, minimized or cloaked (a window on another virtual
 * desktop or a suspended app is cloaked), and windows that are not normal app windows (see NOT_A_NORMAL_WINDOW).
 * The caller fills `windows` from the Win32 window list (desktop-win.js), in physical pixels.
 * @param {Array<{visible:boolean, iconic:boolean, cloaked:boolean, className:string, pid:number, exStyle:number,
 *   rect:{left:number, top:number, right:number, bottom:number}}>} windows
 * @param {number} selfPid
 * @returns {Array<{pid:number, layer:number, alpha:number, className:string,
 *   bounds:{x:number, y:number, width:number, height:number}}>}
 */
export function coverWindowsWin(windows, selfPid) {
  const kept = [];
  for (const w of windows) {
    if (w.pid === selfPid) continue;
    if (SHELL_CLASSES.has(w.className)) continue;
    if (!w.visible || w.iconic || w.cloaked) continue;
    if ((w.exStyle & NOT_A_NORMAL_WINDOW) !== 0) continue;
    const { left, top, right, bottom } = w.rect;
    kept.push({
      pid: w.pid,
      layer: 0,
      alpha: 1,
      className: w.className,
      bounds: { x: left, y: top, width: right - left, height: bottom - top },
    });
  }
  return kept;
}

/** Electron rectangles are {x, y, width, height}; the share code works with {left, top, right, bottom}. */
export function rectToEdges(rect) {
  return { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height };
}

// macOS: share of the primary display's work area (below the menu bar, beside the Dock) that other apps'
// windows must hide together before the tank counts as covered. Not 1, so tiled windows with the small
// gaps of macOS window tiling still count.
export const MAC_COVER_SHARE = 0.96;

/**
 * Share (0 to 1) of the primary display's work area that normal, visible windows of other processes hide together
 * (FR-22). The tank counts as covered at MAC_COVER_SHARE (macOS) or WIN_COVER_SHARE (Windows) or more. It looks at
 * every window on screen, not only the front one, so two windows side by side count too. The caller fills `windows`
 * from CGWindowListCopyWindowInfo (app/main/desktop-mac.js) or from `coverWindowsWin` (Windows, physical pixels).
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

// macOS: while "Show Desktop" (F11, or a click on the wallpaper) is active, the window server parks the app windows
// at the screen edges but still reports some of them with bounds that span the display, and it adds one window per
// display, on this layer, as large as the display. Measured on a Mac with three displays; no app uses this layer.
export const MAC_SHOW_DESKTOP_LAYER = 18;

/**
 * macOS: is "Show Desktop" active? True when a window on the Show Desktop layer is as large as the primary display.
 * The tank is then visible whatever the other windows report (FR-22).
 * @param {Array<{layer:number, bounds:{x:number, y:number, width:number, height:number}}>} windows
 * @param {{width:number, height:number}} display  screen.getPrimaryDisplay().bounds
 * @returns {boolean}
 */
export function isShowDesktopMac(windows, display) {
  return windows.some(
    (w) =>
      w.layer === MAC_SHOW_DESKTOP_LAYER &&
      w.bounds.width >= display.width - EDGE_SLACK &&
      w.bounds.height >= display.height - EDGE_SLACK,
  );
}
