import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from './helpers.js';

// Switching the scene (work package 7.4): the main process asks the page to save, writes the records, remembers the
// scene and loads the page again. The tests choose the scene through a hook that exists only when DESKTOP2_TEST=1
// (the tray menu calls the same function); the menu itself is checked through the template the tray would show.
const records = (dir) => path.join(dir, 'records');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const switchTo = (run, id) =>
  run.app.evaluate((_electron, wanted) => globalThis.__desktop2Test.switchScene(wanted), id);

/** The labels of the tray menu, and the radio items inside "Scenes" with their checked state. */
const trayShape = (run) =>
  run.app.evaluate(async () => {
    const template = await globalThis.__desktop2Test.menuTemplate();
    const scenes = template.find((item) => item.label === 'Scenes');
    return {
      labels: template.map((item) => item.label).filter(Boolean),
      scenes: scenes?.submenu.map((item) => [item.label, item.type, item.checked]) ?? null,
    };
  });

const activeScene = (run) =>
  run.page.evaluate(async () => (await window.desktop2.getAppInfo()).activeScene);

// The page that was loaded again is a new document: it is ready when its own boot has finished.
const ready = (run) => run.page.waitForFunction(() => window.__ready === true);

async function waitForFile(file) {
  await expect.poll(() => fs.existsSync(file), { timeout: 10_000 }).toBe(true);
}

test.describe('switching the scene', () => {
  test('lists both scenes in the tray menu with the running one checked', async () => {
    const run = await launch();
    try {
      const shape = await trayShape(run);
      expect(shape.labels).toContain('Scenes');
      expect(shape.scenes).toEqual([
        ['Empty', 'radio', false],
        ['Tank', 'radio', true],
      ]);
    } finally {
      await run.close();
    }
  });

  test('keeps both records, shows the other scene, and comes back to the tank as it was', async () => {
    const dir = makeDataDir();
    try {
      const run = await launch({ dataDir: dir });
      expect(await activeScene(run)).toBe('fishtank');
      // A first start has no fade: the class belongs to a page that was loaded again for a switch.
      expect(
        await run.page.evaluate(() => document.documentElement.classList.contains('switched')),
      ).toBe(false);
      await waitForFile(run.recordFile);
      // The main process writes a record after a second of quiet; the switch must not wait for that.
      const tankBefore = readJson(run.recordFile);

      expect(await switchTo(run, 'empty')).toEqual({ ok: true });
      await ready(run);
      expect(await activeScene(run)).toBe('empty');
      expect(
        await run.page.evaluate(() => document.documentElement.classList.contains('switched')),
      ).toBe(true);
      expect((await trayShape(run)).scenes).toEqual([
        ['Empty', 'radio', true],
        ['Tank', 'radio', false],
      ]);
      expect(readJson(path.join(dir, 'settings.json')).activeScene).toBe('empty');
      expect(readJson(run.recordFile)).toEqual(tankBefore);
      await expect.poll(() => fs.existsSync(path.join(records(dir), 'empty.json'))).toBe(true);
      expect(readJson(path.join(records(dir), 'empty.json')).opened).toBe(1);

      expect(await switchTo(run, 'fishtank')).toEqual({ ok: true });
      await ready(run);
      expect(await activeScene(run)).toBe('fishtank');
      expect(readJson(run.recordFile)).toEqual(tankBefore);
      expect(readJson(path.join(dir, 'settings.json')).activeScene).toBe('fishtank');
      await run.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a record call after a switch reaches the new scene only', async () => {
    const dir = makeDataDir();
    try {
      const run = await launch({ dataDir: dir });
      await waitForFile(run.recordFile);
      const tankBefore = fs.readFileSync(run.recordFile, 'utf8');
      expect(await switchTo(run, 'empty')).toEqual({ ok: true });
      await ready(run);
      await run.page.evaluate(() => window.desktop2.saveRecord({ schema: 1, opened: 41 }));
      await run.close();
      expect(readJson(path.join(records(dir), 'empty.json')).opened).toBe(41);
      expect(fs.readFileSync(run.recordFile, 'utf8')).toBe(tankBefore);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the next start runs the scene that was chosen last', async () => {
    const dir = makeDataDir();
    try {
      const first = await launch({ dataDir: dir });
      expect(await switchTo(first, 'empty')).toEqual({ ok: true });
      await ready(first);
      await first.close();
      const second = await launch({ dataDir: dir });
      expect(await activeScene(second)).toBe('empty');
      await second.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('refuses an unknown scene and the scene that already runs, and changes nothing', async () => {
    const dir = makeDataDir();
    try {
      const run = await launch({ dataDir: dir });
      expect(await switchTo(run, 'nope')).toEqual({ ok: false, reason: 'unknown' });
      expect(await switchTo(run, '../fishtank')).toEqual({ ok: false, reason: 'unknown' });
      expect(await switchTo(run, 'fishtank')).toEqual({ ok: false, reason: 'same' });
      expect(await activeScene(run)).toBe('fishtank');
      const file = path.join(dir, 'settings.json');
      expect(fs.existsSync(file) ? readJson(file).activeScene : undefined).toBeUndefined();
      await run.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
