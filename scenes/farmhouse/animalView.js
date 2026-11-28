// One animal on the screen: a shadow, the legs of the far side, the body, the legs of the near side (DEC-65, DEC-66). The
// same view serves every kind: the numbers of the walk come from the animal's rig (game/gait.js) and the pictures from
// art/animals.js; this file only puts them where the gait says and keeps the little that has to be remembered from one
// frame to the next (the phase of the walk follows the ground covered, and how much it walks and how far the head is down
// ease in and out).
import { Container, Graphics, Sprite } from 'pixi.js';
import { RIGS, advancePhase, poseAt } from './game/gait.js';

/** How far the body tips forward for each pose (the head goes down to graze and to eat hay). */
const TILT = { stand: 0, walk: 0, graze: 0.18, eat: 0.28 };
/** The size of the shadow under each kind: half its width. */
const SHADOW = { horse: 52, cow: 58, sheep: 32 };
/** An animal that is moved by something other than its own walk (pushed aside) still moves its legs above this pace. */
const MOVING = 9;

const place = (sprite, picture) => {
  sprite.position.set(picture.x, picture.y);
  sprite.width = picture.width;
  sprite.height = picture.height;
  return sprite;
};

/**
 * @param {object} options
 * @param {{id: string, kind: string}} options.spec
 * @param {Container} options.parent  the layer the animal stands in
 * @param {{texture: object, picture: object}} options.body
 * @param {{far: {thigh: {texture: object, picture: object}, shin: {texture: object, picture: object}}, near: object}} options.legs
 * @param {number} options.phase  where in the walk it begins (so that the animals are not in step)
 */
export function createAnimalView({ spec, parent, body, legs, phase }) {
  const rig = RIGS[spec.kind];
  const box = new Container(); // placed, mirrored and scaled by the scene
  const shadow = new Graphics()
    .ellipse(0, 0, SHADOW[spec.kind] * 1.12, 8)
    .fill({ color: 0x1b2610, alpha: 0.12 })
    .ellipse(0, 0, SHADOW[spec.kind], 5.5)
    .fill({ color: 0x1b2610, alpha: 0.2 });
  shadow.position.set(rig.pivot, 1);
  box.addChild(shadow);

  const torso = new Container();
  torso.pivot.set(rig.pivot, -rig.hipRest);
  torso.addChild(place(new Sprite(body.texture), body.picture));

  const pieces = rig.legs.map((leg) => {
    const set = legs[leg.layer];
    const upper = new Container();
    const lower = new Container();
    upper.addChild(place(new Sprite(set.thigh.texture), set.thigh.picture));
    lower.addChild(place(new Sprite(set.shin.texture), set.shin.picture));
    lower.position.set(0, rig.thigh);
    upper.addChild(lower);
    return { leg, upper, lower };
  });
  for (const p of pieces) if (p.leg.layer === 'far') box.addChild(p.upper);
  box.addChild(torso);
  for (const p of pieces) if (p.leg.layer === 'near') box.addChild(p.upper);
  parent.addChild(box);

  const state = { phase: phase % 1, swing: 0, tilt: 0, last: null, drop: 0 };
  return {
    box,
    /**
     * @param {{pose: string, scale: number}} animal
     * @param {number} x  where its hooves are, in the scene's units
     * @param {number} y
     * @param {number} dt  seconds since the last frame
     */
    update(animal, x, y, dt) {
      state.tilt += ((TILT[animal.pose] ?? 0) - state.tilt) * Math.min(1, dt * 5);
      // The legs: the phase follows the ground covered, in the animal's own size, so the feet keep up with the body and do
      // not slide; the walk is asked for by the pose and by any other movement (being pushed aside).
      let walking = animal.pose === 'walk';
      if (state.last) {
        const ground = Math.hypot(x - state.last[0], y - state.last[1]) / animal.scale;
        state.phase = advancePhase(state.phase, ground, rig);
        if (dt > 0 && ground / dt > MOVING) walking = true;
      }
      state.last = [x, y];
      state.swing += ((walking ? 1 : 0) - state.swing) * Math.min(1, dt * 6);
      const pose = poseAt(rig, { phase: state.phase, swing: state.swing, tilt: state.tilt });
      state.drop = pose.drop;
      torso.position.set(rig.pivot, -rig.hipRest + pose.drop);
      torso.rotation = pose.tilt;
      pieces.forEach((p, i) => {
        const joint = pose.legs[i];
        p.upper.position.set(joint.hip[0], joint.hip[1]);
        p.upper.rotation = joint.thigh;
        p.lower.rotation = joint.shin;
      });
    },
    /** What the tests and the debug page can look at. */
    debug: () => ({ phase: state.phase, swing: state.swing, tilt: state.tilt, drop: state.drop }),
  };
}
