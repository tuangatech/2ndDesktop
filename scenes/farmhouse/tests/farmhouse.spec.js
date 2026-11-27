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
const modeOf = (dir) =>
  fs.existsSync(recordOf(dir))
    ? JSON.parse(fs.readFileSync(recordOf(dir), 'utf8')).seasonMode
    : null;
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
      expect(info.menu.map((item) => item.id)).toEqual([
        'hay',
        undefined,
        'seasons',
        'preview-season',
        'preview-weather',
      ]);
      expect(info.menu[0]).toEqual({ id: 'hay', label: 'Scatter hay', enabled: true });
      expect(info.menu[2].label).toBe('Seasons: Calendar (switch to Fast)');
      expect(info.status.line).toMatch(/\(simulated weather\)$/);
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(info.season);
      expect(info.animals).toBe(7);
      // The pictures are drawn once: sky, far ridge, drive, truck, mid ridge, hill, lawn, house, field, fence (10) and eight trees.
      expect(info.art.builds).toBe(18 + 1 + 5); // and the hay and five coats
      // What is on show follows the view: each window's light, the smoke and the truck.
      for (const [id, light] of Object.entries(info.view.slow.lights)) {
        expect(info.shown.lights[id]).toBeCloseTo(light > 0.01 ? light : 0, 5);
      }
      // The seven animals are on show where the view puts them, bigger when nearer, and the hay is not out.
      expect(info.shown.animals).toHaveLength(7);
      for (const a of info.shown.animals) {
        const want = info.view.motion.animals.find((m) => m.id === a.id);
        expect(a.x).toBeCloseTo(want.x * 2100, 3);
        expect(a.scale).toBeCloseTo(want.scale, 5);
      }
      expect(info.shown.hay).toBe(0);
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
      // A few seconds in, the animals are walking to the hay and it is on show.
      await run.page.waitForTimeout(3000);
      const later = await run.page.evaluate(() => {
        const scene = window.__scene.fishtank;
        scene.update(0);
        return {
          hay: scene.debug.shown().hay,
          poses: scene.debug.view().motion.animals.map((a) => a.pose),
        };
      });
      expect(later.hay).toBeGreaterThan(0);
      expect(later.poses.every((pose) => pose === 'walk')).toBe(true);
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

  test('a preview of rain, snow, fog and a storm shows the weather; letting go brings the simulation back', async () => {
    const dir = farmhouseDir();
    let run;
    try {
      run = await launch({ dataDir: dir });
      const shown = (next) =>
        run.page.evaluate(async (preview) => {
          const scene = window.__scene.fishtank;
          await scene.debug.preview(preview);
          scene.update(0.05);
          return { status: scene.status().line, weather: scene.debug.shown().weather };
        }, next);
      const rain = await shown({ kind: 'rain' });
      expect(rain.weather.rain).toBeGreaterThan(50);
      expect(rain.weather.clouds).toBeGreaterThan(5);
      expect(rain.weather.snow).toBe(0);
      const snow = await shown({ kind: 'snow' });
      expect(snow.weather.snow).toBeGreaterThan(50);
      expect(snow.weather.rain).toBe(0);
      const storm = await shown({ kind: 'storm' });
      expect(storm.weather.rain).toBeGreaterThan(200);
      const fog = await shown({ kind: 'fog' });
      expect(fog.weather.fog.every((alpha) => alpha > 0)).toBe(true);
      const winter = await shown({ season: 'winter', kind: 'snow' });
      expect(winter.status).toMatch(/^Winter, snow/);
      // The simulation is back when the preview is let go.
      const back = await shown({});
      expect(back.status).toMatch(/\(simulated weather\)$/);
    } finally {
      await run?.close().catch(() => {});
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the tray items switch Fast mode and the previews through a dip, and Fast mode is saved', async () => {
    const dir = farmhouseDir();
    let run;
    try {
      run = await launch({ dataDir: dir });
      // Runs the dip to its end by stepping the scene the way the host does.
      const choose = (id) =>
        run.page.evaluate(async (item) => {
          const scene = window.__scene.fishtank;
          scene.onMenu(item);
          let peak = 0;
          for (let i = 0; i < 400; i++) {
            scene.update(0.1);
            peak = Math.max(peak, scene.debug.dip().alpha);
            if (scene.debug.dip().phase === 'idle') break;
            await new Promise((resolve) => setTimeout(resolve, 15));
          }
          return {
            peak,
            dip: scene.debug.dip(),
            status: scene.status().line,
            labels: scene.menuItems().map((m) => m.label),
          };
        }, id);
      const fast = await choose('seasons');
      expect(fast.dip.phase).toBe('idle');
      expect(fast.peak).toBeGreaterThan(0.95); // the veil came all the way in, so there was no cut
      expect(fast.dip.alpha).toBe(0);
      expect(fast.status).toMatch(/\(Fast: January\)/); // the first day is the first of January
      expect(fast.labels[2]).toMatch(/^Seasons: Fast, January/);
      await expect
        .poll(() => modeOf(dir), {
          timeout: 10_000,
        })
        .toBe('fast');
      const saved = JSON.parse(fs.readFileSync(recordOf(dir), 'utf8'));
      expect(typeof saved.fastStartedAt).toBe('number');
      const season = await choose('preview-season'); // spring
      expect(season.status).toMatch(/^Spring/);
      expect(season.labels[3]).toMatch(/^Preview season: Spring \(next: Summer\)/);
      const kind = await choose('preview-weather'); // clear
      expect(kind.status).toMatch(/^Spring, clear/);
      const calendar = await choose('seasons');
      expect(calendar.labels[2]).toBe('Seasons: Calendar (switch to Fast)');
      await expect
        .poll(() => modeOf(dir), {
          timeout: 10_000,
        })
        .toBe('calendar');
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
