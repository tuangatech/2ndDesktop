// macOS only: the windows on screen, for the cover check of desktop mode (tech design 3.8, FR-22).
// Chromium reports the desktop-level window as hidden only when a full-screen app takes over the Space; a
// window as large as the screen leaves it drawing. This reads the window list from CoreGraphics through
// `koffi`, written from Apple's public documentation. It needs no permission: only bounds, layer, alpha and
// the owner's process id are read, never window titles or app names.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ON_SCREEN_ONLY = 1 << 0; // kCGWindowListOptionOnScreenOnly
const EXCLUDE_DESKTOP = 1 << 4; // kCGWindowListExcludeDesktopElements
const NUMBER_DOUBLE = 13; // kCFNumberDoubleType
const UTF8 = 0x08000100; // kCFStringEncodingUTF8

let cached = null;

function loadApi() {
  if (cached) return cached;
  const koffi = require('koffi');
  const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
  const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
  koffi.struct('CGRect', { x: 'double', y: 'double', width: 'double', height: 'double' });
  const api = {
    CGWindowListCopyWindowInfo: cg.func(
      'void *CGWindowListCopyWindowInfo(uint32_t option, uint32_t relativeToWindow)',
    ),
    CGRectMakeWithDictionaryRepresentation: cg.func(
      'bool CGRectMakeWithDictionaryRepresentation(void *dict, _Out_ CGRect *rect)',
    ),
    CFArrayGetCount: cf.func('long CFArrayGetCount(void *array)'),
    CFArrayGetValueAtIndex: cf.func('void *CFArrayGetValueAtIndex(void *array, long index)'),
    CFDictionaryGetValue: cf.func('void *CFDictionaryGetValue(void *dict, void *key)'),
    CFNumberGetValue: cf.func('bool CFNumberGetValue(void *number, int type, _Out_ double *value)'),
    CFStringCreateWithCString: cf.func(
      'void *CFStringCreateWithCString(void *alloc, str text, uint32_t encoding)',
    ),
    CFRelease: cf.func('void CFRelease(void *ref)'),
  };
  // The dictionary keys (kCGWindowLayer and so on) are CFStrings whose text is their own name. Made once, kept.
  const key = (name) => api.CFStringCreateWithCString(null, name, UTF8);
  api.keys = {
    layer: key('kCGWindowLayer'),
    pid: key('kCGWindowOwnerPID'),
    alpha: key('kCGWindowAlpha'),
    bounds: key('kCGWindowBounds'),
  };
  cached = api;
  return api;
}

// Loaded when the module is imported, so a missing native part fails the import once instead of every check.
loadApi();

function number(api, dict, key, fallback) {
  const ref = api.CFDictionaryGetValue(dict, key);
  if (!ref) return fallback;
  const out = [0];
  return api.CFNumberGetValue(ref, NUMBER_DOUBLE, out) ? out[0] : fallback;
}

/**
 * The windows on screen in the current Space, front to back, described for decideCoveredMac().
 * Bounds are in points with the origin at the top left of the primary display, as in Electron's `screen`.
 * @returns {Array<{pid:number, layer:number, alpha:number, bounds:{x:number, y:number, width:number, height:number}}>}
 */
export function listWindows() {
  const api = loadApi();
  const list = api.CGWindowListCopyWindowInfo(ON_SCREEN_ONLY | EXCLUDE_DESKTOP, 0);
  if (!list) return [];
  try {
    const windows = [];
    const count = Number(api.CFArrayGetCount(list));
    for (let i = 0; i < count; i++) {
      const dict = api.CFArrayGetValueAtIndex(list, i);
      const boundsDict = api.CFDictionaryGetValue(dict, api.keys.bounds);
      const rect = {};
      if (!boundsDict || !api.CGRectMakeWithDictionaryRepresentation(boundsDict, rect)) continue;
      windows.push({
        pid: number(api, dict, api.keys.pid, -1),
        layer: number(api, dict, api.keys.layer, -1),
        alpha: number(api, dict, api.keys.alpha, 1),
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }
    return windows;
  } finally {
    api.CFRelease(list);
  }
}
