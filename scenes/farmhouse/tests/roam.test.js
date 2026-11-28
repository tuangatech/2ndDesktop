import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HERD, animalsAt } from '../game/animals.js';
import { NOMINAL, roam } from '../game/roam.js';

const SEED = 20261121;
const START = Date.UTC(2026, 9, 20, 12, 0, 0);
const at = (seconds) => animalsAt(START + seconds * 1000, { seed: SEED, dayIndex: 20381 });
const ground = (a, b) => Math.hypot((a.x - b.x) * 2100, (a.depth - b.depth) * 185);

/** Six hours of the herd, a second at a time, per animal. */
function sixHours() {
  const runs = {};
  for (let s = 0; s < 6 * 3600; s++) {
    for (const a of at(s)) (runs[a.id] ??= []).push(a);
  }
  return runs;
}
const runs = sixHours();

describe('R6 the animals roam freely (DEC-66)', () => {
  it('each animal covers a wide part of the field, in x and in depth', () => {
    for (const [id, list] of Object.entries(runs)) {
      const xs = list.map((a) => a.x * 2100);
      const ds = list.map((a) => a.depth);
      const sheep = id.startsWith('sheep');
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(sheep ? 600 : 450);
      expect(Math.max(...ds) - Math.min(...ds)).toBeGreaterThan(0.3);
    }
  });

  it('moves are diagonal as often as straight: left-near, right-far and so on', () => {
    let diagonal = 0;
    let walks = 0;
    for (const list of Object.values(runs)) {
      for (let i = 30; i < list.length; i += 30) {
        if (list[i].pose !== 'walk') continue;
        const dx = Math.abs(list[i].x - list[i - 30].x) * 2100;
        const dd = Math.abs(list[i].depth - list[i - 30].depth) * 185;
        if (dx + dd < 30) continue;
        walks++;
        if (dx > 15 && dd > 15) diagonal++;
      }
    }
    expect(walks).toBeGreaterThan(100);
    expect(diagonal / walks).toBeGreaterThan(0.2);
  });

  it('walk a small part of the time and stand about for a long time between moves', () => {
    for (const [id, list] of Object.entries(runs)) {
      const walking = list.filter((a) => a.pose === 'walk').length / list.length;
      expect(walking).toBeGreaterThan(0.02);
      expect(walking).toBeLessThan(0.2);
      if (id.startsWith('sheep')) continue;
      // The lengths of the stretches without a walk.
      const stills = [];
      let run = 0;
      for (const a of list) {
        if (a.pose === 'walk') {
          if (run > 0) stills.push(run);
          run = 0;
        } else run++;
      }
      stills.sort((p, q) => p - q);
      expect(stills[Math.floor(stills.length / 2)]).toBeGreaterThan(30); // half the stops last over half a minute
      expect(stills[stills.length - 1]).toBeGreaterThan(120); // and some over two minutes
    }
  });

  it('are not in step: the animals do not walk and stop together', () => {
    // At a given moment about the same share of the herd walks, but not the same animals, and not all at once.
    let all = 0;
    let none = 0;
    for (let s = 0; s < 6 * 3600; s += 5) {
      const walking = at(s).filter((a) => a.pose === 'walk').length;
      if (walking === 7) all++;
      if (walking === 0) none++;
    }
    expect(all).toBe(0);
    expect(none).toBeGreaterThan(100); // there are long moments when nobody moves
    expect(none / (6 * 720)).toBeLessThan(0.9); // and it is not a still picture
  });

  it('walk at a steady pace of their own: a horse 38 units a second, a cow 26', () => {
    for (const [id, speed] of [
      ['horse-brown', 38],
      ['cow-1', 26],
    ]) {
      // On a 16:9 screen the animals' part of the width is 1320 design units, about what a share of the width stands for.
      const bounds = { xMin: 0.186, xMax: 0.814 };
      const list = [];
      for (let t = 0; t < 6 * 3600; t++)
        list.push(
          animalsAt(START + t * 1000, { seed: SEED, dayIndex: 20381, bounds }).find(
            (a) => a.id === id,
          ),
        );
      let steady = 0;
      let total = 0;
      for (let i = 1; i < list.length; i++) {
        if (list[i].pose !== 'walk' || list[i - 1].pose !== 'walk') continue;
        total++;
        const pace = ground(list[i], list[i - 1]);
        if (pace < speed * 1.4) steady++; // the gentle start and stop make it a little faster in the middle
      }
      expect(total).toBeGreaterThan(100);
      expect(steady / total).toBeGreaterThan(0.95);
    }
  });

  it('the two horses and the two cows keep to their own sides: they never meet', () => {
    for (let s = 0; s < 6 * 3600; s += 7) {
      const herd = Object.fromEntries(at(s).map((a) => [a.id, a]));
      expect(herd['horse-brown'].x).toBeLessThan(herd['horse-beige'].x - 0.1);
      expect(herd['cow-1'].x).toBeLessThan(herd['cow-2'].x - 0.1);
    }
  });

  it('horses keep to the back and middle of the field, cows to the middle and front', () => {
    const mean = (id) => runs[id].reduce((s, a) => s + a.depth, 0) / runs[id].length;
    expect(mean('horse-brown')).toBeLessThan(0.35);
    expect(mean('horse-beige')).toBeLessThan(0.35);
    expect(mean('cow-1')).toBeGreaterThan(0.6);
    expect(mean('cow-2')).toBeGreaterThan(0.6);
  });

  it('the flock walks together: when the flock moves every sheep walks', () => {
    let together = 0;
    let flockWalks = 0;
    for (let s = 0; s < 6 * 3600; s += 3) {
      const sheep = at(s).filter((a) => a.kind === 'sheep');
      const walking = sheep.filter((a) => a.pose === 'walk').length;
      if (walking === 3) {
        together++;
        flockWalks++;
      } else if (walking > 0) flockWalks++;
    }
    expect(together).toBeGreaterThan(20);
    expect(flockWalks).toBeGreaterThan(together);
  });

  it('one animal alone: a stop never has a step in it, at any cycle edge, a tenth of a second at a time', () => {
    for (const spec of HERD) {
      let last = null;
      for (let ms = 0; ms < 40 * 60 * 1000; ms += 100) {
        const r = roam(SEED, spec.roam, 3, ms / 1000);
        if (last) {
          const d = Math.hypot(
            (r.x - last.x) * NOMINAL.width,
            (r.depth - last.depth) * NOMINAL.depth,
          );
          expect(d).toBeLessThan(8);
        }
        last = r;
      }
    }
  });

  it('is a function of the seed and the clock: nothing is added up', () => {
    const direct = roam(SEED, HERD[0].roam, 0, 7 * 3600 + 13);
    expect(roam(SEED, HERD[0].roam, 0, 7 * 3600 + 13)).toEqual(direct);
    expect(roam(SEED + 1, HERD[0].roam, 0, 7 * 3600 + 13)).not.toEqual(direct);
    const source = readFileSync(fileURLToPath(new URL('../game/roam.js', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/Date\.now|new Date\(|performance\.now|Math\.random/);
    for (const m of source.matchAll(/^import .* from '([^']+)'/gm))
      expect(m[1].startsWith('./')).toBe(true);
  });
});
