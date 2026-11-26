// The local diagnostics log (NFR-7, D23, tech design 3.7): days opened, minutes the tank was drawn, minutes of
// player activity, once-a-minute CPU, memory and frame-rate samples, recent errors and start times. It is kept in
// `diagnostics.json` in the data folder, is never sent anywhere, and is read by hand from "Copy diagnostics".
// Plain Node (no Electron): the clock, the metrics and the file are passed in, so it is unit-tested.
import crypto from 'node:crypto';
import { createDebouncedWriter, readJson } from './store.js';

export const LIMITS = Object.freeze({
  days: 30,
  samples: 500,
  errors: 20,
  startups: 10,
  messageChars: 200,
});
const MINUTE_MS = 60_000;
/** A frame rate older than this is not shown next to a sample (a paused tank reports none). */
const FPS_FRESH_MS = 90_000;

const pad = (n) => String(n).padStart(2, '0');
/** The local date, for example 2026-11-21 (days use the local date). */
export function dayKey(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const isCount = (value) => Number.isFinite(value) && value >= 0;
const isTime = (value) => Number.isFinite(value) && value > 0;

export function emptyLog(now) {
  return {
    schemaVersion: 1,
    installId: crypto.randomUUID(),
    firstSeenDay: dayKey(now),
    days: {},
    desktop: { layout: null, attachMs: null, failures: 0, lastReason: null },
    samples: [],
    errors: [],
    startupMs: [],
  };
}

/** A log read from disk, repaired entry by entry (a damaged file never stops the app). */
export function normalizeLog(raw, now) {
  const base = emptyLog(now);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const out = { ...base };
  if (typeof raw.installId === 'string' && raw.installId.length <= 64)
    out.installId = raw.installId;
  if (typeof raw.firstSeenDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.firstSeenDay)) {
    out.firstSeenDay = raw.firstSeenDay;
  }
  if (raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days)) {
    for (const [day, value] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !value || typeof value !== 'object') continue;
      const entry = {};
      for (const key of ['opens', 'desktopMin', 'windowMin', 'activeMin']) {
        entry[key] = isCount(value[key]) ? Math.round(value[key]) : 0;
      }
      out.days[day] = entry;
    }
  }
  const d = raw.desktop;
  if (d && typeof d === 'object') {
    out.desktop = {
      layout: typeof d.layout === 'string' ? d.layout.slice(0, 20) : null,
      attachMs: isCount(d.attachMs) ? Math.round(d.attachMs) : null,
      failures: isCount(d.failures) ? Math.round(d.failures) : 0,
      lastReason:
        typeof d.lastReason === 'string' ? d.lastReason.slice(0, LIMITS.messageChars) : null,
    };
  }
  if (Array.isArray(raw.samples)) {
    out.samples = raw.samples
      .filter(
        (s) =>
          s && isTime(s.t) && typeof s.state === 'string' && isCount(s.cpuPct) && isCount(s.memMB),
      )
      .map((s) => ({
        t: s.t,
        state: s.state.slice(0, 30),
        cpuPct: s.cpuPct,
        memMB: s.memMB,
        fps: isCount(s.fps) ? s.fps : null,
      }))
      .slice(-LIMITS.samples);
  }
  if (Array.isArray(raw.errors)) {
    out.errors = raw.errors
      .filter((e) => e && isTime(e.t) && typeof e.msg === 'string')
      .map((e) => ({ t: e.t, msg: e.msg.slice(0, LIMITS.messageChars) }))
      .slice(-LIMITS.errors);
  }
  if (Array.isArray(raw.startupMs)) {
    out.startupMs = raw.startupMs.filter(isCount).map(Math.round).slice(-LIMITS.startups);
  }
  return prune(out);
}

/** Keeps the newest 30 days. */
function prune(log) {
  const keep = Object.keys(log.days).sort().slice(-LIMITS.days);
  for (const day of Object.keys(log.days)) if (!keep.includes(day)) delete log.days[day];
  return log;
}

/** CPU (percent of one core) and memory (MB) summed over all the app's processes, from `app.getAppMetrics()`. */
export function sumMetrics(metrics) {
  let cpu = 0;
  let memoryKB = 0;
  for (const m of metrics ?? []) {
    cpu += m.cpu?.percentCPUUsage ?? 0;
    memoryKB += m.memory?.privateBytes ?? m.memory?.workingSetSize ?? 0;
  }
  return { cpuPct: Math.round(cpu * 10) / 10, memMB: Math.round(memoryKB / 1024) };
}

/**
 * @param {object} options
 * @param {string} options.file
 * @param {() => number} [options.now]
 * @param {() => object[]} options.getMetrics  `app.getAppMetrics`
 * @param {() => {mode: string, paused: boolean}} options.getState
 * @param {(text: string) => string} [options.cleanText]  removes the home folder and user name (diagnostics.sanitize)
 * @param {(error: unknown, failures: number) => void} [options.onWriteError]
 */
export function createUsageLog({
  file,
  now = Date.now,
  getMetrics,
  getState,
  cleanText = (text) => text,
  onWriteError = () => {},
}) {
  const read = readJson(file, { now });
  const log = normalizeLog(read.status === 'ok' ? read.data : null, now());
  const writer = createDebouncedWriter(file, 2000, { onError: onWriteError });
  let timer = null;
  let lastActiveMinute = -1;
  let fps = { value: null, at: 0 };

  const today = () => {
    const key = dayKey(now());
    log.days[key] ??= { opens: 0, desktopMin: 0, windowMin: 0, activeMin: 0 };
    return log.days[key];
  };
  const save = () => {
    prune(log);
    writer.queue(log);
  };
  const push = (list, item, limit) => {
    list.push(item);
    if (list.length > limit) list.splice(0, list.length - limit);
  };

  return {
    /** The app has started: one more open today. */
    open() {
      today().opens += 1;
      save();
    },
    /**
     * Once a minute: counts the minute for the display mode if the tank is drawn, and takes one sample. A paused
     * tank is sampled too (its CPU should be near zero, NFR-1), but its minute is not counted.
     */
    tick() {
      const { mode, paused } = getState();
      const state = `${paused ? 'paused' : 'visible'}-${mode}`;
      const day = today();
      if (!paused) day[mode === 'desktop' ? 'desktopMin' : 'windowMin'] += 1;
      const t = now();
      push(
        log.samples,
        {
          t,
          state,
          ...sumMetrics(getMetrics()),
          // A paused tank draws nothing, so a frame rate heard before the pause does not belong to this minute.
          fps: !paused && fps.value !== null && t - fps.at < FPS_FRESH_MS ? fps.value : null,
        },
        LIMITS.samples,
      );
      save();
    },
    /** A click or key press in the window, or a tray menu action. Counted once per minute. */
    activity() {
      const minute = Math.floor(now() / MINUTE_MS);
      if (minute === lastActiveMinute) return;
      lastActiveMinute = minute;
      today().activeMin += 1;
      save();
    },
    /** The renderer's average frame rate over its last 10 seconds. */
    frameRate(value) {
      if (isCount(value)) fps = { value: Math.round(value), at: now() };
    },
    error(text) {
      const msg = cleanText(String(text)).replace(/\s+/g, ' ').slice(0, LIMITS.messageChars);
      push(log.errors, { t: now(), msg }, LIMITS.errors);
      save();
    },
    /** Time from the start of the process to the tank being ready (NFR-5). */
    startup(ms) {
      if (!isCount(ms)) return;
      push(log.startupMs, Math.round(ms), LIMITS.startups);
      save();
    },
    /** The result of an attempt to show the tank on the desktop (FR-64). */
    desktopResult({ ok, layout, ms, reason }) {
      if (ok) {
        log.desktop.layout = typeof layout === 'string' ? layout.slice(0, 20) : null;
        log.desktop.attachMs = isCount(ms) ? Math.round(ms) : null;
      } else {
        log.desktop.failures += 1;
        log.desktop.lastReason = cleanText(String(reason ?? 'unknown')).slice(
          0,
          LIMITS.messageChars,
        );
      }
      save();
    },
    /** Starts the once-a-minute sampler. It is the only timer that runs while the tank is paused. */
    start(intervalMs = MINUTE_MS) {
      clearInterval(timer);
      timer = setInterval(() => this.tick(), intervalMs);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    /** Writes what is waiting (called on quit). Returns true when nothing is left. */
    flush: () => writer.flushSync(),
    /** The log as it is now (not a copy). */
    get: () => log,
  };
}

const sumBy = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

/** The per-day usage table, tab separated so that it can be pasted into a spreadsheet. Newest day last. */
export function dayTable(log) {
  const days = Object.keys(log.days).sort();
  return [
    ['date', 'opens', 'desktop min', 'window min', 'active min'].join('\t'),
    ...days.map((day) => {
      const d = log.days[day];
      return [day, d.opens, d.desktopMin, d.windowMin, d.activeMin].join('\t');
    }),
  ];
}

/** CPU, memory and frame rate per state: how many samples, the average and the highest. */
export function measurementSummary(samples) {
  const states = [...new Set(samples.map((s) => s.state))].sort();
  return states.map((state) => {
    const items = samples.filter((s) => s.state === state);
    const cpu = items.map((s) => s.cpuPct);
    const mem = items.map((s) => s.memMB);
    const fpsItems = items.filter((s) => s.fps !== null).map((s) => s.fps);
    const avg = (list) => (list.length ? sumBy(list, (v) => v) / list.length : 0);
    const parts = [
      `${state}: ${items.length} samples`,
      `cpu avg ${avg(cpu).toFixed(1)}% max ${Math.max(...cpu).toFixed(1)}%`,
      `memory avg ${Math.round(avg(mem))} MB max ${Math.max(...mem)} MB`,
    ];
    if (fpsItems.length) parts.push(`fps avg ${Math.round(avg(fpsItems))}`);
    return parts.join(', ');
  });
}

/**
 * Which memory number `sumMetrics` adds up. Electron gives private bytes on Windows and Linux; on macOS it gives
 * only the working set, which counts pages shared between the processes and reads well above the footprint that
 * the macOS limit (NFR-4) is measured in (about 190 MB on the M1 with 8 fish).
 */
export function memoryBasis(platform) {
  return platform === 'darwin'
    ? 'working set of all the processes; it counts shared pages, so it reads higher than the memory footprint (NFR-4)'
    : 'private bytes of all the processes';
}

/**
 * All the lines the usage log adds to "Copy diagnostics".
 * @param {object} log
 * @param {{platform?: string}} [options]
 */
export function usageLines(log, { platform = process.platform } = {}) {
  const lines = [
    // The install id stays in diagnostics.json and out of this text: it is pasted into public issues.
    `First seen: ${log.firstSeenDay}`,
    '',
    'Usage per day:',
    ...dayTable(log),
    '',
    'Measurements (once a minute):',
    `Memory is the ${memoryBasis(platform)}.`,
    ...(log.samples.length ? measurementSummary(log.samples) : ['no samples yet']),
    '',
    `Start times (ms): ${log.startupMs.length ? log.startupMs.join(', ') : 'none yet'}`,
  ];
  const d = log.desktop;
  // The Mac has no attach step: Electron's desktop window type does it, so there is no layout or time to show.
  const attach =
    d.layout == null && platform === 'darwin'
      ? 'macOS desktop window'
      : `layout ${d.layout ?? 'n/a'}, ${d.attachMs ?? 'n/a'} ms`;
  lines.push(
    `Last desktop attach: ${attach}, ${d.failures} failures${d.lastReason ? `, last reason: ${d.lastReason}` : ''}`,
  );
  lines.push('', 'Recent errors:');
  if (log.errors.length === 0) lines.push('none');
  for (const e of log.errors) lines.push(`${new Date(e.t).toISOString()} ${e.msg}`);
  return lines;
}
