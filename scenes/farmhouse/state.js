// The record of the farm house: what is saved between two starts. Pure data and pure functions (no PixiJS, no host), so
// it is unit-tested without a window. Small on purpose (docs/scenes/farmhouse.md section 4): the animals have no names and
// no record, and everything else is derived from the clock, the seed and the data. A previewed season or weather is
// never saved (it lasts for the session).

export const RECORD_SCHEMA = 1;
export const SEASON_MODES = ['calendar', 'fast'];
const MAX_COUNT = 1_000_000_000;
const MAX_TIME = 8_640_000_000_000_000; // the largest epoch millisecond a date can hold

const count = (value) => (Number.isInteger(value) && value >= 0 && value < MAX_COUNT ? value : 0);
const time = (value) =>
  Number.isFinite(value) && value > 0 && value < MAX_TIME ? Math.floor(value) : null;

/**
 * The state to start with: what `host.record.load()` returned, made safe, with one more start counted.
 * @param {{status: string, data?: unknown}|undefined} loaded
 * @returns {{schema: number, opened: number, lastSeenAt: number|null, lastWeather: string|null,
 *            seasonMode: 'calendar'|'fast', fastStartedAt: number|null}}
 */
export function startState(loaded) {
  const data =
    loaded?.status === 'ok' && loaded.data && typeof loaded.data === 'object' ? loaded.data : {};
  const seasonMode = SEASON_MODES.includes(data.seasonMode) ? data.seasonMode : 'calendar';
  // Fast mode without the moment it was switched on cannot be followed: it starts again (in January) from now.
  const fastStartedAt = time(data.fastStartedAt);
  return {
    schema: RECORD_SCHEMA,
    opened: count(data.opened) + 1,
    lastSeenAt: time(data.lastSeenAt),
    lastWeather:
      typeof data.lastWeather === 'string' && /^[a-z]{3,12}$/.test(data.lastWeather)
        ? data.lastWeather
        : null,
    seasonMode: seasonMode === 'fast' && fastStartedAt === null ? 'calendar' : seasonMode,
    fastStartedAt: seasonMode === 'fast' ? fastStartedAt : null,
  };
}

/** The player switched Fast mode on (the day it starts is January, 4.3) at `now`. */
export const startFast = (state, now) => ({
  ...state,
  seasonMode: 'fast',
  fastStartedAt: Math.floor(now),
});

/** The player switched Fast mode off: back to the real date. */
export const stopFast = (state) => ({ ...state, seasonMode: 'calendar', fastStartedAt: null });

/** What the scene last showed, so the first frame after a reload does not jump. */
export const seen = (state, now, weatherKind) => ({
  ...state,
  lastSeenAt: Math.floor(now),
  lastWeather: weatherKind,
});
