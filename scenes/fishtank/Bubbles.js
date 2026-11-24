// Bubbles: one shared pool, used by the bubble chains now and by the fish bubbles in Phase 2.
// Bubbles and emitters are not click targets.
import { Container, Sprite } from 'pixi.js';
import { ART_SCALE } from './textures.js';
import { visual } from './visualConfig.js';

const config = visual.bubbles;
const rand = (min, max) => min + Math.random() * (max - min);

export class BubbleSystem {
  /**
   * @param {import('pixi.js').Texture} texture
   */
  constructor(texture) {
    this.container = new Container();
    this.container.eventMode = 'none';
    this.texture = texture;
    this.pool = [];
    this.active = [];
    this.unit = 1;
    this.surfaceY = 0;
    for (let i = 0; i < config.poolSize; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.eventMode = 'none';
      this.container.addChild(sprite);
      this.pool.push({ sprite });
    }
    this.free = [...this.pool];
  }

  /** Called on a resize: the unit and the surface line change, and running bubbles are dropped. */
  setSize(unit, surfaceY) {
    this.unit = unit;
    this.surfaceY = surfaceY;
    for (const bubble of this.active) bubble.sprite.visible = false;
    this.free = [...this.pool];
    this.active = [];
  }

  /** Releases one bubble at (x, y). `diameter` is in pixels. If the pool is empty the bubble is skipped. */
  emit(x, y, diameter) {
    const bubble = this.free.pop();
    if (!bubble) return;
    const u = this.unit;
    bubble.x0 = x;
    bubble.y = y;
    bubble.startY = y;
    bubble.diameter = diameter;
    bubble.speed = rand(config.riseMin, config.riseMax) * u;
    bubble.wobbleAmp = rand(...config.wobbleAmplitude) * u;
    bubble.wobbleSpeed = rand(...config.wobbleSpeed);
    bubble.phase = rand(0, Math.PI * 2);
    bubble.age = 0;
    bubble.popAge = -1;
    bubble.sprite.visible = true;
    bubble.sprite.alpha = config.alpha;
    this.active.push(bubble);
    this.place(bubble, 1);
  }

  place(bubble, growth) {
    const x =
      bubble.x0 + Math.sin(bubble.age * bubble.wobbleSpeed + bubble.phase) * bubble.wobbleAmp;
    bubble.sprite.position.set(x, bubble.y);
    // The texture is 3x the size of the art; scale from pixels of texture to pixels of screen.
    bubble.sprite.scale.set((bubble.diameter * growth) / (16 * ART_SCALE));
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const bubble = this.active[i];
      bubble.age += dt;
      if (bubble.popAge < 0) {
        bubble.y -= bubble.speed * dt;
        const travelled = bubble.startY - bubble.y;
        const total = Math.max(1, bubble.startY - this.surfaceY);
        this.place(bubble, 1 + config.growth * Math.min(1, travelled / total));
        if (bubble.y <= this.surfaceY + bubble.diameter * 0.4) bubble.popAge = 0;
      } else {
        // The tiny ring at the surface: grows a little and fades.
        bubble.popAge += dt;
        const t = Math.min(1, bubble.popAge / config.popSeconds);
        this.place(bubble, 1 + config.growth + 0.7 * t);
        bubble.sprite.alpha = config.alpha * (1 - t);
        if (t >= 1) {
          bubble.sprite.visible = false;
          this.active.splice(i, 1);
          this.free.push(bubble);
        }
      }
    }
  }
}

/** A vent on a rock or coral: a chain of 5 to 12 bubbles, then a pause of 4 to 15 seconds. */
export class BubbleEmitter {
  constructor(system, x, y) {
    this.system = system;
    this.x = x;
    this.y = y;
    this.state = 'pause';
    this.timer = rand(0.5, config.firstPauseMax);
    this.remaining = 0;
  }

  update(dt) {
    this.timer -= dt;
    if (this.state === 'pause') {
      if (this.timer <= 0) {
        this.state = 'emit';
        this.remaining = Math.floor(rand(config.chainMin, config.chainMax + 1));
        this.timer = 0;
      }
      return;
    }
    while (this.timer <= 0 && this.remaining > 0) {
      const u = this.system.unit;
      this.system.emit(this.x, this.y, rand(config.sizeMin, config.sizeMax) * u);
      this.remaining--;
      this.timer += config.spacing;
    }
    if (this.remaining === 0) {
      this.state = 'pause';
      this.timer = rand(config.pauseMin, config.pauseMax);
    }
  }
}
