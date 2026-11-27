// A small integer hash for the farm house: the same numbers in, the same number out, on every machine. The simulated
// weather and the animals use it instead of a running random generator, so the state at a moment is a function of the
// time and the seed (never of how many frames ran), and a pause or a jump of the clock settles at once (rule R1).

/** A 32-bit hash of a list of integers. */
export function hash(...ints) {
  let h = 0x811c9dc5;
  for (const n of ints) {
    h ^= n | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** A number in [0, 1) from a list of integers. */
export const unit = (...ints) => hash(...ints) / 4294967296;

/** Smooth step: 0 below 0, 1 above 1, an S curve between. */
export const smooth = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export const lerp = (a, b, t) => a + (b - a) * t;
