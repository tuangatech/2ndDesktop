// Fish colors (FR-13): a palette per stage, shifted a little by the fish's seed so no two fish match
// exactly, and the same fish always looks the same.
import { makeRng } from '../../shared/rng.js';

/** HSL (degrees, percent, percent) to a 0xRRGGBB number. */
export function hslToHex(h, s, l) {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = Math.min(1, Math.max(0, s / 100));
  const lig = Math.min(1, Math.max(0, l / 100));
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const r = Math.round(channel(hue + 1 / 3) * 255);
  const g = Math.round(channel(hue) * 255);
  const b = Math.round(channel(hue - 1 / 3) * 255);
  return (r << 16) | (g << 8) | b;
}

/** The hue shift of a fish in degrees, between -20 and 20. */
export function hueShiftFor(seed) {
  return makeRng(seed ^ 0x5bd1e995).range(-20, 20);
}

/**
 * @param {{palettes: Record<string, {body:number[], fin:number[], accent:number[]}>}} species
 * @param {'fry'|'juvenile'|'adult'} stage
 * @param {number} seed
 * @returns {{body:number, fin:number, accent:number}}
 */
export function paletteFor(species, stage, seed) {
  const palette = species.palettes[stage];
  const shift = hueShiftFor(seed);
  const make = ([h, s, l]) => hslToHex(h + shift, s, l);
  return { body: make(palette.body), fin: make(palette.fin), accent: make(palette.accent) };
}

/** Linear blend of two 0xRRGGBB colors, t from 0 to 1. */
export function mixColor(from, to, t) {
  const channel = (shift) => {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    return Math.round(a + (b - a) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
