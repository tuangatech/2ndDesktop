// Tunable numbers of the game rules (functional spec 7.1). Nothing else in the code base holds game numbers
// (plan section 5). Visual numbers (bubbles, sway, decor) are in scenes/fishtank/view/visualConfig.js and are never
// needed by a server. Times are in milliseconds.

const HOUR = 60 * 60 * 1000;

export const config = {
  pellets: {
    spawnIntervalMs: HOUR, // a new floating pellet appears this often (FR-1)
    maxFloating: 16, // FR-2
    maxStash: 30, // FR-5
    startFloating: 4, // a new tank starts with this many floating pellets (FR-16)
  },
  growth: {
    pointsPerPellet: 20, // FR-9
    juvenileAt: 100, // points at which a fry becomes a juvenile (FR-11)
    adultAt: 400, // points at which a juvenile becomes an adult
    fryScale: 0.5, // a fry is this fraction of the adult size (FR-12)
  },
  meals: {
    perFishPerDay: 2, // a fish takes at most this many pellets in any `windowMs` (DEC-71; there is no fullness)
    windowMs: 24 * HOUR,
  },
  drowsy: {
    afterMs: 36 * HOUR, // no food for this long makes a fish drowsy (FR-10)
  },
  eggs: {
    pelletsPerEgg: 12, // one egg for every 12 pellets fed in total (FR-17)
    maxFish: 8, // FR-18
  },
  start: {
    fish: 2, // a new tank starts with 2 fry of different species (FR-16)
  },
};

// The numbers a test build may change through tuning.json (decision D25), each with a sane range.
// Anything not listed here, or outside its range, is ignored.
const TUNABLE = {
  'pellets.spawnIntervalMs': [60 * 1000, 24 * HOUR],
  'pellets.maxFloating': [1, 64],
  'pellets.maxStash': [1, 200],
  'growth.pointsPerPellet': [1, 200],
  'growth.juvenileAt': [10, 1000],
  'growth.adultAt': [20, 5000],
  'meals.perFishPerDay': [1, 20],
  'meals.windowMs': [60 * 1000, 7 * 24 * HOUR],
  'drowsy.afterMs': [60 * 1000, 14 * 24 * HOUR],
  'eggs.pelletsPerEgg': [1, 100],
  'eggs.maxFish': [1, 12],
};

/**
 * Merges a tuning object such as `{ "pellets.spawnIntervalMs": 600000 }` into a copy of the config.
 * Returns the new config and which keys were applied or ignored (for the diagnostics text).
 * @param {typeof config} base
 * @param {Record<string, unknown>} [override]
 */
export function applyTuning(base, override) {
  const merged = structuredClone(base);
  const applied = [];
  const ignored = [];
  for (const [key, value] of Object.entries(override ?? {})) {
    const range = TUNABLE[key];
    if (!range || typeof value !== 'number' || !Number.isFinite(value)) {
      ignored.push(key);
      continue;
    }
    if (value < range[0] || value > range[1]) {
      ignored.push(key);
      continue;
    }
    const [group, name] = key.split('.');
    merged[group][name] = value;
    applied.push(key);
  }
  return { config: merged, applied, ignored };
}
