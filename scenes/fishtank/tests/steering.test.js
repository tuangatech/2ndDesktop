import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../shared/rng.js';
import {
  chooseDepth,
  chooseHopX,
  chooseHopY,
  chaseSpeedFor,
  clampToArea,
  depthToY,
  interceptTime,
  limit,
  predictInterceptPoint,
  separationForce,
  speedScale,
  wallForce,
} from '../view/steering.js';

const area = { x: 10, y: 20, width: 400, height: 200 };

describe('predictInterceptPoint', () => {
  it('is the pellet position for a pellet that does not move', () => {
    const p = predictInterceptPoint({ x: 0, y: 0 }, 30, { x: 100, y: 50 }, { x: 0, y: 0 });
    expect(p).toEqual({ x: 100, y: 50 });
  });

  it('leads a sinking pellet', () => {
    // Fish at the origin with speed 10, pellet 10 to the right sinking at 5: t = sqrt(100 / 75).
    const p = predictInterceptPoint({ x: 0, y: 0 }, 10, { x: 10, y: 0 }, { x: 0, y: 5 });
    const t = Math.sqrt(100 / 75);
    expect(p.x).toBeCloseTo(10, 6);
    expect(p.y).toBeCloseTo(5 * t, 6);
    // The fish reaches that point in the same time as the pellet.
    expect(Math.hypot(p.x, p.y) / 10).toBeCloseTo(t, 6);
  });

  it('falls back to the pellet position when it can never be caught', () => {
    const p = predictInterceptPoint({ x: 0, y: 0 }, 10, { x: 0, y: 100 }, { x: 50, y: 0 });
    expect(p).toEqual({ x: 0, y: 100 });
  });

  it('handles equal speeds: meets a pellet coming towards the fish, gives up on one moving away', () => {
    // Same speed, pellet coming straight at the fish: they meet halfway after 1 second.
    expect(predictInterceptPoint({ x: 0, y: 0 }, 10, { x: 20, y: 0 }, { x: -10, y: 0 })).toEqual({
      x: 10,
      y: 0,
    });
    expect(interceptTime({ x: 0, y: 0 }, 10, { x: 20, y: 0 }, { x: -10, y: 0 })).toBe(1);
    // Same speed, pellet moving away at a right angle: never caught, so the fish heads for where it is now.
    expect(predictInterceptPoint({ x: 0, y: 0 }, 10, { x: 10, y: 0 }, { x: 0, y: 10 })).toEqual({
      x: 10,
      y: 0,
    });
    expect(interceptTime({ x: 0, y: 0 }, 10, { x: 10, y: 0 }, { x: 0, y: 10 })).toBe(Infinity);
  });
});

describe('wallForce', () => {
  it('is zero in the middle and points inward near each edge', () => {
    const mid = wallForce({ x: 200, y: 120 }, area, 40);
    expect(mid).toEqual({ x: 0, y: 0 });
    expect(wallForce({ x: 12, y: 120 }, area, 40).x).toBeGreaterThan(0);
    expect(wallForce({ x: 408, y: 120 }, area, 40).x).toBeLessThan(0);
    expect(wallForce({ x: 200, y: 22 }, area, 40).y).toBeGreaterThan(0);
    expect(wallForce({ x: 200, y: 218 }, area, 40).y).toBeLessThan(0);
  });
});

describe('targets stay inside the area', () => {
  it('clampToArea never leaves the area', () => {
    for (const point of [
      { x: -500, y: -500 },
      { x: 9999, y: 9999 },
      { x: 100, y: 100 },
    ]) {
      const c = clampToArea(point, area);
      expect(c.x).toBeGreaterThanOrEqual(area.x);
      expect(c.x).toBeLessThanOrEqual(area.x + area.width);
      expect(c.y).toBeGreaterThanOrEqual(area.y);
      expect(c.y).toBeLessThanOrEqual(area.y + area.height);
    }
  });

  it('hop and depth choices stay inside the band', () => {
    const rng = makeRng(5);
    for (let i = 0; i < 500; i++) {
      const x = chooseHopX(rng, area, rng.range(area.x, area.x + area.width));
      expect(x).toBeGreaterThanOrEqual(area.x);
      expect(x).toBeLessThanOrEqual(area.x + area.width);
      const depth = chooseDepth(rng, [0.12, 0.82], false);
      expect(depth).toBeGreaterThanOrEqual(0.12);
      expect(depth).toBeLessThan(0.82);
      const drowsy = chooseDepth(rng, [0.12, 0.82], true);
      expect(drowsy).toBeGreaterThanOrEqual(0.67);
      expect(drowsy).toBeLessThan(0.92);
    }
    expect(depthToY(0, area)).toBe(20);
    expect(depthToY(1, area)).toBe(220);
  });
});

describe('chooseHopY', () => {
  it('stays in the band and makes a visible climb or dive', () => {
    const rng = makeRng(11);
    let up = 0;
    let down = 0;
    for (let i = 0; i < 500; i++) {
      const currentY = rng.range(area.y + 20, area.y + area.height - 20);
      const y = chooseHopY(rng, area, [0.12, 0.82], false, currentY);
      expect(y).toBeGreaterThanOrEqual(area.y + 0.12 * area.height);
      expect(y).toBeLessThan(area.y + 0.82 * area.height);
      if (y < currentY) up++;
      else down++;
    }
    // Targets are above and below the current height, not near one preferred depth.
    expect(up).toBeGreaterThan(100);
    expect(down).toBeGreaterThan(100);
  });

  it('keeps drowsy fish in the lower third', () => {
    const rng = makeRng(12);
    for (let i = 0; i < 200; i++) {
      const y = chooseHopY(rng, area, [0.12, 0.82], true, area.y + 20);
      expect(y).toBeGreaterThanOrEqual(area.y + 0.67 * area.height);
    }
  });
});

describe('small helpers', () => {
  it('larger fish are slower', () => {
    expect(speedScale(0.5)).toBe(1);
    expect(speedScale(1)).toBeCloseTo(0.667, 3);
  });

  it('limit cuts a vector to a length', () => {
    const v = limit({ x: 30, y: 40 }, 10);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10, 9);
    expect(limit({ x: 1, y: 1 }, 10)).toEqual({ x: 1, y: 1 });
  });

  it('separation pushes away from a close neighbour and ignores a far one', () => {
    expect(separationForce({ x: 0, y: 0 }, [{ x: 5, y: 0 }], 20).x).toBeLessThan(0);
    expect(separationForce({ x: 0, y: 0 }, [{ x: 50, y: 0 }], 20)).toEqual({ x: 0, y: 0 });
  });
});

describe('interceptTime', () => {
  it('matches the intercept point', () => {
    expect(interceptTime({ x: 0, y: 0 }, 10, { x: 10, y: 0 }, { x: 0, y: 5 })).toBeCloseTo(
      Math.sqrt(100 / 75),
      6,
    );
    expect(interceptTime({ x: 0, y: 0 }, 10, { x: 0, y: 100 }, { x: 50, y: 0 })).toBe(Infinity);
    expect(interceptTime({ x: 5, y: 5 }, 10, { x: 5, y: 5 }, { x: 0, y: 5 })).toBe(0);
  });
});

describe('chaseSpeedFor', () => {
  const restY = 300;
  const sinking = (x, y) => ({ x, y, velocity: { x: 0, y: 50 }, state: 'sinking' });
  const speeds = [30, 50, 80, 120];

  it('uses the lowest speed when the pellet is easy to reach', () => {
    expect(chaseSpeedFor({ x: 100, y: 100 }, speeds, [sinking(110, 20)], restY)).toBe(30);
  });

  it('uses a higher speed when the pellet is far away', () => {
    const speed = chaseSpeedFor({ x: 0, y: 100 }, speeds, [sinking(350, 20)], restY);
    expect(speed).toBeGreaterThan(30);
  });

  it('plans for a second pellet as well', () => {
    const one = chaseSpeedFor({ x: 50, y: 100 }, speeds, [sinking(120, 20)], restY);
    const two = chaseSpeedFor(
      { x: 50, y: 100 },
      speeds,
      [sinking(120, 20), sinking(330, 15)],
      restY,
    );
    expect(two).toBeGreaterThan(one);
  });

  it('returns the highest speed when nothing is fast enough', () => {
    expect(chaseSpeedFor({ x: 0, y: 100 }, speeds, [sinking(2000, 20)], restY)).toBe(120);
  });

  it('gives pellets on the sand no deadline', () => {
    const resting = { x: 200, y: restY, velocity: { x: 0, y: 0 }, state: 'resting' };
    expect(chaseSpeedFor({ x: 0, y: 100 }, speeds, [resting], restY)).toBe(30);
  });
});

// The fish call these for every fish in every frame, writing into objects they keep (no garbage per frame).
describe('vector results written into a given object', () => {
  const area = { x: 0, y: 0, width: 100, height: 50 };

  it('return the given object with the same values as a new one', () => {
    const cases = [
      [(out) => limit({ x: 30, y: 40 }, 10, out), { x: 6, y: 8 }],
      [(out) => clampToArea({ x: 120, y: -5 }, area, out), { x: 100, y: 0 }],
      [(out) => wallForce({ x: 2, y: 25 }, area, 10, out), wallForce({ x: 2, y: 25 }, area, 10)],
      [
        (out) => separationForce({ x: 0, y: 0 }, [{ x: 3, y: 4 }], 10, out),
        separationForce({ x: 0, y: 0 }, [{ x: 3, y: 4 }], 10),
      ],
    ];
    for (const [call, expected] of cases) {
      const out = { x: 99, y: 99 };
      expect(call(out)).toBe(out);
      expect(out.x).toBeCloseTo(expected.x, 10);
      expect(out.y).toBeCloseTo(expected.y, 10);
    }
  });

  it('can write the result over the input', () => {
    const v = { x: 30, y: 40 };
    expect(limit(v, 10, v)).toEqual({ x: 6, y: 8 });
    const p = { x: -3, y: 70 };
    expect(clampToArea(p, area, p)).toEqual({ x: 0, y: 50 });
  });

  it('still return a new object when none is given', () => {
    const v = { x: 1, y: 1 };
    expect(limit(v, 10)).not.toBe(v);
    expect(limit(v, 10)).toEqual(v);
  });
});
