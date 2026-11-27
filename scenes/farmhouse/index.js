// The farm house scene (docs/scenes/farmhouse.md). A stone house with a porch at the foot of a forested hill, seen
// through the real day, the season and the weather. This file is the scene's skeleton: the layers in their order, the
// fit to the screen, the record and the tray; the art of each layer is drawn by the steps that follow (P2 plan S4 to S7).
// Everything the scene shows is a function of the clock (R1), computed by the pure rules in `game/`.
import { Container, Graphics } from 'pixi.js';
import { canScatter, HAY } from './game/animals.js';
import { motionAt, slowAt } from './game/view.js';
import { DESIGN, coverFit, toDesign } from './layout.js';
import { seen, startState } from './state.js';

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
  // A plain sky and field until the art arrives (S4 onwards replace these two shapes).
  const sky = new Graphics().rect(0, 0, DESIGN.width, 560).fill(0xaec6d4);
  const field = new Graphics().rect(0, 560, DESIGN.width, DESIGN.height - 560).fill(0x7fa35a);
  layers.sky.addChild(sky);
  layers.field.addChild(field);

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
      if (state.lastWeather !== slow.weather.kind || ms - savedAt >= SEEN_MS) {
        state = seen(state, ms, slow.weather.kind);
        savedAt = ms;
        host.record.save(state);
      }
    }
    motion = motionAt(ms, parts, slow, { seed: SEED, hayStartedAt, bounds: bounds() });
  }
  refresh(true);

  const hayReady = () => canScatter(host.clock.now(), hayStartedAt);

  return {
    id: 'farmhouse',
    root,
    resize(w, h) {
      width = w;
      fit = coverFit(w, h);
      world.scale.set(fit.scale);
      world.position.set(fit.x, fit.y);
    },
    // The scene is a function of the clock: nothing is added up here (the host does not cap `dt` for us).
    update() {
      refresh();
    },
    setVisible(value) {
      visible = value;
    },
    // After a pause the scene is right at once: the view is worked out again from the clock.
    resume() {
      refresh(true);
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
      root.destroy({ children: true });
    },
    debug: {
      state: () => ({ ...state }),
      view: () => ({ slow, motion, parts }),
      layers: () => LAYERS.slice(),
      fit: () => ({ ...fit }),
      hay: () => ({ startedAt: hayStartedAt, eatSeconds: HAY.eat }),
      isVisible: () => visible,
      pointer: () => pointer,
    },
  };
}
