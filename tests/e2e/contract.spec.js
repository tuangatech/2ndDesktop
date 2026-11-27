import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { readSceneManifests } from '../../app/main/scene-registry.js';
import { launch, makeDataDir } from './helpers.js';

// The contract test (docs/platform/01 section 12; work package 8.2): every folder in `scenes/` is created, driven and
// disposed the way the host does it, and must leave nothing behind. It runs in the real page (WebGL), once per scene:
// the app is started with that scene, and the page makes a second instance of it with a host of the test's own (its
// own record, clock and sound), so the instance that runs the app is not touched.
//
// What it checks, for window mode and again for desktop mode (the pointer comes from the main process, there is no click
// and no HTML area):
//   - create, resize to four sizes (FR-63: every size must work), 600 updates with the pointer moving, a click (window
//     mode), the tray lines (`status`, `menuItems`, an unknown menu id), a pause and a resume after an hour;
//   - `serialize()` gives plain data: what JSON keeps is equal to what was returned;
//   - a record that the scene saved through `host.record.save` is read by a second instance of the scene, which then runs;
//   - after `dispose()` the stage and the ticker are as they were; five more cycles of create, run and dispose leave the
//     live textures where the first cycle left them (PixiJS keeps a few textures of its own after the first draw, and its
//     list of managed textures keeps a hole for each destroyed one, so only the live ones are counted);
//   - 30 more resizes do not add textures (a gradient texture made again on every resize leaked memory in the tank);
//   - `update()` takes less than a frame (the 95th percentile is printed; the budgets of `01` section 11 are measured
//     with `npm run measure:switch`, not here, because a CI runner has no real GPU).
// `resume(gapMs)` is optional in the contract (01 section 8): a scene without it is resumed with nothing to call.
// Run it with `npm run test:e2e` (it builds first); a direct `npx playwright test` needs `npm run build` before it.
// Not checked yet: that a scene paused for an hour and resumed has the same state as one that ran the hour (the scenes
// of today do not change with the clock; the farm house will, and gets the check with it), and the capabilities (none
// exist before 0.4).
const { scenes } = readSceneManifests(path.join(import.meta.dirname, '..', '..', 'scenes'));

/** Runs in the page. Returns what happened; the test judges it. */
async function runContract({ id, sizes, extraResizes }) {
  const { app, host, create } = window.__scene;
  const problems = [];
  const attempt = async (what, fn) => {
    try {
      return await fn();
    } catch (error) {
      problems.push(
        `${what}: ${String(error?.stack ?? error)
          .split('\n')
          .slice(0, 3)
          .join(' | ')}`,
      );
      return undefined;
    }
  };
  const counts = () => ({
    stage: app.stage.children.length,
    ticker: app.ticker.count,
    textures: app.renderer.texture.managedTextures.filter(Boolean).length, // destroyed ones leave holes
  });
  const frames = (n) => new Promise((resolve) => requestAnimationFrame(() => resolve(n)));
  const same = (a, b) => {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((key) => same(a[key], b[key]));
  };

  const report = { id, problems, modes: {} };
  const start = counts();
  report.start = start;

  for (const mode of ['window', 'desktop']) {
    const result = { updateMs: [] };
    report.modes[mode] = result;
    let now = Date.now();
    let saved = null;
    const makeHost = () => ({
      ...host,
      mode,
      clock: { now: () => now },
      record: {
        load: async () =>
          saved ? { status: 'ok', data: structuredClone(saved) } : { status: 'missing' },
        save: (data) => {
          saved = structuredClone(data);
        },
        keepCopy() {},
      },
      sound: { define: () => true, play: () => false },
      ui: { root: mode === 'window' ? document.createElement('div') : null },
      options: { ...host.options, dev: false },
      log() {},
    });

    const scene = await attempt(`${mode}: create`, () => create(makeHost()));
    if (!scene) continue;
    app.stage.addChild(scene.root);
    result.idMatches = scene.id === id;

    // Four sizes, then the pointer and 600 updates (twenty seconds at 30 a second).
    for (const [w, h] of sizes) {
      await attempt(`${mode}: resize ${w}x${h}`, () => {
        scene.resize(w, h);
        scene.update(1 / 30);
      });
    }
    result.afterSizes = counts();
    await attempt(`${mode}: update`, async () => {
      for (let i = 0; i < 600; i++) {
        now += 1000 / 30;
        if (i % 3 === 0) scene.pointer(100 + (i % 200), 100 + (i % 120));
        const began = performance.now();
        scene.update(1 / 30);
        result.updateMs.push(performance.now() - began);
        if (i % 100 === 99) await frames(1);
      }
      scene.pointer(null);
    });
    if (mode === 'window') await attempt('window: click', () => scene.click(200, 150));

    await attempt(`${mode}: status and menu`, () => {
      const status = scene.status();
      result.statusIsObject = typeof status === 'object' && status !== null;
      const items = scene.menuItems();
      result.menuItemsAreArray =
        Array.isArray(items) && items.every((item) => typeof item.label === 'string');
      scene.onMenu('no-such-item'); // an id the scene never gave must do nothing
    });

    await attempt(`${mode}: pause and resume`, async () => {
      scene.setVisible(false);
      now += 60 * 60 * 1000;
      scene.setVisible(true);
      scene.resume?.(60 * 60 * 1000);
      for (let i = 0; i < 30; i++) scene.update(1 / 30);
    });

    await attempt(`${mode}: serialize`, () => {
      const state = scene.serialize();
      result.serializeIsPlain = same(JSON.parse(JSON.stringify(state)), state);
    });

    // The record the scene saved is read by a second instance, which runs.
    result.saved = saved !== null;
    if (saved) {
      const second = await attempt(`${mode}: create from a saved record`, () => create(makeHost()));
      if (second) {
        app.stage.addChild(second.root);
        await attempt(`${mode}: run from a saved record`, () => {
          second.resize(sizes[0][0], sizes[0][1]);
          for (let i = 0; i < 60; i++) second.update(1 / 30);
          const state = second.serialize();
          result.savedLoads = same(JSON.parse(JSON.stringify(state)), state);
        });
        await attempt(`${mode}: dispose the second`, () => second.dispose());
        if (second.root.parent) app.stage.removeChild(second.root);
      }
    }

    // More resizes must not add textures.
    if (mode === 'window') {
      const before = counts().textures;
      await attempt('window: 30 resizes', async () => {
        for (let i = 0; i < extraResizes; i++) {
          const [w, h] = sizes[i % sizes.length];
          scene.resize(w + (i % 2), h);
          scene.update(1 / 30);
          if (i % 10 === 9) await frames(1);
        }
      });
      result.texturesAfterResizes = { before, after: counts().textures };
    }

    await attempt(`${mode}: dispose`, () => scene.dispose());
    // A scene frees its own PixiJS objects; the host does not do it for it.
    result.rootDestroyed = scene.root.destroyed;
    if (scene.root.parent) app.stage.removeChild(scene.root);
    await frames(2);
    result.afterDispose = counts();
  }

  // Create, run and dispose five more times in window mode. The first cycles may add textures that belong to PixiJS
  // (its own white texture, batch textures) and not to the scene; after that the counts must stand still.
  report.cycles = [];
  for (let i = 0; i < 5; i++) {
    let now = Date.now();
    const cycleHost = {
      ...host,
      mode: 'window',
      clock: { now: () => now },
      record: { load: async () => ({ status: 'missing' }), save() {}, keepCopy() {} },
      sound: { define: () => true, play: () => false },
      ui: { root: document.createElement('div') },
      options: { ...host.options, dev: false },
      log() {},
    };
    const scene = await attempt(`cycle ${i}: create`, () => create(cycleHost));
    if (!scene) break;
    app.stage.addChild(scene.root);
    await attempt(`cycle ${i}: run`, async () => {
      scene.resize(sizes[0][0], sizes[0][1]);
      for (let n = 0; n < 60; n++) {
        now += 1000 / 30;
        scene.update(1 / 30);
      }
      await frames(1);
    });
    await attempt(`cycle ${i}: dispose`, () => scene.dispose());
    const destroyed = scene.root.destroyed;
    if (scene.root.parent) app.stage.removeChild(scene.root);
    await frames(2);
    report.cycles.push({ ...counts(), destroyed });
  }
  return report;
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

test.describe('the scene contract', () => {
  test('there are scenes to check', () => {
    expect(scenes.map((scene) => scene.id)).toEqual(expect.arrayContaining(['empty', 'fishtank']));
  });

  for (const { id } of scenes) {
    test(`${id}: create, resize, update, serialize, dispose`, async () => {
      const dir = makeDataDir();
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ activeScene: id }));
      const run = await launch({ dataDir: dir });
      const errors = [];
      run.page.on('pageerror', (error) => errors.push(error.message));
      try {
        const sizes = [
          [1280, 720],
          [320, 240],
          [3440, 1440],
          [900, 900],
        ];
        const report = await run.page.evaluate(runContract, { id, sizes, extraResizes: 30 });
        expect(report.problems).toEqual([]);
        expect(errors).toEqual([]);
        for (const mode of ['window', 'desktop']) {
          const result = report.modes[mode];
          expect(result.idMatches, `${mode}: the scene id is the folder name`).toBe(true);
          expect(result.statusIsObject, `${mode}: status() is an object`).toBe(true);
          expect(result.menuItemsAreArray, `${mode}: menuItems() is a list of labelled items`).toBe(
            true,
          );
          expect(result.serializeIsPlain, `${mode}: serialize() is plain data`).toBe(true);
          if (result.saved) expect(result.savedLoads, `${mode}: a saved record loads`).toBe(true);
          expect(result.rootDestroyed, `${mode}: dispose() destroys the scene's root`).toBe(true);
          // Nothing is left behind on the stage or in the ticker's listeners.
          expect(
            { stage: result.afterDispose.stage, ticker: result.afterDispose.ticker },
            `${mode}: stage and ticker after dispose`,
          ).toEqual({ stage: report.start.stage, ticker: report.start.ticker });
          const p95 = percentile(result.updateMs, 0.95);
          console.log(`${id} ${mode}: update() 95th percentile ${p95.toFixed(3)} ms`);
          expect(p95, `${mode}: update() is under a frame`).toBeLessThan(16);
        }
        const { before, after } = report.modes.window.texturesAfterResizes;
        expect(after, '30 resizes add no textures').toBeLessThanOrEqual(before);
        // Creating and disposing again and again leaves the textures where the first cycle left them.
        const cycles = report.cycles.map((c) => c.textures);
        expect(cycles, 'five cycles of create and dispose').toHaveLength(5);
        expect(Math.max(...cycles), `textures after each cycle: ${cycles}`).toBe(cycles[0]);
        expect(report.cycles.every((c) => c.destroyed)).toBe(true);
        expect(
          report.cycles.every(
            (c) => c.stage === report.start.stage && c.ticker === report.start.ticker,
          ),
        ).toBe(true);
      } finally {
        await run.close();
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    });
  }
});
