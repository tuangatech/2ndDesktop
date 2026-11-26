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

// About is a small window, not a native message box (about.js): the version sits under the name, the text takes the
// whole width. The menu item to click exists on macOS only (Windows has About in the tray menu).
test.describe('the About window', () => {
  test.skip(process.platform !== 'darwin', 'the application menu is macOS only');

  const clickAbout = (app) =>
    app.evaluate(({ Menu }) => {
      const top = Menu.getApplicationMenu().items[0];
      top.submenu.items.find((item) => item.label.startsWith('About')).click();
    });

  test('opens one window, with the version under the name, and closes with Escape', async () => {
    const app = await launch();
    try {
      const opened = app.app.waitForEvent('window');
      await clickAbout(app.app);
      const about = await opened;
      await about.waitForLoadState('domcontentloaded');
      await expect(about.locator('h1')).toHaveText('2ndDesktop');
      await expect(about.locator('.version')).toHaveText(/^Version \d+\.\d+\.\d+/);
      const [name, version, paragraph] = await Promise.all([
        about.locator('h1').boundingBox(),
        about.locator('.version').boundingBox(),
        about.locator('p').first().boundingBox(),
      ]);
      expect(version.y).toBeGreaterThan(name.y);
      expect(paragraph.y).toBeGreaterThan(version.y + version.height);
      // The text runs under the icon, over the width of the window.
      expect(paragraph.x).toBeLessThan(name.x);

      // A second request brings the same window forward; it does not open another.
      await clickAbout(app.app);
      const count = await app.app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().filter((w) => w.getTitle().startsWith('About')).length,
      );
      expect(count).toBe(1);

      const closed = about.waitForEvent('close');
      // Playwright's own key press goes round Electron's input hook, so the key is sent from the main process.
      await app.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().startsWith('About'));
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      });
      await closed;
    } finally {
      await app.close();
    }
  });
});
