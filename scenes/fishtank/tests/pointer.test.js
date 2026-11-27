import { describe, expect, it } from 'vitest';
import {
  NO_REACTION,
  PointerTracker,
  chooseReaction,
  personalityOf,
  reactionVelocity,
} from '../view/pointer.js';
import { visual } from '../view/visualConfig.js';

const cfg = visual.pointer;
const unit = 1;

const fishAt = (x, y, personality, reaction = NO_REACTION, hasFood = false) => ({
  personality,
  pos: { x, y },
  reaction,
  hasFood,
  unit,
});
const pointerAt = (x, y, now) => {
  const p = new PointerTracker();
  p.move(x - 1, y, now - 0.1);
  p.move(x, y, now);
  return p;
};

describe('personalityOf', () => {
  it('is fixed by the seed and about 6 in 10 fish are curious', () => {
    expect(personalityOf(123)).toBe(personalityOf(123));
    let curious = 0;
    for (let seed = 1; seed <= 1000; seed++) if (personalityOf(seed) === 'curious') curious++;
    expect(curious).toBeGreaterThan(540);
    expect(curious).toBeLessThan(660);
  });
});

describe('PointerTracker', () => {
  it('measures the speed and forgets it when the pointer leaves', () => {
    const p = new PointerTracker();
    p.move(0, 0, 0);
    p.move(100, 0, 0.1);
    p.move(200, 0, 0.2);
    expect(p.speed).toBeGreaterThan(300);
    p.leave();
    expect(p.present).toBe(false);
    expect(p.speed).toBe(0);
  });
});

describe('chooseReaction', () => {
  it('ignores a pointer that is absent, far away or has not moved lately', () => {
    const absent = new PointerTracker();
    expect(chooseReaction(fishAt(0, 0, 'curious'), absent, 10, cfg).state).toBe('none');
    expect(chooseReaction(fishAt(0, 0, 'curious'), pointerAt(500, 0, 10), 10, cfg).state).toBe(
      'none',
    );
    // 3 seconds after the last move: noticed only when it moved in the last 2 seconds.
    expect(chooseReaction(fishAt(0, 0, 'curious'), pointerAt(50, 0, 10), 13, cfg).state).toBe(
      'none',
    );
  });

  it('a curious fish approaches, a shy fish flees', () => {
    const pointer = pointerAt(80, 0, 10);
    expect(chooseReaction(fishAt(0, 0, 'curious'), pointer, 10, cfg).state).toBe('approach');
    expect(chooseReaction(fishAt(0, 0, 'shy'), pointer, 10, cfg).state).toBe('flee');
  });

  it('a curious fish switches to follow near the pointer and stops about 40 units away', () => {
    const pointer = pointerAt(40, 0, 10);
    const reaction = chooseReaction(
      fishAt(0, 0, 'curious', { state: 'approach', since: 10, cooldownUntil: 0 }),
      pointer,
      10.1,
      cfg,
    );
    expect(reaction.state).toBe('follow');
    // At 40 units it hovers; farther away it swims towards the pointer.
    const base = 30;
    expect(reactionVelocity(reaction, { x: 0, y: 0 }, pointer, base, unit, cfg)).toMatchObject({
      x: 0,
      y: 0,
    });
    const far = reactionVelocity({ state: 'approach' }, { x: -80, y: 0 }, pointer, base, unit, cfg);
    expect(far.x).toBeGreaterThan(0);
    expect(Math.hypot(far.x, far.y)).toBeLessThan(base);
  });

  it('a curious fish gives up after 8 seconds', () => {
    const start = { state: 'follow', since: 10, cooldownUntil: 0 };
    const pointer = new PointerTracker();
    const keepMoving = (t) => pointer.move(30 + (t % 2), 0, t);
    for (let t = 10; t <= 18; t += 0.25) keepMoving(t);
    expect(chooseReaction(fishAt(0, 0, 'curious', start), pointer, 17.9, cfg).state).not.toBe(
      'none',
    );
    keepMoving(18.2);
    const ended = chooseReaction(fishAt(0, 0, 'curious', start), pointer, 18.2, cfg);
    expect(ended.state).toBe('none');
    expect(ended.cooldownUntil).toBeCloseTo(18.2 + 20, 6);
  });

  it('a curious fish gives up after 3 seconds of a still pointer', () => {
    const start = { state: 'follow', since: 10, cooldownUntil: 0 };
    const pointer = pointerAt(30, 0, 10);
    expect(chooseReaction(fishAt(0, 0, 'curious', start), pointer, 12.9, cfg).state).toBe('follow');
    expect(chooseReaction(fishAt(0, 0, 'curious', start), pointer, 13.1, cfg).state).toBe('none');
  });

  it('a shy fish flees from the pointer, and is calm again once it is far away', () => {
    const start = { state: 'flee', since: 10, cooldownUntil: 0 };
    const near = pointerAt(60, 0, 10.5);
    expect(chooseReaction(fishAt(0, 0, 'shy', start), near, 10.5, cfg).state).toBe('flee');
    const far = pointerAt(400, 0, 11);
    expect(chooseReaction(fishAt(0, 0, 'shy', start), far, 11, cfg).state).toBe('none');
  });

  it('flees faster from a fast pointer', () => {
    const slow = new PointerTracker();
    slow.move(0, 0, 0);
    slow.move(5, 0, 0.5);
    const fast = new PointerTracker();
    // Waved quickly to and fro to the left of the fish.
    for (let i = 0; i <= 10; i++) fast.move(i % 2 ? 60 : 0, 0, i * 0.05);
    const state = { state: 'flee' };
    const a = reactionVelocity(state, { x: 100, y: 0 }, slow, 30, unit, cfg);
    const b = reactionVelocity(state, { x: 100, y: 0 }, fast, 30, unit, cfg);
    expect(Math.hypot(b.x, b.y)).toBeGreaterThan(Math.hypot(a.x, a.y));
    expect(a.x).toBeGreaterThan(0); // away from the pointer, which is to the left of the fish
    expect(b.x).toBeGreaterThan(0);
    expect(fast.speed).toBeGreaterThan(cfg.fastSpeed * 0.5);
  });

  it('respects the cooldown of 20 seconds', () => {
    const pointer = pointerAt(60, 0, 10);
    const cooling = { state: 'none', since: 0, cooldownUntil: 25 };
    expect(chooseReaction(fishAt(0, 0, 'curious', cooling), pointer, 10, cfg).state).toBe('none');
    const later = pointerAt(60, 0, 25);
    expect(chooseReaction(fishAt(0, 0, 'curious', cooling), later, 25, cfg).state).toBe('approach');
  });

  it('never reacts while food is queued, and drops a reaction that was going on', () => {
    const pointer = pointerAt(60, 0, 10);
    expect(chooseReaction(fishAt(0, 0, 'curious', NO_REACTION, true), pointer, 10, cfg).state).toBe(
      'none',
    );
    const going = { state: 'approach', since: 9, cooldownUntil: 0 };
    expect(chooseReaction(fishAt(0, 0, 'curious', going, true), pointer, 10, cfg).state).toBe(
      'none',
    );
  });

  it('stops at once when the pointer leaves', () => {
    const pointer = pointerAt(60, 0, 10);
    const going = { state: 'approach', since: 9.5, cooldownUntil: 0 };
    pointer.leave();
    expect(chooseReaction(fishAt(0, 0, 'curious', going), pointer, 10.1, cfg).state).toBe('none');
    expect(reactionVelocity(going, { x: 0, y: 0 }, pointer, 30, unit, cfg)).toBe(null);
  });
});
