import { describe, expect, it } from 'vitest';
import { seasonAt } from '../game/season.js';
import { floweringAt } from '../game/flowering.js';
import {
  BACK_TREES,
  FIELD_TOP,
  FRONT_TREES,
  backTreePicture,
  fencePicture,
  fieldPicture,
  frontTreePicture,
  grassColours,
  lawnGroundPicture,
  treeKey,
} from '../art/trees.js';
import { DESIGN } from '../layout.js';

const ATLANTA = 33.7;
const day = (d) => seasonAt(d, ATLANTA);
const blobs = (picture) => picture.ops.filter((op) => op.t === 'ellipse');
const OCT = 293;
const JAN = 15;
const JUL = 196;

describe('the trees', () => {
  it('are the same for the same inputs', () => {
    for (const tree of BACK_TREES) {
      expect(backTreePicture(tree, day(OCT))).toEqual(backTreePicture(tree, day(OCT)));
    }
    for (const tree of FRONT_TREES) {
      const state = floweringAt(tree.id, OCT, ATLANTA);
      expect(frontTreePicture(tree, state)).toEqual(frontTreePicture(tree, state));
    }
  });

  it('have their leaves in summer and show their branches in winter', () => {
    for (const tree of BACK_TREES) {
      const summer = backTreePicture(tree, day(JUL));
      const winter = backTreePicture(tree, day(JAN));
      expect(blobs(summer).length).toBeGreaterThan(15);
      expect(blobs(winter)).toHaveLength(0);
      expect(winter.ops.filter((op) => op.t === 'path').length).toBeGreaterThan(
        summer.ops.filter((op) => op.t === 'path').length,
      );
    }
  });

  it('keep each blob in its place while the colours move through the year', () => {
    const tree = BACK_TREES[0];
    const a = blobs(backTreePicture(tree, day(JUL)));
    const b = blobs(backTreePicture(tree, day(OCT)));
    expect(a.map((e) => [e.x, e.y])).toEqual(b.map((e) => [e.x, e.y]));
    expect(a.map((e) => e.fill)).not.toEqual(b.map((e) => e.fill));
  });

  it('flower in their month: blossom colours in April, none in July, berries on the dogwood in October', () => {
    const dogwood = FRONT_TREES.find((t) => t.id === 'dogwood');
    const april = frontTreePicture(dogwood, floweringAt('dogwood', 110, ATLANTA));
    const july = frontTreePicture(dogwood, floweringAt('dogwood', JUL, ATLANTA));
    const october = frontTreePicture(dogwood, floweringAt('dogwood', 295, ATLANTA));
    const fills = (pic) => new Set(blobs(pic).map((e) => e.fill));
    expect(april.ops.length).toBeGreaterThan(0);
    expect([...fills(april)].some((c) => c !== [...fills(july)][0])).toBe(true);
    expect(blobs(october).some((e) => e.fill === dogwood.berry)).toBe(true);
    expect(blobs(july).some((e) => e.fill === dogwood.berry)).toBe(false);
  });

  it('have a key that moves in steps of the look, not with every minute', () => {
    const state = (d) => floweringAt('cherry', d, ATLANTA);
    expect(treeKey(state(JUL), 0)).toBe(treeKey(state(JUL + 1), 0));
    expect(treeKey(state(100), 0)).not.toBe(treeKey(state(JUL), 0));
    expect(treeKey(state(JUL), 0)).not.toBe(treeKey(state(JUL), 1));
  });
});

describe('the grass, the field and the fence', () => {
  it('are green in summer and straw in winter, and whiter under snow', () => {
    expect(grassColours(day(JUL)).top).not.toBe(grassColours(day(JAN)).top);
    expect(grassColours(day(JUL), 1).top).not.toBe(grassColours(day(JUL), 0).top);
  });

  it('cover the width of the design, the field down to the bottom', () => {
    const field = fieldPicture(day(OCT));
    expect(field.y).toBe(FIELD_TOP);
    expect(field.y + field.height).toBe(DESIGN.height);
    expect(field.width).toBe(DESIGN.width);
    for (const pic of [lawnGroundPicture(day(OCT)), fencePicture(day(OCT)), field]) {
      expect(pic.width).toBe(DESIGN.width);
      expect(JSON.stringify(pic.ops)).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});
