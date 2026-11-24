// Floating pellets (FR-1 to FR-5): the repository holds only the NUMBER of pellets waiting (D8, positions are not
// saved). This class keeps one sprite per pellet in step with that number: it adds one when a pellet appears, and
// removes one when the player collects it. They drift and bob, and a click collects (window mode).
import { Container, Graphics, Sprite } from 'pixi.js';
import { ART_SCALE } from './textures.js';
import { visual } from './visualConfig.js';

const cfg = visual.floating;
const ease = (t) => t * t * (3 - 2 * t);

export class FloatingPellets {
  constructor(texture) {
    this.texture = texture;
    this.container = new Container();
    this.container.eventMode = 'none';
    /** @type {Array<object>} */
    this.entities = [];
    this.layout = null;
    /** Where collected pellets fly to (the stash counter), or null to just fade out. */
    this.collectTarget = null;
    this.scratchPoint = { x: 0, y: 0 };
  }

  setLayout(layout) {
    this.layout = layout;
    const scale = (cfg.diameter * layout.unit) / (this.texture.width / ART_SCALE);
    for (const e of this.entities) {
      e.pellet.scale.set(scale);
      e.halo
        .clear()
        .circle(0, 0, cfg.diameter * layout.unit * 0.95)
        .fill({ color: 0xfff2b0, alpha: 0.22 });
    }
  }

  setCollectTarget(point) {
    this.collectTarget = point;
  }

  get active() {
    return this.entities.filter((e) => e.state === 'entering' || e.state === 'floating');
  }

  /** Where the entity is drawn now, in pixels of the tank. */
  position(e, out = { x: 0, y: 0 }) {
    const { width, height, unit } = this.layout;
    out.x =
      e.fx * width + Math.sin(e.age * cfg.driftSpeed + e.phase * 1.7) * cfg.driftAmplitude * unit;
    out.y = e.fy * height + Math.sin(e.age * cfg.bobSpeed + e.phase) * cfg.bobAmplitude * unit;
    return out;
  }

  add(animate) {
    const { swim, width, height, sandTop, unit } = this.layout;
    const halo = new Graphics();
    const pellet = new Sprite(this.texture);
    pellet.anchor.set(0.5);
    const sprite = new Container();
    sprite.addChild(halo, pellet);
    sprite.eventMode = 'none';
    const top = Math.max(swim.y, cfg.topMargin * unit);
    const bottom = sandTop - cfg.diameter * 1.6 * unit;
    const e = {
      sprite,
      halo,
      pellet,
      fx: (swim.x + Math.random() * swim.width) / width,
      fy: (top + Math.random() * Math.max(1, bottom - top)) / height,
      phase: Math.random() * Math.PI * 2,
      age: Math.random() * 10,
      state: animate ? 'entering' : 'floating',
      t: 0,
      delay: 0,
      from: null,
    };
    sprite.alpha = animate ? 0 : 1;
    this.entities.push(e);
    this.container.addChild(sprite);
    this.setLayout(this.layout);
    const p = this.position(e);
    sprite.position.set(p.x, p.y);
    return e;
  }

  release(e, index = 0, animate = true) {
    const fly = animate && this.collectTarget;
    e.state = fly ? 'flying' : 'fading';
    e.t = 0;
    e.delay = animate ? index * cfg.flyStagger : 0;
    e.from = { x: e.sprite.x, y: e.sprite.y };
    if (!animate) this.remove(e);
  }

  remove(e) {
    this.container.removeChild(e.sprite);
    e.sprite.destroy({ children: true });
    this.entities.splice(this.entities.indexOf(e), 1);
  }

  /**
   * Makes the number of floating pellets equal to `count`. Picked pellets (the ones the player clicked) are removed
   * first and fly away; then the oldest. Without a layout nothing is drawn.
   */
  sync(count, { animate = true } = {}) {
    if (!this.layout) return;
    let active = this.active;
    while (active.length < count) {
      this.add(animate);
      active = this.active;
    }
    let index = 0;
    while (active.length > count) {
      this.release(active.find((e) => e.picked) ?? active[0], index++, animate);
      active = this.active;
    }
  }

  /** The pellet at (x, y), or null. The topmost one wins. */
  hit(x, y) {
    if (!this.layout) return null;
    const radius = cfg.hitRadius * this.layout.unit;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.state !== 'floating' && e.state !== 'entering') continue;
      const p = this.position(e);
      if (Math.hypot(p.x - x, p.y - y) <= radius) return e;
    }
    return null;
  }

  /** Marks the pellet the player clicked: it is the one released when the count goes down. */
  pick(e) {
    e.picked = true;
  }

  unpick(e) {
    e.picked = false;
  }

  /** Makes the pellet shake a little (the stash is full, FR-5). */
  shake(e) {
    e.shake = 0.4;
  }

  update(dt) {
    if (!this.layout) return;
    const target = this.collectTarget;
    // Backwards, so remove() can take an entity out without a copy of the list every frame.
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.age += dt;
      if (e.state === 'flying' || e.state === 'fading') {
        e.delay -= dt;
        if (e.delay > 0) continue;
        e.t += dt / (e.state === 'flying' ? cfg.flySeconds : 0.3);
        if (e.t >= 1) {
          this.remove(e);
          continue;
        }
        const k = ease(e.t);
        if (e.state === 'flying' && target) {
          e.sprite.position.set(
            e.from.x + (target.x - e.from.x) * k,
            e.from.y + (target.y - e.from.y) * k,
          );
          e.sprite.scale.set(1 - 0.6 * k);
        } else {
          e.sprite.position.set(e.from.x, e.from.y - 6 * this.layout.unit * k);
        }
        e.sprite.alpha = 1 - (e.state === 'flying' ? k * k : k);
        continue;
      }
      if (e.state === 'entering') {
        e.t += dt / cfg.fadeInSeconds;
        e.sprite.alpha = Math.min(1, e.t);
        if (e.t >= 1) e.state = 'floating';
      }
      const p = this.position(e, this.scratchPoint);
      let shake = 0;
      if (e.shake > 0) {
        e.shake = Math.max(0, e.shake - dt);
        shake = Math.sin(e.shake * 60) * 2 * this.layout.unit * (e.shake / 0.4);
      }
      e.sprite.position.set(p.x + shake, p.y);
    }
  }
}
