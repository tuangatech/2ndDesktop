import { expect, test } from '@playwright/test';
import { launch } from './helpers.js';

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
        expect(labels).toEqual(expect.arrayContaining(['Tank', 'Window']));
        expect(labels).not.toContain('View');
      } else {
        expect(labels).toBeNull();
      }
    } finally {
      await app.close();
    }
  });
});
