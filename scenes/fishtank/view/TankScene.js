// The tank scene: every layer container of tech design 3.2 in its final order, including the ones
// Phase 2 will fill. Phase 1 leaves surface, light shafts, floor light, shadows and depth shading empty for now.
//
// The scene shows the tank that the repository holds and sends the player's actions to it: it never decides a
// number (D1). Clicks, tray actions and the feed loop all end in the same repository calls.
import { Container, FillGradient, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { eggsAvailable } from '../game/rules.js';
import { BubbleEmitter, BubbleSystem } from './Bubbles.js';
import { EggField } from './Egg.js';
import { Fish } from './Fish.js';
import { FoodSystem } from './Food.js';
import { FloatingPellets } from './Pellet.js';
import { PointerTracker } from './pointer.js';
import { SwayMesh } from './SwayMesh.js';
import { ART_SCALE, makeSandTexture } from './textures.js';
import { backdropShapes } from './backdrop.js';
import { computeLayout, layoutDecor } from './layout.js';
import { visual } from './visualConfig.js';

/** What the player is told when something cannot be done (FR-5, FR-7, FR-18). */
export const MESSAGES = {
  all_full: 'Everyone is full and happy. Come back later!',
  stash_empty: 'No food in the stash',
  stash_full: 'Stash is full',
  none_available: 'No pellets waiting',
  tank_full: 'The tank is full',
};

export class TankScene {
  /**
   * @param {{textures: Record<string, import('pixi.js').Texture>, decor: Record<string, object>, species: object}} art
   * @param {import('../game/repo/TankRepository.js').TankRepository} repository  already loaded
   * @param {typeof import('../game/config.js').config} config
   */
  constructor(art, repository, config) {
    this.art = art;
    this.repository = repository;
    this.config = config;
    /** @type {Map<string, Fish>} */
    this.fishes = new Map();
    this.seed = repository.getState().tank.decorSeed;
    this.time = 0;
    this.tickClock = 0;
    /** False while nobody can see the tank: actions then change the numbers but skip the animation (FR-22). */
    this.visible = true;
    /** The "feed until full" loop, or null. */
    this.feeding = null;
    this.pointer = new PointerTracker();
    /** Called with a short text for the player (window mode shows it as a toast). */
    this.onMessage = null;
    /** @type {{play: (name: string) => unknown}|null} The host's sounds. Only player actions call it (FR-38). */
    this.sound = null;
    /** Called with a fish when the player touches it (window mode, FR-48). */
    this.onFishTouched = null;
    this.layout = null;
    this.sway = [];
    this.emitters = [];
    this.sizeKey = null;
    this.fishList = [];
    this.onEggHatched = (x, y) => this.hatchBurst(x, y);
    /** What every fish gets in update(); one object, refreshed each frame. */
    this.env = {
      layout: null,
      others: this.fishList,
      restY: 0,
      pointer: this.pointer,
      time: 0,
      eat: (fish, pellet) => {
        this.food.consume(pellet);
        // The meal was counted when the pellet was dropped (D1); the fish grows now. Pellets are eaten nearest
        // the sand first, which is not always the order they were dropped in, so growth never goes back.
        fish.setPoints(Math.max(fish.points, pellet.pointsAfter), true);
      },
    };
    this.sandTexture = makeSandTexture();
    // Made once: each gradient owns a texture, and destroying a Graphics does not free it, so making them in
    // every resize leaked two textures each time. 'local' gradients stretch to any shape, so one of each serves.
    const vertical = (colorStops) =>
      new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops,
        textureSpace: 'local',
      });
    this.gradients = {
      water: vertical([
        { offset: 0, color: '#9be8e4' },
        { offset: 0.5, color: '#3fb0c4' },
        { offset: 1, color: '#14507c' },
      ]),
      sand: vertical([
        { offset: 0, color: 'rgba(255,244,205,0.45)' },
        { offset: 1, color: 'rgba(120,92,52,0.45)' },
      ]),
    };

    this.root = new Container();
    this.root.eventMode = 'none';
    // Back to front. Everything between the background and the sand lip is in one `water` container, so
    // a single ripple filter can cover it in Phase 2.
    this.layers = {
      background: new Container(),
      water: new Container(),
      sandLip: new Container(),
      depthShading: new Container(),
      ui: new Container(),
    };
    const water = this.layers.water;
    this.water = {
      surface: new Container(),
      shafts: new Container(),
      backDecor: new Container(),
      backHaze: new Container(),
      sand: new Container(),
      floorLight: new Container(),
      shadows: new Container(),
      bubbles: new Container(),
      fish: new Container(),
      pellets: new Container(),
      frontDecor: new Container(),
    };
    for (const layer of Object.values(this.water)) water.addChild(layer);
    for (const layer of Object.values(this.layers)) this.root.addChild(layer);

    this.bubbles = new BubbleSystem(art.textures.bubble);
    this.water.bubbles.addChild(this.bubbles.container);
    this.eggs = new EggField(art.textures.egg);
    this.floating = new FloatingPellets(art.textures.pellet);
    this.food = new FoodSystem(art.textures.pellet);
    this.water.pellets.addChild(this.eggs.container, this.floating.container, this.food.container);
    // The event says what changed (a fed or hatched fish), so the picture follows the repository without
    // side flags, and the same code works when a Phase 3 repository reports a change later than the call.
    repository.subscribe((event) => this.syncAll(event));
  }

  /** @param {import('../game/repo/TankRepository.js').TankEvent} [event]  what changed, when known */
  syncAll(event) {
    this.syncFish(event);
    this.syncPellets();
    this.syncEggs();
  }

  /** The floating pellets follow the number the repository holds. */
  syncPellets() {
    this.floating.sync(this.repository.getState().tank.floatingPellets, { animate: this.visible });
  }

  syncEggs() {
    this.eggs.sync(eggsAvailable(this.repository.getState().tank, this.config));
  }

  /**
   * (Re)builds everything that depends on the size. Positions come from the seed, so nothing moves. A call with
   * the same size does nothing (the renderer can report a resize that changed only the drawing resolution).
   */
  resize(width, height, usable) {
    const key = JSON.stringify([width, height, usable ?? null]);
    if (key === this.sizeKey) return;
    this.sizeKey = key;
    const layout = computeLayout({ width, height, usable });
    const previous = this.layout;
    this.layout = layout;
    this.clearDynamic();
    this.drawBackground(layout);
    this.drawSand(layout);
    this.buildDecor(layout);
    this.bubbles.setSize(layout.unit, layout.height * 0.025);
    if (previous) for (const fish of this.fishes.values()) fish.rescale(previous, layout);
    this.food.setLayout(layout);
    this.floating.setLayout(layout);
    this.eggs.setLayout(layout);
    this.syncAll();
  }

  /**
   * Makes the fish match the repository: new records get a fish, removed ones lose it, points follow.
   * @param {import('../game/repo/TankRepository.js').TankEvent} [event]
   */
  syncFish(event) {
    if (!this.layout) return;
    const records = this.repository.getState().fish;
    const ids = new Set(records.map((r) => r.id));
    for (const [id, fish] of this.fishes) {
      if (ids.has(id)) continue;
      this.water.fish.removeChild(fish.container);
      fish.container.destroy({ children: true });
      this.fishes.delete(id);
    }
    for (const record of records) {
      const existing = this.fishes.get(record.id);
      if (existing) {
        existing.name = record.name;
        // A meal that is still on its way is shown when the pellet is eaten (D1), not when it is dropped: the
        // fish that was just fed keeps its points until then (dropAt gives the pellet the new points).
        const justFed = event?.type === 'feed' && event.fishId === record.id;
        if (existing.foodQueue.length === 0 && !justFed) {
          existing.setPoints(record.growthPoints, true);
        }
        continue;
      }
      const fish = new Fish({
        record,
        species: this.art.species[record.species],
        textures: this.art.textures,
        bubbles: this.bubbles,
        layout: this.layout,
        // A hatched fish fades in where its egg was (hatch() places it); fish at load time are just there.
        fadeIn: event?.type === 'hatch' && event.fishId === record.id && this.visible,
      });
      fish.setDrowsy(this.repository.isDrowsy(record.id));
      this.fishes.set(record.id, fish);
      this.water.fish.addChild(fish.container);
    }
  }

  say(text) {
    this.onMessage?.(text);
  }

  /** Where collected pellets fly to: the stash counter, in pixels of the tank (or null in desktop mode). */
  setCollectTarget(point) {
    this.floating.setCollectTarget(point);
  }

  /** Called when the tank becomes visible or hidden. Hiding stops the feed loop; showing catches up (FR-22). */
  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      this.tick();
    } else {
      this.stopFeeding();
      this.pointer.leave();
    }
  }

  /** The pointer is over the tank at (x, y) (window mode: its events; desktop mode: read by the main process). */
  setPointer(x, y) {
    this.pointer.move(x, y, this.time);
  }

  clearPointer() {
    this.pointer.leave();
  }

  /** What the tray menu shows, from the stored values and the clock. */
  getSummary() {
    return { ...this.repository.getSummary(), feeding: Boolean(this.feeding) };
  }

  fishAt(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const fish of this.fishes.values()) {
      if (!fish.hitTest(x, y)) continue;
      const d = Math.hypot(fish.pos.x - x, fish.pos.y - y);
      if (d < bestDistance) {
        best = fish;
        bestDistance = d;
      }
    }
    return best;
  }

  /**
   * A click at (x, y) in window mode. The order is fixed (FR-46, plan 5C): an egg or a floating pellet first,
   * then a fish, then the water, where the click drops a pellet.
   */
  click(x, y) {
    const egg = this.eggs.hit(x, y);
    if (egg) return this.hatch(egg);
    const pellet = this.floating.hit(x, y);
    if (pellet) return this.collectPellet(pellet);
    const fish = this.fishAt(x, y);
    if (fish) {
      fish.poke();
      this.onFishTouched?.(fish);
      return { ok: true, touched: fish.id };
    }
    return this.dropAt(x, y);
  }

  /** The player clicked a floating pellet: it goes to the stash (FR-4), unless the stash is full (FR-5). */
  collectPellet(entity) {
    // The clicked pellet is the one that flies to the stash when the count goes down.
    this.floating.pick(entity);
    const result = this.repository.collect(1);
    if (!result.ok) {
      this.floating.unpick(entity);
      this.floating.shake(entity);
      this.say(MESSAGES[result.reason] ?? '');
    } else if (this.visible) this.sound?.play('pop');
    return result;
  }

  /** The tray item "Collect pellets": every waiting pellet, as far as the stash has room. */
  collectAll() {
    const waiting = this.repository.getState().tank.floatingPellets;
    const result = this.repository.collect(Infinity);
    if (!result.ok) this.say(MESSAGES[result.reason] ?? '');
    else if (result.collected < waiting) this.say(MESSAGES.stash_full);
    if (result.ok && result.collected > 0 && this.visible) this.sound?.play('pop');
    return result;
  }

  /**
   * A pellet from the stash at (x, y) for the nearest fish that is not full (FR-6, FR-7). The numbers change in the
   * repository right now (D1); the pellet then sinks and the fish eats it. Nothing happens on the sand, with no
   * fish, with everyone full or with an empty stash (FR-46). `fish` gives the pellet to that fish instead, when it
   * is hungry (the tray). Returns the result of the repository, or `{ ok: false, reason }`.
   */
  dropAt(x, y, { animate = this.visible, quiet = false, fish: target = null } = {}) {
    const layout = this.layout;
    if (!layout) return { ok: false, reason: 'no_layout' };
    if (this.fishes.size === 0) return { ok: false, reason: 'no_fish' };
    if (y >= layout.sandTop) return { ok: false, reason: 'sand' };
    const hungry = [...this.fishes.values()].filter((fish) => !this.repository.isFull(fish.id));
    if (hungry.length === 0) {
      this.say(MESSAGES.all_full);
      return { ok: false, reason: 'all_full' };
    }
    const fish = target && hungry.includes(target) ? target : this.food.nearestFish(x, y, hungry);
    const result = this.repository.feed(fish.id);
    if (!result.ok) {
      this.say(MESSAGES[result.reason] ?? '');
      return result;
    }
    if (animate) {
      this.food.drop(x, y, fish, result.fish.growthPoints);
      if (!quiet) this.sound?.play('splash');
    } else fish.setPoints(result.fish.growthPoints, false);
    return result;
  }

  /**
   * The hungry fish that needs a meal most: the emptiest, then the one that waited longest since its last meal (or
   * since it hatched), so every fish gets its turn whatever depth it swims at. Null when everyone is full.
   */
  hungriestFish() {
    const records = new Map(this.repository.getState().fish.map((r) => [r.id, r]));
    let best = null;
    let bestKey = null;
    for (const fish of this.fishes.values()) {
      const record = records.get(fish.id);
      if (!record || this.repository.isFull(fish.id)) continue;
      const key = [record.fullness, record.lastFedAt ?? record.createdAt];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = fish;
        bestKey = key;
      }
    }
    return best;
  }

  /**
   * The tray items "Feed a pellet" and "Feed until full" (FR-6, D28): the player cannot aim, so the pellet goes to
   * the hungriest fish and is dropped just under the surface above it.
   */
  feedOne(options) {
    const band = this.layout?.dropBand;
    if (!band) return { ok: false, reason: 'no_layout' };
    const fish = this.hungriestFish();
    if (!fish) return this.dropAt(band.x + band.width / 2, band.y + band.height / 2, options); // says "all full"
    // A little to the side at random, so pellets for the same fish do not fall on one line.
    const jitter = (Math.random() - 0.5) * 6 * this.layout.unit;
    const x = Math.min(band.x + band.width, Math.max(band.x, fish.pos.x + jitter));
    return this.dropAt(x, band.y + band.height / 2, { ...options, fish });
  }

  /** "Feed until full": a pellet about every 2 seconds of scene time until everyone is full or the stash is empty. */
  startFeeding() {
    if (this.feeding) return;
    if (!this.visible) {
      // Nobody is looking: apply every meal at once, without animation.
      while (this.feedOne({ animate: false }).ok);
      return;
    }
    this.feeding = { timer: 0 };
  }

  stopFeeding() {
    this.feeding = null;
  }

  /** Hatches a waiting egg (FR-17). `egg` is the one that was clicked; the tray hatches the first. */
  hatch(egg = this.eggs.first()) {
    const state = this.repository.getState();
    if (eggsAvailable(state.tank, this.config) < 1) return { ok: false, reason: 'no_egg' };
    if (state.fish.length >= this.config.eggs.maxFish) {
      this.say(MESSAGES.tank_full);
      return { ok: false, reason: 'tank_full' };
    }
    const spot = egg && this.visible ? this.eggs.hatch(egg) : null;
    const result = this.repository.hatchEgg();
    if (!result.ok) {
      if (egg && spot) egg.state = 'resting';
      return result;
    }
    const fish = this.fishes.get(result.fish.id);
    if (fish && spot) fish.placeAt(spot.x, spot.y);
    if (spot) this.sound?.play('chime');
    return result;
  }

  /** Renames a fish (FR-15). */
  rename(fishId, name) {
    return this.repository.renameFish(fishId, name);
  }

  /** The once-a-second tick: pellets and hunger by the clock, and the drowsy look (FR-1, FR-8, FR-10). */
  tick() {
    this.repository.tick();
    for (const fish of this.fishes.values()) fish.setDrowsy(this.repository.isDrowsy(fish.id));
  }

  clearDynamic() {
    const clear = (container) => {
      for (const child of container.removeChildren()) child.destroy({ children: true });
    };
    clear(this.layers.background);
    clear(this.layers.sandLip);
    clear(this.water.backDecor);
    clear(this.water.backHaze);
    clear(this.water.frontDecor);
    clear(this.water.sand);
    this.sway = [];
    this.emitters = [];
  }

  drawBackground(layout) {
    const { width, height } = layout;
    const background = this.layers.background;
    background.addChild(new Graphics().rect(0, 0, width, height).fill(this.gradients.water));
    // The far reef: one Graphics, flat fills (no gradient textures to leak on resize).
    const reef = new Graphics();
    for (const shape of backdropShapes(this.seed, layout)) {
      reef.poly(shape.points, true).fill({ color: shape.color, alpha: shape.alpha });
    }
    background.addChild(reef);
    // The same gradient as the water over the full height, so it only changes the pixels of the back decor.
    this.water.backHaze.addChild(
      new Graphics()
        .rect(0, 0, width, height)
        .fill({ fill: this.gradients.water, alpha: visual.decor.backHaze }),
    );
  }

  /** The wavy top edge of the sand, as points from left to right. */
  sandEdge({ width, sandTop, unit }, yOffset = 0) {
    const points = [];
    const amplitude = visual.sand.waveAmplitude * unit;
    const step = Math.max(6, 8 * unit);
    for (let x = 0; x <= width + step; x += step) {
      const wave =
        Math.sin((x * 0.012) / unit) * amplitude +
        Math.sin((x * 0.031) / unit + 1.3) * amplitude * 0.5;
      points.push({ x, y: sandTop + yOffset + wave });
    }
    return points;
  }

  drawSand(layout) {
    const { width, height, sandTop, unit } = layout;
    const sandHeight = height - sandTop;
    const container = this.water.sand;

    const tile = new TilingSprite({
      texture: this.sandTexture,
      width,
      height: sandHeight + 8 * unit,
    });
    tile.position.set(0, sandTop - 4 * unit);
    tile.tileScale.set(unit * visual.sand.grainScale);

    const mask = new Graphics();
    const edge = this.sandEdge(layout);
    mask.moveTo(0, height);
    for (const p of edge) mask.lineTo(p.x, p.y);
    mask.lineTo(width, height).closePath().fill(0xffffff);

    // Soft light at the top of the sand, darker at the bottom (light comes from above).
    const shade = new Graphics();
    shade.rect(0, sandTop - 4 * unit, width, sandHeight + 8 * unit).fill(this.gradients.sand);

    // A lighter highlight line along the top edge.
    const highlight = new Graphics();
    highlight.moveTo(edge[0].x, edge[0].y + unit);
    for (const p of edge) highlight.lineTo(p.x, p.y + unit);
    highlight.stroke({ width: 1.6 * unit, color: 0xfff4cd, alpha: 0.55 });

    container.addChild(tile, shade, highlight, mask);
    container.mask = mask;

    // The thin sand lip in front of the front decor.
    const lipHeight = sandHeight * visual.sand.lipFraction;
    const lip = new Graphics();
    const lipTop = height - lipHeight;
    const lipEdge = this.sandEdge({ width, sandTop: lipTop, unit }, 0);
    lip.moveTo(0, height);
    for (const p of lipEdge) lip.lineTo(p.x, p.y);
    lip.lineTo(width, height).closePath().fill({ color: 0xd6bb86 });
    const lipShade = new Graphics();
    lipShade.moveTo(0, height);
    for (const p of lipEdge) lipShade.lineTo(p.x, p.y);
    lipShade.lineTo(width, height).closePath().fill({ color: 0xa98f5e, alpha: 0.25 });
    this.layers.sandLip.addChild(lip, lipShade);
  }

  buildDecor(layout) {
    const { width, height, sandTop, unit } = layout;
    const sandHeight = height - sandTop;
    const widths = {};
    for (const [kind, data] of Object.entries(this.art.decor)) {
      widths[kind] = (this.art.textures[data.frame]?.width ?? 0) / ART_SCALE;
    }
    const { items, bubbleSources } = layoutDecor(this.seed, layout.aspect, this.art.decor, widths);
    const sourceIds = new Set(bubbleSources);

    for (const item of items) {
      const data = this.art.decor[item.kind];
      const texture = this.art.textures[data.frame];
      const back = item.layer === 'back';
      const range = back ? visual.decor.backBase : visual.decor.frontBase;
      const baseY = sandTop + (range[0] + (range[1] - range[0]) * item.fy) * sandHeight;
      const x = item.fx * width;
      const scale = (unit * item.scale) / ART_SCALE;

      let display;
      if (data.sway) {
        const swayMesh = new SwayMesh(texture, data.sway, item.phase);
        this.sway.push(swayMesh);
        display = swayMesh.mesh;
      } else {
        display = new Sprite(texture);
        display.anchor.set(0.5, 1);
      }
      display.position.set(x, baseY);
      display.scale.set(item.flip ? -scale : scale, scale);
      if (back) {
        display.tint = visual.decor.backTint;
      }
      if (!back) {
        // A soft shadow on the sand grounds the decoration.
        const shadowWidth = texture.width * scale;
        const shadow = new Graphics()
          .ellipse(0, 0, shadowWidth * 0.5, shadowWidth * 0.07)
          .fill({ color: 0x5a4528, alpha: 0.2 });
        shadow.position.set(x, baseY);
        this.water.frontDecor.addChild(shadow);
      }
      (back ? this.water.backDecor : this.water.frontDecor).addChild(display);

      if (sourceIds.has(item.id) && data.vent) {
        const w = texture.width * scale;
        const h = texture.height * scale;
        const ventX = x + (item.flip ? -1 : 1) * (data.vent.x - 0.5) * w;
        const ventY = baseY - h * (1 - data.vent.y);
        this.emitters.push(new BubbleEmitter(this.bubbles, ventX, ventY));
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.tickClock += dt;
    if (this.tickClock >= 1) {
      this.tickClock = 0;
      this.tick();
    }
    if (this.feeding) {
      this.feeding.timer -= dt;
      if (this.feeding.timer <= 0) {
        this.feeding.timer = visual.food.feedLoopSeconds;
        // It ends when a drop fails: everyone is full, the stash is empty, or there is no fish.
        // The loop runs from the tick, so it makes no sound (sounds only answer a click or a menu action).
        if (!this.feedOne({ quiet: true }).ok) this.stopFeeding();
      }
    }
    for (let i = 0; i < this.sway.length; i++) this.sway[i].update(this.time);
    for (let i = 0; i < this.emitters.length; i++) this.emitters[i].update(dt);
    // The same list and env object every frame (no garbage per frame); they are refreshed here.
    const fishList = this.fishList;
    let n = 0;
    for (const fish of this.fishes.values()) fishList[n++] = fish;
    fishList.length = n;
    const env = this.env;
    env.layout = this.layout;
    env.restY = this.food.restY;
    env.time = this.time;
    for (let i = 0; i < fishList.length; i++) fishList[i].update(dt, env);
    this.floating.update(dt);
    this.eggs.update(dt, this.onEggHatched);
    this.food.update(dt);
    this.bubbles.update(dt);
  }

  /** Frees everything the scene made, including the textures that are not children of the root. */
  destroy() {
    this.root.destroy({ children: true });
    for (const gradient of Object.values(this.gradients)) gradient.destroy();
    this.sandTexture.destroy(true);
  }

  /** A few bubbles where an egg has hatched. */
  hatchBurst(x, y) {
    const u = this.layout.unit;
    for (let i = 0; i < 7; i++) {
      const size = u * (2 + Math.random() * 3);
      this.bubbles.emit(x + (Math.random() - 0.5) * 8 * u, y + (Math.random() - 0.5) * 6 * u, size);
    }
  }
}
