// Safe JSON files (plan 5B, tech design 3.4): atomic writes, one backup, damaged files moved aside, and a
// debounced writer. Used for the scene records and, later, the settings and the diagnostics log.
// Plain Node (no Electron), so it is unit-tested with a temporary folder.
import fs from 'node:fs';
import path from 'node:path';
import { isSceneId } from './scene-id.js';

const backupName = (file) => file.replace(/\.json$/, '.backup.json');

/**
 * Writes `data` to `file` without ever leaving a half-written file: write `name.tmp`, flush it, copy the old
 * good file to `name.backup.json`, then rename the new file over the old one.
 */
export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(data));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (fs.existsSync(file)) {
    try {
      // Only a file that still parses is worth keeping as the backup.
      JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.copyFileSync(file, backupName(file));
    } catch {
      // The old file is damaged: keep the previous backup.
    }
  }
  fs.renameSync(tmp, file);
}

function tryRead(file) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    return { ok: false, missing: error?.code === 'ENOENT' };
  }
}

/**
 * Reads `file`, falling back to its backup. Returns
 * `{ status: 'ok', data, fromBackup }`, `{ status: 'missing' }` (nothing was ever saved) or
 * `{ status: 'corrupt', movedTo }` (both files are bad: the bad one was moved aside, start a new tank).
 */
export function readJson(file, { now = Date.now } = {}) {
  const main = tryRead(file);
  if (main.ok) return { status: 'ok', data: main.data, fromBackup: false };
  const backup = tryRead(backupName(file));
  if (backup.ok) return { status: 'ok', data: backup.data, fromBackup: true };
  if (main.missing && backup.missing) return { status: 'missing' };
  let movedTo = null;
  if (!main.missing) {
    movedTo = file.replace(/\.json$/, `.corrupt-${now()}.json`);
    try {
      fs.renameSync(file, movedTo);
    } catch {
      movedTo = null;
    }
  }
  return { status: 'corrupt', movedTo };
}

const MAX_RETRY_MS = 60_000;

/**
 * A writer that saves after `delayMs` of quiet, and at once on `flushSync()` (called on quit, D8).
 * A write can fail (on Windows an antivirus or the search indexer may hold the file for a moment, or the disk is
 * full): the data then stays pending, `onError(error, failures)` is called, and the write is tried again after a
 * growing delay. It never throws, because it runs from a timer in the main process.
 */
export function createDebouncedWriter(file, delayMs = 1000, { onError = () => {} } = {}) {
  let pending = null;
  let timer = null;
  let failures = 0;
  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(write, ms);
    timer.unref?.();
  };
  /** Returns true when nothing is left to write. */
  function write() {
    clearTimeout(timer);
    timer = null;
    if (pending === null) return true;
    try {
      writeJsonAtomic(file, pending);
    } catch (error) {
      failures++;
      onError(error, failures);
      schedule(Math.min(MAX_RETRY_MS, delayMs * 2 ** failures));
      return false;
    }
    pending = null;
    failures = 0;
    return true;
  }
  return {
    queue(data) {
      pending = data;
      if (failures === 0) schedule(delayMs); // while retrying, the retry timer writes the newest data
    },
    flushSync: write,
    /** The newest data that is not on disk yet, or null. */
    pending: () => pending,
  };
}

const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const MAX_KEPT_COPIES = 5;
const validId = isSceneId; // the one rule for a scene id (scene-id.js)

/**
 * The records of the scenes (docs/03-platform-design.md section 5): one file per scene id in `dir`.
 * Anything that comes from the renderer is checked: the id is a plain slug, the data is a plain object of
 * a sane size.
 */
export function createRecordStore({ dir, delayMs = 1000, now = Date.now, onError = () => {} }) {
  const writers = new Map();
  const fileFor = (id) => path.join(dir, `${id}.json`);
  const writerFor = (id) => {
    if (!writers.has(id)) {
      const write = createDebouncedWriter(fileFor(id), delayMs, {
        onError: (error, failures) => onError(id, error, failures),
      });
      writers.set(id, write);
    }
    return writers.get(id);
  };
  return {
    isValidId: validId,
    /** The newest record: unsaved data first, then the file. */
    load(id) {
      if (!validId(id)) return { status: 'missing' };
      const pending = writers.get(id)?.pending();
      if (pending) return { status: 'ok', data: pending, fromBackup: false };
      return readJson(fileFor(id), { now });
    },
    /** Returns false when the data is refused. */
    queue(id, data) {
      if (!validId(id)) return false;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      if (JSON.stringify(data).length > MAX_RECORD_BYTES) return false;
      writerFor(id).queue(data);
      return true;
    },
    /** Writes everything that is waiting; returns false when a write failed (it stays pending). */
    flushAll() {
      let ok = true;
      for (const writer of writers.values()) ok = writer.flushSync() && ok;
      return ok;
    },
    /**
     * Keeps a copy of a record that was repaired or replaced, as `<id>-damaged-<time>.json` next to it. It is
     * written at once and never throws; the answer says why a copy was not kept, so the caller can log it. Only
     * the newest `keep` copies of a scene stay, so a save that keeps failing cannot fill the folder.
     * @returns {{ok: true} | {ok: false, reason: 'invalid_id'|'invalid_data'|'too_large'|'write_failed', code?: string}}
     */
    keepCopy(id, data, { keep = MAX_KEPT_COPIES } = {}) {
      if (!validId(id)) return { ok: false, reason: 'invalid_id' };
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ok: false, reason: 'invalid_data' };
      }
      if (JSON.stringify(data).length > MAX_RECORD_BYTES) return { ok: false, reason: 'too_large' };
      try {
        writeJsonAtomic(path.join(dir, `${id}-damaged-${now()}.json`), data);
      } catch (error) {
        return { ok: false, reason: 'write_failed', code: error?.code ?? error?.name };
      }
      pruneCopies(dir, id, keep);
      return { ok: true };
    },
  };
}

/** Deletes all but the newest `keep` damaged copies of the record `id`. Best effort. */
function pruneCopies(dir, id, keep) {
  try {
    const pattern = new RegExp(`^${id}-damaged-(\\d+)\\.json$`);
    const copies = fs
      .readdirSync(dir)
      .map((name) => ({ name, time: Number(pattern.exec(name)?.[1]) }))
      .filter((copy) => Number.isFinite(copy.time))
      .sort((a, b) => b.time - a.time);
    for (const old of copies.slice(keep)) fs.rmSync(path.join(dir, old.name), { force: true });
  } catch {
    // A copy that cannot be deleted is only clutter.
  }
}
