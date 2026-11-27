// The one entry point of the fish tank (decisions D33, D50): the host calls `create(host)` and gets back a scene that
// follows the contract in app/page/host.js. Everything outside this folder talks to the tank through it: the host
// knows nothing of pellets, fish or the tank's tuning.
import { TankScene } from './view/TankScene.js';
import { createLocalRepository } from './game/repo/LocalTankRepository.js';
import { applyTuning, config as baseConfig } from './game/config.js';
import { createHud } from './ui/hud.js';
import { createDevPanel } from './ui/devPanel.js';
import { menuItems, statusLine } from './menu.js';
import { defineSounds } from './sounds.js';
import decorData from './data/decor.json';
import speciesData from './data/species.json';

export const FISHTANK_ID = 'fishtank';

/**
 * @param {import('../../app/page/host.js').SceneHost} host
 * @returns {Promise<import('../../app/page/host.js').Scene>}
 */
export default async function create(host) {
  const { config } = applyTuning(baseConfig, host.tuning ?? undefined);
  const art = { textures: host.art.textures, decor: decorData, species: speciesData };
  const speciesIds = Object.keys(art.species);
  const repository = createLocalRepository({
    storage: host.record,
    clock: host.clock,
    rng: host.rng,
    config,
    speciesIds,
  });
  await repository.load();
  const { problem, fixes } = repository.status;
  if (problem) host.log(`record: ${problem}${fixes.length ? ` (${fixes.join(', ')})` : ''}`);
  const scene = new TankScene(art, repository, config);
  if (host.sound) scene.sound = host.sound;
  defineSounds(host.sound);

  // Measurements only (DESKTOP2_SCENE_OPTIONS='{"fish":8}'): a tank of mixed species and stages that is never saved.
  const fishCount = host.options?.fish ?? 0;
  if (fishCount) {
    repository.dev.freeze();
    repository.dev.setFish(
      Array.from({ length: fishCount }, (_, i) => ({
        species: speciesIds[i % speciesIds.length],
        seed: 7101 + i,
        points: 80 + ((i * 67) % 340),
      })),
    );
  }

  // The first-launch hint (spec section 8) stays until the first successful feed, whichever way it was done.
  const markHint = () => {
    const { tank } = repository.getState();
    if (!tank.hintShown && tank.totalFed > 0) repository.markHintShown();
  };
  repository.subscribe(markHint);
  markHint();

  // Window mode has HTML over the canvas (D7); desktop mode shows none (D31).
  let hud = null;
  let aimCollect = () => {};
  if (host.mode === 'window' && host.ui?.root) {
    hud = createHud({ scene, repository, config, root: host.ui.root });
    aimCollect = () => scene.setCollectTarget(hud.stashTarget());
    aimCollect();
    if (problem === 'damaged') scene.say('The saved tank was damaged, so a new one was started');
    // A repair is quiet unless the player could notice it: a fish that was dropped or changed species.
    if (problem === 'repaired' && fixes.some((fix) => /dropped|species|no fish/.test(fix))) {
      scene.say('Part of the saved tank could not be read, so it was repaired');
    }
    if (problem === 'newer')
      scene.say('This tank was saved by a newer version. Changes are not saved');
    if (host.options?.dev) {
      createDevPanel({ scene, repository, clock: host.clock, speciesIds });
    }
  }

  // The tray menu's actions (D28, FR-62). Each one ends in the same repository calls as a click.
  const actions = {
    collect: () => scene.collectAll(),
    feed: () => scene.feedOne(),
    feedUntilFull: () => scene.startFeeding(),
    stopFeeding: () => scene.stopFeeding(),
    hatch: () => scene.hatch(),
  };

  return {
    id: FISHTANK_ID,
    root: scene.root,
    resize: (width, height) => {
      scene.resize(width, height);
      aimCollect();
    },
    update: (dt) => {
      scene.update(dt);
      hud?.update();
    },
    setVisible: (visible) => scene.setVisible(visible),
    // The pointer is over the scene at (x, y); `pointer(null)` says it left.
    pointer: (x, y) => (x == null ? scene.clearPointer() : scene.setPointer(x, y)),
    // Window mode only: a click goes to an egg or pellet, then a fish, then the water (FR-46).
    click: (x, y) => scene.click(x, y),
    // One line for the tray and one for the diagnostics text (nothing personal in either).
    status: () => {
      const summary = scene.getSummary();
      const fed = repository.getState().tank.totalFed;
      return {
        line: statusLine(summary),
        diagnostics: `Fish: ${summary.fishCount}, pellets fed in total: ${Number.isFinite(fed) ? fed : 'n/a'}`,
      };
    },
    menuItems: () => menuItems(scene.getSummary()),
    onMenu: (id) => actions[id]?.(),
    serialize: () => repository.getState(),
    dispose: () => scene.destroy(),
    // For tests and measurements (`window.__scene` with `?debug=1`): the tank's own objects.
    debug: { scene, repository },
  };
}
