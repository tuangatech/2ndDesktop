import { describe, expect, it } from 'vitest';
import { seasonAt } from '../game/season.js';
import {
  STRIPS,
  farRidgePicture,
  hillPicture,
  midRidgePicture,
  skyPicture,
} from '../art/landscape.js';
import { band, gradient, paint, rgba } from '../art/draw.js';
import { paletteKey } from '../art/palette.js';
import { DESIGN } from '../layout.js';

const ATLANTA = 33.7;
const autumn = seasonAt(293, ATLANTA);
const summer = seasonAt(196, ATLANTA);
const count = (picture, t) => picture.ops.filter((op) => op.t === t).length;
const ellipses = (picture) => picture.ops.filter((op) => op.t === 'ellipse');

describe('the landscape pictures', () => {
  it('are the same for the same inputs (every tree keeps its place)', () => {
    expect(hillPicture(autumn, 0)).toEqual(hillPicture(autumn, 0));
    expect(midRidgePicture(autumn, 0)).toEqual(midRidgePicture(autumn, 0));
    expect(farRidgePicture()).toEqual(farRidgePicture());
    expect(skyPicture()).toEqual(skyPicture());
  });

  it('cover their strip of the design and are drawn at the resolution of the plan', () => {
    const pictures = {
      sky: skyPicture(),
      far: farRidgePicture(),
      mid: midRidgePicture(autumn),
      hill: hillPicture(autumn),
    };
    for (const [name, picture] of Object.entries(pictures)) {
      const strip = STRIPS[name];
      expect(picture).toMatchObject({
        x: 0,
        y: strip.y,
        width: DESIGN.width,
        height: strip.height,
      });
      expect(picture.pixelWidth).toBe(Math.round(DESIGN.width * strip.resolution));
      expect(picture.pixelHeight).toBe(Math.round(strip.height * strip.resolution));
      expect(picture.ops.length).toBeGreaterThan(0);
      expect(JSON.stringify(picture.ops)).not.toMatch(/NaN|Infinity|null/);
    }
  });

  it('keep the trees where they are when the season changes, and only the colours move', () => {
    const a = ellipses(hillPicture(summer, 0));
    const b = ellipses(hillPicture(autumn, 0));
    expect(a.map(({ x, y, rx, ry }) => [x, y, rx, ry])).toEqual(
      b.map(({ x, y, rx, ry }) => [x, y, rx, ry]),
    );
    expect(a.map((e) => e.fill)).not.toEqual(b.map((e) => e.fill));
  });

  it('put snow on the trees and the ground when snow lies', () => {
    expect(hillPicture(autumn, 0)).not.toEqual(hillPicture(autumn, 1));
    expect(midRidgePicture(autumn, 0)).not.toEqual(midRidgePicture(autumn, 1));
  });

  it('hold thousands of trees on the near hill and a few conifers', () => {
    const hill = hillPicture(autumn, 0);
    expect(count(hill, 'ellipse')).toBeGreaterThan(2500);
    expect(count(hill, 'path')).toBeGreaterThan(50);
    expect(count(midRidgePicture(autumn), 'ellipse')).toBeGreaterThan(1000);
  });

  it('use fog bands that are clear at both edges, so no line shows where one starts', () => {
    for (const picture of [farRidgePicture(), midRidgePicture(autumn)]) {
      const fog = picture.ops.findLast((op) => op.t === 'rect');
      expect(fog.fill.stops[0][2]).toBe(0);
      expect(fog.fill.stops.at(-1)[2]).toBe(0);
    }
  });
});

describe('the drawing operations', () => {
  it('make gradients and colours', () => {
    expect(rgba('#ff8000', 0.5)).toBe('rgba(255,128,0,0.5)');
    expect(gradient(0, 10, '#000000', '#ffffff', 1, 0).stops).toHaveLength(2);
    expect(band(0, 10, '#dcdad0', 0.4).stops.map((s) => s[2])).toEqual([0, 0.4, 0]);
  });

  it('paint every kind of operation, and refuse an unknown one', () => {
    const calls = [];
    const ctx = new Proxy(
      {},
      {
        get: (_, name) => () => {
          calls.push(name);
          return name === 'createLinearGradient' ? { addColorStop() {} } : undefined;
        },
        set: () => true,
      },
    );
    globalThis.Path2D ??= class {};
    paint(ctx, [
      { t: 'rect', x: 0, y: 0, w: 1, h: 1, fill: '#000000' },
      { t: 'ellipse', x: 1, y: 1, rx: 1, ry: 1, fill: gradient(0, 1, '#000000', '#ffffff') },
      { t: 'path', d: 'M 0 0 L 1 1', fill: '#000000', stroke: '#000000', width: 2 },
    ]);
    expect(calls).toEqual(
      expect.arrayContaining(['fillRect', 'ellipse', 'fill', 'stroke', 'createLinearGradient']),
    );
    expect(() => paint(ctx, [{ t: 'star' }])).toThrow(/unknown/);
  });
});

describe('the palette key', () => {
  it('moves in steps, not every second', () => {
    expect(paletteKey(autumn, 0)).toBe(paletteKey(autumn, 0));
    expect(paletteKey(summer, 0)).not.toBe(paletteKey(autumn, 0));
    expect(paletteKey(autumn, 0)).not.toBe(paletteKey(autumn, 1));
    const keys = new Set();
    for (let day = 280; day < 300; day++) keys.add(paletteKey(seasonAt(day, ATLANTA), 0));
    expect(keys.size).toBeLessThan(20);
  });
});
