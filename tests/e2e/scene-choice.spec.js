import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from './helpers.js';

// The main process decides which scene a page runs (work package 7.3): from settings.json, with the tank as the answer
// to anything it does not know, and the page's record calls always reach the scene it was given.
test.describe('the main process chooses the scene', () => {
  const withSettings = (settings) => {
    const dir = makeDataDir();
    if (settings !== undefined) {
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings));
    }
    return dir;
  };

  test('a first start runs the tank, and the page has no call that names a scene', async () => {
    const dir = withSettings(undefined);
    try {
      const run = await launch({ dataDir: dir });
      const result = await run.page.evaluate(async () => ({
        scene: (await window.desktop2.getAppInfo()).activeScene,
        bridge: Object.keys(window.desktop2).filter((name) => /scene/i.test(name)),
      }));
      expect(result).toEqual({ scene: 'fishtank', bridge: [] });
      await run.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const wanted of ['nope', '../fishtank', 42, null]) {
    test(`an unknown scene in settings.json (${JSON.stringify(wanted)}) starts the tank`, async () => {
      const dir = withSettings({ activeScene: wanted });
      try {
        const run = await launch({ dataDir: dir });
        expect(
          await run.page.evaluate(async () => (await window.desktop2.getAppInfo()).activeScene),
        ).toBe('fishtank');
        await run.close();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  test('the record calls of a page reach the scene the main process gave it, and no other', async () => {
    const dir = withSettings({ activeScene: 'empty' });
    try {
      const run = await launch({ dataDir: dir });
      // The page saves with no scene id at all; the file that changes is the empty scene's.
      await run.page.evaluate(() => window.desktop2.saveRecord({ schema: 1, opened: 77 }));
      await run.close();
      expect(
        JSON.parse(fs.readFileSync(path.join(dir, 'records', 'empty.json'), 'utf8')).opened,
      ).toBe(77);
      expect(fs.existsSync(path.join(dir, 'records', 'fishtank.json'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
