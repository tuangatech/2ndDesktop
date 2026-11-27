import { describe, expect, it } from 'vitest';
import { HERD } from '../game/animals.js';
import { animalPicture, coatKey, hayPicture } from '../art/animals.js';

describe('the animal art', () => {
  it('has a picture for every animal of the herd, and five coats for the seven animals', () => {
    const coats = new Set(HERD.map(coatKey));
    expect(coats.size).toBe(5);
    for (const spec of HERD) {
      const picture = animalPicture(spec.kind, spec.coat);
      expect(picture.ops.length).toBeGreaterThan(10);
      expect(JSON.stringify(picture.ops)).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('draws each animal on the ground in its own space: hooves at y 0, the nose to the right', () => {
    for (const kind of ['horse', 'cow', 'sheep']) {
      const coat = { horse: 'brown', cow: 'brown-white', sheep: 'white' }[kind];
      const picture = animalPicture(kind, coat);
      expect(picture.y + picture.height).toBeGreaterThanOrEqual(6); // tufts of grass just under the hooves
      expect(picture.x).toBeLessThan(0);
      expect(picture.x + picture.width).toBeGreaterThan(50);
      expect(picture.pixelWidth).toBe(Math.round(picture.width * 1.5));
    }
  });

  it('gives the two horses and the two cows different coats, and a cow patches inside its body', () => {
    expect(animalPicture('horse', 'brown')).not.toEqual(animalPicture('horse', 'beige'));
    const brown = animalPicture('cow', 'brown-white');
    const tan = animalPicture('cow', 'tan-white');
    expect(brown).not.toEqual(tan);
    expect(brown.ops.some((op) => op.t === 'clip')).toBe(true);
  });

  it('is the same every time, and the hay is a few heaps with straw', () => {
    expect(animalPicture('sheep', 'white')).toEqual(animalPicture('sheep', 'white'));
    const hay = hayPicture();
    expect(hay).toEqual(hayPicture());
    expect(hay.ops.filter((op) => op.t === 'ellipse')).toHaveLength(3);
    expect(hay.ops.filter((op) => op.t === 'path').length).toBeGreaterThan(10);
  });
});
