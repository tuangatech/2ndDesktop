// The farm house scene (docs/scenes/farmhouse.md). A stone house with a porch at the foot of a forested hill, seen
// through the real day, the season and the weather. This file is the scene's skeleton: the layers in their order, the
// fit to the screen, the record and the tray; the art of each layer is drawn by the steps that follow (P2 plan S4 to S7).
// Everything the scene shows is a function of the clock (R1), computed by the pure rules in `game/`.
import { Container, Graphics } from 'pixi.js';
import { canScatter, HAY } from './game/animals.js';
import { motionAt, slowAt } from './game/view.js';
import { DESIGN, coverFit, toDesign, visibleDesign } from './layout.js';
import { seen, startState } from './state.js';
import { farRidgePicture, hillPicture, midRidgePicture, skyPicture } from './art/landscape.js';
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
  let hayStartedAt = null; // when "Scatter hay" was last used; lasts for the session, never saved
  let slow = null;
  let slowFor = -Infinity;
  let motion = null;
  let parts = null;
  let savedAt = -Infinity;

  const latitude = () => host.place.get().latitude;
  /** The part of the field's width the animals keep out of: the strip of desktop icons (rule R6), in design shares. */
  const bounds = () => {
    const strip = host.safeArea.get().iconStrip;
    if (!strip) return { xMin: 0, xMax: 1 };
    const share = (screenX) => Math.max(0, Math.min(1, toDesign(fit, screenX, 0).x / DESIGN.width));
    return strip.side === 'left'
      ? { xMin: share(strip.width), xMax: 1 }
      : { xMin: 0, xMax: share(width - strip.width) };
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
    const ms = host.clock.now();
    parts = host.time.parts(ms);
    if (force || slow === null || Math.abs(ms - slowFor) >= SLOW_MS) {
      slow = slowAt({
        ms,
        parts,
        sun: host.time.sun(ms),
        nightness: host.time.nightness(ms),
        latitude: latitude(),
        seed: SEED,
      });
      slowFor = ms;
      if (art.ready) checkLandscape();
      if (state.lastWeather !== slow.weather.kind || ms - savedAt >= SEEN_MS) {
        state = seen(state, ms, slow.weather.kind);
        savedAt = ms;
        host.record.save(state);
      }
    }
    motion = motionAt(ms, parts, slow, { seed: SEED, hayStartedAt, bounds: bounds() });
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
    layers.house.addChild(g);
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

  /** Puts the lights, the smoke and the truck where the view of this moment says. */
  let edgeX = DESIGN.width + 200;
  function applyMotion() {
    for (const [id, g] of Object.entries(lights)) {
      const light = slow.lights[id] ?? 0;
      g.visible = light > 0.01;
      g.alpha = light;
    }
    smoke.visible = motion.smoke > 0.01;
    if (smoke.visible) {
      const t = host.clock.now() / 1000;
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
    if (name === 'drive' || name === 'house' || name === 'field')
      home[name].setChildIndex(sprite, 0); // under the truck, the lights, the placeholders
    art.pieces[name] = sprite;
    if (old) {
      old.parent?.removeChild(old);
      old.destroy({ texture: true, textureSource: true });
    }
    art.builds++;
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
    return { key, keys };
  };
  async function drawLandscape(all) {
    const { season, snowCover } = slow;
    const now = wanted();
    if (all) {
      await drawPiece('sky', skyPicture());
      await drawPiece('far', farRidgePicture());
      await drawPiece('drive', drivePicture());
      await drawPiece('truck', truckPicture());
    }
    if (all || now.key !== art.key) {
      art.key = now.key;
      await drawPiece('mid', midRidgePicture(season, snowCover));
      await drawPiece('hill', hillPicture(season, snowCover));
      await drawPiece('lawn', lawnGroundPicture(season, snowCover));
      await drawPiece('house', housePicture(snowCover));
      await drawPiece('field', fieldPicture(season, snowCover));
      await drawPiece('fence', fencePicture(season, snowCover));
    }
    for (const { tree, name } of trees) {
      if (!all && art.treeKeys[name] === now.keys[name]) continue;
      art.treeKeys[name] = now.keys[name];
      await drawPiece(
        name,
        BACK_TREES.includes(tree)
          ? backTreePicture(tree, season, snowCover)
          : frontTreePicture(tree, slow.trees[tree.id], snowCover),
      );
    }
  }
  await drawLandscape(true);
  art.ready = true;
  /** Called once a second: draws again what has moved enough. */
  function checkLandscape() {
    if (art.building || art.disposed) return;
    const now = wanted();
    if (now.key === art.key && trees.every(({ name }) => art.treeKeys[name] === now.keys[name])) {
      return;
    }
    art.building = drawLandscape(false)
      .catch((error) =>
        host.log('farmhouse: the landscape was not drawn again: ' + (error?.message ?? error)),
      )
      .finally(() => {
        art.building = null;
      });
  }

  const hayReady = () => canScatter(host.clock.now(), hayStartedAt);

  return {
    id: 'farmhouse',
    root,
    resize(w, h) {
      width = w;
      edgeX = visibleDesign(w, h).right + 200; // the truck leaves the screen to the right
      fit = coverFit(w, h);
      world.scale.set(fit.scale);
      world.position.set(fit.x, fit.y);
    },
    // The scene is a function of the clock: nothing is added up here (the host does not cap `dt` for us).
    update() {
      refresh();
      applyMotion();
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
      return {
        line: `${season}, ${slow.weather.kind}, ${Math.round(slow.weather.temperature)} °C (simulated weather)`,
        diagnostics: `farmhouse, ${slow.season.name}, ${slow.weather.kind}, opened ${state.opened}`,
      };
    },
    menuItems: () => [
      {
        id: 'hay',
        label: hayReady() ? 'Scatter hay' : 'Scatter hay (wait a moment)',
        enabled: hayReady(),
      },
    ],
    onMenu(id) {
      if (id === 'hay' && hayReady()) hayStartedAt = host.clock.now();
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
      art: () => ({ builds: art.builds, key: art.key, treeKeys: { ...art.treeKeys } }),
      // What is on show now: the alpha of each lit window, the smoke, and the truck.
      shown: () => ({
        lights: Object.fromEntries(
          Object.entries(lights).map(([id, g]) => [id, g.visible ? g.alpha : 0]),
        ),
        smoke: smoke.visible ? motion.smoke : 0,
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
