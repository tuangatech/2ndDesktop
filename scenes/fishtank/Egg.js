// Eggs (FR-17, FR-18): one rests on the sand for every egg that is waiting, up to four are drawn. Clicking one hatches
// it. The repository holds only the number of eggs; this class keeps the sprites in step with it.
import { Container, Sprite } from 'pixi.js';
import { ART_SCALE } from './textures.js';
import { visual } from './visualConfig.js';

const cfg = visual.eggs;

export class EggField {
  constructor(texture) {
    this.texture = texture;
    this.container = new Container();
    this.container.eventMode = 'none';
    /** @type {Array<{sprite: Sprite, slot: number, state: string, t: number, age: number, phase: number}>} */
    this.entities = [];
    this.layout = null;
  }

  setLayout(layout) {
    this.layout = layout;
    const scale = (cfg.width * layout.unit) / (this.texture.width / ART_SCALE);
    for (const e of this.entities) {
      e.sprite.scale.set(scale);
      this.place(e);
    }
  }

  place(e) {
    const { width, sandTop, height } = this.layout;
    e.sprite.position.set(cfg.slots[e.slot] * width, sandTop + (height - sandTop) * 0.4);
  }

  get resting() {
    return this.entities.filter((e) => e.state === 'resting');
  }

  /** The egg to hatch next, or null. */
  first() {
    return this.resting[0] ?? null;
  }

  /** Makes the number of resting eggs equal to `count` (at most the number of slots). */
  sync(count) {
    if (!this.layout) return;
    const wanted = Math.min(count, cfg.maxShown);
    let resting = this.resting;
    while (resting.length < wanted) {
      const used = new Set(this.entities.map((e) => e.slot));
      const slot = cfg.slots.findIndex((_, i) => !used.has(i));
      if (slot < 0) break;
      const sprite = new Sprite(this.texture);
      sprite.anchor.set(0.5, 1);
      sprite.alpha = 0;
      const e = { sprite, slot, state: 'resting', t: 0, age: 0, phase: slot * 1.9 };
      this.entities.push(e);
      this.container.addChild(sprite);
      this.setLayout(this.layout);
      resting = this.resting;
    }
    while (resting.length > wanted) {
      this.remove(resting[resting.length - 1]);
      resting = this.resting;
    }
  }

  remove(e) {
    this.container.removeChild(e.sprite);
    e.sprite.destroy();
    this.entities.splice(this.entities.indexOf(e), 1);
  }

  /** The resting egg at (x, y), or null. */
  hit(x, y) {
    if (!this.layout) return null;
    const radius = cfg.hitRadius * this.layout.unit;
    for (const e of this.resting) {
      if (Math.hypot(e.sprite.x - x, e.sprite.y - radius * 0.6 - y) <= radius) return e;
    }
    return null;
  }

  /** Starts the hatch animation; the egg no longer counts as resting. Returns where it is. */
  hatch(e) {
    e.state = 'hatching';
    e.t = 0;
    return { x: e.sprite.x, y: e.sprite.y - this.layout.unit * cfg.width * 0.5 };
  }

  /** @param {(x: number, y: number) => void} [onHatched]  called when a hatching egg is done */
  update(dt, onHatched) {
    if (!this.layout) return;
    // Backwards, so an entity can be taken out without a copy of the list every frame.
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.age += dt;
      if (e.state === 'hatching') {
        e.t += dt / cfg.hatchSeconds;
        if (e.t >= 1) {
          onHatched?.(e.sprite.x, e.sprite.y - this.layout.unit * cfg.width * 0.5);
          this.remove(e);
          continue;
        }
        // The shaking grows, then the egg shrinks away.
        const shake = Math.sin(e.t * 70) * 0.16 * Math.min(1, e.t * 2.2);
        e.sprite.rotation = shake;
        e.sprite.alpha = e.t > 0.8 ? 1 - (e.t - 0.8) / 0.2 : 1;
        continue;
      }
      e.sprite.alpha = Math.min(1, e.sprite.alpha + dt);
      e.sprite.rotation = Math.sin(e.age * 1.4 + e.phase) * 0.05;
    }
  }
}
