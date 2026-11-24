// Small seeded random number generator (mulberry32). Pure: the same seed always gives the same numbers.
// Used for the decoration layout, fish hue shifts and pointer personalities, so a tank always looks the same.

export function makeRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** A number in [0, 1). */
    next,
    /** A number in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** An integer in [min, max] (both included). */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** One element of a non-empty array. */
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
