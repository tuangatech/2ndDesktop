import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { seededRandomScript } from '../../../scripts/seeded-random.mjs';
import { launch } from '../../../tests/e2e/helpers.js';

// The golden state hash (platform plan D49): the gate for moving the tank into `scenes/fishtank/` (Step 1). With a
// fixed seed, the manual clock and a seeded Math.random, a scripted session is run (collect, drop three pellets, Feed
// everyone, six hours pass, hatch an egg if one is waiting) and the scene is stepped 900 more times (30 seconds of
// 1/30). Two hashes are taken: one of the saved state and the actions' results (without the time stamps, which follow
// the real clock) and one of the whole scene graph (the PixiJS type, position, scale, rotation, alpha and visibility
// of every node, rounded to 0.01). A change that is meant to alter the look or the numbers of the tank changes the
// hashes: run
//   GOLDEN_UPDATE=1 npx playwright test scenes/fishtank/tests/golden.spec.js
// and paste the printed values below in the same commit, saying why. A move of files or a change of the host must
// not change them. If a hash fails for no reason you know, GOLDEN_DUMP=run1.json and then run2.json write what was
// hashed, so the two runs can be compared.
const STEPS = 900;
const GOLDEN = {
  // 2026-11-28 (DEC-71, fish have no names): the state hash changed from 784820e6e804d032 because every fish lost its
  // `name: null` field. Checked: putting `name: null` back after `seed` in the dump of a run gives the old hash exactly.
  // The graph hash did not move.
  // 2026-11-28 (DEC-71, no fullness): the state hash changed again, from 7be7c96f8e2607bc to ed0f26e9232cd6f0. Checked with
  // GOLDEN_DUMP on both builds: the two dumps are identical once the keys fullness, fullnessUpdatedAt, mealsAt, hungry,
  // allFull and canFeed are removed from them, and the scene graph is identical. The time stamps of the meals (mealsAt)
  // are in TIME_KEYS below, because they follow the real clock.
  state: 'ed0f26e9232cd6f0',
  // 2026-11-22: the graph hash changed (the state hash did not) when the far reef (scenes/fishtank/backdrop.js) and the
  // back-row haze layer were added: more nodes under `background` and `water`, and the back decor has no alpha of its own.
  graph: '5be771c4e5cb12a9',
};

const snapshot = `(steps) => {
  const { fishtank, scene, repository, clock } = window.__scene;
  const step = (seconds) => {
    for (let t = 0; t < seconds; t += 1 / 30) fishtank.update(1 / 30);
  };
  // A scripted session first, so that the rules and the repository are touched, not only the swimming: collect the
  // floating pellets, drop three, Feed everyone, let six hours pass, hatch an egg if one is waiting.
  const trace = {};
  trace.collected = scene.collectAll();
  step(3);
  const { width, height } = scene.layout;
  trace.drops = [0.3, 0.5, 0.7].map((fx) => scene.dropAt(width * fx, height * 0.3).ok);
  step(10);
  scene.startFeeding();
  step(60);
  clock.offset += 6 * 60 * 60 * 1000;
  step(5);
  trace.summary = scene.getSummary();
  if (trace.summary.eggs > 0) trace.hatched = scene.hatch();
  step(5);
  step(steps);
  const r = (v) => Math.round(v * 100) / 100;
  const graph = [];
  const walk = (node, depth) => {
    // renderPipeId is the stable PixiJS type of a node ('sprite', 'graphics', 'mesh', ...; a plain container has none).
    // constructor.name is not: in the built app it is the minifier's name and changes with any code in the bundle.
    graph.push([depth, node.renderPipeId ?? 'container', r(node.x), r(node.y), r(node.scale.x), r(node.scale.y),
      r(node.rotation), r(node.alpha), node.visible ? 1 : 0, node.children.length]);
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(scene.root, 0);
  // Game numbers are integers and are compared exactly; floats are rounded to 0.01.
  // The time stamps follow the real clock and differ from run to run; they are listed by name, so that a new game
  // field is never dropped by accident.
  const TIME_KEYS = ['createdAt', 'mealsAt', 'pelletsUpdatedAt', 'lastFedAt', 'savedAt'];
  const strip = (value) => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).filter(([key]) => !TIME_KEYS.includes(key)).map(([key, v]) => [key, strip(v)]),
      );
    }
    return typeof value === 'number' ? r(value) : value;
  };
  return { graph, state: { record: strip(repository.getState()), trace: strip(trace) } };
}`;

const sha = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

test('the tank after a scripted session has the same state and scene graph as before (golden hash)', async () => {
  const { page, close } = await launch();
  try {
    // The seeded random numbers must be there before the page starts, so the page is started again.
    await page.addInitScript(seededRandomScript());
    await page.reload();
    await page.waitForFunction(() => window.__ready === true);
    const out = await page.evaluate(`(${snapshot})(${STEPS})`);
    const actual = { state: sha(out.state), graph: sha(out.graph) };
    // To see what differs between two runs: GOLDEN_DUMP=run1.json, then again with run2.json, and compare the files.
    if (process.env.GOLDEN_DUMP)
      fs.writeFileSync(process.env.GOLDEN_DUMP, JSON.stringify(out, null, 1));
    if (process.env.GOLDEN_UPDATE) {
      console.log(`GOLDEN = ${JSON.stringify(actual)} (${out.graph.length} nodes)`);
      return;
    }
    expect(actual).toEqual(GOLDEN);
  } finally {
    await close();
  }
});
