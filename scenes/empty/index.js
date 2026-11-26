// The empty scene (P1, work package 7.2): one flat colour, no art, no sound, and a record that counts how many times it
// was started. It is the baseline for measurements (the cost of the host with nothing drawn) and the second scene that
// the switch of 7.4 is tested with ("both records are kept"). `dev: true` in scene.json keeps it out of a release.
import { Container, Graphics } from 'pixi.js';
import { nextRecord } from './state.js';

export const EMPTY_ID = 'empty';
const COLOR = 0x1b2a3a;

/**
 * @param {import('../../app/page/host.js').SceneHost} host
 * @returns {Promise<import('../../app/page/host.js').Scene>}
 */
export default async function create(host) {
  const state = nextRecord(await host.record.load());
  host.record.save(state);

  const root = new Container();
  const fill = new Graphics();
  root.addChild(fill);
  let visible = true;

  return {
    id: EMPTY_ID,
    root,
    resize(width, height) {
      fill.clear().rect(0, 0, width, height).fill(COLOR);
    },
    update() {},
    setVisible(value) {
      visible = value;
    },
    pointer() {},
    click() {},
    status: () => ({
      line: `Empty scene (started ${state.opened} ${state.opened === 1 ? 'time' : 'times'})`,
      diagnostics: `empty scene, started ${state.opened}`,
    }),
    menuItems: () => [],
    onMenu() {},
    serialize: () => ({ ...state }),
    dispose() {
      root.destroy({ children: true });
    },
    debug: { state: () => ({ ...state }), isVisible: () => visible },
  };
}
