// One fish (plan Step 3; FR-11 to FR-14, FR-21, FR-42, FR-45 to FR-47).
// Three MeshRope layers (tail and fins, body, accent stripe) share one array of points, so each can take its
// own tint. A sine wave runs along the points from head to tail; the whole fish pitches towards its direction.
import { Container, MeshRope, Point } from 'pixi.js';
import { makeRng } from '../../../shared/rng.js';
import { sizeOf, stageOf } from '../game/rules.js';
import { mixColor, paletteFor } from './palette.js';
import { NO_REACTION, chooseReaction, personalityOf, reactionVelocity } from './pointer.js';
import {
  chooseDepth,
  chaseSpeedFor,
  chooseHopX,
  chooseHopY,
  clampToArea,
  depthToY,
  hypot,
  length,
  limit,
  predictInterceptPoint,
  separationForce,
  speedScale,
  wallForce,
} from './steering.js';
import { ART_SCALE } from './textures.js';
import { visual } from './visualConfig.js';

const cfg = visual.fish;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);

export class Fish {
  /**
   * @param {{record: {id:string, seed:number, name:string|null, growthPoints:number}, species: object,
   *          textures: Record<string, import('pixi.js').Texture>, bubbles: import('./Bubbles.js').BubbleSystem,
   *          layout: object, fadeIn?: boolean}} options
   */
  constructor({ record, species, textures, bubbles, layout, fadeIn = false }) {
    this.id = record.id;
    this.species = species;
    this.seed = record.seed;
    this.name = record.name ?? null;
    this.personality = personalityOf(record.seed, visual.pointer.curiousShare);
    this.reaction = NO_REACTION;
    this.fade = fadeIn ? 0 : 1;
    this.bubbles = bubbles;
    this.layout = layout;
    this.rng = makeRng(record.seed);
    this.points = record.growthPoints;
    this.stage = stageOf(record.growthPoints);
    this.size = sizeOf(record.growthPoints);
    this.drowsy = false;
    this.time = 0;
    this.phase = this.rng.range(0, Math.PI * 2);
    this.foodQueue = [];
    this.wiggleTimer = 0;
    this.pulse = 0;

    // Colors: the displayed tints blend from `from` to `to` after a stage change.
    this.to = paletteFor(species, this.stage, this.seed);
    this.from = this.to;
    this.blend = 1;

    // The rope: points from the tail (first) to the head (last), centred on the origin, in texture pixels.
    this.ropeLength = species.artLength * ART_SCALE;
    this.ropePoints = Array.from({ length: species.ropePoints }, () => new Point(0, 0));
    const make = (frame) => new MeshRope({ texture: textures[frame], points: this.ropePoints });
    this.layers = {
      tail: make(species.frames.tail),
      body: make(species.frames.body),
      accent: make(species.frames.accent),
    };
    this.flip = new Container();
    this.flip.addChild(this.layers.tail, this.layers.body, this.layers.accent);
    this.container = new Container();
    this.container.addChild(this.flip);
    this.container.eventMode = 'none';
    this.container.alpha = this.fade;
    this.applyTints(this.to);
    this.layoutWave(0, 1);

    // Movement state.
    const swim = layout.swim;
    this.pos = {
      x: swim.x + swim.width * this.rng.range(0.2, 0.8),
      y: depthToY(chooseDepth(this.rng, species.depthRange, false), swim),
    };
    this.vel = { x: 0, y: 0 };
    this.faceSign = this.rng.next() < 0.5 ? -1 : 1;
    this.faceScale = this.faceSign;
    this.pitch = 0;
    this.hop = { x: this.pos.x, y: this.pos.y };
    this.hopTimer = 0;
    // Objects that update() writes into instead of making new ones every frame (it runs for every fish 30 to
    // 60 times a second, and the garbage made the renderer's memory climb until a collection).
    this.scratch = {
      desired: { x: 0, y: 0 },
      walls: { x: 0, y: 0 },
      apart: { x: 0, y: 0 },
      reacting: { x: 0, y: 0, maxSpeed: 0 },
      mouth: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      virtualMouth: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      chaseArea: { x: 0, y: 0, width: 0, height: 0 },
      steps: [0, 0, 0, 0],
      others: [],
      reactionInput: {
        personality: this.personality,
        pos: this.pos,
        reaction: NO_REACTION,
        hasFood: false,
        unit: 1,
      },
    };
    this.applyTransform();
  }

  get adultLengthPx() {
    return this.species.adultLengthPx * this.layout.unit;
  }

  /** The tints on screen now: the old palette blending into the new one. */
  currentTints() {
    const t = smooth(this.blend);
    return {
      body: mixColor(this.from.body, this.to.body, t),
      fin: mixColor(this.from.fin, this.to.fin, t),
      accent: mixColor(this.from.accent, this.to.accent, t),
    };
  }

  applyTints(tints) {
    this.layers.body.tint = tints.body;
    this.layers.tail.tint = tints.fin;
    this.layers.accent.tint = tints.accent;
  }

  /** Points changed. A stage change blends the palette over 2 seconds and plays the bubbles when `animate`. */
  setPoints(points, animate = true) {
    this.points = points;
    const stage = stageOf(points);
    if (stage === this.stage) return;
    this.from = this.currentTints();
    this.stage = stage;
    this.to = paletteFor(this.species, stage, this.seed);
    if (animate) {
      this.blend = 0;
      this.playStageEffect();
    } else {
      this.blend = 1;
      this.from = this.to;
      this.applyTints(this.to);
    }
  }

  /** Bubbles and a small swell when the fish reaches a new stage (FR-14). */
  playStageEffect() {
    const u = this.layout.unit;
    const len = this.adultLengthPx * this.size;
    for (let i = 0; i < 8; i++) {
      this.bubbles.emit(
        this.pos.x + this.rng.range(-0.5, 0.5) * len,
        this.pos.y + this.rng.range(-0.3, 0.3) * len,
        u * this.rng.range(2.5, 5.5),
      );
    }
    this.pulse = 1;
    this.wiggleTimer = cfg.wiggleSeconds;
  }

  setDrowsy(drowsy) {
    if (this.drowsy === drowsy) return;
    this.drowsy = drowsy;
    this.hopTimer = 0; // choose a new target at once, in the right depth band
  }

  /** Puts the fish at a spot (a freshly hatched fish starts where its egg was), kept inside the swimming area. */
  placeAt(x, y) {
    const placed = clampToArea({ x, y }, this.layout.swim);
    this.pos.x = placed.x;
    this.pos.y = placed.y;
    this.hop = { x: placed.x, y: placed.y };
    this.hopTimer = 0;
    this.applyTransform();
  }

  /** A click on the fish (window mode): a short wiggle (FR-48). It changes no game numbers. */
  poke() {
    this.wiggleTimer = Math.max(this.wiggleTimer, visual.touch.pokeSeconds);
  }

  /** True when (x, y) is on the fish: an ellipse around the body, a little generous so it is easy to hit. */
  hitTest(x, y) {
    const len = this.adultLengthPx * this.size;
    const margin = 3 * this.layout.unit;
    const cos = Math.cos(-this.pitch);
    const sin = Math.sin(-this.pitch);
    const dx = x - this.pos.x;
    const dy = y - this.pos.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const a = len * 0.5 + margin;
    const b = len * 0.3 + margin;
    return (lx * lx) / (a * a) + (ly * ly) / (b * b) <= 1;
  }

  /** The layout changed (a resize): keep the fish at the same place in the tank. */
  rescale(previous, layout) {
    const sx = layout.width / previous.width;
    const sy = layout.height / previous.height;
    const su = layout.unit / previous.unit;
    this.layout = layout;
    this.pos.x *= sx;
    this.pos.y *= sy;
    this.hop.x *= sx;
    this.hop.y *= sy;
    this.vel.x *= su;
    this.vel.y *= su;
  }

  /** Where the mouth is, relative to the middle of the fish, in pixels of the tank. */
  mouthOffset(out = { x: 0, y: 0 }) {
    const len = this.adultLengthPx * this.size;
    const lx = this.faceScale * this.species.mouth.x * len;
    const ly = this.species.mouth.y * len;
    const cos = Math.cos(this.container.rotation);
    const sin = Math.sin(this.container.rotation);
    out.x = lx * cos - ly * sin;
    out.y = lx * sin + ly * cos;
    return out;
  }

  currentFood() {
    // Drop eaten pellets in place, and pick the one nearest to the sand: pellets are eaten one after another.
    const queue = this.foodQueue;
    let kept = 0;
    let best = null;
    for (let i = 0; i < queue.length; i++) {
      const pellet = queue[i];
      if (pellet.state === 'eaten') continue;
      queue[kept++] = pellet;
      if (!best || pellet.y > best.y) best = pellet;
    }
    queue.length = kept;
    return best;
  }

  /**
   * @param {number} dt  seconds
   * @param {{layout: object, others: Array<{pos:{x:number,y:number}}>, eat: (fish: Fish, pellet: object) => void,
   *          pointer?: import('./pointer.js').PointerTracker, time?: number}} env
   */
  update(dt, env) {
    const { layout } = env;
    this.layout = layout;
    const u = layout.unit;
    const swim = layout.swim;
    this.time += dt;

    // Size follows the points smoothly (FR-12); the palette blends after a stage change (FR-13).
    this.size += (sizeOf(this.points) - this.size) * Math.min(1, dt * cfg.sizeSmoothing);
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / cfg.fadeInSeconds);
      this.container.alpha = this.fade;
    }
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / cfg.stageBlendSeconds);
      this.applyTints(this.currentTints());
    }

    const baseSpeed =
      this.species.baseSpeed * u * speedScale(this.size) * (this.drowsy ? cfg.drowsySpeed : 1);
    const s = this.scratch;
    let desired = null;
    let maxSpeed = baseSpeed;
    let area = swim;
    const food = this.currentFood();
    // The pointer: a curious fish comes over, a shy one swims off (FR-49). Eating always comes first.
    if (env.pointer) {
      const input = s.reactionInput;
      input.pos = this.pos;
      input.reaction = this.reaction;
      input.hasFood = Boolean(food);
      input.unit = u;
      this.reaction = chooseReaction(input, env.pointer, env.time ?? this.time, visual.pointer);
    }

    if (food) {
      // Chase: head for where the pellet will be, a little faster than usual, and eat it near the mouth.
      const mouth = this.mouthOffset(s.mouth);
      mouth.x += this.pos.x;
      mouth.y += this.pos.y;
      const reach = (cfg.eatRadius + 4 * this.size) * u;
      const distance = hypot(food.x - mouth.x, food.y - mouth.y);
      if (distance <= reach) {
        // A copy: the bubbles of the meal keep this point after the scratch object is reused.
        this.eat(food, { x: mouth.x, y: mouth.y }, env);
      } else {
        // Face the pellet at once (the flip itself still eases), and aim with the mouth on the side it will
        // have on arrival, so the aim does not jump while the fish is turning.
        const side =
          Math.abs(food.x - this.pos.x) > 4 * u ? Math.sign(food.x - this.pos.x) : this.faceSign;
        this.faceSign = side;
        const len = this.adultLengthPx * this.size;
        const offset = s.offset;
        offset.x = side * this.species.mouth.x * len;
        offset.y = this.species.mouth.y * len;
        const virtualMouth = s.virtualMouth;
        virtualMouth.x = this.pos.x + offset.x;
        virtualMouth.y = this.pos.y + offset.y;
        // The lowest speed that still gets every queued pellet before it lands (a little faster than usual, FR-47).
        const steps = s.steps;
        steps[0] = baseSpeed * cfg.chaseSpeed;
        steps[1] = baseSpeed * 1.9;
        steps[2] = baseSpeed * 2.5;
        steps[3] = baseSpeed * cfg.chaseSpeedMax;
        const speed = chaseSpeedFor(virtualMouth, steps, this.foodQueue, env.restY, 0.8);
        maxSpeed = speed;
        const aim = predictInterceptPoint(virtualMouth, speed, food, food.velocity);
        // The mouth, not the middle of the fish, has to arrive; and the fish stays above the sand.
        const chaseArea = s.chaseArea;
        chaseArea.x = swim.x;
        chaseArea.y = swim.y;
        chaseArea.width = swim.width;
        chaseArea.height = env.restY - 3 * u - swim.y;
        const target = s.target;
        target.x = aim.x - offset.x;
        target.y = aim.y - offset.y;
        clampToArea(target, chaseArea, target);
        const dx = target.x - this.pos.x;
        const dy = target.y - this.pos.y;
        const dist = hypot(dx, dy) || 1;
        const arrive = Math.min(1, 0.35 + dist / (24 * u));
        desired = s.desired;
        desired.x = (dx / dist) * speed * arrive;
        desired.y = (dy / dist) * speed * arrive;
        // Keep a little apart from the others on the way, so a crowd of hungry fish does not swim as one heap;
        // the push fades out close to the pellet, so it never stops a fish from eating.
        const nearFood = Math.min(1, distance / (cfg.chaseSeparationFade * u));
        const apart = separationForce(
          this.pos,
          this.othersPos(env.others),
          cfg.separationRadius * u * (0.6 + this.size * 0.6),
          s.apart,
        );
        desired.x += apart.x * cfg.chaseSeparation * baseSpeed * nearFood;
        desired.y += apart.y * cfg.chaseSeparation * baseSpeed * nearFood;
        limit(desired, speed, desired);
        area = chaseArea;
      }
    }

    if (!desired) {
      const reacting = env.pointer
        ? reactionVelocity(
            this.reaction,
            this.pos,
            env.pointer,
            baseSpeed,
            u,
            visual.pointer,
            s.reacting,
          )
        : null;
      desired = s.desired;
      if (reacting) {
        desired.x = reacting.x;
        desired.y = reacting.y;
        maxSpeed = reacting.maxSpeed;
      } else {
        // Wander: swim to a random point of the tank that changes every few seconds, so the paths run
        // sideways and diagonally, up and down (FR-45).
        this.hopTimer -= dt;
        const toHop = hypot(this.hop.x - this.pos.x, this.hop.y - this.pos.y);
        if (this.hopTimer <= 0 || toHop < 10 * u) {
          this.hopTimer = this.rng.range(...cfg.hopSeconds);
          this.hop.x = chooseHopX(this.rng, swim, this.pos.x);
          this.hop.y = chooseHopY(this.rng, swim, this.species.depthRange, this.drowsy, this.pos.y);
        }
        const dx = this.hop.x - this.pos.x;
        const dy = this.hop.y - this.pos.y;
        const dist = hypot(dx, dy) || 1;
        const arrive = clamp(dist / (50 * u), 0.35, 1);
        desired.x = (dx / dist) * baseSpeed * arrive;
        desired.y = (dy / dist) * baseSpeed * arrive;
      }

      const walls = wallForce(this.pos, swim, cfg.wallMargin * u, s.walls);
      const apart = separationForce(
        this.pos,
        this.othersPos(env.others),
        cfg.separationRadius * u * (0.6 + this.size * 0.6),
        s.apart,
      );
      desired.x += (walls.x * 1.6 + apart.x * 1.2) * baseSpeed;
      desired.y += (walls.y * 1.6 + apart.y * 1.2) * baseSpeed;
      desired.y = clamp(
        desired.y,
        -maxSpeed * cfg.verticalSpeedFraction,
        maxSpeed * cfg.verticalSpeedFraction,
      );
      limit(desired, maxSpeed, desired);
    }

    const follow = Math.min(1, dt * cfg.acceleration);
    this.vel.x += (desired.x - this.vel.x) * follow;
    this.vel.y += (desired.y - this.vel.y) * follow;
    limit(this.vel, maxSpeed, this.vel);
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // Never leave the swimming area; a push against the edge stops the speed into it.
    if (this.pos.x < area.x || this.pos.x > area.x + area.width) this.vel.x = 0;
    if (this.pos.y < area.y || this.pos.y > area.y + area.height) this.vel.y = 0;
    clampToArea(this.pos, area, this.pos);

    // Facing: turn only when the fish clearly swims the other way, then ease the flip through zero.
    if (!food && Math.abs(this.vel.x) > baseSpeed * 0.12) this.faceSign = Math.sign(this.vel.x);
    const flipStep = (2 / cfg.flipSeconds) * dt;
    this.faceScale += clamp(this.faceSign - this.faceScale, -flipStep, flipStep);

    // Tilt up when climbing and down when diving (FR-45), limited and smoothed.
    const limitAngle = (cfg.pitchMaxDegrees * Math.PI) / 180;
    const angle = Math.atan2(this.vel.y, Math.max(Math.abs(this.vel.x), baseSpeed * 0.05));
    const pitchTarget = clamp(this.faceSign * angle, -limitAngle, limitAngle);
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, dt * cfg.pitchSmoothing);

    // The wave: faster when the fish swims faster, bigger after a meal.
    const wave = this.species.wave;
    const speedRatio = Math.min(1.6, length(this.vel) / Math.max(1e-3, baseSpeed));
    this.wiggleTimer = Math.max(0, this.wiggleTimer - dt);
    const wiggle = this.wiggleTimer > 0 ? 1 : 0;
    this.pulse = Math.max(0, this.pulse - dt * 2.5);
    this.phase += dt * (wave.idleSpeed + wave.speed * speedRatio + wiggle * wave.speed * 0.9);
    this.layoutWave(this.phase, wiggle ? 2.3 : 0.6 + 0.4 * Math.min(1, speedRatio));
    this.applyTransform();
  }

  /** The positions of the other fish (one array, reused every frame). */
  othersPos(others) {
    // Written by index and cut at the end: emptying the array first can make V8 give up its storage.
    const list = this.scratch.others;
    let n = 0;
    for (let i = 0; i < others.length; i++) if (others[i] !== this) list[n++] = others[i].pos;
    list.length = n;
    return list;
  }

  eat(pellet, mouth, env) {
    env.eat(this, pellet);
    this.foodQueue = this.foodQueue.filter((queued) => queued !== pellet);
    this.wiggleTimer = cfg.wiggleSeconds;
    this.pulse = 1;
    const u = this.layout.unit;
    const count = this.rng.int(2, 3);
    for (let i = 0; i < count; i++) {
      this.bubbles.emit(
        mouth.x + this.rng.range(-1, 1) * u,
        mouth.y + this.rng.range(-1, 1) * u,
        u * this.rng.range(1.6, 2.6),
      );
    }
  }

  /** Writes the rope points: a sine wave from head to tail with more swing towards the tail (FR-42). */
  layoutWave(phase, strength) {
    const { amplitude, wavelength, tailBoost } = this.species.wave;
    const n = this.ropePoints.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1); // 0 at the tail, 1 at the head
      const weight = 0.12 + (tailBoost - 0.12) * (1 - t) * (1 - t);
      const y =
        Math.sin(phase - ((1 - t) * Math.PI * 2) / wavelength) *
        amplitude *
        this.ropeLength *
        weight *
        strength;
      this.ropePoints[i].set((t - 0.5) * this.ropeLength, y);
    }
  }

  applyTransform() {
    const px = (this.adultLengthPx * this.size) / this.ropeLength;
    const swell = 1 + 0.14 * Math.sin(Math.min(1, this.pulse) * Math.PI);
    this.container.position.set(this.pos.x, this.pos.y);
    this.container.rotation = this.pitch;
    this.container.scale.set(px * swell);
    this.flip.scale.x = this.faceScale;
  }
}
