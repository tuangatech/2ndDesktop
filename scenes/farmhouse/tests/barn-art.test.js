import { describe, expect, it } from 'vitest';
import { BARN_DOOR, BARN_LANTERN, BARN_LOFT, barnPicture } from '../art/barn.js';
import { BARN } from '../game/barn.js';

describe('the barn art', () => {
  it('is the same for the same inputs, and the snow changes the roof and nothing else in count', () => {
    expect(barnPicture(0)).toEqual(barnPicture(0));
    const dry = barnPicture(0);
    const snowy = barnPicture(1);
    expect(snowy.ops.length).toBeGreaterThan(dry.ops.length); // a line of snow along the roof
    expect(snowy.ops).not.toEqual(dry.ops);
  });

  it('is drawn in its own space on the ground line, with the door, the lantern and the loft window inside it', () => {
    const pic = barnPicture(0);
    expect(pic).toMatchObject({ x: 0, y: -BARN.height, width: BARN.width });
    expect(pic.y + pic.height).toBeGreaterThanOrEqual(6); // a little shadow under the ground line
    const inside = (r) =>
      r.x >= pic.x &&
      r.y >= pic.y &&
      r.x + (r.w ?? 0) <= pic.x + pic.width &&
      r.y + (r.h ?? 0) <= pic.y + pic.height;
    expect(inside(BARN_DOOR)).toBe(true);
    expect(inside(BARN_LOFT)).toBe(true);
    expect(inside({ ...BARN_LANTERN, w: 0, h: 0 })).toBe(true);
    // the animals go in by the door: its centre is where the rules say
    expect(BARN_DOOR.x + BARN_DOOR.w / 2).toBe(BARN.doorX);
  });

  it('is red and cream, with no pure white or black (docs/art-style.md), and nothing is cut at the edge', () => {
    const pic = barnPicture(0);
    const text = JSON.stringify(pic.ops);
    expect(text).toMatch(/#b24a34/);
    expect(text).toMatch(/#efe9da/);
    expect(text).not.toMatch(/#ffffff|#000000|NaN|undefined|Infinity/i);
    for (const op of pic.ops) {
      const box =
        op.t === 'rect'
          ? { x: op.x, y: op.y, w: op.w, h: op.h }
          : op.t === 'ellipse'
            ? { x: op.x - op.rx, y: op.y - op.ry, w: 2 * op.rx, h: 2 * op.ry }
            : null;
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(pic.x);
        expect(box.x + box.w).toBeLessThanOrEqual(pic.x + pic.width);
        expect(box.y).toBeGreaterThanOrEqual(pic.y);
        expect(box.y + box.h).toBeLessThanOrEqual(pic.y + pic.height);
      }
    }
  });
});
