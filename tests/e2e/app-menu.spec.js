import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launch } from './helpers.js';

// The second menu on macOS is named after the default scene, as its scene.json says (not a literal in the test).
const sceneName = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, '..', '..', 'scenes', 'fishtank', 'scene.json'),
    'utf8',
  ),
).name;

// Electron's default menu carries Reload and Developer Tools, so the app sets its own (macOS) or none (Windows).
test.describe('the application menu', () => {
  test('is not the Electron default', async () => {
    const app = await launch();
    try {
      const labels = await app.app.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        return menu ? menu.items.map((item) => item.label) : null;
      });
      if (process.platform === 'darwin') {
        // The first item takes the name of the app on macOS; the dev build has the Developer menu as well.
        expect(labels).toEqual(expect.arrayContaining([sceneName, 'Window']));
        expect(labels).not.toContain('View');
      } else {
        expect(labels).toBeNull();
      }
    } finally {
      await app.close();
    }
  });
});
