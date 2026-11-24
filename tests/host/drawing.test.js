import { describe, expect, it } from 'vitest';
import { MAX_DESKTOP_PIXELS, drawingResolution } from '../../app/page/drawing.js';

// The CPU and memory budgets (spec 7.3, NFR-2 and NFR-4) depend on desktop mode never drawing more than 1600 x 900.
const pixels = (width, height, resolution) => width * resolution * height * resolution;

describe('drawingResolution', () => {
  it('draws the window at the full pixel ratio of the display', () => {
    expect(drawingResolution('window', 480, 320, 2)).toBe(2);
    expect(drawingResolution('window', 1200, 800, 1.5)).toBe(1.5);
  });

  it('caps a large desktop at 1600 x 900 of pixels', () => {
    // A 4K display at 100% scaling, and the Retina Mac (1512 x 982 points at 2x).
    const fourK = drawingResolution('desktop', 3840, 2160, 1);
    expect(fourK).toBeCloseTo(Math.sqrt(MAX_DESKTOP_PIXELS / (3840 * 2160)), 6);
    const mac = drawingResolution('desktop', 1512, 982, 2);
    expect(mac).toBeLessThan(2);
    expect(pixels(1512, 982, mac)).toBeCloseTo(MAX_DESKTOP_PIXELS, -1);
  });

  it('does not upscale a desktop that is already small enough', () => {
    expect(drawingResolution('desktop', 1600, 900, 1)).toBe(1);
    expect(drawingResolution('desktop', 1280, 720, 1)).toBe(1);
  });

  it('survives a zero size while the window is being created', () => {
    expect(Number.isFinite(drawingResolution('desktop', 0, 0, 2))).toBe(true);
  });
});
