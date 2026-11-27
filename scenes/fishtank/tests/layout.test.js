import { describe, expect, it } from 'vitest';
import { FRONT_OVERLAP, computeLayout, layoutDecor, slotCountFor } from '../view/layout.js';

const kinds = {
  'rock-large': { bubbleSource: true },
  'rock-small': { bubbleSource: true },
  'coral-branch': { bubbleSource: true },
  'weed-tall': {},
};

describe('computeLayout', () => {
  it('has a unit of 1 in the default 480 x 320 window', () => {
    const layout = computeLayout({ width: 480, height: 320 });
    expect(layout.unit).toBe(1);
    expect(layout.aspect).toBeCloseTo(1.5);
  });

  it('scales the unit with the height (1080p and 4K)', () => {
    expect(computeLayout({ width: 1920, height: 1080 }).unit).toBeCloseTo(3.375);
    expect(computeLayout({ width: 3840, height: 2160 }).unit).toBeCloseTo(6.75);
  });

  it('puts the sand at the bottom and keeps the swim area above it', () => {
    for (const [width, height] of [
      [480, 320],
      [1920, 1080],
      [3440, 1440],
      [5120, 1440],
    ]) {
      const layout = computeLayout({ width, height });
      expect(layout.sand.y + layout.sand.height).toBeCloseTo(height);
      expect(layout.swim.y).toBeGreaterThan(0);
      expect(layout.swim.y + layout.swim.height).toBeLessThan(layout.sandTop);
      expect(layout.swim.width).toBeGreaterThan(0);
    }
  });

  it('keeps fish and pellets inside the usable area (taskbar at the bottom)', () => {
    const usable = { x: 0, y: 0, width: 1920, height: 1040 };
    const layout = computeLayout({ width: 1920, height: 1080, usable });
    expect(layout.swim.y + layout.swim.height).toBeLessThanOrEqual(1040);
  });

  it('keeps the swim area off a taskbar on the left or on the top', () => {
    const left = computeLayout({
      width: 1920,
      height: 1080,
      usable: { x: 60, y: 0, width: 1860, height: 1080 },
    });
    expect(left.swim.x).toBeGreaterThanOrEqual(60);
    const top = computeLayout({
      width: 1920,
      height: 1080,
      usable: { x: 0, y: 40, width: 1920, height: 1040 },
    });
    expect(top.dropBand.y).toBeGreaterThanOrEqual(40);
  });
});

describe('layoutDecor', () => {
  it('is deterministic', () => {
    expect(layoutDecor(123, 1.5, kinds)).toEqual(layoutDecor(123, 1.5, kinds));
  });

  it('differs between seeds', () => {
    expect(layoutDecor(1, 1.5, kinds).items).not.toEqual(layoutDecor(2, 1.5, kinds).items);
  });

  it('has more slots on wider tanks', () => {
    expect(slotCountFor(1.5)).toBe(6);
    expect(slotCountFor(16 / 9)).toBe(7);
    expect(slotCountFor(32 / 9)).toBe(14);
    expect(layoutDecor(5, 32 / 9, kinds).items.length).toBe(14);
  });

  it('keeps the first slots in place when the aspect grows', () => {
    const narrow = layoutDecor(99, 1.5, kinds);
    const wide = layoutDecor(99, 32 / 9, kinds);
    expect(wide.items.slice(0, narrow.items.length)).toEqual(narrow.items);
  });

  it('always has at least 2 bubble sources, on rocks or corals', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const aspect of [1.5, 16 / 9, 32 / 9]) {
        const { items, bubbleSources } = layoutDecor(seed, aspect, kinds);
        expect(bubbleSources.length).toBeGreaterThanOrEqual(2);
        expect(bubbleSources.length).toBeLessThanOrEqual(4);
        for (const id of bubbleSources) expect(kinds[items[id].kind].bubbleSource).toBe(true);
      }
    }
  });

  it('keeps positions inside the tank', () => {
    for (const item of layoutDecor(7, 32 / 9, kinds).items) {
      expect(item.fx).toBeGreaterThan(0);
      expect(item.fx).toBeLessThan(1);
      expect(item.fy).toBeGreaterThanOrEqual(0);
      expect(item.fy).toBeLessThanOrEqual(1);
    }
  });
});

describe('layoutDecor with widths: front rocks and corals do not stand in each other', () => {
  // Widths in units at scale 1, about the size of the real art.
  const widths = Object.fromEntries(
    Object.keys(kinds).map((k) => [
      k,
      k.startsWith('rock') ? 150 : k.startsWith('coral') ? 80 : 30,
    ]),
  );
  const extent = (item) => {
    const half = (widths[item.kind] * item.scale) / 480 / 2;
    return [item.fx - half, item.fx + half];
  };
  const solidFront = (items) =>
    items.filter((i) => i.layer === 'front' && /^(rock|coral)/.test(i.kind));

  it('leaves no front pair overlapping by more than the allowed share', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const aspect of [1.5, 16 / 9, 32 / 9]) {
        const front = solidFront(layoutDecor(seed, aspect, kinds, widths).items);
        for (let i = 0; i < front.length; i++) {
          for (let j = i + 1; j < front.length; j++) {
            const [a0, a1] = extent(front[i]);
            const [b0, b1] = extent(front[j]);
            const overlap = Math.min(a1, b1) - Math.max(a0, b0);
            expect(overlap).toBeLessThanOrEqual(FRONT_OVERLAP * Math.min(a1 - a0, b1 - b0) + 1e-9);
          }
        }
      }
    }
  });

  it('only moves items to the back, and changes nothing else', () => {
    for (let seed = 0; seed < 100; seed++) {
      const plain = layoutDecor(seed, 1.5, kinds).items;
      const separated = layoutDecor(seed, 1.5, kinds, widths).items;
      separated.forEach((item, i) => {
        const { layer, ...rest } = item;
        const { layer: before, ...restBefore } = plain[i];
        expect(rest).toEqual(restBefore);
        if (layer !== before) expect([before, layer]).toEqual(['front', 'back']);
      });
    }
  });

  it('still keeps the first slots the same when the aspect grows', () => {
    for (let seed = 0; seed < 100; seed++) {
      const narrow = layoutDecor(seed, 1.5, kinds, widths);
      const wide = layoutDecor(seed, 32 / 9, kinds, widths);
      expect(wide.items.slice(0, narrow.items.length)).toEqual(narrow.items);
    }
  });
});
