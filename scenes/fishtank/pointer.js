// Fish react to the mouse pointer (FR-49, D26, tech design 3.3). The decisions are pure functions so they can be
// unit-tested; Fish.js only applies them. A reaction changes movement and never calls the repository.
//
// Times are in seconds of scene time, distances in pixels of the tank; `unit` is height / 320 (layout.js).
import { makeRng } from '../../shared/rng.js';

/** @typedef {'none'|'approach'|'follow'|'flee'} ReactionState */
/** @typedef {{state: ReactionState, since: number, cooldownUntil: number}} Reaction */

/** Like Math.hypot for two numbers, without its allocation (this runs for every fish in every frame). */
const hypot = (x, y) => Math.sqrt(x * x + y * y);

const setVelocity = (out, x, y, maxSpeed) => {
  out.x = x;
  out.y = y;
  out.maxSpeed = maxSpeed;
  return out;
};

export const NO_REACTION = Object.freeze({ state: 'none', since: 0, cooldownUntil: 0 });

/** About 6 in 10 fish are curious, the rest shy. Derived from the seed, so nothing is saved (FR-49). */
export function personalityOf(seed, curiousShare = 0.6) {
  return makeRng((seed ^ 0x9e3779b1) >>> 0).next() < curiousShare ? 'curious' : 'shy';
}

/** Where the pointer is, how fast it moves and when it last moved. */
export class PointerTracker {
  constructor() {
    this.present = false;
    this.x = 0;
    this.y = 0;
    this.speed = 0; // pixels per second, smoothed
    this.lastMove = -Infinity;
    this._lastTime = 0;
  }

  /** The pointer is at (x, y) at scene time `now`. */
  move(x, y, now) {
    if (this.present) {
      const dt = now - this._lastTime;
      if (dt > 0) {
        const instant = hypot(x - this.x, y - this.y) / dt;
        this.speed += (instant - this.speed) * Math.min(1, dt * 8);
      }
    } else {
      this.speed = 0;
    }
    this.present = true;
    this.x = x;
    this.y = y;
    this.lastMove = now;
    this._lastTime = now;
  }

  /** The pointer left the tank, the window lost focus or the tank paused. */
  leave() {
    this.present = false;
    this.speed = 0;
  }
}

/**
 * The next reaction of one fish.
 * @param {{personality: 'curious'|'shy', pos: {x: number, y: number}, reaction: Reaction,
 *          hasFood: boolean, unit: number}} fish
 * @param {PointerTracker} pointer
 * @param {number} now
 * @param {typeof import('./visualConfig.js').visual.pointer} cfg
 * @returns {Reaction}
 */
const endReaction = (now, cfg) => ({
  state: 'none',
  since: now,
  cooldownUntil: now + cfg.cooldownSeconds,
});

export function chooseReaction(fish, pointer, now, cfg) {
  const { reaction, unit } = fish;

  // A fish that is going to eat ignores the pointer. If it was reacting, the reaction just stops.
  if (fish.hasFood) return reaction.state === 'none' ? reaction : endReaction(now, cfg);

  const distance = pointer.present
    ? hypot(pointer.x - fish.pos.x, pointer.y - fish.pos.y)
    : Infinity;
  const noticeRange = cfg.noticeDistance * unit;
  const sinceMove = now - pointer.lastMove;

  if (reaction.state === 'none') {
    if (!pointer.present || now < reaction.cooldownUntil) return reaction;
    if (distance >= noticeRange || sinceMove > cfg.movedRecentlySeconds) return reaction;
    return {
      state: fish.personality === 'curious' ? 'approach' : 'flee',
      since: now,
      cooldownUntil: reaction.cooldownUntil,
    };
  }

  if (!pointer.present || now - reaction.since > cfg.giveUpSeconds) return endReaction(now, cfg);

  if (reaction.state === 'flee') {
    // A shy fish calms down once it is well away from the pointer, or when the pointer is still.
    if (distance > noticeRange * cfg.fleeClearDistance || sinceMove > cfg.stillSeconds)
      return endReaction(now, cfg);
    return reaction;
  }

  // approach or follow: a curious fish loses interest when the pointer has been still for a while.
  if (sinceMove > cfg.stillSeconds) return endReaction(now, cfg);
  const state = distance <= cfg.followDistance * unit * 1.25 ? 'follow' : 'approach';
  return state === reaction.state ? reaction : { ...reaction, state };
}

/**
 * The velocity a reacting fish wants, or null when it is not reacting. A curious fish swims gently towards the
 * pointer and hovers about 40 units away; a shy fish swims away, faster when the pointer is fast.
 * @returns {{x: number, y: number, maxSpeed: number}|null}
 */
export function reactionVelocity(
  reaction,
  pos,
  pointer,
  baseSpeed,
  unit,
  cfg,
  out = { x: 0, y: 0, maxSpeed: 0 },
) {
  if (reaction.state === 'none' || !pointer.present) return null;
  const dx = pointer.x - pos.x;
  const dy = pointer.y - pos.y;
  const distance = hypot(dx, dy) || 1;
  if (reaction.state === 'flee') {
    const fast = Math.min(1, pointer.speed / (cfg.fastSpeed * unit));
    const speed = baseSpeed * (cfg.fleeSpeed + (cfg.fleeFastBoost - cfg.fleeSpeed) * fast);
    return setVelocity(out, (-dx / distance) * speed, (-dy / distance) * speed, speed);
  }
  const stop = cfg.followDistance * unit;
  if (distance <= stop) return setVelocity(out, 0, 0, baseSpeed);
  const speed = baseSpeed * cfg.seekSpeed * Math.min(1, 0.3 + (distance - stop) / (40 * unit));
  return setVelocity(out, (dx / distance) * speed, (dy / distance) * speed, baseSpeed);
}
