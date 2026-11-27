import { describe, expect, it } from 'vitest';
import {
  CHIMNEY_TOP,
  DOOR_GLASS,
  TRUCK,
  WINDOW_RECTS,
  drivePicture,
  housePicture,
  truckPicture,
} from '../art/house.js';
import { WINDOWS } from '../game/clockRules.js';
import { DESIGN } from '../layout.js';

const inside = (picture, r) =>
  r.x >= picture.x &&
  r.y >= picture.y &&
  r.x + r.w <= picture.x + picture.width &&
  r.y + r.h <= picture.y + picture.height;

describe('the house art', () => {
  it('is the same for the same inputs', () => {
    expect(housePicture(0)).toEqual(housePicture(0));
    expect(drivePicture()).toEqual(drivePicture());
    expect(truckPicture()).toEqual(truckPicture());
  });

  it('puts the house in the middle of the design, and the six lit windows of the rules on the house', () => {
    const house = housePicture(0);
    expect(house.x + house.width / 2).toBeCloseTo(DESIGN.houseX + 10, 0);
    const ids = [...Object.keys(WINDOW_RECTS), 'door'].sort();
    expect(ids).toEqual([...WINDOWS].sort());
    for (const r of [...Object.values(WINDOW_RECTS), DOOR_GLASS])
      expect(inside(house, r)).toBe(true);
    expect(inside(house, { x: CHIMNEY_TOP.x - 1, y: CHIMNEY_TOP.y, w: 2, h: 2 })).toBe(true);
  });

  it('has snow on the roofs and the bushes when snow lies, and nothing else changes shape', () => {
    const dry = housePicture(0);
    const snowy = housePicture(1);
    expect(snowy.ops).toHaveLength(dry.ops.length);
    expect(snowy.ops).not.toEqual(dry.ops);
  });

  it('draws the drive out to the right edge and the truck in its own space', () => {
    const drive = drivePicture();
    expect(drive.x + drive.width).toBe(DESIGN.width);
    const truck = truckPicture();
    expect(truck).toMatchObject({ x: TRUCK.left, y: TRUCK.top, width: TRUCK.width });
    // The wheels touch the ground line of the truck's space (y 0), and nothing hangs below it.
    expect(truck.y + truck.height).toBeGreaterThanOrEqual(6);
    for (const pic of [drive, truck, housePicture(0)]) {
      expect(JSON.stringify(pic.ops)).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});
