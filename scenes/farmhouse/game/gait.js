// How a four-legged animal walks (docs/scenes/farmhouse.md rule R21, DEC-65 and DEC-66). One pure module for every
// animal: a rig (the legs of a kind: where the hips are, how long the two pieces of a leg are, how long a stride is) and a
// few functions that turn the phase of the walk into the angles of the two joints of each leg. A new animal (a goat, a
// dog) is a new entry in `RIGS` and a picture of its pieces; nothing else changes.
//
// The rules of a natural walk that this module keeps:
//  - the feet do not slide: the phase is the ground covered divided by the stride (`advancePhase`), and a foot that is on
//    the ground moves back against the body by exactly as much as the body goes forward, so it stays where it was put;
//  - the four legs take turns in the order of a real walk (near hind, near fore, far hind, far fore, a quarter of a cycle
//    apart), and at least two feet are on the ground at any moment (a foot is down for more than half a cycle);
//  - a foot lifts and swings forward in an arc and comes down; each leg is two pieces (the upper leg and the lower leg)
//    that bend at a knee, which points forward on a fore leg and back on a hind leg, as on a horse or a cow;
//  - the body is lowered until every foot can reach the ground, so the animal never floats: when it walks it sinks a little
//    (the legs bend), and when its head goes down to graze its body does not lift a foot off the ground.
// Everything is a function of its arguments: the module keeps nothing from one frame to the next. Positions are in the
// animal's own space, as the pictures are: the origin is on the ground at the middle of the hooves, y goes down (so a hip
// is at a negative y), and the nose points to +x.

/**
 * @typedef {object} Leg
 * @property {string} id
 * @property {'far'|'near'} layer  which side of the body (drawn behind or in front of it)
 * @property {number} x            the hip's x
 * @property {1|-1} bend           1: the knee points forward (a fore leg); -1: it points back (a hind leg's hock)
 * @property {number} offset       where in the cycle this leg is, 0 to 1 (a walk is 0, 0.25, 0.5 and 0.75)
 * @property {number} width        the width of the upper leg
 */

/**
 * @typedef {object} Rig
 * @property {number} hipRest   the height of the hips above the ground when the animal stands
 * @property {number} stride    the ground covered in one cycle of the walk (a leg back where it began)
 * @property {number} stance    the share of the cycle a foot is on the ground (0.5 to 1)
 * @property {number} lift      how high a foot comes off the ground at the middle of its swing
 * @property {number} thigh     the length of the upper leg
 * @property {number} shin      the length of the lower leg
 * @property {number} pivot     the x that the body tips about when the head goes down
 * @property {Leg[]} legs
 */

const SPEC = {
  horse: {
    hipRest: 38,
    stride: 44,
    stance: 0.64,
    lift: 6.5,
    pivot: 5,
    width: [9, 8],
    hips: { nearHind: -25.5, nearFore: 36.5, farHind: -34, farFore: 26 },
  },
  cow: {
    hipRest: 40,
    stride: 36,
    stance: 0.66,
    lift: 5.5,
    pivot: 5,
    width: [10, 9],
    hips: { nearHind: -25, nearFore: 35, farHind: -33.5, farFore: 28.5 },
  },
  sheep: {
    hipRest: 22,
    stride: 26,
    stance: 0.66,
    lift: 3.5,
    pivot: 4,
    width: [5, 5],
    hips: { nearHind: -7.5, nearFore: 21.5, farHind: -15.5, farFore: 14.5 },
  },
};

/** The legs of a real walk: the near hind first, the near fore a quarter of a cycle later, then the far hind and far fore. */
const ORDER = { nearHind: 0, nearFore: 0.25, farHind: 0.5, farFore: 0.75 };

/** The reach of a leg is a little more than the height of the hip, so that a standing leg is almost straight. */
const REACH = 1 / 0.98;
/** How much of a leg's length is used when it is stretched to reach (the rest is slack so that the knee never locks). */
const SLACK = 0.985;

function makeRig(kind) {
  const s = SPEC[kind];
  const length = s.hipRest * REACH;
  const legs = Object.entries(s.hips).map(([id, x]) => {
    const fore = id.endsWith('Fore');
    const near = id.startsWith('near');
    return {
      id,
      layer: near ? 'near' : 'far',
      x,
      bend: fore ? 1 : -1,
      offset: ORDER[id],
      width: near ? s.width[0] : s.width[1],
    };
  });
  return Object.freeze({
    kind,
    hipRest: s.hipRest,
    stride: s.stride,
    stance: s.stance,
    lift: s.lift,
    pivot: s.pivot,
    // The upper leg is a little shorter than the lower one, as on a horse.
    thigh: length * 0.46,
    shin: length * 0.54,
    legs: Object.freeze(legs),
  });
}

/** The rigs of the kinds of animal in the scene. */
export const RIGS = Object.freeze({
  horse: makeRig('horse'),
  cow: makeRig('cow'),
  sheep: makeRig('sheep'),
});

/** The full length of a leg, from the hip to the sole of the foot. */
export const legLength = (rig) => rig.thigh + rig.shin;

const smooth = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * The phase of the walk (0 to 1, one full cycle) after the animal has covered `ground` more of the ground (in its own
 * size). The feet keep up with the body because the phase follows the ground, not the clock.
 */
export function advancePhase(phase, ground, rig) {
  const next = (phase + ground / rig.stride) % 1;
  return next < 0 ? next + 1 : next;
}

/**
 * Where a leg's foot is against its hip: `x` along the body (positive forward) and `lift` above the ground. On the ground
 * it goes back at the speed of the ground, so it stays put; in the air it swings forward, rising and falling.
 * @returns {{x: number, lift: number, onGround: boolean}}
 */
export function footAt(rig, leg, phase) {
  const u = (((phase + leg.offset) % 1) + 1) % 1;
  const reach = rig.stride * rig.stance * 0.5; // half the length of the step the foot takes on the ground
  if (u < rig.stance) {
    return { x: reach - (u / rig.stance) * 2 * reach, lift: 0, onGround: true };
  }
  const s = (u - rig.stance) / (1 - rig.stance);
  return {
    x: -reach + 2 * reach * smooth(s),
    lift: rig.lift * Math.sin(Math.PI * s),
    onGround: false,
  };
}

/**
 * The two joint angles of a leg that puts its foot at a place, as rotations for a drawing (positive turns clockwise on the
 * screen, y down, and a leg hangs straight down at 0): `thigh` turns the whole leg at the hip, `shin` turns the lower leg
 * at the knee, against the upper one. A target out of reach is taken as far as the leg will go.
 * @param {Rig} rig
 * @param {Leg} leg
 * @param {[number, number]} hip   the hip, in the animal's space
 * @param {[number, number]} foot  where the foot should be
 * @returns {{thigh: number, shin: number, knee: [number, number], foot: [number, number], stretched: boolean}}
 */
export function solveLeg(rig, leg, hip, foot) {
  const a = rig.thigh;
  const b = rig.shin;
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const wanted = Math.hypot(dx, dy);
  const d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, wanted));
  const toFoot = Math.atan2(dx, dy); // from straight down, towards +x
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const t1 = toFoot + leg.bend * A;
  const knee = [hip[0] + a * Math.sin(t1), hip[1] + a * Math.cos(t1)];
  // Where the foot really ends up (the target, or as near as the leg reaches along the same line).
  const end = [hip[0] + (dx / (wanted || 1)) * d, hip[1] + (dy / (wanted || 1)) * d];
  const t2 = Math.atan2(end[0] - knee[0], end[1] - knee[1]);
  return { thigh: -t1, shin: -t2 + t1, knee, foot: end, stretched: wanted >= a + b - 1e-3 };
}

/** Where a joint ends up from the two rotations of `solveLeg` (the reverse of it; for the tests and the sprites' check). */
export function legEnds(rig, hip, thigh, shin) {
  const t1 = -thigh;
  const t2 = -(thigh + shin);
  const knee = [hip[0] + rig.thigh * Math.sin(t1), hip[1] + rig.thigh * Math.cos(t1)];
  return { knee, foot: [knee[0] + rig.shin * Math.sin(t2), knee[1] + rig.shin * Math.cos(t2)] };
}

/**
 * Everything the picture of an animal needs for one frame: how far its body is lowered, and the hip, knee and foot and the
 * rotations of each leg.
 * @param {Rig} rig
 * @param {object} state
 * @param {number} state.phase  the walk's phase, 0 to 1
 * @param {number} state.swing  how much it walks, 0 (stands) to 1 (walks): ramp it, so that nothing steps
 * @param {number} state.tilt   how far the body tips forward (head down), in radians
 * @returns {{drop: number, bob: number, tilt: number, legs: {id: string, layer: string, hip: [number, number],
 *   knee: [number, number], foot: [number, number], thigh: number, shin: number, onGround: boolean}[]}}
 */
export function poseAt(rig, { phase, swing, tilt }) {
  const length = legLength(rig) * SLACK;
  const px = rig.pivot;
  const py = -rig.hipRest;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  // The hips where the tipped body puts them (the body turns about the pivot).
  const hips = rig.legs.map((leg) => {
    const rx = leg.x - px;
    return [px + rx * cos, py + rx * sin];
  });
  // Lower the body until every foot can reach the ground from its hip, a step ahead and a step behind.
  const half = rig.stride * rig.stance * 0.5 * swing;
  const reachY = Math.sqrt(Math.max(0, length * length - half * half));
  let drop = 0;
  for (const hip of hips) drop = Math.max(drop, -hip[1] - reachY);
  // A little rise and fall twice in a cycle: the body is highest when the legs pass under it.
  const bob = swing * rig.lift * 0.12 * (Math.cos(4 * Math.PI * phase) - 1) * 0.5;
  const legs = rig.legs.map((leg, i) => {
    const hip = [hips[i][0], hips[i][1] + drop + bob];
    const step = footAt(rig, leg, phase);
    const foot = [hip[0] + step.x * swing, -step.lift * swing];
    const joints = solveLeg(rig, leg, hip, foot);
    return {
      id: leg.id,
      layer: leg.layer,
      hip,
      knee: joints.knee,
      foot: joints.foot,
      thigh: joints.thigh,
      shin: joints.shin,
      onGround: step.onGround,
    };
  });
  return { drop: drop + bob, bob, tilt, legs };
}
