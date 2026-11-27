// Colour helpers for the farm house art (pure). Hex strings in, hex strings out. No pure white and no pure black
// (docs/art-style.md): the lightest and darkest mixes are a warm cream and a warm dark brown.

const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/** A mix of two colours: `t` 0 gives `a`, 1 gives `b`. */
export function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}
export const darker = (c, t) => mix(c, '#2e2a26', t);
export const lighter = (c, t) => mix(c, '#fff6e6', t);
/** The haze of a far hill and of fog. */
export const FOG = '#dcdad0';
/** Rounds a number for a drawing operation (one decimal keeps the string short). */
export const n = (v) => +v.toFixed(1);
