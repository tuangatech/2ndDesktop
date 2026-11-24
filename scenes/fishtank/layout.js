// Layout of the tank for any width and height (tech design 3.8, FR-63). Pure functions, no drawing.
// One unit is height / 320, so the default 480 x 320 window has a unit of 1 and every size and speed
// in the scene is a number of units.

import { makeRng } from '../../shared/rng.js';

export const REFERENCE_HEIGHT = 320;
export const DEFAULT_ASPECT = 1.5;

/** Fraction of the height taken by the sand floor. */
const SAND_FRACTION = 0.14;
/** Pellets and fish stay out of the top and bottom margins (fractions of the height). */
const WATER_MARGIN = 0.06;

/**
 * @param {{width:number, height:number, usable?:{x:number,y:number,width:number,height:number}}} input
 *   `usable` is the part of the tank not covered by the taskbar, menu bar or Dock (defaults to all of it).
 */
export function computeLayout({ width, height, usable }) {
  const unit = height / REFERENCE_HEIGHT;
  const area = usable ?? { x: 0, y: 0, width, height };
  const sandHeight = height * SAND_FRACTION;
  const sandTop = height - sandHeight;
  const margin = height * WATER_MARGIN;
  const swimTop = Math.max(area.y, 0) + margin;
  const swimBottom = Math.min(sandTop - margin * 0.5, area.y + area.height - margin);
  return {
    width,
    height,
    unit,
    aspect: width / height,
    water: { x: 0, y: 0, width, height: sandTop },
    sand: { x: 0, y: sandTop, width, height: sandHeight },
    sandTop,
    swim: {
      x: area.x + margin,
      y: swimTop,
      width: Math.max(0, area.width - margin * 2),
      height: Math.max(0, swimBottom - swimTop),
    },
    // Where dropped pellets start: a band just under the surface, inside the usable area.
    dropBand: {
      x: area.x + margin,
      y: swimTop,
      width: Math.max(0, area.width - margin * 2),
      height: Math.max(1, height * 0.04),
    },
    usable: area,
  };
}

/** How many decoration slots a tank of this shape has: about 6 at 3:2, up to 14 at 32:9. */
export function slotCountFor(aspect) {
  return Math.min(14, Math.max(5, Math.round((6 * aspect) / DEFAULT_ASPECT)));
}

const GOLDEN = 0.6180339887498949;

/**
 * Decoration layout from the tank seed (FR-41). Same seed and aspect give the same result. Slots are made
 * one after another and do not depend on the aspect, so a wider tank only adds slots at the end.
 *
 * @param {number} seed
 * @param {number} aspect  width / height
 * @param {Record<string, {bubbleSource?: boolean}>} kinds  decoration kinds (scenes/fishtank/decor.json)
 * @param {Record<string, number>} [widths]  width of each kind in units at scale 1; with it, front rocks and
 *   corals that would stand in each other are moved to the back (see separateFront)
 * @returns {{items: Array<{id:number, kind:string, layer:'back'|'front', fx:number, fy:number, scale:number, flip:boolean, phase:number}>,
 *            bubbleSources: number[]}}  `bubbleSources` holds item ids
 */
export function layoutDecor(seed, aspect, kinds, widths) {
  const names = Object.keys(kinds);
  const rocks = names.filter((n) => n.startsWith('rock'));
  const corals = names.filter((n) => n.startsWith('coral'));
  const weeds = names.filter((n) => n.startsWith('weed'));
  const rng = makeRng(seed ^ 0x2545f491);
  const count = slotCountFor(aspect);
  const maxCount = slotCountFor(Infinity);
  const items = [];

  // Every slot is made for the largest tank and the first `count` are used, so the random numbers of
  // a slot never depend on the aspect.
  for (let id = 0; id < maxCount; id++) {
    // The first slots are fixed in kind, so every tank has rocks, corals and weeds.
    let kind;
    if (id === 0) kind = rocks[0];
    else if (id === 1) kind = corals[0];
    else if (id === 2) kind = weeds[0];
    else if (id === 3) kind = rng.pick(rocks.length ? rocks : names);
    else {
      const roll = rng.next();
      const group = roll < 0.3 ? rocks : roll < 0.6 ? corals : weeds;
      kind = rng.pick(group.length ? group : names);
    }
    const fx = (0.13 + id * GOLDEN + (rng.next() - 0.5) * 0.08) % 1;
    const item = {
      id,
      kind,
      layer: rng.next() < 0.5 ? 'back' : 'front',
      fx: Math.min(0.97, Math.max(0.03, fx)),
      fy: rng.range(0, 1),
      scale: rng.range(0.85, 1.2),
      flip: rng.next() < 0.5,
      phase: rng.range(0, Math.PI * 2),
    };
    if (id < count) items.push(item);
  }

  if (widths) separateFront(items, widths);

  // Two to four bubble sources among the first eight slots (so they never change with the aspect).
  const candidates = items.filter((item) => item.id < 8 && kinds[item.kind]?.bubbleSource);
  const wanted = rng.int(2, 4);
  const bubbleSources = candidates
    .slice(0, Math.max(2, Math.min(wanted, candidates.length)))
    .map((i) => i.id);

  return { items, bubbleSources };
}

/** How much two front rocks or corals may overlap, as a share of the narrower one. */
export const FRONT_OVERLAP = 0.25;

/**
 * A rock or coral in the front row that would stand inside an earlier front rock or coral moves to the back
 * row, where it is paler and sits behind it, as in a real tank. Weeds are thin and may overlap anything.
 * Widths are measured at the default 3:2 shape whatever the tank's aspect, and an item only looks at items
 * before it, so the first slots stay the same when the tank gets wider.
 */
function separateFront(items, widths) {
  const tankWidth = REFERENCE_HEIGHT * DEFAULT_ASPECT; // in units
  const solid = (item) => /^(rock|coral)/.test(item.kind) && widths[item.kind] > 0;
  const placed = [];
  for (const item of items) {
    if (item.layer !== 'front' || !solid(item)) continue;
    const half = (widths[item.kind] * item.scale) / tankWidth / 2;
    const left = item.fx - half;
    const right = item.fx + half;
    const clash = placed.some((other) => {
      const overlap = Math.min(right, other.right) - Math.max(left, other.left);
      return overlap > FRONT_OVERLAP * Math.min(right - left, other.right - other.left);
    });
    if (clash) item.layer = 'back';
    else placed.push({ left, right });
  }
}
