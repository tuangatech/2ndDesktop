// The player's settings (FR-36), kept in `settings.json` in the user data folder. Plain Node, so it is unit-tested.
// Only the booleans below are changed through `set`; other keys in the file are kept. `activeScene` is read by
// app/main/scene-registry.js (`chooseActiveScene`, which falls back for anything it does not know) and written by `setActiveScene`.
import { CHOICES } from './display-mode.js';
import { normalizeWindowBounds } from './placement.js';
import { isSceneId } from './scene-id.js';
import { readJson, writeJsonAtomic } from './store.js';

export const DEFAULTS = Object.freeze({ alwaysOnTop: false, sound: true });
const BOOLEAN_KEYS = Object.keys(DEFAULTS);

/**
 * The raw file content with every known setting a boolean (the default when it is missing or of a wrong type).
 * `window` (the remembered window rectangle, FR-19) is kept only when it is a valid rectangle; `displayMode` and `desktopAttempt` only when they are known words.
 */
export function normalizeSettings(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { ...data };
  for (const key of BOOLEAN_KEYS) {
    out[key] = typeof data[key] === 'boolean' ? data[key] : DEFAULTS[key];
  }
  // The display mode and the desktop attempt (FR-60, FR-64): only a known word is kept.
  for (const [key, allowed] of Object.entries(CHOICES)) {
    if (!allowed.includes(data[key])) delete out[key];
  }
  const windowBounds = normalizeWindowBounds(data.window);
  if (windowBounds) out.window = windowBounds;
  else delete out.window;
  return out;
}

/** @param {{file: string}} options */
export function createSettingsStore({ file }) {
  let cache = null;
  const load = () => {
    const read = readJson(file);
    cache = normalizeSettings(read.status === 'ok' ? read.data : null);
    return cache;
  };
  const save = (next) => {
    try {
      writeJsonAtomic(file, next);
    } catch {
      return false;
    }
    cache = next;
    return true;
  };
  return {
    get() {
      return cache ?? load();
    },
    /** Sets one known boolean setting and saves. Returns false for an unknown key or a value that is not a boolean. */
    set(key, value) {
      if (!BOOLEAN_KEYS.includes(key) || typeof value !== 'boolean') return false;
      return save({ ...(cache ?? load()), [key]: value });
    },
    /**
     * Sets known words such as { displayMode: 'desktop', desktopAttempt: 'trying' } in one write.
     * Returns false (and writes nothing) if a key is unknown or a value is not one of its words.
     */
    setChoices(patch) {
      const entries = Object.entries(patch ?? {});
      if (entries.length === 0) return false;
      if (!entries.every(([key, value]) => CHOICES[key]?.includes(value))) return false;
      const current = cache ?? load();
      if (entries.every(([key, value]) => current[key] === value)) return true;
      return save({ ...current, ...Object.fromEntries(entries) });
    },
    /** Remembers the scene that runs (`activeScene`). Returns false for anything that is not a scene id, or when the file cannot be written. */
    setActiveScene(id) {
      if (!isSceneId(id)) return false;
      const current = cache ?? load();
      if (current.activeScene === id) return true;
      return save({ ...current, activeScene: id });
    },
    /** Remembers the window rectangle (x, y, width, height). Returns false for anything that is not a rectangle. */
    setWindow(bounds) {
      const window = normalizeWindowBounds(bounds);
      if (!window) return false;
      const current = cache ?? load();
      const old = current.window;
      if (old && ['x', 'y', 'width', 'height'].every((k) => old[k] === window[k])) return true;
      return save({ ...current, window });
    },
  };
}
