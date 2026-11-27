// The far reef: soft, low-contrast silhouettes that stand behind everything and give the water depth (like the
// blurry distant reef in an aquarium picture). Pure functions, no drawing: they turn the tank seed and the layout
// into polygons, and TankScene fills them. Everything is sized in units (FR-63) and measured from the left edge,
// so a wider tank only shows more of the same reef (ridges and blades) and never stretches it.

import { makeRng } from '../../../shared/rng.js';
import { visual } from './visualConfig.js';

const CELL = 34; // units between the points of the random profile
const MAX_CELLS = 420; // enough for a 32:9 tank at any size (each cell is a point of the value noise)
// The blades are drawn over a fixed span of units, and the ones beyond the tank's right edge are dropped, so a wider
// tank shows the same blades further right (a count or a position that depended on the width would make the weeds
// slide and jump while a window is resized). 1600 units is about 4.5 tanks of 32:9.
const BLADE_SPAN_UNITS = 1600;

const smooth = (t) => t * t * (3 - 2 * t);

/** A smooth random profile in [0, 1]: value noise over a lattice that depends only on the seed and the layer. */
function makeProfile(seed, layerIndex) {
  const rng = makeRng((seed ^ 0x9e3779b9) + layerIndex * 7919);
  const lattice = Array.from({ length: MAX_CELLS }, () => rng.next());
  const at = (i) => lattice[Math.min(MAX_CELLS - 1, Math.max(0, i))];
  return (u) => {
    const i = Math.floor(u);
    return at(i) + (at(i + 1) - at(i)) * smooth(u - i);
  };
}

/**
 * @param {number} seed  the tank's decor seed
 * @param {{width:number, sandTop:number, unit:number}} layout
 * @returns {Array<{kind:'ridge'|'blade', color:number, alpha:number, points:Array<{x:number,y:number}>}>}
 *   back to front; every shape is closed by the caller
 */
export function backdropShapes(seed, { width, sandTop, unit }) {
  const shapes = [];
  const cfg = visual.backdrop;
  const step = Math.max(4, 5 * unit);

  cfg.layers.forEach((layer, index) => {
    const coarse = makeProfile(seed, index * 2);
    const fine = makeProfile(seed, index * 2 + 1);
    const heightAt = (x) => {
      const u = x / (CELL * unit);
      // Mostly gentle swells, with now and then a tall tower: the cube makes the high values rare.
      const swell = coarse(u * layer.swells);
      const tower = Math.pow(fine(u * layer.swells * 0.5 + 40), 3);
      const h = layer.base + layer.swell * swell + layer.tower * tower;
      return h * unit;
    };

    const points = [{ x: -step, y: sandTop + 2 * unit }];
    for (let x = -step; x <= width + step; x += step) {
      points.push({ x, y: sandTop - heightAt(x) });
    }
    points.push({ x: width + step, y: sandTop + 2 * unit });
    shapes.push({ kind: 'ridge', color: layer.color, alpha: layer.alpha, points });

    // Thin weed silhouettes standing on the ridge, only on the nearer layers.
    if (layer.blades) {
      const rng = makeRng((seed ^ 0x51ed270b) + index * 104729);
      const candidates = Math.ceil((BLADE_SPAN_UNITS / 100) * layer.blades);
      for (let i = 0; i < candidates; i++) {
        // Every value is drawn for every candidate, kept or not, so no blade depends on how many were kept before it.
        const x = rng.range(0, BLADE_SPAN_UNITS) * unit;
        const bladeHeight = rng.range(layer.bladeHeight[0], layer.bladeHeight[1]) * unit;
        const bladeWidth = rng.range(1.6, 2.6) * unit;
        const lean = rng.range(-0.25, 0.25);
        const phase = rng.range(0, Math.PI * 2);
        if (x > width + 4 * unit) continue;
        const baseY = sandTop - heightAt(x) + 3 * unit;
        const left = [];
        const right = [];
        const segments = 8;
        for (let s = 0; s <= segments; s++) {
          const t = s / segments;
          const cx = x + (lean * t + Math.sin(phase + t * 4.2) * 0.07 * t) * bladeHeight;
          const cy = baseY - t * bladeHeight;
          const half = (bladeWidth / 2) * (1 - t * 0.85);
          left.push({ x: cx - half, y: cy });
          right.push({ x: cx + half, y: cy });
        }
        shapes.push({
          kind: 'blade',
          color: layer.color,
          alpha: layer.alpha,
          points: [...left, ...right.reverse()],
        });
      }
    }
  });
  return shapes;
}
