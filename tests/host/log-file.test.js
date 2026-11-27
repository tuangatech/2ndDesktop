import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLineLimiter, createLogFile, pageLine } from '../../app/main/log-file.js';

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

describe('pageLine', () => {
  it('keeps plain text and cuts it to the length', () => {
    expect(pageLine('visible', 20)).toBe('visible');
    expect(pageLine('x'.repeat(5000), 2000)).toHaveLength(2000);
  });

  it('turns control characters, a new line above all, into spaces', () => {
    expect(pageLine('a\nb\r\nc\td\u0000e\u007ff\u001b[0m', 100)).toBe('a b  c d e f [0m');
    // A page cannot write a line that looks like the app's own.
    expect(pageLine('x\n2026-01-01T00:00:00.000Z restart after a crash', 100)).not.toContain('\n');
  });

  it('says nothing for what is not text', () => {
    for (const value of [undefined, null, 42, {}, ['a'], { toString: () => 'x' }]) {
      expect(pageLine(value, 10)).toBe('');
    }
  });
});
