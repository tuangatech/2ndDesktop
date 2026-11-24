import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from './helpers.js';

// DESKTOP2_MODE is left empty so the app chooses its own mode from the settings, as a normal launch does.
const own = { DESKTOP2_MODE: '' };
const readSettings = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
const remove = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the folder for a moment.
  }
};

test.describe('the safe start (FR-64)', () => {
  test('the first launch opens a window and remembers it', async () => {
    const dataDir = makeDataDir();
    try {
      const app = await launch({ dataDir, env: own });
      expect(app.page.url()).toContain('mode=window');
      await app.close();
      expect(readSettings(dataDir).displayMode).toBe('window');
    } finally {
      remove(dataDir);
    }
  });

  test('a launch that finds an unfinished desktop attempt opens a window and stores that it failed', async () => {
    const dataDir = makeDataDir();
    try {
      fs.writeFileSync(
        path.join(dataDir, 'settings.json'),
        JSON.stringify({ displayMode: 'desktop', desktopAttempt: 'trying' }),
      );
      const app = await launch({ dataDir, env: own });
      expect(app.page.url()).toContain('mode=window');
      await app.close();
      expect(readSettings(dataDir)).toMatchObject({
        displayMode: 'window',
        desktopAttempt: 'failed',
      });

      // The next launch stays in a window without a new try.
      const again = await launch({ dataDir, env: own });
      expect(again.page.url()).toContain('mode=window');
      await again.close();
    } finally {
      remove(dataDir);
    }
  });

  test('a forced mode changes nothing in the saved settings', async () => {
    const dataDir = makeDataDir();
    try {
      fs.writeFileSync(
        path.join(dataDir, 'settings.json'),
        JSON.stringify({ displayMode: 'desktop', desktopAttempt: 'ok' }),
      );
      const app = await launch({ dataDir }); // DESKTOP2_MODE=window, as in all other tests
      await app.close();
      expect(readSettings(dataDir)).toMatchObject({ displayMode: 'desktop', desktopAttempt: 'ok' });
    } finally {
      remove(dataDir);
    }
  });
});
