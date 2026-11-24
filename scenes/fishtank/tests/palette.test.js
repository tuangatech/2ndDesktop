import { describe, expect, it } from 'vitest';
import species from '../species.json';
import { hslToHex, hueShiftFor, mixColor, paletteFor } from '../palette.js';

describe('palette', () => {
  it('converts HSL to hex', () => {
    expect(hslToHex(0, 100, 50)).toBe(0xff0000);
    expect(hslToHex(120, 100, 50)).toBe(0x00ff00);
    expect(hslToHex(240, 100, 50)).toBe(0x0000ff);
    expect(hslToHex(0, 0, 100)).toBe(0xffffff);
  });

  it('keeps the hue shift of a fish within 20 degrees and the same for the same seed', () => {
    for (let seed = 1; seed < 300; seed++) {
      const shift = hueShiftFor(seed);
      expect(Math.abs(shift)).toBeLessThanOrEqual(20);
      expect(hueShiftFor(seed)).toBe(shift);
    }
  });

  it('gives the same fish the same colors, and different stages different colors', () => {
    const tetra = species.tetra;
    expect(paletteFor(tetra, 'adult', 42)).toEqual(paletteFor(tetra, 'adult', 42));
    expect(paletteFor(tetra, 'fry', 42)).not.toEqual(paletteFor(tetra, 'juvenile', 42));
    expect(paletteFor(tetra, 'juvenile', 42)).not.toEqual(paletteFor(tetra, 'adult', 42));
  });

  it('mixes colors', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xfefefe, 0.5)).toBe(0x7f7f7f);
  });
});
