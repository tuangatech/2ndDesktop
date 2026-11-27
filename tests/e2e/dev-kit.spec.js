import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from './helpers.js';

// The dev kit (app/page/devKit.js; work package 8.4): window mode with DESKTOP2_DEV=1. It moves the host clock, cuts the
// stage to a shape and pauses the scene, for any scene. The product never shows it.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function withKit(scene, env = { DESKTOP2_DEV: '1' }) {
  const dir = makeDataDir();
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ activeScene: scene }));
  const run = await launch({ dataDir: dir, env });
  return {
    ...run,
    close: async () => {
      await run.app.close();
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

// The window of a test is small, so the panel starts closed (COLLAPSE_BELOW); this opens it like a click on "dev kit".
async function openKit(page) {
  const kit = page.locator('#devkit');
  if (await kit.locator('.body.hidden').count()) await kit.locator('.head').click();
  return kit;
}

test.describe('the dev kit', () => {
  test('starts closed in a small window and opens with a click on its title', async () => {
    const run = await withKit('empty');
    try {
      const kit = run.page.locator('#devkit');
      await expect(kit.locator('.head')).toBeVisible();
      await expect(kit.locator('.body')).toBeHidden();
      await kit.locator('.head').click();
      await expect(kit.locator('.body')).toBeVisible();
      await kit.locator('.head').click();
      await expect(kit.locator('.body')).toBeHidden();
    } finally {
      await run.close();
    }
  });

  test('is not there in a normal run', async () => {
    const run = await withKit('empty', { DESKTOP2_DEBUG: '1' });
    try {
      expect(await run.page.locator('#devkit').count()).toBe(0);
    } finally {
      await run.close();
    }
  });

  test('is not there in desktop mode', async () => {
    const run = await withKit('empty', {
      DESKTOP2_DEV: '1',
      DESKTOP2_TEST_RENDER_MODE: 'desktop',
    });
    try {
      expect(await run.page.locator('#devkit').count()).toBe(0);
    } finally {
      await run.close();
    }
  });

  test('moves the clock of any scene, and the scene settles as after a pause', async () => {
    const run = await withKit('empty');
    try {
      const kit = await openKit(run.page);
      await expect(kit).toBeVisible();
      const read = () => run.page.evaluate(() => window.__scene.clock.now());
      const a = await read();
      await kit.getByRole('button', { name: '+1 d', exact: true }).click();
      const b = await read();
      expect(b - a).toBeGreaterThanOrEqual(DAY);
      expect(b - a).toBeLessThan(DAY + 5000);
      await kit.getByRole('button', { name: '-1 d' }).click();
      const c = await read();
      expect(c - b).toBeLessThan(-DAY + 5000);
      expect(c - b).toBeGreaterThan(-DAY - 5000);
      // The clock and the label agree.
      await kit.getByRole('button', { name: '+30 d' }).click();
      const label = await kit.locator('.clock').textContent();
      expect(label).toContain(String(new Date(await read()).getFullYear()));
    } finally {
      await run.close();
    }
  });

  test('sets the clock to a date and time, and runs it faster without a jump', async () => {
    const run = await withKit('empty');
    try {
      const kit = await openKit(run.page);
      await kit.getByLabel('Set the clock').fill('2026-12-21T06:30');
      const expected = new Date(2026, 11, 21, 6, 30).getTime();
      const now = await run.page.evaluate(() => window.__scene.clock.now());
      expect(Math.abs(now - expected)).toBeLessThan(5000);

      await kit.getByLabel('Clock speed').selectOption('600');
      const before = await run.page.evaluate(() => window.__scene.clock.now());
      await run.page.waitForTimeout(500);
      const after = await run.page.evaluate(() => window.__scene.clock.now());
      expect(after - before).toBeGreaterThan(200_000); // 0.5 s at x600 is 300 s
      expect(after - before).toBeLessThan(1_500_000);

      await kit.getByRole('button', { name: 'now' }).click();
      const wall = Date.now();
      const reset = await run.page.evaluate(() => window.__scene.clock.now());
      expect(Math.abs(reset - wall)).toBeLessThan(5000);
    } finally {
      await run.close();
    }
  });

  test('cuts the stage to a shape and the scene is resized to it', async () => {
    const run = await withKit('empty');
    try {
      const kit = await openKit(run.page);
      const size = () =>
        run.page.evaluate(() => [
          window.__scene.app.screen.width,
          window.__scene.app.screen.height,
        ]);
      const [fullWidth, fullHeight] = await size();
      expect(fullWidth).toBe(await run.page.evaluate(() => innerWidth));

      await kit.getByLabel('Window shape').selectOption('1:1');
      await expect.poll(async () => (await size())[0]).toBe((await size())[1]);
      const [w, h] = await size();
      expect(w).toBeLessThanOrEqual(Math.min(fullWidth, fullHeight));

      await kit.getByLabel('Window shape').selectOption('16:9');
      await expect
        .poll(async () => {
          const [x, y] = await size();
          return Math.abs(x / y - 16 / 9) < 0.02;
        })
        .toBe(true);
      expect(h).toBeGreaterThan(0);

      await kit.getByLabel('Window shape').selectOption('fill');
      await expect.poll(size).toEqual([fullWidth, fullHeight]);
    } finally {
      await run.close();
    }
  });

  test('pauses the scene as if the desktop were covered, and resumes it', async () => {
    const run = await withKit('empty');
    try {
      const kit = await openKit(run.page);
      const visible = () => run.page.evaluate(() => window.__scene.isVisible());
      expect(await visible()).toBe(true);
      await kit.getByLabel('paused (as if covered)').check();
      expect(await visible()).toBe(false);
      await kit.getByLabel('paused (as if covered)').uncheck();
      expect(await visible()).toBe(true);
    } finally {
      await run.close();
    }
  });

  test('works for the tank too, next to its own panel', async () => {
    const run = await withKit('fishtank');
    try {
      await expect(run.page.locator('#devkit')).toBeVisible();
      await expect(run.page.locator('#dev')).toBeVisible();
      await (await openKit(run.page)).getByRole('button', { name: '+1 h' }).click();
    } finally {
      await run.close();
    }
  });
});
