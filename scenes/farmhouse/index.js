// The farm house scene (docs/scenes/farmhouse.md). A stone house with a porch at the foot of a forested hill, seen
// through the real day, the season and the weather. This file is the scene's skeleton: the layers in their order, the
// fit to the screen, the record and the tray; the art of each layer is drawn by the steps that follow (P2 plan S4 to S7).
// Everything the scene shows is a function of the clock (R1), computed by the pure rules in `game/`.
import { Container, Graphics } from 'pixi.js';
import { canScatter, HAY, hayWeight, HERD } from './game/animals.js';
import { BARN } from './game/barn.js';
import { motionAt, slowAt } from './game/view.js';
import { DESIGN, coverFit, toDesign, visibleDesign } from './layout.js';
import { seen, startFast, startState, stopFast } from './state.js';
import { fastDate, monthOf } from './game/fast.js';
import { smooth } from './game/hash.js';

const hexNumber = (hex) => parseInt(hex.slice(1), 16);
import { farRidgePicture, hillPicture, midRidgePicture, skyPicture } from './art/landscape.js';
import { createAnimalView } from './animalView.js';
import { animalParts, coatKey, hayPicture, legKey, legPieces } from './art/animals.js';
import { BARN_DOOR, BARN_LANTERN, barnPicture } from './art/barn.js';
import { blend, skyColours, skyKey, timeOfDay, fallingAt } from './game/sky.js';
import { createWeatherView } from './weatherView.js';
import { createExtrasView } from './extrasView.js';
import { paletteKey } from './art/palette.js';
import {
  BACK_TREES,
  FRONT_TREES,
  backTreePicture,
  fencePicture,
  fieldPicture,
  frontTreePicture,
  lawnGroundPicture,
  treeKey,
} from './art/trees.js';
import { rasterize, spriteOf } from './art/raster.js';
import {
  CHIMNEY_TOP,
  DOOR_GLASS,
  GLASS,
  TRUCK,
  WINDOW_RECTS,
  drivePicture,
  housePicture,
  truckPicture,
} from './art/house.js';

/** The scene's own seed: the weather and the animals are the same on every machine and in every session. */
const SEED = 20261127;
/** The layers, back to front (docs/scenes/farmhouse.md section 5). The order does not change without a note. */
export const LAYERS = [
  'sky',
  'ridges',
  'forest',
  'lawn',
  'trees-back',
  'house',
  'trees-front',
  'drive-truck',
  'field',
  'fence',
  'animals',
  'weather',
  'grade',
];
/** How often the slow view (season, weather, lights) is worked out again, in clock milliseconds. */
const SLOW_MS = 1000;
/** The record is saved again at most this often when only the time moved. */
const SEEN_MS = 10 * 60 * 1000;

/** The snow on the roofs and the bushes changes in steps of a fifth. */
const snowStep = (cover) => Math.round(cover * 5);

const SEASON_LABEL = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

/**
 * @param {import('../../app/page/host.js').SceneHost} host
 * @returns {Promise<import('../../app/page/host.js').Scene>}
 */
export default async function create(host) {
  let state = startState(await host.record.load());
  host.record.save(state);

  const root = new Container();
  // The world is painted in the design space (layout.js) and scaled to cover the screen.
  const world = new Container();
  root.addChild(world);
  const layers = {};
  for (const name of LAYERS) {
    const layer = new Container();
    layer.label = `layer-${name}`;
    layers[name] = layer;
    world.addChild(layer);
  }
  let width = 1;
  let fit = coverFit(1, 1);
  let visible = true;
  let pointer = null;
  // A tray preview of a season or a kind of weather lasts for the session and is never saved.
  const preview = { season: null, kind: null };
  let hayStartedAt = null; // when "Scatter hay" was last used; lasts for the session, never saved
  let slow = null;
  let slowFor = -Infinity;
  let motion = null;
  let parts = null;
  let savedAt = -Infinity;

  // The scene's own "now": the host's clock, moved only by a test or a shot through `debug.setTime` (never in real use).
  let timeShift = 0;
  const now = () => host.clock.now() + timeShift;

  const latitude = () => host.place.get().latitude;
  // The red barn stands at the back of the field, at the left edge of what is on the screen (R13); its door is where the
  // animals go in. The screen's shape moves it, so it is placed on a resize, and the animals' door follows.
  let edgeLeft = visibleDesign(1, 1).left;
  const barnLeft = () => edgeLeft + BARN.inset;
  const barnDoor = () => [(barnLeft() + BARN.doorX) / DESIGN.width, BARN.doorDepth];
  /** The part of the field's width the animals keep out of: the strip of desktop icons (rule R6), in design shares. */
  const bounds = () => {
    // The animals keep to the part of the field that is on the screen (about an animal's length in from each side), and out of the
    // strip of desktop icons.
    const share = (screenX) => Math.max(0, Math.min(1, toDesign(fit, screenX, 0).x / DESIGN.width));
    const margin = 140 / DESIGN.width;
    let xMin = Math.min(0.4, share(0) + margin);
    let xMax = Math.max(0.6, share(width) - margin);
    const strip = host.safeArea.get().iconStrip;
    if (strip?.side === 'left') xMin = Math.max(xMin, share(strip.width));
    else if (strip) xMax = Math.min(xMax, share(width - strip.width));
    return { xMin, xMax };
  };

  // The pictures of the landscape (below): `ready` is set once the first ones are drawn.
  const art = {
    key: null,
    treeKeys: {},
    building: null,
    builds: 0,
    pieces: {},
    disposed: false,
    ready: false,
  };

  /** Works out the view of a moment: the slow part at most once a second of clock time, the motion every frame. */
  function refresh(force = false) {
    const ms = now();
    parts = host.time.parts(ms);
    if (force || slow === null || Math.abs(ms - slowFor) >= SLOW_MS) {
      slow = slowAt({
        ms,
        parts,
        sun: host.time.sun(ms),
        nightness: host.time.nightness(ms),
        latitude: latitude(),
        seed: SEED,
        previewSeason: preview.season,
        previewKind: preview.kind,
        fast: state.seasonMode === 'fast' ? fastDate(ms, state.fastStartedAt) : null,
      });
      slowFor = ms;
      if (art.ready) checkLandscape();
      if (state.lastWeather !== slow.weather.kind || ms - savedAt >= SEEN_MS) {
        state = seen(state, ms, slow.weather.kind);
        savedAt = ms;
        host.record.save(state);
      }
    }
    motion = motionAt(ms, parts, slow, {
      seed: SEED,
      hayStartedAt,
      bounds: bounds(),
      barn: { door: barnDoor() },
    });
  }
  refresh(true);

  // The lit windows: a warm glass over the dark glass of the house, drawn with its glow, its alpha the light of the window
  // (rule R3). Six small Graphics; nothing is drawn again.
  const lights = {};
  const lightOf = (r, bars) => {
    const g = new Graphics();
    g.roundRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 7).fill({ color: GLASS.lit, alpha: 0.18 });
    g.roundRect(r.x, r.y, r.w, r.h, 3).fill(GLASS.lit);
    if (bars) {
      g.rect(r.x, r.y + r.h * 0.42, r.w, r.h * 0.58).fill({ color: GLASS.litLow, alpha: 0.55 });
      g.rect(r.x + r.w / 2 - 1.5, r.y, 3, r.h).fill(0xefe9da);
      g.rect(r.x, r.y + r.h * 0.42, r.w, 3).fill(0xefe9da);
    }
    g.visible = false;
    layers.grade.addChild(g); // over the grade, so that the windows stay bright at night
    return g;
  };
  for (const [id, r] of Object.entries(WINDOW_RECTS)) lights[id] = lightOf(r, true);
  lights.door = lightOf(DOOR_GLASS, false);

  // The chimney smoke: six puffs that rise, drift and thin out, each on its own point of a nine-second cycle taken from
  // the clock; the amount (rule R4) is the alpha of them all.
  const SMOKE_PUFFS = 6;
  const SMOKE_CYCLE = 9;
  const smoke = new Container();
  smoke.visible = false;
  const puffs = [];
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const puff = new Graphics().circle(0, 0, 10).fill(0xe6e4dc);
    puffs.push(puff);
    smoke.addChild(puff);
  }
  layers.house.addChild(smoke);

  const truckBox = new Container(); // the truck, moved and mirrored by the scene
  layers['drive-truck'].addChild(truckBox);

  // The barn: its picture (in `barnBox`, under the animals) and, over the grade, the warm glow of its open door and its
  // lantern at night, with the light of the house's door lamp (rule R3: it stays on all night).
  const barnBox = new Container();
  layers.animals.addChild(barnBox);
  const barnGlow = new Container();
  barnGlow.visible = false;
  {
    const g = new Graphics();
    // The warm light inside: faint high up, stronger near the floor and the hay.
    g.rect(BARN_DOOR.x, BARN_DOOR.y, BARN_DOOR.w, BARN_DOOR.h * 0.55).fill({
      color: GLASS.lit,
      alpha: 0.08,
    });
    g.rect(BARN_DOOR.x, BARN_DOOR.y + BARN_DOOR.h * 0.55, BARN_DOOR.w, BARN_DOOR.h * 0.45).fill({
      color: GLASS.lit,
      alpha: 0.22,
    });
    g.roundRect(BARN_DOOR.x - 6, BARN_DOOR.y - 6, BARN_DOOR.w + 12, BARN_DOOR.h + 8, 8).fill({
      color: GLASS.lit,
      alpha: 0.12,
    });
    g.circle(BARN_LANTERN.x, BARN_LANTERN.y, 14).fill({ color: GLASS.lit, alpha: 0.09 });
    g.circle(BARN_LANTERN.x, BARN_LANTERN.y, 3.2).fill(GLASS.lit);
    barnGlow.addChild(g);
  }
  layers.grade.addChild(barnGlow);
  // The owl at the loft window, the weathervane and the breath of the animals in the cold (R16 to R18).
  const extras = createExtrasView({ layers, barnBox, fieldY: (depth) => fieldY(depth) });
  /** Puts the barn and its glow at the left edge of the screen. */
  function placeBarn() {
    const y = fieldY(BARN.depth);
    barnBox.position.set(barnLeft(), y);
    barnGlow.position.set(barnLeft(), y);
    extras.placeBarn(barnLeft(), y);
  }

  // The animals: one texture for each coat (five for seven animals), one box for each animal (placed, mirrored and scaled
  // by depth) holding a body that tilts to graze, and the hay under them.
  let weatherView = null; // made once the first pictures are drawn
  const herd = new Map(); // id -> the animal's view (animalView.js)
  const hay = { sprite: null, key: 'hay' };
  const animalTextures = new Map();
  const legTextures = new Map(); // legKey -> {far, near} of {thigh, shin}, each {texture, picture}
  const FIELD_Y = 690; // the fence line of the field and how far down it reaches (the concept's numbers)
  const FIELD_DEPTH = 185;
  const fieldY = (depth) => FIELD_Y + depth * FIELD_DEPTH;
  // The barn and the hay are the first two children of the animals' layer: the animals come after them.
  const UNDER_ANIMALS = 2;
  function placeAnimals(dt) {
    motion.animals.forEach((a, i) => {
      const view = herd.get(a.id);
      if (!view) return;
      const { box } = view;
      const x = a.x * DESIGN.width;
      const y = fieldY(a.depth);
      box.position.set(x, y);
      box.scale.set(a.scale * (a.facing === 'right' ? 1 : -1), a.scale);
      layers.animals.setChildIndex(box, UNDER_ANIMALS + i); // far ones first
      box.alpha = a.alpha; // 0 in the barn: faded in its door
      box.visible = a.alpha > 0.01;
      view.update(a, x, y, dt, now() / 1000); // the legs, the head, the ear, the tail
    });
    const w = hayWeight(now(), hayStartedAt);
    if (hay.sprite) {
      hay.sprite.visible = w > 0.01;
      hay.sprite.alpha = Math.min(1, w * 4);
    }
  }

  /** Puts the lights, the smoke and the truck where the view of this moment says. */
  let edgeX = DESIGN.width + 200;
  function applyMotion(dt = 0) {
    for (const [id, g] of Object.entries(lights)) {
      const light = slow.lights[id] ?? 0;
      g.visible = light > 0.01;
      g.alpha = light;
    }
    placeBarn();
    const doorLamp = slow.lights.door ?? 0;
    barnGlow.visible = doorLamp > 0.01;
    barnGlow.alpha = doorLamp;
    smoke.visible = motion.smoke > 0.01;
    if (smoke.visible) {
      const t = now() / 1000;
      puffs.forEach((puff, i) => {
        const k = (t / SMOKE_CYCLE + i / SMOKE_PUFFS) % 1;
        puff.position.set(
          CHIMNEY_TOP.x + k * 26 + Math.sin(k * 5 + i) * 5,
          CHIMNEY_TOP.y - 4 - k * 100,
        );
        puff.scale.set(0.5 + k * 1.3);
        puff.alpha = motion.smoke * 0.75 * Math.min(1, k * 5) * (1 - k);
      });
    }
    const truck = motion.truck;
    truckBox.visible = truck.visible;
    const centre = TRUCK.left + TRUCK.width / 2;
    truckBox.pivot.x = centre;
    truckBox.scale.x = truck.facing === 'right' ? -1 : 1;
    truckBox.position.set(TRUCK.x + centre + truck.x * (edgeX - TRUCK.x), TRUCK.y);
    placeAnimals(dt);
    extras.update({
      ms: now(),
      slow,
      parts,
      dayIndex: slow.when.dayIndex,
      seed: SEED,
      animals: motion.animals,
    });
    if (weatherView) {
      const ms = now();
      const petals = Math.max(0, ...Object.values(slow.trees).map((tree) => tree.petals));
      const tod = timeOfDay(ms, slow.sun, slow.nightness);
      // The far ridge is almost the colour of the haze, so by night it would stay pale against the dark sky: it goes dark
      // with the night, on top of the grade.
      if (art.pieces.far)
        art.pieces.far.tint = hexNumber(blend('#ffffff', '#4a5378', tod.night * 0.85));
      weatherView.update({
        ms,
        dt,
        slow,
        tod,
        falling: fallingAt(slow.weather, slow.season, slow.snowCover, petals),
        pointer: pointer ? toDesign(fit, pointer.x, pointer.y) : null,
      });
    }
  }
  applyMotion();

  // The pictures. Each one is painted from drawing operations (art/draw.js) and turned into one texture. The sky, the far
  // ridge, the drive and the truck are drawn once; what depends on the season or the snow (the two ridges, the hill, the
  // house, the grass and the fence) is drawn again when the palette has moved enough (paletteKey and snowStep), and each
  // tree when its own look has (treeKey); the old texture stays on screen until the new one is ready.
  const home = {
    sky: layers.sky,
    far: layers.ridges,
    mid: layers.ridges,
    hill: layers.forest,
    lawn: layers.lawn,
    house: layers.house,
    barn: barnBox,
    drive: layers['drive-truck'],
    truck: truckBox,
    field: layers.field,
    fence: layers.fence,
  };
  const trees = [
    ...BACK_TREES.map((tree) => ({ tree, name: 'tree-' + tree.id, layer: layers['trees-back'] })),
    ...FRONT_TREES.map((tree) => ({ tree, name: 'tree-' + tree.id, layer: layers['trees-front'] })),
  ];
  for (const t of trees) home[t.name] = t.layer;
  async function drawPiece(name, picture) {
    const texture = rasterize(picture, host.app.renderer);
    if (art.disposed) {
      texture.destroy(true);
      return;
    }
    const old = art.pieces[name];
    const sprite = spriteOf(picture, texture);
    home[name].addChild(sprite);
    if (name === 'mid') home.mid.setChildIndex(sprite, home.mid.children.length - 1);
    if (name === 'sky' || name === 'drive' || name === 'house' || name === 'field')
      home[name].setChildIndex(sprite, 0); // under the truck, the lights, the placeholders
    art.pieces[name] = sprite;
    if (old) {
      old.parent?.removeChild(old);
      old.destroy({ texture: true, textureSource: true });
    }
    art.builds++;
  }
  /** The five coat textures and the seven animals (drawn once: an animal only moves, it never changes). */
  function drawAnimals() {
    if (art.disposed) return;
    const hayPic = hayPicture();
    hay.sprite = spriteOf(hayPic, rasterize(hayPic, host.app.renderer));
    hay.sprite.position.set(HAY.spot[0] * DESIGN.width, fieldY(HAY.spot[1]));
    hay.sprite.visible = false;
    layers.animals.addChild(hay.sprite);
    art.builds++;
    for (const [i, spec] of HERD.entries()) {
      const key = coatKey(spec);
      if (!animalTextures.has(key)) {
        // The body, the head with the neck, the ear and the tail of a coat: four textures (three for a sheep).
        const parts = animalParts(spec.kind, spec.coat);
        const made = { joints: parts.joints };
        for (const part of ['body', 'head', 'ear', 'tail']) {
          if (!parts[part]) continue;
          made[part] = { picture: parts[part], texture: rasterize(parts[part], host.app.renderer) };
          art.builds++;
        }
        animalTextures.set(key, made);
      }
      const coat = animalTextures.get(key);
      // The pieces of the legs: an upper and a lower piece for each side, drawn once for each set (a horse's follow its coat).
      const lk = legKey(spec);
      const pieces = legPieces(spec.kind, spec.coat);
      if (!legTextures.has(lk)) {
        const made = {};
        for (const side of ['far', 'near']) {
          made[side] = {};
          for (const part of ['thigh', 'shin']) {
            made[side][part] = {
              picture: pieces[side][part],
              texture: rasterize(pieces[side][part], host.app.renderer),
            };
            art.builds++;
          }
        }
        legTextures.set(lk, made);
      }
      herd.set(
        spec.id,
        createAnimalView({
          spec,
          parent: layers.animals,
          body: coat.body,
          head: coat.head,
          ear: coat.ear,
          tail: coat.tail ?? null,
          joints: coat.joints,
          legs: legTextures.get(lk),
          phase: i * 0.31,
          seed: SEED,
          index: i,
        }),
      );
    }
  }
  /** What the pictures should look like now: the key of the palette group and of each tree. */
  const wanted = () => {
    const { season, snowCover } = slow;
    const key = paletteKey(season, snowCover) + '|' + snowStep(snowCover);
    const keys = {};
    for (const { tree, name } of trees) {
      const state = BACK_TREES.includes(tree) ? { ...season } : { ...slow.trees[tree.id] };
      keys[name] = BACK_TREES.includes(tree) ? key : treeKey(state, snowCover);
    }
    const tod = timeOfDay(slow.ms, slow.sun, slow.nightness);
    return { key, keys, sky: skyKey(tod, slow.weather), tod };
  };
  async function drawLandscape(all) {
    const { season, snowCover } = slow;
    const want = wanted();
    if (all || want.sky !== art.skyKey) {
      art.skyKey = want.sky;
      await drawPiece('sky', skyPicture(skyColours(want.tod, slow.weather)));
    }
    if (all) {
      await drawPiece('far', farRidgePicture());
      await drawPiece('drive', drivePicture());
      await drawPiece('truck', truckPicture());
      drawAnimals();
    }
    if (all || want.key !== art.key) {
      art.key = want.key;
      await drawPiece('mid', midRidgePicture(season, snowCover));
      await drawPiece('hill', hillPicture(season, snowCover));
      await drawPiece('lawn', lawnGroundPicture(season, snowCover));
      await drawPiece('house', housePicture(snowCover));
      await drawPiece('barn', barnPicture(snowCover));
      await drawPiece('field', fieldPicture(season, snowCover));
      await drawPiece('fence', fencePicture(season, snowCover));
    }
    for (const { tree, name } of trees) {
      if (!all && art.treeKeys[name] === want.keys[name]) continue;
      art.treeKeys[name] = want.keys[name];
      await drawPiece(
        name,
        BACK_TREES.includes(tree)
          ? backTreePicture(tree, season, snowCover)
          : frontTreePicture(tree, slow.trees[tree.id], snowCover),
      );
    }
  }
  await drawLandscape(true);
  weatherView = createWeatherView({ renderer: host.app.renderer, layers, seed: SEED });
  art.ready = true;
  applyMotion(); // the animals are in their places from the first frame
  /** Whether every picture shows what the view of this moment asks for. */
  function landscapeCurrent() {
    const want = wanted();
    return (
      want.key === art.key &&
      want.sky === art.skyKey &&
      trees.every(({ name }) => art.treeKeys[name] === want.keys[name])
    );
  }
  /** Called once a second: draws again what has moved enough. */
  function checkLandscape() {
    if (art.building || art.disposed || landscapeCurrent()) return;
    art.building = drawLandscape(false)
      .catch((error) =>
        host.log('farmhouse: the landscape was not drawn again: ' + (error?.message ?? error)),
      )
      .finally(() => {
        art.building = null;
      });
  }

  // A change of the season setting or of a preview is a slow dip into the colour of the fog and back, so there is no cut:
  // the veil comes in over 0.6 seconds, the change is made under it, the pictures are drawn again, and the veil goes out
  // over 1.2 seconds. (A cosmetic fade of the frame time; what the scene shows is still a function of the clock.)
  const veil = new Graphics().rect(0, 0, DESIGN.width, DESIGN.height).fill(0xdcdad0);
  veil.alpha = 0;
  veil.visible = false;
  layers.grade.addChild(veil);
  const dip = { phase: 'idle', t: 0, from: 0, apply: null };
  const VEIL_IN = 0.6;
  const VEIL_OUT = 1.2;
  function changeWithDip(apply) {
    dip.apply = apply;
    if (dip.phase !== 'out') {
      dip.phase = 'out';
      dip.t = 0;
      dip.from = veil.alpha;
    }
    veil.visible = true;
  }
  function stepDip(dt) {
    if (dip.phase === 'idle') return;
    dip.t += dt;
    if (dip.phase === 'out') {
      veil.alpha = dip.from + (1 - dip.from) * smooth(dip.t / VEIL_IN);
      if (dip.t < VEIL_IN) return;
      dip.apply?.();
      dip.apply = null;
      refresh(true);
      applyMotion();
      checkLandscape();
      dip.phase = 'wait';
    }
    if (dip.phase === 'wait') {
      // Held at full veil until the pictures show the new look.
      veil.alpha = 1;
      if (art.building || !landscapeCurrent()) {
        checkLandscape();
        return;
      }
      dip.phase = 'in';
      dip.t = 0;
    }
    if (dip.phase === 'in') {
      veil.alpha = 1 - smooth(dip.t / VEIL_OUT);
      if (dip.t >= VEIL_OUT) {
        dip.phase = 'idle';
        veil.visible = false;
        veil.alpha = 0;
      }
    }
  }

  const SEASON_CYCLE = [null, 'spring', 'summer', 'autumn', 'winter'];
  const KIND_CYCLE = [null, 'clear', 'cloudy', 'fog', 'rain', 'snow', 'storm'];
  const nextOf = (cycle, current) => cycle[(cycle.indexOf(current) + 1) % cycle.length];
  const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);
  const cycleLabel = (what, cycle, current) => {
    const next = nextOf(cycle, current);
    return `${what}: ${current ? cap(current) : 'off'} (next: ${next ? cap(next) : 'back to the setting'})`;
  };

  // Scatter hay is for the day (R12): at night and in a storm the animals are in the barn.
  const hayReady = () => slow.hayAllowed && canScatter(now(), hayStartedAt);

  return {
    id: 'farmhouse',
    root,
    resize(w, h) {
      width = w;
      edgeX = visibleDesign(w, h).right + 200; // the truck leaves the screen to the right
      edgeLeft = visibleDesign(w, h).left; // the barn stands at the left edge
      fit = coverFit(w, h);
      world.scale.set(fit.scale);
      world.position.set(fit.x, fit.y);
    },
    // The scene is a function of the clock: nothing is added up here (the host does not cap `dt` for us).
    update(dt = 0) {
      stepDip(Math.min(dt, 0.1));
      refresh();
      applyMotion(Math.min(dt, 0.1));
    },
    setVisible(value) {
      visible = value;
    },
    // After a pause the scene is right at once: the view is worked out again from the clock.
    resume() {
      refresh(true);
      applyMotion();
    },
    pointer(x, y) {
      pointer = x === null ? null : { x, y };
    },
    click() {},
    status: () => {
      const season = SEASON_LABEL[slow.season.name];
      const fastNote =
        state.seasonMode === 'fast' && !preview.season
          ? ` (Fast: ${monthOf(slow.when.dayOfYear)})`
          : '';
      return {
        line: `${season}${fastNote}, ${slow.weather.kind}, ${Math.round(slow.weather.temperature)} °C (simulated weather)`,
        diagnostics: `farmhouse, ${slow.season.name}, ${slow.weather.kind}, ${state.seasonMode}, opened ${state.opened}`,
      };
    },
    // Flat items only (docs/platform/01): the cycles stand for the radio lists of docs/scenes/farmhouse.md section 3.
    menuItems: () => [
      {
        id: 'hay',
        label: hayReady()
          ? 'Scatter hay'
          : slow.hayAllowed
            ? 'Scatter hay (wait a moment)'
            : 'Scatter hay (the animals are in the barn)',
        enabled: hayReady(),
      },
      { label: 'Weather: simulated' },
      {
        id: 'seasons',
        label:
          state.seasonMode === 'fast'
            ? `Seasons: Fast, ${monthOf(slow.when.dayOfYear)} (switch to Calendar)`
            : 'Seasons: Calendar (switch to Fast)',
      },
      { id: 'preview-season', label: cycleLabel('Preview season', SEASON_CYCLE, preview.season) },
      { id: 'preview-weather', label: cycleLabel('Preview weather', KIND_CYCLE, preview.kind) },
    ],
    onMenu(id) {
      if (id === 'hay' && hayReady()) hayStartedAt = now();
      else if (id === 'seasons') {
        const toFast = state.seasonMode !== 'fast';
        changeWithDip(() => {
          state = toFast ? startFast(state, host.clock.now()) : stopFast(state);
          host.record.save(state);
        });
      } else if (id === 'preview-season') {
        const next = nextOf(SEASON_CYCLE, preview.season);
        changeWithDip(() => {
          preview.season = next;
        });
      } else if (id === 'preview-weather') {
        const next = nextOf(KIND_CYCLE, preview.kind);
        changeWithDip(() => {
          preview.kind = next;
        });
      }
    },
    serialize: () => ({ ...state }),
    dispose() {
      art.disposed = true;
      root.destroy({ children: true, texture: true, textureSource: true });
    },
    debug: {
      state: () => ({ ...state }),
      view: () => ({ slow, motion, parts }),
      layers: () => LAYERS.slice(),
      fit: () => ({ ...fit }),
      hay: () => ({ startedAt: hayStartedAt, eatSeconds: HAY.eat }),
      isVisible: () => visible,
      // For tests and measurements: draw every picture again now, and how many pictures have been drawn.
      rebuild: async () => {
        await art.building;
        await drawLandscape(true);
      },
      // For tests and shots: pin a season and/or a kind of weather (null to let go), settled at once.
      preview: (next = {}) => {
        preview.season = next.season ?? null;
        preview.kind = next.kind ?? null;
        refresh(true);
        applyMotion();
        if (art.ready) checkLandscape();
        return art.building;
      },
      // For tests and shots: show the scene as it is at another moment (epoch ms; null to let go), settled at once.
      setTime: (ms = null) => {
        timeShift = ms === null ? 0 : ms - host.clock.now();
        refresh(true);
        applyMotion();
        if (art.ready) checkLandscape();
        return art.building;
      },
      dip: () => ({ phase: dip.phase, alpha: veil.alpha }),
      settle: async () => {
        await art.building;
      },
      art: () => ({ builds: art.builds, key: art.key, treeKeys: { ...art.treeKeys } }),
      // What is on show now: the alpha of each lit window, the smoke, and the truck.
      shown: () => ({
        lights: Object.fromEntries(
          Object.entries(lights).map(([id, g]) => [id, g.visible ? g.alpha : 0]),
        ),
        smoke: smoke.visible ? motion.smoke : 0,
        weather: weatherView?.debug(),
        hay: hay.sprite?.visible ? hay.sprite.alpha : 0,
        animals: [...herd].map(([id, v]) => ({
          id,
          x: v.box.position.x,
          y: v.box.position.y,
          scale: v.box.scale.y,
          alpha: v.box.visible ? v.box.alpha : 0,
        })),
        extras: extras.debug(),
        barn: {
          x: barnBox.position.x,
          y: barnBox.position.y,
          door: barnDoor(),
          glow: barnGlow.visible ? barnGlow.alpha : 0,
        },
        truck: {
          visible: truckBox.visible,
          x: truckBox.position.x,
          mirrored: truckBox.scale.x < 0,
        },
      }),
      pointer: () => pointer,
    },
  };
}
