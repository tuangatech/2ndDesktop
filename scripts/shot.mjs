// Launches the app through Playwright and saves a screenshot of its window, so the look can be reviewed
// without a person at the keyboard.
// The picture is reproducible: a fixed seed, the manual clock and a seeded Math.random, and the scene is stepped by
// <seconds> of simulated time (30 steps a second) before the picture, so two runs of the same code give the same
// fish, bubbles and pellets (on the same machine and graphics card). Set SHOT_LIVE=1 to get the old behaviour: real
// time, real random numbers, and <seconds> of waiting.
// Usage: npm run shot -- <name> [WIDTHxHEIGHT] [window|desktop] [seconds]
//   npm run shot -- tank 480x320
//   npm run shot -- tank-1080p 1920x1080 desktop 6
//   npm run shot -- fry 480x320 window 4 "__tank.repository.getState().fish.forEach((f) => __tank.repository.dev.setPoints(f.id, 0))"
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seededRandomScript } from './seeded-random.mjs';

const [name = 'shot', size = '480x320', renderMode = 'window', seconds = '4', script = ''] =
  process.argv.slice(2);
const root = path.join(import.meta.dirname, '..');
const outDir = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-shot-'));
const live = process.env.SHOT_LIVE === '1';

const app = await electron.launch({
  args: [root],
  env: {
    ...env,
    FISHTANK_USER_DATA: dataDir,
    FISHTANK_MODE: 'window',
    FISHTANK_TEST: '1',
    FISHTANK_WINDOW_SIZE: size,
    FISHTANK_TEST_RENDER_MODE: renderMode,
    FISHTANK_DEBUG: '1',
    ...(live ? {} : { FISHTANK_SEED: '20261121', FISHTANK_MANUAL_TIME: '1' }),
    // The first window of a run was coloured differently from the later ones on the Mac (colour management of the
    // display); a fixed colour profile makes the pictures comparable.
    ...(live || process.env.FISHTANK_CHROMIUM_FLAGS
      ? {}
      : { FISHTANK_CHROMIUM_FLAGS: 'force-color-profile=srgb' }),
  },
});
try {
  const page = await app.firstWindow();
  page.on('pageerror', (error) => console.log('page error:', error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      console.log(`page ${message.type()}:`, message.text());
  });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  if (!live) {
    // The seeded random numbers must be there before the page starts, so the page is started again.
    await page.addInitScript(seededRandomScript());
    await page.reload();
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  }
  // An optional script runs in the page first, for example: "__tank.repository.getState().fish.forEach((f) => __tank.repository.dev.setPoints(f.id, 0))"
  if (script) {
    const result = await page.evaluate(script);
    if (result !== undefined) console.log(result);
  }
  if (live) {
    await page.waitForTimeout(Number(seconds) * 1000);
  } else {
    const steps = Math.round(Number(seconds) * 30);
    await page.evaluate((n) => {
      for (let i = 0; i < n; i++) window.__tank.fishtank.update(1 / 30);
      // The debug label (the only Text on the stage) shows the frame rate, which differs from run to run.
      for (const child of window.__tank.app.stage.children) {
        if ('text' in child) child.visible = false;
      }
    }, steps);
    await page.waitForTimeout(1500); // a drawn frame, and the first-launch hint finishes its fade-in
  }
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`saved ${path.relative(root, file)} (${size}, ${renderMode} scene)`);
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
