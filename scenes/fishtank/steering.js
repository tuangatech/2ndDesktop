// Steering helpers for the fish (plan Step 3). Pure functions, no drawing; every position and speed is in
// pixels of the tank, already scaled by the unit of computeLayout().
//
// They run for every fish in every frame, so the ones that return a vector take an optional `out` object to write
// it into (the fish keeps one per use), and none of them creates closures or calls Math.hypot, which allocates.
// Without `out` they return a new object, as before.

/** The distance from (0, 0) to (x, y), without the allocation of Math.hypot. */
export const hypot = (x, y) => Math.sqrt(x * x + y * y);

/** Larger fish swim slower (FR-21): 1 at the fry size (0.5), about 0.67 at the adult size (1). */
export function speedScale(size) {
  return 1 / (0.5 + size);
}

export function length(v) {
  return hypot(v.x, v.y);
}

/** The vector with its length cut to `max`. `out` may be `v` itself. */
export function limit(v, max, out = { x: 0, y: 0 }) {
  const len = length(v);
  const k = len <= max || len === 0 ? 1 : max / len;
  out.x = v.x * k;
  out.y = v.y * k;
  return out;
}

/** The point moved into the area. `out` may be `point` itself. */
export function clampToArea(point, area, out = { x: 0, y: 0 }) {
  out.x = Math.min(area.x + area.width, Math.max(area.x, point.x));
  out.y = Math.min(area.y + area.height, Math.max(area.y, point.y));
  return out;
}

const wallPush = (distance, margin) => {
  if (distance >= margin) return 0;
  const t = 1 - Math.max(0, distance) / margin;
  return t * t;
};

/**
 * A push away from the walls, the surface and the sand line: zero in the middle of the area, growing to 1
 * at an edge. Always points into the area.
 * @param {{x:number,y:number}} pos
 * @param {{x:number,y:number,width:number,height:number}} area  the swimming area
 * @param {number} margin  distance from an edge where the push starts
 */
export function wallForce(pos, area, margin, out = { x: 0, y: 0 }) {
  out.x = wallPush(pos.x - area.x, margin) - wallPush(area.x + area.width - pos.x, margin);
  out.y = wallPush(pos.y - area.y, margin) - wallPush(area.y + area.height - pos.y, margin);
  return out;
}

/** A push away from neighbours that are closer than `radius` (a little distance, FR-21). */
export function separationForce(pos, others, radius, out = { x: 0, y: 0 }) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < others.length; i++) {
    const other = others[i];
    const dx = pos.x - other.x;
    const dy = pos.y - other.y;
    const dist = hypot(dx, dy);
    if (dist >= radius) continue;
    if (dist < 1e-6) {
      x += 1; // exactly on top of each other: any direction will do
      continue;
    }
    const strength = 1 - dist / radius;
    x += (dx / dist) * strength;
    y += (dy / dist) * strength;
  }
  out.x = x;
  out.y = y;
  return out;
}

/**
 * Where to swim to meet a moving pellet: the point the pellet will be at when a fish of speed `fishSpeed`
 * can be there at the same moment. Falls back to the pellet's position if it can never be caught (FR-47).
 */
export function predictInterceptPoint(fishPos, fishSpeed, pelletPos, pelletVelocity) {
  const rx = pelletPos.x - fishPos.x;
  const ry = pelletPos.y - fishPos.y;
  const vx = pelletVelocity.x;
  const vy = pelletVelocity.y;
  const a = vx * vx + vy * vy - fishSpeed * fishSpeed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  let t = null;
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9 && -c / b > 0) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((x) => x > 0);
      if (candidates.length) t = Math.min(...candidates);
    }
  }
  if (t === null) return { x: pelletPos.x, y: pelletPos.y };
  return { x: pelletPos.x + vx * t, y: pelletPos.y + vy * t };
}

/**
 * Seconds until a fish of speed `fishSpeed` can be at the pellet, or Infinity if it never can.
 * (The same equation as predictInterceptPoint.)
 */
export function interceptTime(fishPos, fishSpeed, pelletPos, pelletVelocity) {
  const rx = pelletPos.x - fishPos.x;
  const ry = pelletPos.y - fishPos.y;
  const vx = pelletVelocity.x;
  const vy = pelletVelocity.y;
  const a = vx * vx + vy * vy - fishSpeed * fishSpeed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  if (c < 1e-9) return 0;
  if (Math.abs(a) < 1e-9) return Math.abs(b) > 1e-9 && -c / b > 0 ? -c / b : Infinity;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const root = Math.sqrt(disc);
  const times = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((t) => t > 0);
  return times.length ? Math.min(...times) : Infinity;
}

/**
 * The lowest of the candidate speeds with which a fish can eat every queued pellet before it lands, one
 * after another in the order they will land. `pellets` are {x, y, velocity:{x,y}, state}; pellets already on
 * the sand have no deadline. `margin` (0 to 1) shortens the time the pellets have, and `pause` is the time
 * spent on each meal. Returns the highest candidate if none is fast enough.
 */
export function chaseSpeedFor(mouth, speeds, pellets, restY, margin = 0.8, pause = 0.35) {
  const queue = [...pellets].sort((a, b) => b.y - a.y);
  for (const speed of speeds) {
    let pos = { x: mouth.x, y: mouth.y };
    let t = 0;
    let ok = true;
    for (const pellet of queue) {
      const vy = pellet.velocity.y;
      const now = { x: pellet.x, y: pellet.y + vy * t };
      if (pellet.state === 'resting') {
        t += hypot(now.x - pos.x, now.y - pos.y) / speed + pause;
        pos = now;
        continue;
      }
      const dt = interceptTime(pos, speed, now, pellet.velocity);
      const landsIn = (restY - now.y) / Math.max(1e-6, vy);
      if (!Number.isFinite(dt) || dt > landsIn * margin) {
        ok = false;
        break;
      }
      t += dt + pause;
      pos = { x: now.x + pellet.velocity.x * dt, y: now.y + vy * dt };
    }
    if (ok) return speed;
  }
  return speeds[speeds.length - 1];
}

/** Vertical position of a depth (0 at the top of the swimming area, 1 at the bottom). */
export function depthToY(depth, area) {
  return area.y + Math.min(1, Math.max(0, depth)) * area.height;
}

/** A new preferred depth inside the species band; drowsy fish use the lower third (FR-45). */
export function chooseDepth(rng, range, drowsy) {
  const [low, high] = drowsy ? [0.67, 0.92] : range;
  return rng.range(low, high);
}

/**
 * A new vertical target anywhere in the species depth band (the lower third for drowsy fish), far enough
 * from the current height for a visible climb or dive. Together with chooseHopX it makes diagonal swims to
 * every corner of the tank (FR-45).
 */
export function chooseHopY(rng, area, range, drowsy, currentY) {
  let y = depthToY(chooseDepth(rng, range, drowsy), area);
  for (let i = 0; i < 4 && Math.abs(y - currentY) < area.height * 0.2; i++) {
    y = depthToY(chooseDepth(rng, range, drowsy), area);
  }
  return y;
}

/** A new horizontal target that is far enough from the current position for a visible swim. */
export function chooseHopX(rng, area, currentX) {
  let x = rng.range(area.x, area.x + area.width);
  for (let i = 0; i < 4 && Math.abs(x - currentX) < area.width * 0.22; i++) {
    x = rng.range(area.x, area.x + area.width);
  }
  return x;
}
