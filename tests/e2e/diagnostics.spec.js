import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from './helpers.js';

const readLog = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'diagnostics.json'), 'utf8'));

test.describe('the diagnostics log (NFR-7)', () => {
  test('counts the open, the minutes drawn, activity, samples and the start time', async () => {
    const dataDir = makeDataDir();
    try {
      const app = await launch({ dataDir, env: { FISHTANK_DIAG_MS: '300' } });
      // A click counts as activity; mouse movement alone does not.
      await app.page.mouse.move(100, 100);
      await app.page.mouse.move(150, 120);
      await app.page.mouse.click(200, 150);
      // Several ticks of 300 ms (the file itself is written on quit).
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await app.close(); // the log is written on quit

      const log = readLog(dataDir);
      const days = Object.values(log.days);
      expect(days).toHaveLength(1);
      expect(days[0].opens).toBe(1);
      expect(days[0].windowMin).toBeGreaterThanOrEqual(1);
      expect(days[0].desktopMin).toBe(0);
      expect(days[0].activeMin).toBe(1);
      expect(log.samples[0]).toMatchObject({ state: 'visible-window' });
      expect(log.samples[0].memMB).toBeGreaterThan(20);
      expect(log.startupMs).toHaveLength(1);
      expect(log.startupMs[0]).toBeGreaterThan(100);
      expect(log.installId).toMatch(/^[0-9a-f-]{36}$/);

      // The next start adds an open and keeps the same install.
      const again = await launch({ dataDir });
      await again.close();
      const second = readLog(dataDir);
      expect(Object.values(second.days)[0].opens).toBe(2);
      expect(second.installId).toBe(log.installId);
      expect(second.startupMs).toHaveLength(2);
    } finally {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // Windows may still hold the folder for a moment.
      }
    }
  });

  test('records an error of the page', async () => {
    const dataDir = makeDataDir();
    try {
      const app = await launch({ dataDir });
      await app.page.evaluate(() => {
        setTimeout(() => {
          throw new Error('test error from the page');
        }, 0);
      });
      await expect
        .poll(async () => {
          await new Promise((r) => setTimeout(r, 100));
          return app.app.evaluate(() => true);
        })
        .toBe(true);
      await app.close();
      const log = readLog(dataDir);
      expect(log.errors.some((e) => e.msg.includes('test error from the page'))).toBe(true);
    } finally {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // Windows may still hold the folder for a moment.
      }
    }
  });
});
