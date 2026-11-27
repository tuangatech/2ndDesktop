// The record of the scene: what is saved between two starts. Pure data and pure functions (no PixiJS, no host), so it is
// unit-tested without a window. The host saves one JSON file per scene id; keep it small (at most 2 MB), plain
// (numbers, strings, lists, objects) and tolerant: a record can be missing, damaged or from an older version of the scene.

export const RECORD_SCHEMA = 1;
const MAX_COUNT = 1_000_000_000;

const count = (value) => (Number.isInteger(value) && value >= 0 && value < MAX_COUNT ? value : 0);

/**
 * The state to start with: what `host.record.load()` returned, made safe, with one more start counted.
 * @param {{status: string, data?: unknown}|undefined} loaded
 * @returns {{schema: number, opened: number, taps: number}}
 */
export function startState(loaded) {
  const data =
    loaded?.status === 'ok' && loaded.data && typeof loaded.data === 'object' ? loaded.data : {};
  return { schema: RECORD_SCHEMA, opened: count(data.opened) + 1, taps: count(data.taps) };
}

/** One tap on the scene (a click in window mode). */
export const tap = (state) => ({ ...state, taps: Math.min(state.taps + 1, MAX_COUNT) });

/** The menu item "Reset the taps". */
export const resetTaps = (state) => ({ ...state, taps: 0 });
