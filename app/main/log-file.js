// The app's small text log (`desktop-spike.log` in the data folder) and a limiter for lines that come from the page.
// The file stays under a size: when the next line would pass it, the file becomes `<name>.old` (the one before is
// replaced) and a new one starts. Every line is cleaned (home folder, user name) when it is written, because a stack
// trace in an error line holds a path. Plain Node (no Electron), so it is unit-tested.
import fs from 'node:fs';
import path from 'node:path';

export const MAX_LOG_BYTES = 1024 * 1024;

/**
 * @param {object} options
 * @param {string | (() => string)} options.file  the log file, or a function that gives it (the data folder can change at start)
 * @param {number} [options.maxBytes]
 * @param {(text: string) => string} [options.clean]  applied to every line
 * @returns {{write: (line: string) => void}}  `write` never throws: logging must never break the app
 */
export function createLogFile({ file, maxBytes = MAX_LOG_BYTES, clean = (text) => text }) {
  let knownFile = null;
  let size = 0;
  return {
    write(line) {
      try {
        const target = typeof file === 'function' ? file() : file;
        const text = `${clean(String(line))}\n`;
        const bytes = Buffer.byteLength(text);
        if (target !== knownFile) {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          knownFile = target;
          try {
            size = fs.statSync(target).size;
          } catch {
            size = 0;
          }
        }
        if (size > 0 && size + bytes > maxBytes) {
          fs.renameSync(target, target.replace(/\.log$/, '.old.log'));
          size = 0;
        }
        fs.appendFileSync(target, text);
        size += bytes;
      } catch {
        // Logging must never break the app.
      }
    },
  };
}

/**
 * Text from the page, made fit for one log line: anything that is not text becomes empty, control characters (a new
 * line would let a page write a line that looks like the app's own) become spaces, and the rest is cut to `max`.
 * The main process does this itself; it does not rely on the page or the preload having done it
 * (docs/platform/02 section 4).
 * @param {unknown} value
 * @param {number} max  characters
 * @returns {string}
 */
export function pageLine(value, max) {
  if (typeof value !== 'string') return '';
  return Array.from(value.slice(0, max), (c) => {
    const code = c.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : c;
  }).join('');
}

/**
 * Lets at most `perSecond` lines through in each second and counts the rest, so a page that talks a lot cannot fill the
 * log or the disk (docs/platform/02 section 4: 20 lines a second).
 * @param {{perSecond?: number, now?: () => number}} [options]
 */
export function createLineLimiter({ perSecond = 20, now = Date.now } = {}) {
  let second = -1;
  let used = 0;
  let dropped = 0;
  return {
    /** True when this line may be written. */
    allow() {
      const current = Math.floor(now() / 1000);
      if (current !== second) {
        second = current;
        used = 0;
      }
      if (used >= perSecond) {
        dropped++;
        return false;
      }
      used++;
      return true;
    },
    /** How many lines were refused since the last call; the count starts again. */
    takeDropped() {
      const count = dropped;
      dropped = 0;
      return count;
    },
  };
}
