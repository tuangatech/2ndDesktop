// "Copy diagnostics" (FR-36, NFR-7): a text the player can paste into a message. It must never contain the home
// folder or the user name, so everything goes through `sanitize`. Plain Node (no Electron), so it is unit-tested.

import { PRODUCT_NAME } from './product.js';

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Removes the home folder and the user name from `text`.
 * @param {string} text
 * @param {{home?: string, userName?: string}} [who]  the real values, when known
 */
export function sanitize(text, { home, userName } = {}) {
  let out = String(text);
  if (home && home.length > 3) {
    // The same folder can be written with either kind of slash, or with doubled backslashes in JSON.
    const parts = home
      .split(/[\\/]+/)
      .filter(Boolean)
      .map(escapeRegExp);
    out = out.replace(
      new RegExp(`${home.startsWith('/') ? '/' : ''}${parts.join('[\\\\/]+')}`, 'gi'),
      '~',
    );
  }
  // Whatever the real home folder is, a path under a Users or home folder loses its user folder.
  out = out
    .replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"']+/gi, '~')
    .replace(/\/(?:Users|home)\/[^/\s"']+/g, '~');
  if (userName && userName.length >= 3) {
    out = out.replace(new RegExp(escapeRegExp(userName), 'gi'), 'user');
  }
  return out;
}

// Vendor ids of the graphics cards people have (PCI ids; 0x106b is Apple's, 0x1414 is Windows' software renderer).
const GPU_VENDORS = {
  0x10de: 'NVIDIA',
  0x1002: 'AMD',
  0x1022: 'AMD',
  0x8086: 'Intel',
  0x106b: 'Apple',
  0x1414: 'Microsoft',
  0x5143: 'Qualcomm',
  0x13b5: 'Arm',
  0x15ad: 'VMware',
};

/**
 * One graphics card as text: `NVIDIA (vendor 0x10de) device 0x2684 (active)`. The vendor is named when it is a
 * known one; a device id of 0 (Apple's GPUs have no PCI device id) is left out.
 * @param {{vendorId?: number, deviceId?: number, active?: boolean}} device
 */
export function describeGpuDevice({ vendorId, deviceId, active } = {}) {
  const vendor = Number(vendorId);
  const hex = (n) => `0x${Number(n).toString(16)}`;
  if (!Number.isFinite(vendor)) return 'unknown';
  const name = GPU_VENDORS[vendor];
  const parts = [name ? `${name} (vendor ${hex(vendor)})` : `vendor ${hex(vendor)}`];
  if (Number(deviceId)) parts.push(`device ${hex(deviceId)}`);
  if (active) parts.push('(active)');
  return parts.join(' ');
}

/**
 * A folder of the player as the About box shows it, without the user name: it starts with `%APPDATA%` on
 * Windows (Explorer understands it) and with `~` on macOS (Finder's "Go to Folder" understands it).
 * @param {string} file
 * @param {{platform?: string, home?: string, appData?: string}} [where]
 */
export function displayPath(file, { platform, home, appData } = {}) {
  const startsWith = (prefix) =>
    Boolean(prefix) && file.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
  if (platform === 'win32' && startsWith(appData)) return `%APPDATA%${file.slice(appData.length)}`;
  if (platform === 'darwin' && startsWith(home)) return `~${file.slice(home.length)}`;
  return sanitize(file, { home });
}

/**
 * Reduces absolute paths and file:// URLs to the file name (and its line and column), for error messages:
 * `at f (file:///C:/app/dist/index.js:10:5)` becomes `at f (index.js:10:5)`.
 */
export function shortenPaths(text) {
  return String(text).replace(
    /(?<![\w.:/\\])(?:file:\/\/\/?)?(?:[A-Za-z]:)?(?:[\\/][^\s\\/()'"<>|?*]+)*[\\/]([^\s\\/()'"<>|?*]+)/g,
    '$1',
  );
}

/**
 * The text copied to the clipboard (NFR-7). Every part is optional; the whole text is sanitized.
 * @param {{appInfo: object, mode: string,
 *          display?: {width: number, height: number, scale: number},
 *          displays?: {width: number, height: number, scale: number, primary?: boolean}[],
 *          gpu?: string, windowSize?: {width: number, height: number} | null,
 *          sceneLine?: string, tuningKeys?: string[],
 *          settings?: object, usage?: string[], logLines?: string[]}} data
 * @param {{home?: string, userName?: string}} [who]
 */
export function buildText(data, who) {
  const {
    appInfo,
    mode,
    display,
    displays,
    gpu,
    windowSize,
    sceneLine,
    tuningKeys,
    settings = {},
    usage = [],
    logLines = [],
  } = data;
  const size = (d) => `${d.width} x ${d.height} at ${Math.round(d.scale * 100)}%`;
  const lines = [
    `${PRODUCT_NAME} diagnostics`,
    `Version: ${appInfo.version}`,
    `System: ${appInfo.platform} ${appInfo.arch ?? ''}`.trim(),
    `Electron ${appInfo.electron}, Chromium ${appInfo.chrome}`,
    gpu ? `GPU: ${gpu}` : null,
    `Display mode: ${mode}`,
    display ? `Display: ${size(display)}` : null,
    displays && displays.length > 1
      ? `All displays: ${displays.map((d) => size(d) + (d.primary ? ' (main)' : '')).join('; ')}`
      : null,
    windowSize ? `Window: ${windowSize.width} x ${windowSize.height}` : null,
    `Always on top: ${settings.alwaysOnTop ? 'on' : 'off'}, sound: ${settings.sound === false ? 'off' : 'on'}`,
    sceneLine || null, // a line from the scene, for example "Fish: 2, pellets fed in total: 4"
    tuningKeys && tuningKeys.length ? `Tuning overrides: ${tuningKeys.join(', ')}` : null,
    '',
    ...usage,
    '',
    `Recent log (${logLines.length} lines):`,
    ...logLines,
  ].filter((line) => line !== null);
  return sanitize(lines.join('\n'), who);
}

/** The last `count` lines of a log file's text. */
export function tailLines(text, count) {
  return String(text).split(/\r?\n/).filter(Boolean).slice(-count);
}
