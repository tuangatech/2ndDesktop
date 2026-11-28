// What the scene draws for the small things of rules R16 to R18 (docs/scenes/farmhouse.md, DEC-64): the owl in the barn's
// loft window, the weathervane on its roof, and the breath of the horses and cows in the cold. The numbers come from the
// pure rules (game/extras.js); this file only puts shapes where they say. Everything is a function of the clock (R1).
import { Container, Graphics } from 'pixi.js';
import { BARN_LOFT } from './art/barn.js';
import { HERD } from './game/animals.js';
import { breathAmount, owlAt, puffProgress, vaneHeading, vaneWidth } from './game/extras.js';
import { DESIGN } from './layout.js';

/** Where the nose is, in an animal's own picture (nose to the right, the origin at the hooves). */
const NOSE = { horse: [84, -86], cow: [68, -56] };
/** The loft window's middle, and the owl's place in it. */
const OWL_X = BARN_LOFT.x + BARN_LOFT.w / 2;
const OWL_Y = BARN_LOFT.y + BARN_LOFT.h - 3;
/** The top of the barn's roof, where the weathervane stands (the barn's own space). */
const VANE_BASE = [125, -176];
const EYES = 0xffe98a;

/**
 * @param {{layers: Record<string, Container>, barnBox: Container, fieldY: (depth: number) => number}} options
 */
export function createExtrasView({ layers, barnBox, fieldY }) {
  // The weathervane: a post and a ball (still) and an arrow that turns about the post (its width is the cosine of its angle).
  const vane = new Container();
  vane.addChild(new Graphics().rect(-1.1, -26, 2.2, 26).fill(0x3a332c));
  vane.addChild(new Graphics().circle(0, -27, 2.6).fill(0x3a332c));
  const arrow = new Graphics()
    .poly([
      -18, 0, -9, -4.5, -9, -1.5, 13, -1.5, 13, -5.5, 19, 0, 13, 5.5, 13, 1.5, -9, 1.5, -9, 4.5,
    ])
    .fill(0x3a332c);
  arrow.position.set(0, -20);
  vane.addChild(arrow);
  vane.position.set(VANE_BASE[0], VANE_BASE[1]);
  barnBox.addChild(vane);

  // The owl: a small brown body in the window (under the grade) and its two eyes over the grade, so they glow at night.
  const owl = new Container();
  owl.addChild(new Graphics().ellipse(0, 0, 7.5, 9).fill(0x6e5b48));
  owl.addChild(new Graphics().poly([-6, -6, -4.5, -12, -1.5, -7]).fill(0x6e5b48));
  owl.addChild(new Graphics().poly([6, -6, 4.5, -12, 1.5, -7]).fill(0x6e5b48));
  owl.addChild(new Graphics().circle(0, -3, 6).fill(0xcdbb9a));
  owl.addChild(new Graphics().poly([-1.4, -0.8, 1.4, -0.8, 0, 2.6]).fill(0xd08a3a));
  owl.position.set(OWL_X, OWL_Y - 9);
  owl.visible = false;
  barnBox.addChild(owl);
  const eyes = new Container();
  const eyeL = new Graphics().ellipse(0, 0, 2.9, 2.9).fill(EYES);
  const eyeR = new Graphics().ellipse(0, 0, 2.9, 2.9).fill(EYES);
  eyeL.position.set(-2.8, 0);
  eyeR.position.set(2.8, 0);
  eyes.addChild(eyeL, eyeR);
  eyes.visible = false;
  layers.grade.addChild(eyes);

  // The breath: one soft puff for each horse and cow, out of step.
  const breath = new Container();
  const puffs = HERD.map((spec, index) => {
    if (spec.kind === 'sheep') return null;
    const g = new Graphics().circle(0, 0, 6).fill(0xe9edf0);
    g.visible = false;
    breath.addChild(g);
    return { id: spec.id, kind: spec.kind, index, g };
  }).filter(Boolean);
  layers.weather.addChild(breath);

  const seen = { owl: 0, vane: 0, breath: 0 };
  return {
    /** Puts the barn's small things where the barn is (design units, the barn's ground line at its left edge). */
    placeBarn(x, y) {
      eyes.position.set(x + OWL_X, y + OWL_Y - 9 - 3);
    },
    /**
     * @param {object} frame
     * @param {number} frame.ms
     * @param {object} frame.slow  `slowAt()`
     * @param {object} frame.parts  the wall clock now
     * @param {number} frame.dayIndex
     * @param {number} frame.seed
     * @param {{id: string, x: number, depth: number, scale: number, facing: string, alpha: number, pose: string}[]} frame.animals
     */
    update({ ms, slow, parts, dayIndex, seed, animals }) {
      const t = ms / 1000;
      const { weather } = slow;
      // The weathervane turns into the wind.
      const width = vaneWidth(vaneHeading(t, weather.wind));
      arrow.scale.x = width;
      seen.vane = width;
      // The owl.
      const o = owlAt(ms, {
        seed,
        dayIndex,
        minuteOfDay: parts.minuteOfDay,
        nightness: slow.nightness,
        weather,
      });
      owl.visible = o.amount > 0.01;
      owl.alpha = o.amount;
      eyes.visible = owl.visible;
      eyes.alpha = o.amount;
      eyeL.scale.y = eyeR.scale.y = Math.max(0.08, 1 - o.blink);
      seen.owl = o.amount;
      // The breath of the horses and cows when it is freezing: a puff from the nose that rises, spreads and fades.
      const cold = breathAmount(weather.temperature);
      let shown = 0;
      for (const p of puffs) {
        const a = animals.find((x) => x.id === p.id);
        const progress = puffProgress(t, p.index);
        const on =
          a &&
          cold > 0.02 &&
          progress !== null &&
          a.alpha > 0.5 &&
          a.pose !== 'graze' &&
          a.pose !== 'eat';
        p.g.visible = Boolean(on);
        if (!on) continue;
        const dir = a.facing === 'right' ? 1 : -1;
        const [nx, ny] = NOSE[p.kind];
        p.g.position.set(
          a.x * DESIGN.width + dir * (nx + 6 + progress * 22) * a.scale,
          fieldY(a.depth) + (ny - progress * 20) * a.scale,
        );
        p.g.scale.set((0.5 + progress * 1.1) * a.scale);
        p.g.alpha = cold * 0.55 * Math.sin(Math.PI * Math.min(1, progress * 1.15)) * a.alpha;
        shown++;
      }
      seen.breath = shown;
    },
    debug: () => ({ ...seen }),
  };
}
