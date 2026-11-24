import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDebouncedWriter,
  createRecordStore,
  readJson,
  writeJsonAtomic,
} from '../../electron/store.js';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-store-'));
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeJsonAtomic and readJson', () => {
  it('round-trips and reports a file that was never written as missing', () => {
    const file = path.join(dir, 'a.json');
    expect(readJson(file)).toEqual({ status: 'missing' });
    writeJsonAtomic(file, { a: 1, list: [1, 2] });
    expect(readJson(file)).toEqual({
      status: 'ok',
      data: { a: 1, list: [1, 2] },
      fromBackup: false,
    });
  });

  it('leaves no temporary file and keeps the previous good file as the backup', () => {
    const file = path.join(dir, 'a.json');
    writeJsonAtomic(file, { v: 1 });
    writeJsonAtomic(file, { v: 2 });
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'a.backup.json'), 'utf8'))).toEqual({ v: 1 });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ v: 2 });
  });

  it('falls back to the backup when the main file is truncated', () => {
    const file = path.join(dir, 'a.json');
    writeJsonAtomic(file, { v: 1 });
    writeJsonAtomic(file, { v: 2 });
    fs.writeFileSync(file, '{"v":');
    expect(readJson(file)).toEqual({ status: 'ok', data: { v: 1 }, fromBackup: true });
  });

  it('does not overwrite a good backup with a damaged main file', () => {
    const file = path.join(dir, 'a.json');
    writeJsonAtomic(file, { v: 1 });
    writeJsonAtomic(file, { v: 2 });
    fs.writeFileSync(file, 'garbage');
    writeJsonAtomic(file, { v: 3 });
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'a.backup.json'), 'utf8'))).toEqual({ v: 1 });
    expect(readJson(file).data).toEqual({ v: 3 });
  });

  it('moves the file aside when both are bad, and then reports a new start', () => {
    const file = path.join(dir, 'a.json');
    fs.writeFileSync(file, 'garbage');
    fs.writeFileSync(path.join(dir, 'a.backup.json'), 'also garbage');
    const result = readJson(file, { now: () => 123 });
    expect(result.status).toBe('corrupt');
    expect(result.movedTo).toBe(path.join(dir, 'a.corrupt-123.json'));
    expect(fs.readFileSync(result.movedTo, 'utf8')).toBe('garbage');
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe('createDebouncedWriter', () => {
  it('writes once after a second of quiet, with the newest data', () => {
    vi.useFakeTimers();
    const file = path.join(dir, 'd.json');
    const writer = createDebouncedWriter(file, 1000);
    writer.queue({ n: 1 });
    vi.advanceTimersByTime(600);
    writer.queue({ n: 2 });
    vi.advanceTimersByTime(600);
    expect(fs.existsSync(file)).toBe(false);
    vi.advanceTimersByTime(500);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ n: 2 });
    expect(writer.pending()).toBe(null);
  });

  // On Windows an antivirus or the indexer can hold the file; the main process must not crash and lose the save.
  it('keeps the data and tries again with a growing delay when a write fails', () => {
    vi.useFakeTimers();
    const file = path.join(dir, 'd.json');
    fs.mkdirSync(file); // a folder where the file should be: every write fails
    const errors = [];
    const writer = createDebouncedWriter(file, 1000, { onError: (e, n) => errors.push(n) });
    writer.queue({ n: 1 });
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(errors).toEqual([1]);
    expect(writer.pending()).toEqual({ n: 1 });
    writer.queue({ n: 2 }); // newer data while retrying replaces the pending data
    vi.advanceTimersByTime(2000);
    expect(errors).toEqual([1, 2]);
    expect(writer.flushSync()).toBe(false);
    fs.rmSync(file, { recursive: true });
    vi.advanceTimersByTime(8000);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ n: 2 });
    expect(writer.pending()).toBe(null);
    expect(writer.flushSync()).toBe(true);
  });

  it('flushSync writes at once', () => {
    const file = path.join(dir, 'd.json');
    const writer = createDebouncedWriter(file, 60_000);
    writer.queue({ n: 7 });
    writer.flushSync();
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ n: 7 });
  });
});

describe('createRecordStore', () => {
  it('saves a record per scene id and returns unsaved data first', () => {
    const store = createRecordStore({ dir, delayMs: 60_000 });
    expect(store.load('fishtank')).toEqual({ status: 'missing' });
    expect(store.queue('fishtank', { schemaVersion: 1, state: { a: 1 } })).toBe(true);
    expect(store.load('fishtank').data).toEqual({ schemaVersion: 1, state: { a: 1 } });
    store.flushAll();
    expect(fs.existsSync(path.join(dir, 'fishtank.json'))).toBe(true);
    expect(createRecordStore({ dir }).load('fishtank').status).toBe('ok');
  });

  it('reports a failed write with the scene id, and flushAll says so', () => {
    const errors = [];
    const store = createRecordStore({ dir, onError: (id, error) => errors.push([id, error.code]) });
    fs.mkdirSync(path.join(dir, 'fishtank.json'));
    store.queue('fishtank', { a: 1 });
    expect(store.flushAll()).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0][0]).toBe('fishtank');
    expect(store.load('fishtank').data).toEqual({ a: 1 }); // the unsaved data is still what loads
  });

  it('refuses ids that could leave the folder, and data that is not a plain object', () => {
    const store = createRecordStore({ dir });
    for (const id of ['../x', 'a/b', 'A', '', '.', 'x'.repeat(41), null, 5]) {
      expect(store.queue(id, { a: 1 })).toBe(false);
      expect(store.load(id)).toEqual({ status: 'missing' });
    }
    expect(store.queue('ok-id', [1, 2])).toBe(false);
    expect(store.queue('ok-id', 'text')).toBe(false);
    expect(store.queue('ok-id', null)).toBe(false);
    expect(store.queue('ok-id', { big: 'x'.repeat(3 * 1024 * 1024) })).toBe(false);
  });
});

describe('createRecordStore keepCopy', () => {
  const copies = () => fs.readdirSync(dir).filter((name) => name.includes('-damaged-'));

  it('writes the copy at once, named by the clock, and leaves the record alone', () => {
    let time = 1000;
    const store = createRecordStore({ dir, now: () => time });
    store.queue('fishtank', { a: 1 });
    store.flushAll();
    expect(store.keepCopy('fishtank', { old: true })).toEqual({ ok: true });
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, 'fishtank-damaged-1000.json'), 'utf8')),
    ).toEqual({
      old: true,
    });
    expect(store.load('fishtank').data).toEqual({ a: 1 });
    time = 2000;
    store.keepCopy('fishtank', { old: 2 });
    expect(copies().sort()).toEqual(['fishtank-damaged-1000.json', 'fishtank-damaged-2000.json']);
  });

  it('keeps only the newest copies, so a save that keeps failing cannot fill the folder', () => {
    let time = 0;
    const store = createRecordStore({ dir, now: () => ++time });
    for (let i = 0; i < 8; i++) store.keepCopy('fishtank', { i }, { keep: 3 });
    expect(copies().sort()).toEqual([
      'fishtank-damaged-6.json',
      'fishtank-damaged-7.json',
      'fishtank-damaged-8.json',
    ]);
    store.queue('other', { a: 1 });
    store.keepCopy('other', { b: 1 });
    expect(copies()).toHaveLength(4); // the copies of another record are not touched
  });

  it('says why a copy was not kept', () => {
    const store = createRecordStore({ dir });
    expect(store.keepCopy('../x', { a: 1 })).toEqual({ ok: false, reason: 'invalid_id' });
    expect(store.keepCopy('fishtank', [1])).toEqual({ ok: false, reason: 'invalid_data' });
    expect(store.keepCopy('fishtank', { big: 'x'.repeat(3 * 1024 * 1024) })).toEqual({
      ok: false,
      reason: 'too_large',
    });
    fs.mkdirSync(path.join(dir, 'fishtank-damaged-5.json'));
    const blocked = createRecordStore({ dir, now: () => 5 });
    expect(blocked.keepCopy('fishtank', { a: 1 })).toMatchObject({
      ok: false,
      reason: 'write_failed',
    });
    expect(copies().filter((name) => name.endsWith('.json'))).toEqual(['fishtank-damaged-5.json']); // no other copy appeared
  });
});
