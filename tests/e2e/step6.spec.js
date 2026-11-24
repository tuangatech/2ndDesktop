import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { launch, makeDataDir } from './helpers.js';

// Steps the scene by simulated time, so a test does not have to wait for the real clock.
const stepScene = `(seconds) => {
  const { fishtank } = window.__tank;
  for (let t = 0; t < seconds; t += 1 / 30) fishtank.update(1 / 30);
}`;

test.describe('the first-launch hint (spec section 8)', () => {
  test('shows on a new tank, goes after the first meal and does not come back', async () => {
    const dataDir = makeDataDir();
    try {
      const first = await launch({ dataDir });
      const hint = first.page.locator('#hint');
      await expect(hint).toHaveClass(/show/);
      await expect(hint).toContainText('Click food to collect it, then click the water to feed');
      await expect(hint).toContainText('Launch at login');

      // Collecting alone does not end it; the first successful feed does.
      await first.page.evaluate(() => window.__tank.scene.collectAll());
      await expect(hint).toHaveClass(/show/);
      await first.page.evaluate(() => window.__tank.scene.feedOne());
      await expect(hint).not.toHaveClass(/show/);
      await first.close(); // the save is written on quit
      expect(JSON.parse(fs.readFileSync(first.recordFile, 'utf8')).state.tank.hintShown).toBe(true);

      const second = await launch({ dataDir });
      await expect(second.page.locator('#hint')).not.toHaveClass(/show/);
      await second.close();
    } finally {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // Windows may still hold the folder for a moment; the real error is above.
      }
    }
  });

  test('a meal from the tray ends it too', async () => {
    const { page, close } = await launch();
    try {
      await expect(page.locator('#hint')).toHaveClass(/show/);
      await page.evaluate(() => {
        window.__tank.fishtank.onMenu('collect');
        window.__tank.fishtank.onMenu('feed');
      });
      await expect(page.locator('#hint')).not.toHaveClass(/show/);
    } finally {
      await close();
    }
  });

  test('a hint never blocks a click on the tank', async () => {
    const { page, close } = await launch();
    try {
      const pointerEvents = await page.evaluate(
        () => getComputedStyle(document.getElementById('hint')).pointerEvents,
      );
      expect(pointerEvents).toBe('none');
    } finally {
      await close();
    }
  });
});

test.describe('sounds (FR-38)', () => {
  test('play for the player’s own actions, and never from the game tick or the feeding loop', async () => {
    const { page, close } = await launch();
    try {
      const result = await page.evaluate(`(async () => {
        const step = ${stepScene};
        const { scene, repository } = window.__tank;
        const plays = [];
        scene.sound = { play: (name) => plays.push(name) };

        // A minute of nothing but the tick and the animation: no sound.
        step(60);
        const idle = plays.length;

        scene.collectAll();
        const afterCollect = [...plays];
        scene.feedOne();
        const afterFeed = [...plays];

        // Feed until full is a loop that runs from the tick: it drops several pellets and makes no sound.
        repository.dev.addStash(10);
        const before = plays.length;
        scene.startFeeding();
        step(40);
        return {
          idle,
          afterCollect,
          afterFeed,
          loopSounds: plays.length - before,
          loopFed: repository.getState().tank.totalFed,
        };
      })()`);
      expect(result.idle).toBe(0);
      expect(result.afterCollect).toEqual(['pop']);
      expect(result.afterFeed).toEqual(['pop', 'splash']);
      expect(result.loopFed).toBeGreaterThan(2);
      expect(result.loopSounds).toBe(0);
    } finally {
      await close();
    }
  });

  test('a paused tank is silent and the sound setting reaches the player', async () => {
    const { page, app, close } = await launch();
    try {
      const silent = await page.evaluate(() => {
        const { scene } = window.__tank;
        const plays = [];
        scene.sound = { play: (name) => plays.push(name) };
        scene.setVisible(false); // covered: the economy is applied at once, without animation
        scene.collectAll();
        scene.feedOne();
        scene.setVisible(true);
        return plays;
      });
      expect(silent).toEqual([]);

      // The main process tells the renderer when Sound is switched in a menu.
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.send('settings:changed', { sound: false });
      });
      await expect.poll(() => page.evaluate(() => window.__tank.sound.enabled)).toBe(false);
    } finally {
      await close();
    }
  });
});
