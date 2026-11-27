import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from '../../../tests/e2e/helpers.js';

// The farm house in the real page (the contract test, tests/e2e/contract.spec.js, already runs it through create, resize,
// updates, pause and resume, serialize and dispose): the scene is chosen by the main process, it saves its record, it
// shows its layers in order, and a switch to the tank and back keeps the record.
const switchTo = (run, id) =>
  run.app.evaluate((_electron, wanted) => globalThis.__desktop2Test.switchScene(wanted), id);
const ready = (run) => run.page.waitForFunction(() => window.__ready === true);
const recordOf = (dir) => path.join(dir, 'records', 'farmhouse.json');
const farmhouseDir = () => {
  const dir = makeDataDir();
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ activeScene: 'farmhouse' }));
  return dir;
};

test.describe('the farm house scene', () => {
  test('runs with its layers in order, a status line and the Scatter hay item', async () => {
    const dir = farmhouseDir();
    let run;
    try {
      run = await launch({ dataDir: dir });
      const info = await run.page.evaluate(() => {
        const scene = window.__scene.fishtank;
        const view = scene.debug.view();
        return {
          id: scene.id,
          layers: scene.root.children[0].children.map((c) => c.label),
          menu: scene.menuItems(),
          status: scene.status(),
          season: view.slow.season.name,
          animals: view.motion.animals.length,
          art: scene.debug.art(),
          shown: scene.debug.shown(),
          view,
        };
      });
      expect(info.id).toBe('farmhouse');
      expect(info.layers).toEqual([
        'layer-sky',
        'layer-ridges',
        'layer-forest',
        'layer-lawn',
        'layer-trees-back',
        'layer-house',
        'layer-trees-front',
        'layer-drive-truck',
        'layer-field',
        'layer-fence',
        'layer-animals',
        'layer-weather',
        'layer-grade',
      ]);
      expect(info.menu).toEqual([{ id: 'hay', label: 'Scatter hay', enabled: true }]);
      expect(info.status.line).toMatch(/\(simulated weather\)$/);
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(info.season);
      expect(info.animals).toBe(7);
      // The eight pictures of S4 and S5 are drawn (sky, far ridge, lawn, drive, truck, mid ridge, hill, house).
      expect(info.art.builds).toBe(8);
      // What is on show follows the view: each window's light, the smoke and the truck.
      for (const [id, light] of Object.entries(info.view.slow.lights)) {
        expect(info.shown.lights[id]).toBeCloseTo(light > 0.01 ? light : 0, 5);
      }
      expect(info.shown.truck.visible).toBe(info.view.motion.truck.visible);
      await expect.poll(() => fs.existsSync(recordOf(dir)), { timeout: 10_000 }).toBe(true);
      const saved = JSON.parse(fs.readFileSync(recordOf(dir), 'utf8'));
      expect(saved).toMatchObject({ opened: 1, seasonMode: 'calendar' });
    } finally {
      await run?.close().catch(() => {});
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('Scatter hay works once and then asks to wait (R12)', async () => {
    const dir = farmhouseDir();
    let run;
    try {
      run = await launch({ dataDir: dir });
      const result = await run.page.evaluate(() => {
        const scene = window.__scene.fishtank;
        scene.onMenu('hay');
        scene.update(0);
        return { after: scene.menuItems()[0], started: scene.debug.hay().startedAt !== null };
      });
      expect(result.started).toBe(true);
      expect(result.after).toEqual({
        id: 'hay',
        label: 'Scatter hay (wait a moment)',
        enabled: false,
      });
    } finally {
      await run?.close().catch(() => {});
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a switch to the tank and back keeps the farm house record', async () => {
    const dir = farmhouseDir();
    let run;
    try {
      run = await launch({ dataDir: dir });
      await expect.poll(() => fs.existsSync(recordOf(dir)), { timeout: 10_000 }).toBe(true);
      await switchTo(run, 'fishtank');
      await ready(run);
      expect(
        await run.page.evaluate(async () => (await window.desktop2.getAppInfo()).activeScene),
      ).toBe('fishtank');
      await switchTo(run, 'farmhouse');
      await ready(run);
      expect(await run.page.evaluate(() => window.__scene.fishtank.id)).toBe('farmhouse');
      await expect
        .poll(() => JSON.parse(fs.readFileSync(recordOf(dir), 'utf8')).opened, {
          timeout: 10_000,
        })
        .toBe(2);
    } finally {
      await run?.close().catch(() => {});
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
