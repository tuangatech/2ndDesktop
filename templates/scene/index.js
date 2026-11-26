// A scene is a folder: `scene.json` (what the host reads without running any code) and this file, whose default export
// `create(host)` returns the scene object. The contract is in app/page/host.js (the typedefs `SceneHost` and `Scene`);
// docs/platform/01 section 8 explains it. The rules a scene keeps:
//   - draw only through `host.app` (PixiJS): add nothing to the page, touch no DOM except `host.ui.root` (window mode);
//   - never read the clock (`host.clock.now()`; ESLint refuses `Date.now()`), never use `Math.random` (`host.rng`);
//   - save the record as it changes (`host.record.save`), because a scene switch does not ask for a last save (DEC-49);
//   - free everything in `dispose()`; every size must work (`resize`); desktop mode takes no clicks, so every action also
//     lives in `menuItems()`.
// `tests/e2e/contract.spec.js` runs every scene in `scenes/` through all of this: `npm run test:e2e`.
import { Container, Graphics } from 'pixi.js';
import { resetTaps, startState, tap } from './state.js';

const COLORS = [0x4f9d8f, 0xe0a458, 0xc8553d, 0x6c8ebf, 0x9a7fb5];
const SIZE = 64;

/**
 * @param {import('../../app/page/host.js').SceneHost} host
 * @returns {Promise<import('../../app/page/host.js').Scene>}
 */
export default async function create(host) {
  let state = startState(await host.record.load());
  host.record.save(state);

  const root = new Container();
  const background = new Graphics();
  const box = new Graphics();
  root.addChild(background, box);

  let width = 1;
  let height = 1;
  let target = null; // where the pointer is, or null when it left
  let visible = true;

  const colorOf = () => COLORS[state.taps % COLORS.length];
  const drawBox = () =>
    box
      .clear()
      .roundRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 12)
      .fill(colorOf());
  const change = (next) => {
    state = next;
    host.record.save(state);
    drawBox();
  };
  box.position.set(0, 0);
  drawBox();

  return {
    id: '__ID__',
    root,
    resize(w, h) {
      width = w;
      height = h;
      background.clear().rect(0, 0, w, h).fill(0x1b2a3a);
      if (!target) box.position.set(w / 2, h / 2);
    },
    // `dt` is in seconds. A scene that changes with the time of day computes it from `host.clock`, not from `dt`.
    update(dt) {
      const to = target ?? { x: width / 2, y: height / 2 };
      const ease = Math.min(1, dt * 6);
      box.position.set(box.x + (to.x - box.x) * ease, box.y + (to.y - box.y) * ease);
    },
    // False while nobody can see the scene (covered, locked, minimised); true again catches up.
    setVisible(value) {
      visible = value;
    },
    pointer(x, y) {
      target = x === null ? null : { x, y };
    },
    click() {
      change(tap(state)); // window mode only
    },
    status: () => ({
      line: `__NAME__ (started ${state.opened} ${state.opened === 1 ? 'time' : 'times'}, ${state.taps} taps)`,
      diagnostics: `__ID__, started ${state.opened}`,
    }),
    // Items of the tray menu; an item without an id is a greyed line. Everything a click does is here too.
    menuItems: () => [
      { id: 'tap', label: 'Tap' },
      { id: 'reset', label: 'Reset the taps', enabled: state.taps > 0 },
    ],
    onMenu(id) {
      if (id === 'tap') change(tap(state));
      else if (id === 'reset') change(resetTaps(state));
    },
    serialize: () => ({ ...state }),
    dispose() {
      root.destroy({ children: true });
    },
    debug: { state: () => ({ ...state }), isVisible: () => visible },
  };
}
