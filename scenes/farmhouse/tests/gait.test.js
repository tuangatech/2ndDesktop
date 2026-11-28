import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RIGS, advancePhase, footAt, legEnds, legLength, poseAt, solveLeg } from '../game/gait.js';

const KINDS = Object.keys(RIGS);

describe('the rigs', () => {
  it('have four legs each, in the order of a real walk, with hip, thigh and shin that fit', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      expect(rig.legs).toHaveLength(4);
      expect(rig.legs.map((l) => l.id)).toEqual(['nearHind', 'nearFore', 'farHind', 'farFore']);
      expect(rig.legs.map((l) => l.offset)).toEqual([0, 0.25, 0.5, 0.75]);
      for (const leg of rig.legs) {
        expect(leg.bend).toBe(leg.id.endsWith('Fore') ? 1 : -1); // knees forward, hocks back
        expect(leg.layer).toBe(leg.id.startsWith('near') ? 'near' : 'far');
      }
      // a little longer than the hips are high, so that a standing leg is almost straight
      expect(legLength(rig)).toBeGreaterThan(rig.hipRest);
      expect(legLength(rig)).toBeLessThan(rig.hipRest * 1.05);
      expect(rig.thigh).toBeLessThan(rig.shin);
      expect(rig.stance).toBeGreaterThan(0.5); // always more than two feet down
    }
  });
});

describe('the two-piece leg: solveLeg', () => {
  it('puts the foot where it is asked, in reach, and bends the knee the right way', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      for (const leg of rig.legs) {
        const hip = [leg.x, -rig.hipRest];
        for (const dx of [-0.15, -0.05, 0, 0.08, 0.15].map((k) => k * rig.hipRest)) {
          for (const lift of [0, 2]) {
            const foot = [leg.x + dx, -lift];
            const joints = solveLeg(rig, leg, hip, foot);
            const back = legEnds(rig, hip, joints.thigh, joints.shin);
            expect(back.foot[0]).toBeCloseTo(foot[0], 4);
            expect(back.foot[1]).toBeCloseTo(foot[1], 4);
            expect(back.knee[0]).toBeCloseTo(joints.knee[0], 4);
            // the knee is in front of the line from hip to foot on a fore leg, behind it on a hind leg
            const line =
              (joints.knee[1] - hip[1]) * (foot[0] - hip[0]) -
              (joints.knee[0] - hip[0]) * (foot[1] - hip[1]);
            expect(Math.sign(line)).toBe(leg.bend === 1 ? -1 : 1);
            expect(joints.stretched).toBe(false);
          }
        }
      }
    }
  });

  it('stretches as far as it reaches for a target out of reach, without a NaN', () => {
    const rig = RIGS.horse;
    const leg = rig.legs[0];
    const joints = solveLeg(rig, leg, [leg.x, -rig.hipRest], [leg.x + 90, 40]);
    expect(joints.stretched).toBe(true);
    for (const v of [joints.thigh, joints.shin, ...joints.knee, ...joints.foot])
      expect(Number.isFinite(v)).toBe(true);
    expect(Math.hypot(joints.foot[0] - leg.x, joints.foot[1] + rig.hipRest)).toBeCloseTo(
      legLength(rig),
      2,
    );
  });
});

describe('the walk', () => {
  it('has the feet on the ground more than half the time, and never fewer than two', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      let min = 4;
      let sum = 0;
      for (let k = 0; k < 400; k++) {
        const down = rig.legs.filter((l) => footAt(rig, l, k / 400).onGround).length;
        min = Math.min(min, down);
        sum += down;
      }
      expect(min).toBeGreaterThanOrEqual(2);
      expect(sum / 400 / 4).toBeCloseTo(rig.stance, 1);
    }
  });

  it('takes the legs in turn: near hind, near fore, far hind, far fore, a quarter of a cycle apart', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      // The moment each foot leaves the ground, in cycles.
      const liftOff = rig.legs.map((leg) => {
        for (let k = 0; k < 1000; k++) {
          const a = footAt(rig, leg, k / 1000);
          const b = footAt(rig, leg, (k + 1) / 1000);
          if (a.onGround && !b.onGround) return (k / 1000 + leg.offset) % 1;
        }
        return null;
      });
      // They all lift off at the same point of their own cycle, a quarter of a cycle apart from each other.
      for (const t of liftOff) expect(t).toBeCloseTo(rig.stance, 1);
    }
  });

  it('keeps a foot on the ground where it was put: it does not slide as the body goes forward', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      for (const leg of rig.legs) {
        // The body goes forward by `ground`; the foot's place in the world is the body's place plus its place against the
        // body. On the ground that stays the same.
        let body = 0;
        let phase = 0.13;
        let planted = null;
        for (let step = 0; step < 2000; step++) {
          const here = footAt(rig, leg, phase);
          const world = body + here.x;
          if (here.onGround) {
            if (planted !== null) expect(Math.abs(world - planted)).toBeLessThan(0.02 * rig.stride);
            planted = world;
          } else planted = null;
          const move = 0.35; // design units, in the animal's own size
          body += move;
          phase = advancePhase(phase, move, rig);
        }
      }
    }
  });

  it('lifts a foot in the air and sets it down in front of where it left', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      const leg = rig.legs[1];
      let highest = 0;
      let before = null;
      let after = null;
      for (let k = 0; k <= 1000; k++) {
        const f = footAt(rig, leg, k / 1000);
        highest = Math.max(highest, f.lift);
        if (!f.onGround && before === null) before = footAt(rig, leg, (k - 1) / 1000).x;
        if (!f.onGround) after = f.x;
      }
      expect(highest).toBeCloseTo(rig.lift, 0);
      expect(after).toBeGreaterThan(before - 1); // it swings forward, to where the next step begins
    }
  });

  it('advances the phase with the ground covered, and wraps', () => {
    const rig = RIGS.cow;
    expect(advancePhase(0.9, rig.stride * 0.3, rig)).toBeCloseTo(0.2, 6);
    expect(advancePhase(0.1, -rig.stride * 0.3, rig)).toBeCloseTo(0.8, 6);
    expect(advancePhase(0.5, 0, rig)).toBe(0.5);
  });

  it('keeps every grounded foot on the ground, at any phase, any swing and any tilt: the animal never floats', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      for (const swing of [0, 0.4, 1]) {
        for (const tilt of [0, 0.18, 0.28]) {
          for (let k = 0; k < 80; k++) {
            const pose = poseAt(rig, { phase: k / 80, swing, tilt });
            for (const leg of pose.legs) {
              // where the foot really is: the sole of the leg's lower piece
              expect(leg.foot[1]).toBeLessThanOrEqual(0.001); // never below the ground
              if (leg.onGround) {
                expect(leg.foot[1]).toBeGreaterThan(-0.6); // and a foot that is down is on it
              }
              expect(Number.isFinite(leg.thigh) && Number.isFinite(leg.shin)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('is upright and straight-legged when it stands, and sinks a little when it walks', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      const stand = poseAt(rig, { phase: 0.3, swing: 0, tilt: 0 });
      expect(stand.drop).toBeCloseTo(0, 6);
      for (const leg of stand.legs) {
        expect(Math.abs(leg.thigh)).toBeLessThan(0.45);
        expect(leg.foot[0]).toBeCloseTo(leg.hip[0], 4); // straight under the hip
      }
      const walk = poseAt(rig, { phase: 0.3, swing: 1, tilt: 0 });
      expect(walk.drop).toBeGreaterThan(0.5);
      expect(walk.drop).toBeLessThan(rig.hipRest * 0.2);
    }
  });

  it('has no step in it: a small change of phase, swing or tilt moves every joint a little', () => {
    for (const kind of KINDS) {
      const rig = RIGS[kind];
      let worst = 0;
      let last = null;
      for (let k = 0; k <= 2000; k++) {
        const pose = poseAt(rig, { phase: k / 2000, swing: 1, tilt: 0 });
        if (last) {
          pose.legs.forEach((leg, i) => {
            worst = Math.max(
              worst,
              Math.abs(leg.thigh - last.legs[i].thigh),
              Math.abs(leg.shin - last.legs[i].shin),
            );
          });
        }
        last = pose;
      }
      expect(worst).toBeLessThan(0.08); // radians, for a 1/2000 of a cycle
    }
  });

  it('is pure: it reads no clock and imports nothing from the scene', () => {
    const source = readFileSync(fileURLToPath(new URL('../game/gait.js', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/Date\.now|new Date\(|performance\.now|Math\.random|pixi/);
    expect([...source.matchAll(/^import /gm)]).toHaveLength(0);
  });
});
