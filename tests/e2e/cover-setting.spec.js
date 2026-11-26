import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from './helpers.js';

// The setting "When the desktop is covered" (work package 7.5). The cover check itself only runs in desktop mode, which
// would attach to the real desktop of whoever runs the tests; what is checked here is what the app remembers when the
// choice is made (through the hook that exists only when DESKTOP2_TEST=1; the menu calls the same function). The
// pause itself is unit-tested (tests/host/cover-policy.test.js, desktop.test.js).
const settingsFile = (dir) => path.join(dir, 'settings.json');
const readSettings = (dir) => JSON.parse(fs.readFileSync(settingsFile(dir), 'utf8'));
const remove = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the folder for a moment.
  }
};
const choose = (run, word) =>
  run.app.evaluate((_electron, wanted) => globalThis.__desktop2Test.setWhenCovered(wanted), word);

test.describe('When the desktop is covered', () => {
  test('stores nothing until the player chooses, then remembers the choice for the next start', async () => {
    const dir = makeDataDir();
    try {
      const first = await launch({ dataDir: dir });
      expect(
        fs.existsSync(settingsFile(dir)) ? readSettings(dir).whenCovered : undefined,
      ).toBeUndefined();
      await choose(first, 'auto');
      expect(readSettings(dir).whenCovered).toBe('auto');
      await choose(first, 'never');
      expect(readSettings(dir).whenCovered).toBe('never');
      await first.close();

      const second = await launch({ dataDir: dir });
      expect(readSettings(dir).whenCovered).toBe('never');
      await second.close();
    } finally {
      remove(dir);
    }
  });

  test('ignores a word it does not know and a damaged value in the file', async () => {
    const dir = makeDataDir();
    try {
      fs.writeFileSync(
        settingsFile(dir),
        JSON.stringify({ whenCovered: 'sometimes', sound: false }),
      );
      const run = await launch({ dataDir: dir });
      await choose(run, 'battery'); // the plan said so once; the spec word is `auto`
      await choose(run, 42);
      // Nothing was written for either, and the other keys stay as they were.
      expect(readSettings(dir)).toEqual({ whenCovered: 'sometimes', sound: false });
      await choose(run, 'auto');
      expect(readSettings(dir)).toMatchObject({ whenCovered: 'auto', sound: false });
      await run.close();
    } finally {
      remove(dir);
    }
  });
});
