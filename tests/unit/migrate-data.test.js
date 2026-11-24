import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateOldData } from '../../electron/migrate-data.js';

let root;
let oldDir;
let newDir;
const put = (dir, name, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), text);
};
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8');
const lines = [];
const log = (line) => lines.push(line);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), '2nddesktop-migrate-'));
  oldDir = path.join(root, 'old');
  newDir = path.join(root, 'new');
  lines.length = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('migrateOldData (the saved tank moves to the new data folder)', () => {
  it('copies the record, its backup and the settings, and leaves the old folder as it is', () => {
    put(oldDir, 'records/fishtank.json', '{"tank":1}');
    put(oldDir, 'records/fishtank.backup.json', '{"tank":0}');
    put(oldDir, 'settings.json', '{"sound":false}');
    put(oldDir, 'diagnostics.json', 'not copied');

    const result = migrateOldData({ oldDir, newDir, log });

    expect(result.status).toBe('copied');
    expect(result.copied.sort()).toEqual([
      'records/fishtank.backup.json',
      'records/fishtank.json',
      'settings.json',
    ]);
    expect(read(newDir, 'records/fishtank.json')).toBe('{"tank":1}');
    expect(read(newDir, 'records/fishtank.backup.json')).toBe('{"tank":0}');
    expect(read(newDir, 'settings.json')).toBe('{"sound":false}');
    expect(fs.existsSync(path.join(newDir, 'diagnostics.json'))).toBe(false);
    expect(fs.existsSync(path.join(newDir, 'records.migrating'))).toBe(false);
    // a copy, never a move
    expect(read(oldDir, 'records/fishtank.json')).toBe('{"tank":1}');
    expect(read(oldDir, 'settings.json')).toBe('{"sound":false}');
    expect(lines).toHaveLength(1);
  });

  it('does nothing when the new folder already has records', () => {
    put(oldDir, 'records/fishtank.json', 'old');
    put(newDir, 'records/fishtank.json', 'new');
    expect(migrateOldData({ oldDir, newDir, log })).toMatchObject({
      status: 'skipped',
      reason: 'has-records',
    });
    expect(read(newDir, 'records/fishtank.json')).toBe('new');
    expect(fs.existsSync(path.join(newDir, 'settings.json'))).toBe(false);
  });

  it('never overwrites settings the new folder already has', () => {
    put(oldDir, 'records/fishtank.json', '{"tank":1}');
    put(oldDir, 'settings.json', 'old settings');
    put(newDir, 'settings.json', 'new settings');
    const result = migrateOldData({ oldDir, newDir, log });
    expect(result.copied).toEqual(['records/fishtank.json']);
    expect(read(newDir, 'settings.json')).toBe('new settings');
  });

  it('does nothing when there is no old folder, or nothing in it to copy', () => {
    expect(migrateOldData({ oldDir, newDir, log })).toMatchObject({
      status: 'skipped',
      reason: 'nothing-to-copy',
    });
    put(oldDir, 'diagnostics.json', 'x');
    expect(migrateOldData({ oldDir, newDir, log })).toMatchObject({
      status: 'skipped',
      reason: 'nothing-to-copy',
    });
    expect(fs.existsSync(newDir)).toBe(false);
    expect(lines).toEqual([]);
  });

  it('copies the settings alone when the old tank was never saved', () => {
    put(oldDir, 'settings.json', '{"sound":false}');
    expect(migrateOldData({ oldDir, newDir, log })).toMatchObject({
      status: 'copied',
      copied: ['settings.json'],
    });
    expect(fs.existsSync(path.join(newDir, 'records'))).toBe(false);
  });

  it('is done once: a second start finds the records and leaves everything alone', () => {
    put(oldDir, 'records/fishtank.json', '{"tank":1}');
    migrateOldData({ oldDir, newDir, log });
    put(oldDir, 'records/fishtank.json', '{"tank":2}');
    expect(migrateOldData({ oldDir, newDir, log }).status).toBe('skipped');
    expect(read(newDir, 'records/fishtank.json')).toBe('{"tank":1}');
  });

  it('starts again from a clean stage after a start that died half-way', () => {
    put(oldDir, 'records/fishtank.json', '{"tank":1}');
    put(newDir, 'records.migrating/leftover.json', 'half');
    expect(migrateOldData({ oldDir, newDir, log }).status).toBe('copied');
    expect(fs.readdirSync(path.join(newDir, 'records'))).toEqual(['fishtank.json']);
  });

  it('copies only the scenes it is told about', () => {
    put(oldDir, 'records/other.json', 'x');
    expect(migrateOldData({ oldDir, newDir, log }).status).toBe('skipped');
    put(oldDir, 'records/fishtank.json', 'y');
    expect(migrateOldData({ oldDir, newDir, log }).copied).toEqual(['records/fishtank.json']);
  });

  it('reports a failure by its code only, keeps the old folder, and does not throw', () => {
    put(oldDir, 'records/fishtank.json', '{"tank":1}');
    // a file where the settings copy needs a folder: the copy fails
    put(oldDir, 'settings.json', '{"sound":false}');
    fs.mkdirSync(path.join(newDir, 'settings.json.migrating'), { recursive: true });
    const result = migrateOldData({ oldDir, newDir, log });
    expect(result.status).toBe('failed');
    expect(read(oldDir, 'records/fishtank.json')).toBe('{"tank":1}');
    expect(fs.existsSync(path.join(newDir, 'records'))).toBe(false); // so the next start tries again
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(root);
  });

  it('does nothing when both folders are the same', () => {
    put(oldDir, 'records/fishtank.json', 'x');
    expect(migrateOldData({ oldDir, newDir: oldDir, log })).toMatchObject({
      status: 'skipped',
      reason: 'same-folder',
    });
  });
});
