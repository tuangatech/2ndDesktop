import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from './helpers.js';

const bounds = ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getNormalBounds();

test.describe('window rules and placement (FR-19)', () => {
  test('opens at 480 x 320 inside the work area of the display, and has the size limits', async () => {
    const { app, close } = await launch();
    try {
      const result = await app.evaluate(({ BrowserWindow, screen }) => {
        const win = BrowserWindow.getAllWindows()[0];
        const area = screen.getPrimaryDisplay().workArea;
        return {
          bounds: win.getNormalBounds(),
          area,
          min: win.getMinimumSize(),
          max: win.getMaximumSize(),
        };
      });
      const { bounds: b, area } = result;
      expect(b.x).toBeGreaterThanOrEqual(area.x);
      expect(b.y).toBeGreaterThanOrEqual(area.y);
      expect(b.x + b.width).toBeLessThanOrEqual(area.x + area.width);
      expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height);
      expect(b.width / b.height).toBeCloseTo(1.5, 1);
      expect(result.min[0] / result.min[1]).toBeCloseTo(1.5, 1);
      expect(result.max[0]).toBeLessThanOrEqual(1200);
      expect(result.max[1]).toBeLessThanOrEqual(800);
    } finally {
      await close();
    }
  });

  test('remembers where the window was left and opens there next time', async () => {
    const dataDir = makeDataDir();
    try {
      const first = await launch({ dataDir });
      const wanted = await first.app.evaluate(({ BrowserWindow, screen }) => {
        const win = BrowserWindow.getAllWindows()[0];
        const area = screen.getPrimaryDisplay().workArea;
        const next = { x: area.x + 40, y: area.y + 30, width: 420, height: 280 };
        win.setBounds(next);
        return { next, got: win.getNormalBounds() };
      });
      await first.close(); // the position is written when the window closes
      const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
      expect(saved.window).toMatchObject(wanted.got);

      // On a scaled display (for example 150%) the system rounds a size to whole device pixels, so a size can
      // differ by a few pixels. The position is exact, and the size must not creep on every launch.
      const second = await launch({ dataDir });
      const again = await second.app.evaluate(bounds);
      expect(again).toMatchObject({ x: wanted.got.x, y: wanted.got.y });
      expect(Math.abs(again.width - wanted.got.width)).toBeLessThanOrEqual(8);
      expect(Math.abs(again.height - wanted.got.height)).toBeLessThanOrEqual(8);
      await second.close();
      const third = await launch({ dataDir });
      expect(await third.app.evaluate(bounds)).toEqual(again);
      await third.close();
    } finally {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // Windows may still hold the folder for a moment.
      }
    }
  });

  test('opens on the display when the remembered place is no longer on any screen', async () => {
    const dataDir = makeDataDir();
    try {
      fs.writeFileSync(
        path.join(dataDir, 'settings.json'),
        JSON.stringify({ window: { x: 9000, y: 9000, width: 600, height: 400 } }),
      );
      const { app, close } = await launch({ dataDir });
      const result = await app.evaluate(({ BrowserWindow, screen }) => ({
        bounds: BrowserWindow.getAllWindows()[0].getNormalBounds(),
        area: screen.getPrimaryDisplay().workArea,
      }));
      const { bounds: b, area } = result;
      expect(b.x + b.width).toBeLessThanOrEqual(area.x + area.width);
      expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height);
      expect(Math.abs(b.width - 600)).toBeLessThanOrEqual(8); // keeps its size (FR-19)
      await close();
    } finally {
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // Windows may still hold the folder for a moment.
      }
    }
  });
});
