// A page script that replaces Math.random with a seeded generator (mulberry32), for the state-hash test and
// `npm run shot`. The tank's looks (bubbles, where floating pellets start, the jitter of a drop) use Math.random on
// purpose: animations never decide numbers (D1). To compare two runs of the scene, or a screenshot before and after a
// change, the random numbers must be the same too. Used only by tests and tools, never by the app.
// Usage: `await page.addInitScript(seededRandomScript(seed)); await page.reload();` (the script has to be there
// before the page starts, so a page that is already running is reloaded).

export const SEEDED_RANDOM_SEED = 0x9e3779b9;

/** @param {number} [seed] */
export function seededRandomScript(seed = SEEDED_RANDOM_SEED) {
  return `(() => {
    let a = ${seed | 0};
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();`;
}
