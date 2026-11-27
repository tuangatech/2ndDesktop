// Windows only: show the tank on the desktop, behind the icons and above the system wallpaper.
// Tech design 3.8. Written from the public Win32 documentation; the technique (a child window of the
// desktop layer) is the one used by live-wallpaper programs. No code is copied from any other project.
//
// Two desktop structures exist:
//   "new"     Windows 11 24H2 and later: Progman holds SHELLDLL_DefView (icons) and a WorkerW (wallpaper) as
//             children. Our window becomes a child of Progman, directly below the icon layer.
//   "classic" Older builds: after the 0x052C message a WorkerW appears behind the icon window; our window
//             becomes a child of that WorkerW.
// The structure is detected from the windows, never from the build number.

import { createRequire } from 'node:module';
import { compensate, frameInsets } from './frame-fit.js';

const require = createRequire(import.meta.url);

const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_POPUP = 0x80000000;
const WS_CAPTION = 0x00c00000;
const WS_THICKFRAME = 0x00040000;
const WS_CHILD = 0x40000000;
const WS_VISIBLE = 0x10000000;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const SWP_SHOWWINDOW = 0x0040;
const HWND_BOTTOM = 1;
const WS_EX_LAYERED = 0x00080000;
const DWMWA_CLOAKED = 14;
const DWMWA_EXTENDED_FRAME_BOUNDS = 9;
const GW_HWNDNEXT = 2;
const MAX_WINDOWS = 1000;
const LWA_ALPHA = 2;
const SWP_NOZORDER = 0x0004;

let cached = null;

function loadApi() {
  if (cached) return cached;
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const dwmapi = koffi.load('dwmapi.dll');
  koffi.struct('POINT', { x: 'int32_t', y: 'int32_t' });
  koffi.struct('RECT', {
    left: 'int32_t',
    top: 'int32_t',
    right: 'int32_t',
    bottom: 'int32_t',
  });
  cached = {
    FindWindowW: user32.func('uintptr_t __stdcall FindWindowW(str16 cls, str16 title)'),
    FindWindowExW: user32.func(
      'uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t after, str16 cls, str16 title)',
    ),
    SendMessageTimeoutW: user32.func(
      'intptr_t __stdcall SendMessageTimeoutW(uintptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)',
    ),
    SetParent: user32.func('uintptr_t __stdcall SetParent(uintptr_t child, uintptr_t parent)'),
    GetParent: user32.func('uintptr_t __stdcall GetParent(uintptr_t hwnd)'),
    IsWindow: user32.func('int __stdcall IsWindow(uintptr_t hwnd)'),
    IsWindowVisible: user32.func('int __stdcall IsWindowVisible(uintptr_t hwnd)'),
    IsZoomed: user32.func('int __stdcall IsZoomed(uintptr_t hwnd)'),
    IsIconic: user32.func('int __stdcall IsIconic(uintptr_t hwnd)'),
    ClientToScreen: user32.func('int __stdcall ClientToScreen(uintptr_t hwnd, _Inout_ POINT *pt)'),
    GetClientRect: user32.func('int __stdcall GetClientRect(uintptr_t hwnd, _Out_ RECT *rect)'),
    GetWindowRect: user32.func('int __stdcall GetWindowRect(uintptr_t hwnd, _Out_ RECT *rect)'),
    ScreenToClient: user32.func('int __stdcall ScreenToClient(uintptr_t hwnd, _Inout_ POINT *pt)'),
    GetClassNameW: user32.func(
      'int __stdcall GetClassNameW(uintptr_t hwnd, _Out_ uint16_t *buf, int max)',
    ),
    GetWindowThreadProcessId: user32.func(
      'uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hwnd, _Out_ uint32_t *pid)',
    ),
    GetForegroundWindow: user32.func('uintptr_t __stdcall GetForegroundWindow()'),
    GetWindowLongPtrW: user32.func(
      'intptr_t __stdcall GetWindowLongPtrW(uintptr_t hwnd, int index)',
    ),
    SetWindowLongPtrW: user32.func(
      'intptr_t __stdcall SetWindowLongPtrW(uintptr_t hwnd, int index, intptr_t value)',
    ),
    SetLayeredWindowAttributes: user32.func(
      'int __stdcall SetLayeredWindowAttributes(uintptr_t hwnd, uint32_t key, uint8_t alpha, uint32_t flags)',
    ),
    SetWindowPos: user32.func(
      'int __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t after, int x, int y, int cx, int cy, uint32_t flags)',
    ),
    DwmGetWindowAttribute: dwmapi.func(
      'int32_t __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32_t attr, _Out_ int32_t *value, uint32_t size)',
    ),
    // The same call for an attribute that is a rectangle (the visible frame, without the invisible resize border).
    DwmGetWindowRect: dwmapi.func(
      'int32_t __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32_t attr, _Out_ RECT *value, uint32_t size)',
    ),
    GetTopWindow: user32.func('uintptr_t __stdcall GetTopWindow(uintptr_t hwnd)'),
    GetWindow: user32.func('uintptr_t __stdcall GetWindow(uintptr_t hwnd, uint32_t cmd)'),
  };
  return cached;
}

const big = (value) => BigInt(value ?? 0);

function className(api, hwnd) {
  const buffer = new Uint16Array(256);
  const length = api.GetClassNameW(hwnd, buffer, 256);
  return String.fromCharCode(...buffer.subarray(0, Math.max(0, length)));
}

function windowRect(api, hwnd) {
  const rect = {};
  api.GetWindowRect(hwnd, rect);
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

/**
 * Put the window where its client area (the drawn page) covers `rect` (screen pixels). Chromium may keep an
 * invisible frame inside the window, which is measured after the first placement and cancelled by growing the window.
 */
function placeWindow(api, hwnd, parent, insertAfter, rect, flags) {
  const point = { x: rect.x, y: rect.y };
  api.ScreenToClient(parent, point);
  const put = (target) =>
    api.SetWindowPos(
      hwnd,
      insertAfter,
      point.x + (target.x - rect.x),
      point.y + (target.y - rect.y),
      target.width,
      target.height,
      flags,
    );
  put(rect);
  const outer = windowRect(api, hwnd);
  const client = {};
  api.GetClientRect(hwnd, client);
  const origin = { x: 0, y: 0 };
  api.ClientToScreen(hwnd, origin);
  const insets = frameInsets(outer, origin, { width: client.right, height: client.bottom });
  if (insets.left || insets.top || insets.right || insets.bottom) put(compensate(rect, insets));
}

/** The window under the foreground, for the edit-mode spike (spikes/edit-mode); the cover check uses listWindows(). Null if there is none. */
export function describeForeground() {
  const api = loadApi();
  const hwnd = big(api.GetForegroundWindow());
  if (hwnd === 0n) return null;
  const pid = [0];
  api.GetWindowThreadProcessId(hwnd, pid);
  const cloaked = [0];
  api.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloaked, 4);
  return {
    visible: Boolean(api.IsWindowVisible(hwnd)),
    iconic: Boolean(api.IsIconic(hwnd)),
    cloaked: cloaked[0] !== 0,
    zoomed: Boolean(api.IsZoomed(hwnd)),
    className: className(api, hwnd),
    pid: pid[0],
    rect: windowRect(api, hwnd),
  };
}

/**
 * Every top-level window, front to back, described for coverWindowsWin() (cover.js). Only hidden windows are skipped
 * here (they are the many); the rest of the filtering is in the pure function, where it is tested. The rectangle is the
 * visible frame from DWM (what is drawn), not GetWindowRect, which on Windows 10 and 11 includes an invisible resize
 * border of about 8 pixels around a maximized window; in physical pixels, as the display rectangle of the caller.
 * No window title is read.
 */
export function listWindows() {
  const api = loadApi();
  const windows = [];
  let hwnd = big(api.GetTopWindow(0));
  for (let i = 0; hwnd !== 0n && i < MAX_WINDOWS; i++) {
    if (api.IsWindowVisible(hwnd)) {
      const pid = [0];
      api.GetWindowThreadProcessId(hwnd, pid);
      const cloaked = [0];
      api.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloaked, 4);
      const frame = {};
      const framed = api.DwmGetWindowRect(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, frame, 16) === 0;
      windows.push({
        visible: true,
        iconic: Boolean(api.IsIconic(hwnd)),
        cloaked: cloaked[0] !== 0,
        className: className(api, hwnd),
        pid: pid[0],
        exStyle: Number(api.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)) >>> 0,
        rect: framed
          ? { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom }
          : windowRect(api, hwnd),
      });
    }
    hwnd = big(api.GetWindow(hwnd, GW_HWNDNEXT));
  }
  return windows;
}

function findDesktopParent(api, progman) {
  const defViewInProgman = big(api.FindWindowExW(progman, 0, 'SHELLDLL_DefView', null));
  if (defViewInProgman !== 0n) {
    return { layout: 'new', parent: progman, insertAfter: defViewInProgman };
  }
  // Classic layout: the WorkerW that follows the one holding SHELLDLL_DefView.
  let top = 0n;
  for (;;) {
    top = big(api.FindWindowExW(0, top, 'WorkerW', null));
    if (top === 0n) return null;
    if (big(api.FindWindowExW(top, 0, 'SHELLDLL_DefView', null)) !== 0n) {
      const wallpaper = big(api.FindWindowExW(0, top, 'WorkerW', null));
      if (wallpaper !== 0n) return { layout: 'classic', parent: wallpaper, insertAfter: 0n };
      return null;
    }
  }
}

/**
 * Put the window with handle `hwnd` on the desktop.
 * @param {Buffer} handleBuffer  from BrowserWindow.getNativeWindowHandle()
 * @param {{x:number,y:number,width:number,height:number}} rect  target in physical screen pixels
 * @param {{layered?: boolean, parent?: 'progman'|'workerw'}} [options]  experiments of the attach test
 * @returns {{ok:true, layout:string, ms:number, parent:bigint, hwnd:bigint}|{ok:false, reason:string}}
 */
export function attachToDesktop(handleBuffer, rect, options = {}) {
  const started = Date.now();
  try {
    const api = loadApi();
    const hwnd = handleBuffer.readBigUInt64LE(0);
    const progman = big(api.FindWindowW('Progman', null));
    if (progman === 0n) return { ok: false, reason: 'no-progman' };

    // Ask Explorer to create the wallpaper layer. It must be sent only once per attach: sending it
    // again can delete the layer. The result is ignored; the layers are looked up below.
    api.SendMessageTimeoutW(progman, 0x052c, 0xd, 1, 0, 1000, [0]);

    let found = null;
    for (let i = 0; i < 20 && !found; i++) {
      found = findDesktopParent(api, progman);
      if (!found) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
    if (!found) return { ok: false, reason: 'no-desktop-layer' };

    if (options.parent === 'workerw' && found.layout === 'new') {
      const wallpaper = big(api.FindWindowExW(progman, 0, 'WorkerW', null));
      if (wallpaper !== 0n)
        found = { layout: 'new-in-workerw', parent: wallpaper, insertAfter: 0n };
    }

    // Keep Explorer's own wallpaper windows at the bottom so that ours sits above them.
    if (found.layout === 'new') {
      let w = 0n;
      while ((w = big(api.FindWindowExW(progman, w, 'WorkerW', null))) !== 0n) {
        api.SetWindowPos(w, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
      }
    }

    const style = Number(api.GetWindowLongPtrW(hwnd, GWL_STYLE)) >>> 0;
    const childStyle =
      ((style & ~WS_POPUP & ~WS_CAPTION & ~WS_THICKFRAME) | WS_CHILD | WS_VISIBLE) >>> 0;
    api.SetWindowLongPtrW(hwnd, GWL_STYLE, childStyle);

    api.SetParent(hwnd, found.parent);

    if (options.layered) {
      const ex = Number(api.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)) >>> 0;
      api.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (ex | WS_EX_LAYERED) >>> 0);
      api.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
    }

    placeWindow(
      api,
      hwnd,
      found.parent,
      found.insertAfter,
      rect,
      SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
    );

    const parentNow = big(api.GetParent(hwnd));
    if (parentNow !== found.parent) return { ok: false, reason: 'set-parent-failed' };
    const layered = (Number(api.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)) & WS_EX_LAYERED) !== 0;
    return {
      ok: true,
      layout: found.layout,
      layered,
      ms: Date.now() - started,
      parent: found.parent,
      hwnd,
    };
  } catch (error) {
    return { ok: false, reason: `exception: ${error?.message ?? error}` };
  }
}

/** Outer and client size of one window plus its style, for the log (looking for gaps at the screen edges). */
export function describeWindow(hwnd) {
  try {
    const api = loadApi();
    const outer = windowRect(api, hwnd);
    const client = {};
    api.GetClientRect(hwnd, client);
    const style = Number(api.GetWindowLongPtrW(hwnd, GWL_STYLE)) >>> 0;
    const ex = Number(api.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)) >>> 0;
    return `outer ${outer.left},${outer.top},${outer.right},${outer.bottom} client ${client.right}x${client.bottom} style 0x${style.toString(16)} ex 0x${ex.toString(16)}`;
  } catch (error) {
    return `describeWindow failed: ${error?.message ?? error}`;
  }
}

/** One line per window of the desktop structure, for the log (class, visibility, size). */
export function describeDesktopTree() {
  try {
    const api = loadApi();
    const lines = [];
    const line = (indent, hwnd) => {
      const rect = windowRect(api, hwnd);
      lines.push(
        `${indent}${className(api, hwnd)} visible=${Boolean(api.IsWindowVisible(hwnd))} ${rect.right - rect.left}x${rect.bottom - rect.top}`,
      );
    };
    const progman = big(api.FindWindowW('Progman', null));
    if (progman === 0n) return 'no Progman';
    line('Progman ', progman);
    for (let c = 0n; (c = big(api.FindWindowExW(progman, c, null, null))) !== 0n;)
      line('  child ', c);
    for (let t = 0n; (t = big(api.FindWindowExW(0, t, 'WorkerW', null))) !== 0n;)
      line('top-level ', t);
    return lines.join(' | ');
  } catch (error) {
    return `tree failed: ${error?.message ?? error}`;
  }
}

/** Move and resize an attached window (a display change). Does not send the Explorer message again. */
export function moveOnDesktop(attachment, rect) {
  try {
    const api = loadApi();
    placeWindow(
      api,
      attachment.hwnd,
      attachment.parent,
      0,
      rect,
      SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW,
    );
    return true;
  } catch {
    return false;
  }
}

/** True while the window is still a visible child of the desktop layer we attached it to. */
export function isStillAttached(attachment) {
  try {
    const api = loadApi();
    return (
      Boolean(api.IsWindow(attachment.parent)) &&
      Boolean(api.IsWindow(attachment.hwnd)) &&
      big(api.GetParent(attachment.hwnd)) === attachment.parent &&
      Boolean(api.IsWindowVisible(attachment.hwnd))
    );
  } catch {
    return false;
  }
}
