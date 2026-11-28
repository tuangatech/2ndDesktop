import { describe, expect, it } from 'vitest';
import { HERD } from '../game/animals.js';
import { animalPicture, coatKey, hayPicture, legKey, legPieces } from '../art/animals.js';
import { RIGS } from '../game/gait.js';

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

  it('draws each leg as two pieces, apart from the body, with the size the rig says', () => {
    expect(new Set(HERD.map(legKey)).size).toBe(4); // a horse's legs follow its coat; cows and sheep share theirs
    for (const [kind, coat] of [
      ['horse', 'brown'],
      ['horse', 'beige'],
      ['cow', 'brown-white'],
      ['sheep', 'white'],
    ]) {
      const rig = RIGS[kind];
      const legs = legPieces(kind, coat);
      for (const side of ['far', 'near']) {
        const { thigh, shin } = legs[side];
        // the upper piece hangs from the hip, the lower one from the knee, each down its own length
        expect(thigh.y).toBeLessThan(0);
        expect(thigh.y + thigh.height).toBeGreaterThan(rig.thigh);
        expect(shin.y).toBeLessThan(0);
        expect(shin.y + shin.height).toBeGreaterThan(rig.shin);
        for (const piece of [thigh, shin]) {
          expect(piece.ops.length).toBeGreaterThan(1);
          expect(JSON.stringify(piece.ops)).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
      // hooves on the lower piece of the horses' and cows' near legs
      const hooves = (piece) => piece.ops.filter((op) => op.t === 'rect').length;
      expect(hooves(legs.near.shin)).toBe(kind === 'sheep' ? 1 : 2);
      expect(hooves(legs.far.shin)).toBe(1);
    }
    // the body picture has no leg rectangles left in it
    const bodyOps = animalPicture('cow', 'brown-white').ops.filter((op) => op.t === 'rect');
    expect(bodyOps).toHaveLength(0);
  });

  it('is the same every time, and the hay is a few heaps with straw', () => {
    expect(animalPicture('sheep', 'white')).toEqual(animalPicture('sheep', 'white'));
    const hay = hayPicture();
    expect(hay).toEqual(hayPicture());
    expect(hay.ops.filter((op) => op.t === 'ellipse')).toHaveLength(3);
    expect(hay.ops.filter((op) => op.t === 'path').length).toBeGreaterThan(10);
  });
});
