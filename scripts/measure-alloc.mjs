// Measures how much memory one frame of the tank allocates (short-lived objects the garbage collector must clean
// up), with V8's sampling heap profiler. It drives `fishtank.update(1/30)` directly with the drawing loop stopped,
// so the numbers do not depend on the display or the frame rate. See docs/perf-notes.md, "Garbage per frame".
// Usage (after `npm run build`; build with `npx vite build --minify false` to see real function names):
//   npm run measure:alloc -- [frames] [fish] [--top]
//   npm run measure:alloc                  1800 frames, 8 fish
//   npm run measure:alloc -- 1800 8 --top  also lists the functions that allocate most
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const top = args.includes('--top');
const [frames = 1800, fish = 8] = args.filter((a) => a !== '--top').map(Number);
const root = path.join(import.meta.dirname, '..');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-alloc-'));
const app = await electron.launch({
  args: [root],
  env: {
    ...env,
    FISHTANK_USER_DATA: dataDir,
    FISHTANK_MODE: 'window',
    FISHTANK_TEST: '1',
    FISHTANK_DEBUG: '1',
    FISHTANK_FISH: String(fish),
  },
});
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');

  // Wandering with a moving pointer, or feeding: a pellet every 2 seconds at changing places.
  const run = (feeding) =>
    page.evaluate(
      ({ frames, feeding }) => {
        const { fishtank, scene, app, repository } = window.__tank;
        app.ticker.stop();
        for (let i = 0; i < frames; i++) {
          if (feeding && i % 60 === 0) {
            repository.dev.addStash(1);
            const x = scene.layout.width * (0.3 + (i % 7) * 0.06);
            scene.dropAt(x, scene.layout.dropBand.y + 2, { quiet: true });
          }
          scene.setPointer(200 + (i % 100), 200);
          fishtank.update(1 / 30);
        }
      },
      { frames, feeding },
    );

  console.log(`${fish} fish, ${frames} frames`);
  for (const feeding of [false, true]) {
    await run(feeding); // warm up, so the JIT has settled
    await cdp.send('HeapProfiler.startSampling', {
      samplingInterval: 256,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
    await run(feeding);
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    let total = 0;
    const byFunction = new Map();
    const walk = (node) => {
      total += node.selfSize;
      const { functionName, url, lineNumber } = node.callFrame;
      const key = `${functionName || '(anonymous)'} ${path.basename(url)}:${lineNumber + 1}`;
      byFunction.set(key, (byFunction.get(key) ?? 0) + node.selfSize);
      node.children.forEach(walk);
    };
    walk(profile.head);
    console.log(
      `${feeding ? 'feeding  ' : 'wandering'} ${(total / frames / 1024).toFixed(1)} KB per frame`,
    );
    if (top) {
      for (const [key, bytes] of [...byFunction].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
        console.log(`  ${String(Math.round(bytes / frames)).padStart(6)} B  ${key}`);
      }
    }
  }
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
