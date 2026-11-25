import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLineLimiter, createLogFile } from '../../app/main/log-file.js';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logfile-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('createLogFile', () => {
  it('appends lines, and makes the folder when it is missing', () => {
    const file = path.join(dir, 'data', 'app.log');
    const log = createLogFile({ file });
    log.write('one');
    log.write('two');
    expect(fs.readFileSync(file, 'utf8')).toBe('one\ntwo\n');
  });

  it('cleans every line before it is written', () => {
    const file = path.join(dir, 'app.log');
    const log = createLogFile({ file, clean: (text) => text.replace('secret', 'x') });
    log.write('a secret line');
    expect(fs.readFileSync(file, 'utf8')).toBe('a x line\n');
  });

  it('starts a new file when the next line would pass the size, and keeps one old file', () => {
    const file = path.join(dir, 'app.log');
    const log = createLogFile({ file, maxBytes: 20 });
    log.write('aaaaaaaaa'); // 10 bytes with the newline
    log.write('bbbbbbbbb'); // 20: fits
    log.write('ccccccccc'); // would be 30: rotate
    expect(fs.readFileSync(file, 'utf8')).toBe('ccccccccc\n');
    expect(fs.readFileSync(path.join(dir, 'app.old.log'), 'utf8')).toBe('aaaaaaaaa\nbbbbbbbbb\n');
    log.write('ddddddddd');
    log.write('eeeeeeeee'); // 30 again: the old file is replaced
    expect(fs.readFileSync(path.join(dir, 'app.old.log'), 'utf8')).toBe('ccccccccc\nddddddddd\n');
  });

  it('counts a file that already exists', () => {
    const file = path.join(dir, 'app.log');
    fs.writeFileSync(file, 'x'.repeat(15));
    const log = createLogFile({ file, maxBytes: 20 });
    log.write('yyyyyyyyy');
    expect(fs.readFileSync(path.join(dir, 'app.old.log'), 'utf8')).toBe('x'.repeat(15));
    expect(fs.readFileSync(file, 'utf8')).toBe('yyyyyyyyy\n');
  });

  it('never throws, even when the folder cannot be written', () => {
    const blocker = path.join(dir, 'blocker');
    fs.writeFileSync(blocker, '');
    const log = createLogFile({ file: path.join(blocker, 'app.log') });
    expect(() => log.write('lost')).not.toThrow();
  });
});

describe('createLineLimiter', () => {
  it('lets a number of lines through in a second and counts the rest', () => {
    let time = 5000;
    const limit = createLineLimiter({ perSecond: 3, now: () => time });
    expect([1, 2, 3, 4, 5].map(() => limit.allow())).toEqual([true, true, true, false, false]);
    expect(limit.takeDropped()).toBe(2);
    expect(limit.takeDropped()).toBe(0);
  });

  it('starts again in the next second', () => {
    let time = 5000;
    const limit = createLineLimiter({ perSecond: 1, now: () => time });
    expect(limit.allow()).toBe(true);
    expect(limit.allow()).toBe(false);
    time = 6000;
    expect(limit.allow()).toBe(true);
  });
});
