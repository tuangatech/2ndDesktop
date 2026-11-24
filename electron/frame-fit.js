// Chromium keeps an invisible frame inside a frameless window, so the client area (where the page is drawn)
// can be smaller than the window. For a tank that must reach every edge of the screen, the window is made
// bigger by exactly that amount. Pure functions, used by desktop-win.js.

/**
 * How far the client area is inset from each side of the window.
 * @param {{left:number, top:number, right:number, bottom:number}} outer  window rectangle, screen pixels
 * @param {{x:number, y:number}} clientOrigin  top-left of the client area, screen pixels
 * @param {{width:number, height:number}} clientSize
 */
export function frameInsets(outer, clientOrigin, clientSize) {
  const clean = (n) => (Number.isFinite(n) && n > 0 && n <= 60 ? Math.round(n) : 0);
  return {
    left: clean(clientOrigin.x - outer.left),
    top: clean(clientOrigin.y - outer.top),
    right: clean(outer.right - (clientOrigin.x + clientSize.width)),
    bottom: clean(outer.bottom - (clientOrigin.y + clientSize.height)),
  };
}

/** The window rectangle (x, y, width, height) whose client area is exactly `target`. */
export function compensate(target, insets) {
  return {
    x: target.x - insets.left,
    y: target.y - insets.top,
    width: target.width + insets.left + insets.right,
    height: target.height + insets.top + insets.bottom,
  };
}
