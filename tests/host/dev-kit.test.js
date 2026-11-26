import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  fitShape,
  fromLocalInput,
  JUMPS,
  SHAPES,
  SPEEDS,
  toLocalInput,
} from '../../app/page/devKit.js';
import { prepareDevScene } from '../../scripts/dev-scene.mjs';

const repo = path.join(import.meta.dirname, '..', '..');

describe('the dev kit shapes', () => {
  it('fills the viewport when no shape is chosen', () => {
    expect(fitShape(null, 1280, 720)).toEqual({ width: 1280, height: 720 });
  });

  it('fits the biggest rectangle of the shape in the viewport', () => {
    expect(fitShape(16 / 9, 1280, 1000)).toEqual({ width: 1280, height: 720 });
    expect(fitShape(16 / 9, 1000, 400)).toEqual({ width: 711, height: 400 });
    expect(fitShape(1, 1280, 720)).toEqual({ width: 720, height: 720 });
    expect(fitShape(9 / 16, 1280, 720)).toEqual({ width: 405, height: 720 });
    expect(fitShape(21 / 9, 800, 800)).toEqual({ width: 800, height: 342 });
  });

  it('never gives a rectangle bigger than the viewport', () => {
    for (const shape of SHAPES) {
      for (const [w, h] of [
        [300, 200],
        [1920, 1080],
        [500, 2000],
      ]) {
        const box = fitShape(shape.ratio, w, h);
        expect(box.width).toBeLessThanOrEqual(w);
        expect(box.height).toBeLessThanOrEqual(h);
      }
    }
  });

  it('lists distinct shapes, jumps and speeds', () => {
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
    expect(SHAPES[0].ratio).toBeNull();
    expect(JUMPS.map(([label]) => label)).toContain('+1 d');
    expect(SPEEDS[0]).toBe(1);
  });
});

describe('the dev kit time input', () => {
  it('writes a local time to the minute and reads it back', () => {
    const t = new Date(2026, 6, 15, 12, 30).getTime(); // local time
    expect(toLocalInput(t)).toBe('2026-07-15T12:30');
    expect(fromLocalInput('2026-07-15T12:30')).toBe(t);
  });

  it('says NaN for an empty input', () => {
    expect(Number.isNaN(fromLocalInput(''))).toBe(true);
  });
});

describe('npm run dev:scene', () => {
  let temp;
  beforeEach(() => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-scene-'));
  });
  afterEach(() =>
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
  );

  it('names the scene in a settings file of its own and turns on window mode and the dev kit', () => {
    const { dataDir, env } = prepareDevScene({ root: repo, id: 'empty', tempDir: temp });
    expect(dataDir).toBe(path.join(temp, '2nddesktop-dev-scene', 'empty'));
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'))).toEqual({
      activeScene: 'empty',
    });
    expect(env).toEqual({
      DESKTOP2_USER_DATA: dataDir,
      DESKTOP2_MODE: 'window',
      DESKTOP2_DEV: '1',
    });
  });

  it('keeps the other settings of an earlier run and changes only the scene', () => {
    const first = prepareDevScene({ root: repo, id: 'fishtank', tempDir: temp });
    const file = path.join(first.dataDir, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ activeScene: 'x', sound: false }));
    prepareDevScene({ root: repo, id: 'fishtank', tempDir: temp });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({
      activeScene: 'fishtank',
      sound: false,
    });
  });

  it('starts again when the settings file is damaged', () => {
    const { dataDir } = prepareDevScene({ root: repo, id: 'empty', tempDir: temp });
    fs.writeFileSync(path.join(dataDir, 'settings.json'), '{not json');
    prepareDevScene({ root: repo, id: 'empty', tempDir: temp });
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'))).toEqual({
      activeScene: 'empty',
    });
  });

  it('refuses a scene that is not in scenes/, and names the ones that are', () => {
    expect(() => prepareDevScene({ root: repo, id: 'nope', tempDir: temp })).toThrow(
      /no scene "nope".*empty.*fishtank/,
    );
    expect(() => prepareDevScene({ root: repo, id: undefined, tempDir: temp })).toThrow(/no scene/);
    expect(() => prepareDevScene({ root: repo, id: '../x', tempDir: temp })).toThrow(/no scene/);
    expect(fs.existsSync(path.join(temp, '2nddesktop-dev-scene'))).toBe(false);
  });
});
