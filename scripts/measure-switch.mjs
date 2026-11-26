// Measures the host with one scene, and what switching scenes costs (work package 7.7; docs/platform/05, section 5).
// A script, not a CI test: the numbers depend on the machine and its graphics card, so they are read by a person.
//
// It starts the built app with a clean data folder, lets it settle, measures memory of every process and the frame
// time of the page, switches between the tank and the empty scene N times (the same call the tray menu makes, through
// the test hook), settles again (with --gc 1 and a forced garbage collection of the page) and measures again. Memory that grows by more than the noise (about 3 MB) over 20
// switches is a leak of the host or of a scene.
//
// Usage (after `npm run build`):
//   npm run measure:switch -- [--switches 20] [--scene fishtank|empty] [--mode window|desktop] [--seconds 10] [--settle 8] [--gc 0|1]
//   npm run measure:switch                                   20 switches, starting on the tank, in a window
//   npm run measure:switch -- --switches 0 --scene empty     a baseline: the empty scene alone, no switch
//   npm run measure:switch -- --switches 0 --mode desktop    the tank alone attached to the real desktop
// `desktop` really attaches the scene to the desktop (behind the icons) for the length of the run.
//
// Which memory number: Windows prints private bytes per process type (what `docs/platform/05` calls the Windows
// number); macOS prints the memory footprint (`footprint -p`, the number Activity Monitor shows), because Electron's
// working set on the Mac reads about 190 MB too high. Both also print Electron's working set for reference.
/* global window */
import { _electron as electron } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCENES = ['fishtank', 'empty'];
const SAMPLES = 5; // memory is read this many times, a second apart, and the median is used

function parseArgs(argv) {
  const options = {
    switches: 20,
    scene: 'fishtank',
    mode: 'window',
    seconds: 10,
    settle: 8,
    gc: 0,
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (!(key in options) || value === undefined)
      throw new Error(`unknown or incomplete option: ${argv[i]}`);
    options[key] = typeof options[key] === 'number' ? Number(value) : value;
  }
  if (!SCENES.includes(options.scene)) throw new Error(`--scene is one of ${SCENES.join(', ')}`);
  if (!['window', 'desktop'].includes(options.mode)) throw new Error('--mode is window or desktop');
  if (!Number.isInteger(options.switches) || options.switches < 0)
    throw new Error('--switches is 0 or more');
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN;
};
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : NaN;
};
const mb = (value) => (Number.isFinite(value) ? value.toFixed(1) : 'n/a');

/** Memory footprint of one process on the Mac, in MB (NaN when `footprint` says nothing we can read). */
function footprintMB(pid) {
  try {
    const text = execFileSync('footprint', ['-p', String(pid)], { encoding: 'utf8' });
    const match = /Footprint:\s*([\d.]+)\s*([KMG])B/i.exec(text);
    if (!match) return NaN;
    const scale = { K: 1 / 1024, M: 1, G: 1024 }[match[2].toUpperCase()];
    return Number(match[1]) * scale;
  } catch {
    return NaN;
  }
}

/** One reading: MB per process type, and the total, on the machine's own number (see the top of the file). */
async function readMemory(app) {
  const metrics = await app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics());
  const byType = {};
  let workingSet = 0;
  for (const { pid, type, memory } of metrics) {
    let value;
    if (process.platform === 'win32') value = (memory.privateBytes ?? 0) / 1024;
    else if (process.platform === 'darwin') value = footprintMB(pid);
    else value = (memory.workingSetSize ?? 0) / 1024;
    byType[type] = (byType[type] ?? 0) + value;
    workingSet += (memory.workingSetSize ?? 0) / 1024;
  }
  return { byType, total: Object.values(byType).reduce((a, b) => a + b, 0), workingSet };
}

/** The median of several readings, type by type. */
async function memoryNow(app) {
  const readings = [];
  for (let i = 0; i < SAMPLES; i++) {
    readings.push(await readMemory(app));
    if (i < SAMPLES - 1) await sleep(1000);
  }
  const types = new Set(readings.flatMap((reading) => Object.keys(reading.byType)));
  const byType = {};
  for (const type of types)
    byType[type] = median(readings.map((reading) => reading.byType[type] ?? 0));
  return {
    byType,
    total: median(readings.map((reading) => reading.total)),
    workingSet: median(readings.map((reading) => reading.workingSet)),
  };
}

/**
 * Frames of the page for `seconds`: the gap between two ticks (what the player sees), and the work of a tick (update
 * of the scene plus the drawing calls; not the GPU). The ticker is PixiJS's own, so the host's frame cap applies.
 */
function frames(page, seconds) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const { ticker } = window.__scene.app;
        const gaps = [];
        const work = [];
        let last = null;
        let began = 0;
        const begin = () => {
          began = performance.now();
          if (last !== null) gaps.push(began - last);
          last = began;
        };
        const end = () => work.push(performance.now() - began);
        ticker.add(begin, null, 50); // before everything (PixiJS: INTERACTION)
        ticker.add(end, null, -50); // after the drawing (PixiJS: UTILITY)
        setTimeout(() => {
          ticker.remove(begin);
          ticker.remove(end);
          resolve({ gaps, work });
        }, ms);
      }),
    seconds * 1000,
  );
}

const frameSummary = ({ gaps, work }) => {
  if (gaps.length < 2) return { ticks: gaps.length, note: 'no frames: the scene is paused' };
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return {
    ticks: gaps.length,
    fps: 1000 / mean,
    gapMean: mean,
    gapP95: percentile(gaps, 0.95),
    workMean: work.reduce((a, b) => a + b, 0) / work.length,
    workP95: percentile(work, 0.95),
  };
};

const options = parseArgs(process.argv.slice(2));
const SETTLE_MS = options.settle * 1000; // after a start or the last switch: the early high stretch, the garbage collector
const root = path.join(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), '2nddesktop-measure-'));
fs.writeFileSync(
  path.join(dataDir, 'settings.json'),
  JSON.stringify({ activeScene: options.scene }),
);

const app = await electron.launch({
  args: [root],
  env: {
    ...env,
    DESKTOP2_USER_DATA: dataDir,
    DESKTOP2_MODE: options.mode,
    DESKTOP2_TEST: '1', // the hook that switches the scene exists only with this
    DESKTOP2_DEBUG: '1', // window.__scene.app, for the ticker
  },
});
try {
  const page = await app.firstWindow();
  const ready = () =>
    page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  await ready();
  const sceneNow = () =>
    page.evaluate(async () => (await window.desktop2.getAppInfo()).activeScene);

  const electronVersion = await app.evaluate(() => process.versions.electron);
  await sleep(SETTLE_MS);
  const startScene = await sceneNow();
  const before = {
    memory: await memoryNow(app),
    frames: frameSummary(await frames(page, options.seconds)),
  };

  const switchTimes = [];
  const along = [];
  for (let i = 1; i <= options.switches; i++) {
    const current = await sceneNow();
    const target = SCENES.find((id) => id !== current);
    const began = performance.now();
    const result = await app.evaluate(
      (_e, id) => globalThis.__desktop2Test.switchScene(id),
      target,
    );
    if (!result?.ok) throw new Error(`switch ${i} to ${target} failed: ${JSON.stringify(result)}`);
    await ready();
    switchTimes.push(performance.now() - began);
    if (i % 5 === 0 && i !== options.switches)
      along.push({ after: i, total: (await readMemory(app)).total });
    await sleep(500);
  }
  const endScene = await sceneNow();
  let after = null;
  if (options.switches > 0) {
    await sleep(SETTLE_MS);
    if (options.gc) {
      // Garbage the page has not given back yet is not a leak: after a forced collection what is left is.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage');
      await sleep(2000);
    }
    after = {
      memory: await memoryNow(app),
      frames: frameSummary(await frames(page, options.seconds)),
    };
  }

  // The report.
  const basis =
    process.platform === 'darwin'
      ? 'memory footprint'
      : process.platform === 'win32'
        ? 'private bytes'
        : 'working set';
  console.log(
    `${os.platform()} ${os.release()}, Electron ${electronVersion}, mode ${options.mode}, started on ${startScene}, ${options.switches} switches, ends on ${endScene}`,
  );
  console.log(
    `memory in MB (${basis}; median of ${SAMPLES} readings, ${SETTLE_MS / 1000} s after the start / the last switch)`,
  );
  const types = [
    ...new Set([...Object.keys(before.memory.byType), ...Object.keys(after?.memory.byType ?? {})]),
  ].sort();
  const header = ['process', 'before', ...(after ? ['after', 'change'] : [])];
  const rows = types.map((type) => {
    const b = before.memory.byType[type] ?? 0;
    const a = after?.memory.byType[type] ?? 0;
    return [type, mb(b), ...(after ? [mb(a), (a - b >= 0 ? '+' : '') + mb(a - b)] : [])];
  });
  const totalRow = [
    'total',
    mb(before.memory.total),
    ...(after
      ? [
          mb(after.memory.total),
          (after.memory.total - before.memory.total >= 0 ? '+' : '') +
            mb(after.memory.total - before.memory.total),
        ]
      : []),
  ];
  const workingRow = [
    'electron working set',
    mb(before.memory.workingSet),
    ...(after
      ? [
          mb(after.memory.workingSet),
          (after.memory.workingSet - before.memory.workingSet >= 0 ? '+' : '') +
            mb(after.memory.workingSet - before.memory.workingSet),
        ]
      : []),
  ];
  for (const row of [header, ...rows, totalRow, workingRow]) {
    console.log('  ' + row.map((cell, i) => String(cell).padEnd(i === 0 ? 22 : 9)).join(''));
  }
  if (along.length)
    console.log(
      `total after each 5 switches (one reading, no settling): ${along.map((p) => `${p.after}: ${mb(p.total)}`).join(', ')}`,
    );

  const describe = (summary) =>
    summary.note ??
    `${summary.fps.toFixed(1)} fps (${summary.ticks} ticks), gap ${summary.gapMean.toFixed(1)} ms (95th ${summary.gapP95.toFixed(1)}), work ${summary.workMean.toFixed(2)} ms (95th ${summary.workP95.toFixed(2)})`;
  console.log(`frames, ${startScene}, before: ${describe(before.frames)}`);
  if (after) console.log(`frames, ${endScene}, after:  ${describe(after.frames)}`);
  if (switchTimes.length) {
    console.log(
      `switch to ready: median ${median(switchTimes).toFixed(0)} ms, largest ${Math.max(...switchTimes).toFixed(0)} ms (${switchTimes.length} switches)`,
    );
  }
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
