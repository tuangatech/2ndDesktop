import { describe, expect, it } from 'vitest';
import { compensate, frameInsets } from '../../app/main/frame-fit.js';

describe('frameInsets', () => {
  it('finds the invisible frame measured on the test machine (client 2541x1591 inside 2561x1601)', () => {
    const insets = frameInsets(
      { left: 0, top: 0, right: 2561, bottom: 1601 },
      { x: 10, y: 0 },
      { width: 2541, height: 1591 },
    );
    expect(insets).toEqual({ left: 10, top: 0, right: 10, bottom: 10 });
  });

  it('is zero when the client area fills the window', () => {
    const insets = frameInsets(
      { left: 0, top: 0, right: 100, bottom: 50 },
      { x: 0, y: 0 },
      { width: 100, height: 50 },
    );
    expect(insets).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('ignores nonsense values', () => {
    const insets = frameInsets(
      { left: 0, top: 0, right: 100, bottom: 50 },
      { x: -5, y: 500 },
      { width: 100, height: 50 },
    );
    expect(insets.left).toBe(0);
    expect(insets.top).toBe(0);
  });
});

describe('compensate', () => {
  it('grows the window so the client area is the target', () => {
    const rect = compensate(
      { x: 0, y: 0, width: 2561, height: 1601 },
      { left: 10, top: 0, right: 10, bottom: 10 },
    );
    expect(rect).toEqual({ x: -10, y: 0, width: 2581, height: 1611 });
  });
});
