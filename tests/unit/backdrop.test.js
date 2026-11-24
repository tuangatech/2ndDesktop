import { describe, expect, it } from 'vitest';
import { backdropShapes } from '../../scenes/fishtank/backdrop.js';
import { computeLayout } from '../../scenes/fishtank/layout.js';
import { visual } from '../../scenes/fishtank/visualConfig.js';

const layoutFor = (width, height) => computeLayout({ width, height });

describe('backdropShapes (the far reef)', () => {
  it('gives the same shapes for the same seed and size', () => {
    const layout = layoutFor(480, 320);
    expect(backdropShapes(7, layout)).toEqual(backdropShapes(7, layout));
  });

  it('differs between seeds', () => {
    const layout = layoutFor(480, 320);
    expect(backdropShapes(7, layout)).not.toEqual(backdropShapes(8, layout));
  });

  it('makes one ridge per layer, then the blades, back to front', () => {
    const shapes = backdropShapes(1, layoutFor(480, 320));
    const ridges = shapes.filter((s) => s.kind === 'ridge');
    expect(ridges).toHaveLength(visual.backdrop.layers.length);
    expect(shapes.some((s) => s.kind === 'blade')).toBe(true);
    // Each layer is drawn after the one behind it, so the colours get darker toward the front.
    expect(ridges.map((r) => r.color)).toEqual(visual.backdrop.layers.map((l) => l.color));
  });

  it('stays above the sand and inside the water, and covers the full width', () => {
    const layout = layoutFor(1920, 1080);
    for (const shape of backdropShapes(3, layout)) {
      const xs = shape.points.map((p) => p.x);
      if (shape.kind === 'ridge') {
        expect(Math.min(...xs)).toBeLessThanOrEqual(0);
        expect(Math.max(...xs)).toBeGreaterThanOrEqual(layout.width);
      }
      for (const p of shape.points) {
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThanOrEqual(layout.sandTop + 3 * layout.unit);
      }
    }
  });

  it('keeps the reef in the lower part of the water (it never reaches the fish at the top)', () => {
    const layout = layoutFor(480, 320);
    const top = Math.min(...backdropShapes(5, layout).flatMap((s) => s.points.map((p) => p.y)));
    expect(top).toBeGreaterThan(layout.height * 0.3);
  });

  it('a wider tank shows the same reef further right (nothing stretches)', () => {
    const narrow = backdropShapes(9, layoutFor(480, 320)).filter((s) => s.kind === 'ridge');
    const wide = backdropShapes(9, layoutFor(960, 320)).filter((s) => s.kind === 'ridge');
    narrow.forEach((ridge, i) => {
      for (const p of ridge.points.filter((q) => q.x >= 0 && q.x <= 480)) {
        const same = wide[i].points.find((q) => q.x === p.x);
        expect(same?.y).toBeCloseTo(p.y, 6);
      }
    });
  });

  it('a wider tank keeps every blade of the narrow one in the same place (weeds do not slide when a window is resized)', () => {
    for (const seed of [4, 9]) {
      const narrow = backdropShapes(seed, layoutFor(480, 320)).filter((s) => s.kind === 'blade');
      const wide = backdropShapes(seed, layoutFor(570, 320)).filter((s) => s.kind === 'blade');
      expect(narrow.length).toBeGreaterThan(0);
      const wideBlades = new Set(wide.map((s) => JSON.stringify(s)));
      for (const blade of narrow) expect(wideBlades.has(JSON.stringify(blade))).toBe(true);
      expect(wide.length).toBeGreaterThanOrEqual(narrow.length);
    }
  });
});
