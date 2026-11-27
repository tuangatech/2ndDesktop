// Dropped food (FR-46, FR-47, D17): a pellet appears where the player clicked, sinks slowly and sways. It is
// given to the nearest fish, which always eats it, even when it has reached the sand.
import { Container, Sprite } from 'pixi.js';
import { ART_SCALE } from './textures.js';
import { visual } from './visualConfig.js';

const config = visual.food;

export class DroppedPellet {
  constructor(texture, x, y, phase) {
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.eventMode = 'none';
    this.x0 = x;
    this.x = x;
    this.y = y;
    this.phase = phase;
    this.age = 0;
    /** @type {'sinking'|'resting'|'eaten'} */
    this.state = 'sinking';
    this.owner = null;
    /** The owner's growth points after this meal; shown when the pellet is eaten (D1). */
    this.pointsAfter = 0;
    /** Velocity for the fish's prediction (the sway is small and ignored). */
    this.velocity = { x: 0, y: 0 };
  }
}

export class FoodSystem {
  constructor(texture) {
    this.texture = texture;
    this.container = new Container();
    this.container.eventMode = 'none';
    this.pellets = [];
    this.layout = null;
    this.sinkSpeed = 0;
    this.restY = 0;
  }

  /** Called with every new layout. Pellets keep their place in the tank when the size changes. */
  setLayout(layout) {
    const previous = this.layout;
    this.layout = layout;
    this.sinkSpeed = layout.sandTop / config.sinkSeconds;
    this.restY = layout.sandTop + 4 * layout.unit;
    const scale = (config.pelletDiameter * layout.unit) / (this.texture.width / ART_SCALE);
    for (const pellet of this.pellets) {
      if (previous) {
        pellet.x0 *= layout.width / previous.width;
        pellet.x = pellet.x0;
        pellet.y *= layout.height / previous.height;
      }
      pellet.sprite.scale.set(scale, pellet.state === 'resting' ? scale * 0.8 : scale);
      pellet.velocity.y = pellet.state === 'sinking' ? this.sinkSpeed : 0;
      if (pellet.state === 'resting') pellet.y = this.restY;
    }
  }

  /**
   * The fish that has the shortest swim to (x, y), counting the way it has to swim for the pellets it already
   * has queued, so a busy fish counts as farther away (FR-7).
   * @param {Array<{pos:{x:number,y:number}, foodQueue:object[]}>} fishList
   */
  nearestFish(x, y, fishList) {
    let nearest = null;
    let best = Infinity;
    for (const fish of fishList) {
      let from = fish.pos;
      let d = 0;
      for (const queued of fish.foodQueue) {
        d += Math.hypot(queued.x - from.x, queued.y - from.y);
        from = queued;
      }
      d += Math.hypot(x - from.x, y - from.y);
      if (d < best) {
        best = d;
        nearest = fish;
      }
    }
    return nearest;
  }

  /**
   * Drops a pellet at (x, y) for `fish`, which will eat it (FR-47). The meal is already counted in the
   * repository (D1); `pointsAfter` is the fish's growth points after this meal, shown when it is eaten.
   * Returns the pellet, or null when nothing happens (a click on the sand).
   */
  drop(x, y, fish, pointsAfter) {
    const layout = this.layout;
    if (!layout || !fish || y >= layout.sandTop) return null;
    const pellet = new DroppedPellet(this.texture, x, Math.max(0, y), Math.random() * Math.PI * 2);
    pellet.pointsAfter = pointsAfter;
    pellet.velocity.y = this.sinkSpeed;
    const scale = (config.pelletDiameter * layout.unit) / (this.texture.width / ART_SCALE);
    pellet.sprite.scale.set(scale);
    pellet.sprite.position.set(pellet.x, pellet.y);
    pellet.owner = fish;
    fish.foodQueue.push(pellet);
    this.pellets.push(pellet);
    this.container.addChild(pellet.sprite);
    return pellet;
  }

  /** The fish calls this when it has eaten the pellet. */
  consume(pellet) {
    pellet.state = 'eaten';
    pellet.sprite.visible = false;
  }

  update(dt) {
    const layout = this.layout;
    if (!layout) return;
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const pellet = this.pellets[i];
      if (pellet.state === 'eaten') {
        this.container.removeChild(pellet.sprite);
        pellet.sprite.destroy();
        this.pellets.splice(i, 1);
        continue;
      }
      pellet.age += dt;
      if (pellet.state === 'sinking') {
        pellet.y += this.sinkSpeed * dt;
        pellet.x =
          pellet.x0 +
          Math.sin(pellet.age * config.swaySpeed + pellet.phase) *
            config.swayAmplitude *
            layout.unit;
        if (pellet.y >= this.restY) {
          pellet.y = this.restY;
          pellet.state = 'resting';
          pellet.velocity.y = 0;
          pellet.sprite.scale.y *= 0.8;
        }
      }
      pellet.sprite.position.set(pellet.x, pellet.y);
    }
  }
}
