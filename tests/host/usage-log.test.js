import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitize } from '../../app/main/diagnostics.js';
import {
  LIMITS,
  createUsageLog,
  dayKey,
  dayTable,
  emptyLog,
  measurementSummary,
  memoryBasis,
  normalizeLog,
  sumMetrics,
  usageLines,
} from '../../app/main/usage-log.js';

// 2026-11-21 10:00 local time
const T0 = new Date(2026, 10, 21, 10, 0, 0).getTime();
const MIN = 60_000;

describe('dayKey', () => {
  it('is the local date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 1).getTime())).toBe('2026-12-31');
  });
});

describe('sumMetrics', () => {
  it('adds the CPU and memory of all processes (private bytes where there are some)', () => {
    const result = sumMetrics([
      { cpu: { percentCPUUsage: 1.04 }, memory: { privateBytes: 102400, workingSetSize: 999999 } },
      { cpu: { percentCPUUsage: 0.5 }, memory: { workingSetSize: 51200 } },
    ]);
    expect(result).toEqual({ cpuPct: 1.5, memMB: 150 });
  });

  it('copes with nothing', () => {
    expect(sumMetrics([])).toEqual({ cpuPct: 0, memMB: 0 });
    expect(sumMetrics(undefined)).toEqual({ cpuPct: 0, memMB: 0 });
  });
});

describe('normalizeLog', () => {
  it('starts a new log when there is nothing usable', () => {
    for (const raw of [null, 'x', [], 7]) {
      const log = normalizeLog(raw, T0);
      expect(log.schemaVersion).toBe(1);
      expect(log.days).toEqual({});
      expect(log.installId).toMatch(/^[0-9a-f-]{36}$/);
      expect(log.firstSeenDay).toBe('2026-11-21');
    }
  });

  it('keeps good entries and drops the damaged ones', () => {
    const log = normalizeLog(
      {
        installId: 'abc',
        firstSeenDay: '2026-11-01',
        days: {
          '2026-11-20': { opens: 2, desktopMin: 170, windowMin: 'x', activeMin: -1 },
          'not a day': { opens: 1 },
        },
        samples: [
          { t: 1, state: 'visible-desktop', cpuPct: 1.2, memMB: 190, fps: 30 },
          { t: 2, state: 'visible-desktop', cpuPct: 'high', memMB: 190 },
          null,
        ],
        errors: [{ t: 5, msg: 'boom' }, { t: 6 }],
        startupMs: [1450, 'slow', -3],
      },
      T0,
    );
    expect(log.installId).toBe('abc');
    expect(log.days['2026-11-20']).toEqual({
      opens: 2,
      desktopMin: 170,
      windowMin: 0,
      activeMin: 0,
    });
    expect(Object.keys(log.days)).toEqual(['2026-11-20']);
    expect(log.samples).toHaveLength(1);
    expect(log.errors).toEqual([{ t: 5, msg: 'boom' }]);
    expect(log.startupMs).toEqual([1450]);
  });

  it('keeps only the newest entries (30 days, 500 samples, 20 errors, 10 start times)', () => {
    const many = (n, make) => Array.from({ length: n }, (_, i) => make(i + 1));
    const log = normalizeLog(
      {
        days: Object.fromEntries(
          many(45, (i) => [
            dayKey(new Date(2026, 8, i).getTime()),
            { opens: 1, desktopMin: 0, windowMin: 0, activeMin: 0 },
          ]),
        ),
        samples: many(600, (i) => ({ t: i, state: 's', cpuPct: 1, memMB: 1, fps: null })),
        errors: many(30, (i) => ({ t: i, msg: `e${i}` })),
        startupMs: many(15, (i) => i * 100),
      },
      T0,
    );
    expect(Object.keys(log.days)).toHaveLength(LIMITS.days);
    expect(log.samples).toHaveLength(LIMITS.samples);
    expect(log.samples[0].t).toBe(101);
    expect(log.errors).toHaveLength(LIMITS.errors);
    expect(log.errors.at(-1).msg).toBe('e30');
    expect(log.startupMs).toHaveLength(LIMITS.startups);
  });
});

describe('the usage log', () => {
  let dir;
  let file;
  let now;
  let state;
  let metrics;
  beforeEach(() => {
    vi.useFakeTimers();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-usage-'));
    file = path.join(dir, 'diagnostics.json');
    now = T0;
    state = { mode: 'desktop', paused: false };
    metrics = [{ cpu: { percentCPUUsage: 2 }, memory: { privateBytes: 204800 } }];
  });
  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const make = (extra = {}) =>
    createUsageLog({
      file,
      now: () => now,
      getMetrics: () => metrics,
      getState: () => state,
      ...extra,
    });

  it('counts opens and the minutes the tank was drawn, per mode', () => {
    const usage = make();
    usage.open();
    usage.tick();
    usage.tick();
    state = { mode: 'window', paused: false };
    usage.tick();
    const today = usage.get().days['2026-11-21'];
    expect(today).toEqual({ opens: 1, desktopMin: 2, windowMin: 1, activeMin: 0 });
  });

  it('does not count a minute in which the tank was paused, but still samples it', () => {
    const usage = make();
    state = { mode: 'desktop', paused: true };
    usage.tick();
    const log = usage.get();
    expect(log.days['2026-11-21'].desktopMin).toBe(0);
    expect(log.samples[0]).toMatchObject({ state: 'paused-desktop', cpuPct: 2, memMB: 200 });
  });

  it('counts a minute of activity once, however many clicks come in that minute', () => {
    const usage = make();
    usage.activity();
    now += 10_000;
    usage.activity();
    usage.activity();
    expect(usage.get().days['2026-11-21'].activeMin).toBe(1);
    now += MIN;
    usage.activity();
    expect(usage.get().days['2026-11-21'].activeMin).toBe(2);
  });

  it('starts a new day at midnight (local date)', () => {
    const usage = make();
    usage.open();
    now = new Date(2026, 10, 22, 0, 5).getTime();
    usage.open();
    expect(Object.keys(usage.get().days)).toEqual(['2026-11-21', '2026-11-22']);
  });

  it('puts the latest frame rate next to a sample, and none when it is old', () => {
    const usage = make();
    usage.frameRate(30);
    usage.tick();
    now += 5 * MIN;
    usage.tick();
    const { samples } = usage.get();
    expect(samples[0].fps).toBe(30);
    expect(samples[1].fps).toBeNull();
  });

  it('gives a paused sample no frame rate, even when one was heard a moment ago', () => {
    const usage = make();
    usage.frameRate(30);
    state = { mode: 'desktop', paused: true };
    usage.tick();
    expect(usage.get().samples[0].fps).toBeNull();
  });

  it('keeps at most 500 samples', () => {
    const usage = make();
    for (let i = 0; i < 520; i++) {
      now += MIN;
      usage.tick();
    }
    expect(usage.get().samples).toHaveLength(500);
  });

  it('cleans, shortens and limits errors', () => {
    const usage = make({
      cleanText: (text) => sanitize(text, { home: 'C:\\Users\\jane', userName: 'jane' }),
    });
    usage.error(`TypeError at C:\\Users\\jane\\app\\x.js ${'y'.repeat(500)}`);
    const [error] = usage.get().errors;
    expect(error.msg).not.toMatch(/jane/i);
    expect(error.msg.length).toBeLessThanOrEqual(200);
    for (let i = 0; i < 30; i++) usage.error(`e${i}`);
    expect(usage.get().errors).toHaveLength(20);
  });

  it('keeps the start times and the last desktop result', () => {
    const usage = make();
    usage.startup(1450.4);
    usage.startup('slow');
    usage.desktopResult({ ok: true, layout: 'new', ms: 59.6 });
    usage.desktopResult({ ok: false, reason: 'no Progman' });
    const log = usage.get();
    expect(log.startupMs).toEqual([1450]);
    expect(log.desktop).toEqual({
      layout: 'new',
      attachMs: 60,
      failures: 1,
      lastReason: 'no Progman',
    });
  });

  it('saves after a moment, on flush, and the next start reads it back', () => {
    const usage = make();
    usage.open();
    usage.tick();
    expect(fs.existsSync(file)).toBe(false); // written after a short quiet time
    expect(usage.flush()).toBe(true);
    const again = make();
    again.open();
    expect(again.get().days['2026-11-21'].opens).toBe(2);
    expect(again.get().installId).toBe(usage.get().installId);
    expect(again.get().samples).toHaveLength(1);
  });

  it('takes a sample every minute once started, and stops', async () => {
    const usage = make();
    usage.start();
    await vi.advanceTimersByTimeAsync(3 * MIN + 1000);
    expect(usage.get().samples).toHaveLength(3);
    usage.stop();
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(usage.get().samples).toHaveLength(3);
  });

  it('starts a new log when the file is damaged', () => {
    fs.writeFileSync(file, '{broken');
    const usage = make();
    expect(usage.get().days).toEqual({});
  });
});

describe('the report', () => {
  const log = (() => {
    const l = emptyLog(T0);
    l.installId = 'test-id';
    l.days = {
      '2026-11-21': { opens: 2, desktopMin: 170, windowMin: 20, activeMin: 2 },
      '2026-11-20': { opens: 1, desktopMin: 600, windowMin: 0, activeMin: 1 },
    };
    l.samples = [
      { t: 1, state: 'visible-desktop', cpuPct: 1, memMB: 180, fps: 30 },
      { t: 2, state: 'visible-desktop', cpuPct: 3, memMB: 200, fps: 28 },
      { t: 3, state: 'paused-desktop', cpuPct: 0, memMB: 150, fps: null },
    ];
    l.startupMs = [1450, 1300];
    l.desktop = { layout: 'new', attachMs: 59, failures: 1, lastReason: 'no Progman' };
    l.errors = [{ t: T0, msg: 'TypeError: x is undefined' }];
    return l;
  })();

  it('makes a per-day table that pastes into a spreadsheet (tab separated, oldest first)', () => {
    expect(dayTable(log)).toEqual([
      'date\topens\tdesktop min\twindow min\tactive min',
      '2026-11-20\t1\t600\t0\t1',
      '2026-11-21\t2\t170\t20\t2',
    ]);
  });

  it('summarizes the samples per state', () => {
    const lines = measurementSummary(log.samples);
    expect(lines).toEqual([
      'paused-desktop: 1 samples, cpu avg 0.0% max 0.0%, memory avg 150 MB max 150 MB',
      'visible-desktop: 2 samples, cpu avg 2.0% max 3.0%, memory avg 190 MB max 200 MB, fps avg 29',
    ]);
  });

  it('lists everything in the text for "Copy diagnostics"', () => {
    const text = usageLines(log).join('\n');
    expect(text).toContain('Install: test-id');
    expect(text).toContain('2026-11-21\t2\t170\t20\t2');
    expect(text).toContain('Start times (ms): 1450, 1300');
    expect(text).toContain(
      'Last desktop attach: layout new, 59 ms, 1 failures, last reason: no Progman',
    );
    expect(text).toContain('TypeError: x is undefined');
  });

  it('says which memory number it is, per system', () => {
    const win = usageLines(log, { platform: 'win32' }).join('\n');
    expect(win).toContain('Memory is the private bytes of all the processes.');
    const mac = usageLines(log, { platform: 'darwin' }).join('\n');
    expect(mac).toContain('Memory is the working set');
    expect(mac).toContain('shared pages');
    expect(memoryBasis('linux')).toContain('private bytes');
  });

  it('names the Mac attach instead of showing n/a', () => {
    const none = emptyLog(T0);
    const mac = usageLines(none, { platform: 'darwin' }).join('\n');
    expect(mac).toContain('Last desktop attach: macOS desktop window, 0 failures');
    const win = usageLines(none, { platform: 'win32' }).join('\n');
    expect(win).toContain('Last desktop attach: layout n/a, n/a ms, 0 failures');
    // A layout that was recorded is always shown.
    expect(usageLines(log, { platform: 'darwin' }).join('\n')).toContain('layout new, 59 ms');
  });

  it('says so when there is nothing yet', () => {
    const text = usageLines(emptyLog(T0)).join('\n');
    expect(text).toContain('no samples yet');
    expect(text).toContain('none yet');
    expect(text).toContain('Recent errors:\nnone');
  });
});
