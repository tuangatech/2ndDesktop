import { describe, expect, it } from 'vitest';
import { DESIGN, coverFit, toDesign, visibleDesign } from '../layout.js';

describe('the fit to the screen', () => {
  it('16:9 shows the middle of the design, from the top to the bottom of the field', () => {
    const fit = coverFit(1920, 1080);
    expect(fit.scale).toBeCloseTo(1.2, 5);
    const view = visibleDesign(1920, 1080);
    expect(view.top).toBeCloseTo(0, 5);
    expect(view.bottom).toBeCloseTo(DESIGN.height, 5);
    expect(view.left).toBeGreaterThan(0); // 2100 wide is wider than 16:9: the sides are cropped
    expect(view.right).toBeLessThan(DESIGN.width);
  });

  it('keeps the house in the middle of the screen at every shape from 4:3 to 21:9 and beyond', () => {
    for (const [w, h] of [
      [1024, 768],
      [1280, 720],
      [1920, 1080],
      [1920, 1200],
      [2560, 1080],
      [3440, 1440],
      [5120, 1440],
      [800, 1000],
      [300, 300],
    ]) {
      const fit = coverFit(w, h);
      const house = fit.x + DESIGN.houseX * fit.scale;
      expect(Math.abs(house - w / 2)).toBeLessThan(0.5);
      const view = visibleDesign(w, h);
      // the design always covers the screen: no gap at any edge
      expect(view.left).toBeGreaterThanOrEqual(-1e-6);
      expect(view.right).toBeLessThanOrEqual(DESIGN.width + 1e-6);
      expect(view.bottom).toBeLessThanOrEqual(DESIGN.height + 1e-6);
      expect(view.top).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('a narrow screen crops the sides and a wide one shows more of them and crops the sky', () => {
    const narrow = visibleDesign(1024, 768);
    const wide = visibleDesign(3440, 1440);
    expect(wide.right - wide.left).toBeGreaterThan(narrow.right - narrow.left);
    expect(narrow.top).toBeCloseTo(0, 5);
    expect(wide.top).toBeGreaterThan(0); // wider than 21:9: the top of the sky goes first
    expect(wide.bottom).toBeCloseTo(DESIGN.height, 5); // the field never does
  });

  it('is anchored at the bottom and never fails on a zero size', () => {
    for (const [w, h] of [
      [0, 0],
      [1, 1],
      [-5, 10],
    ]) {
      const fit = coverFit(w, h);
      expect(Number.isFinite(fit.scale) && fit.scale > 0).toBe(true);
    }
    const fit = coverFit(1600, 900);
    expect(fit.y + DESIGN.height * fit.scale).toBeCloseTo(900, 5);
  });

  it('toDesign is the inverse of the fit', () => {
    const fit = coverFit(1280, 720);
    const p = toDesign(fit, 640, 360);
    expect(fit.x + p.x * fit.scale).toBeCloseTo(640, 5);
    expect(fit.y + p.y * fit.scale).toBeCloseTo(360, 5);
  });
});
