import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import species from '../../scenes/fishtank/species.json';
import { paletteFor } from '../../scenes/fishtank/palette.js';

const artDir = path.join(import.meta.dirname, '..', '..', 'scenes', 'fishtank', 'art');

describe('species data', () => {
  it('has the three species of the plan', () => {
    expect(Object.keys(species).sort()).toEqual(['angelfish', 'guppy', 'tetra']);
  });

  for (const [id, data] of Object.entries(species)) {
    describe(id, () => {
      it('has an art file for every frame', () => {
        for (const frame of Object.values(data.frames)) {
          expect(fs.existsSync(path.join(artDir, `${frame}.svg`)), frame).toBe(true);
        }
      });

      it('has sane numbers', () => {
        expect(data.id).toBe(id);
        expect(data.artLength).toBe(200);
        expect(data.mouth.x).toBeGreaterThan(0.3);
        expect(data.mouth.x).toBeLessThan(0.5);
        const [low, high] = data.depthRange;
        expect(low).toBeGreaterThanOrEqual(0.05);
        expect(high).toBeLessThanOrEqual(0.9);
        expect(high - low).toBeGreaterThan(0.4);
        expect(data.baseSpeed).toBeGreaterThan(10);
      });

      it('has a palette for every stage', () => {
        for (const stage of ['fry', 'juvenile', 'adult']) {
          const colors = paletteFor(data, stage, 1);
          expect(Object.keys(colors).sort()).toEqual(['accent', 'body', 'fin']);
        }
      });
    });
  }

  it('the angelfish swims mid-water and slower than the tetra, the guppy is the quickest', () => {
    expect(species.angelfish.baseSpeed).toBeLessThan(species.tetra.baseSpeed);
    expect(species.guppy.baseSpeed).toBeGreaterThan(species.tetra.baseSpeed);
    expect(species.angelfish.depthRange[0]).toBeGreaterThan(species.tetra.depthRange[0]);
    expect(species.angelfish.depthRange[1]).toBeLessThan(species.tetra.depthRange[1]);
  });
});
