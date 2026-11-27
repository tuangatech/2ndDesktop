import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listScenes } from '../../app/page/scenes.js';
import {
  checkManifest,
  chooseActiveScene,
  listedScenes,
  readSceneManifests,
} from '../../app/main/scene-registry.js';

const scenesDir = path.join(import.meta.dirname, '..', '..', 'scenes');
const good = {
  id: 'meadow',
  name: 'Meadow',
  version: '0.1.0',
  schema: 1,
  license: { code: 'MIT' },
};

describe('checkManifest', () => {
  it('accepts a complete manifest and keeps unknown keys', () => {
    const result = checkManifest({ ...good, fps: 15, atlas: null, dev: true, future: 1 }, 'meadow');
    expect(result.ok).toBe(true);
    expect(result.manifest.future).toBe(1);
  });

  it('accepts the manifests of the two scenes in the repository', () => {
    for (const folder of ['fishtank', 'empty', 'farmhouse']) {
      const raw = JSON.parse(fs.readFileSync(path.join(scenesDir, folder, 'scene.json'), 'utf8'));
      expect(checkManifest(raw, folder)).toMatchObject({ ok: true });
    }
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'scene'],
  ])('rejects %s', (_label, raw) => {
    expect(checkManifest(raw, 'meadow').ok).toBe(false);
  });

  it.each([
    ['an id that is not a string', { id: 7 }, /id must be/],
    ['an id with capitals', { id: 'Meadow' }, /id must be/],
    ['an id that starts with a digit', { id: '1meadow' }, /id must be/],
    ['an id that is too short', { id: 'ab' }, /id must be/],
    ['an id of 33 characters', { id: 'a'.repeat(33) }, /id must be/],
    ['an id that is not the folder name', { id: 'valley' }, /is not the folder name/],
    ['a path as an id', { id: '../meadow' }, /id must be/],
    ['an empty name', { name: '  ' }, /name must be/],
    ['a name of 41 characters', { name: 'x'.repeat(41) }, /name must be/],
    ['a name with a newline', { name: 'Mea\ndow' }, /name must be/],
    ['a name with an ampersand', { name: 'Tom & Jerry' }, /without &/],
    ['a version without three parts', { version: '1.0' }, /version must/],
    ['a schema of 0', { schema: 0 }, /schema must/],
    ['a schema that is a string', { schema: '1' }, /schema must/],
    ['a schema with a fraction', { schema: 1.5 }, /schema must/],
    ['no license code', { license: {} }, /license\.code/],
    ['an fps of 4', { fps: 4 }, /fps must/],
    ['an fps of 31', { fps: 31 }, /fps must/],
    ['an fps that is a string', { fps: '15' }, /fps must/],
    ['an atlas that is a number', { atlas: 3 }, /atlas must/],
    ['an empty atlas name', { atlas: '' }, /atlas must/],
    ['a dev flag that is a string', { dev: 'yes' }, /dev must/],
  ])('rejects %s', (_label, change, message) => {
    const result = checkManifest({ ...good, ...change }, 'meadow');
    expect(result.ok).toBe(false);
    expect(result.problems.join(' | ')).toMatch(message);
  });

  it('lists every problem, not only the first', () => {
    const result = checkManifest({ id: 'x', name: '', version: 'v', schema: 0 }, 'x');
    expect(result.problems.length).toBeGreaterThanOrEqual(5);
  });
});

describe('readSceneManifests', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), '2nddesktop-registry-'));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const scene = (folder, manifest, { index = true, raw } = {}) => {
    fs.mkdirSync(path.join(root, folder));
    fs.writeFileSync(path.join(root, folder, 'scene.json'), raw ?? JSON.stringify(manifest));
    if (index) fs.writeFileSync(path.join(root, folder, 'index.js'), 'export default () => {};');
  };

  it('returns the good scenes sorted by id and reports the rest', () => {
    scene('meadow', good);
    scene('arctic', { ...good, id: 'arctic' });
    scene('broken', null, { raw: '{ not json' });
    scene('mismatch', { ...good, id: 'other' });
    scene('noindex', { ...good, id: 'noindex' }, { index: false });
    fs.mkdirSync(path.join(root, 'notascene'));
    fs.writeFileSync(path.join(root, 'file.txt'), 'x');

    const { scenes, rejected } = readSceneManifests(root);
    expect(scenes.map((s) => s.id)).toEqual(['arctic', 'meadow']);
    expect(rejected.map((r) => r.folder).sort()).toEqual(['broken', 'mismatch', 'noindex']);
    expect(rejected.find((r) => r.folder === 'noindex').problems).toEqual(['index.js is missing']);
  });

  it('returns nothing for a folder that does not exist', () => {
    expect(readSceneManifests(path.join(root, 'nope'))).toEqual({ scenes: [], rejected: [] });
  });

  it('finds the scenes of the repository and rejects none', () => {
    const { scenes, rejected } = readSceneManifests(scenesDir);
    expect(rejected).toEqual([]);
    expect(scenes.map((s) => s.id)).toEqual(['empty', 'farmhouse', 'fishtank']);
  });

  it('lists the same scene ids as the page does (the page finds them with Vite at build time)', () => {
    const fromDisk = readSceneManifests(scenesDir).scenes.map((s) => s.id);
    const fromPage = listScenes()
      .map((s) => s.id)
      .sort();
    expect(fromPage).toEqual(fromDisk);
  });
});

describe('readSceneManifests for an installed app', () => {
  it('does not look for index.js when asked not to (the app ships manifests, not scene source)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), '2nddesktop-registry-'));
    try {
      fs.mkdirSync(path.join(root, 'meadow'));
      fs.writeFileSync(path.join(root, 'meadow', 'scene.json'), JSON.stringify(good));
      expect(readSceneManifests(root).scenes).toEqual([]);
      expect(readSceneManifests(root, { requireIndex: false }).scenes.map((s) => s.id)).toEqual([
        'meadow',
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('chooseActiveScene', () => {
  const scenes = [{ id: 'empty', dev: true }, { id: 'fishtank' }, { id: 'meadow' }];
  const options = { dev: false, fallback: 'fishtank' };

  it('runs the scene that settings.json names when the player may have it', () => {
    expect(chooseActiveScene('meadow', scenes, options)).toBe('meadow');
  });

  it('falls back to the tank for an unknown scene, a missing name or one of a wrong type', () => {
    for (const wanted of ['nope', '../fishtank', '', undefined, null, 7, {}, ['meadow']]) {
      expect(chooseActiveScene(wanted, scenes, options)).toBe('fishtank');
    }
  });

  it('refuses a dev scene in a release build, however it got into settings.json', () => {
    expect(chooseActiveScene('empty', scenes, { ...options, dev: false })).toBe('fishtank');
  });

  it('allows a dev scene in a development or test build', () => {
    expect(chooseActiveScene('empty', scenes, { ...options, dev: true })).toBe('empty');
  });

  it('falls back when the list of scenes is empty (a build without manifests)', () => {
    expect(chooseActiveScene('meadow', [], options)).toBe('fishtank');
  });
});

describe('listedScenes', () => {
  const scenes = [{ id: 'empty', dev: true }, { id: 'fishtank' }, { id: 'meadow', dev: false }];

  it('hides a dev scene in a release build', () => {
    expect(listedScenes(scenes, { dev: false }).map((s) => s.id)).toEqual(['fishtank', 'meadow']);
  });

  it('shows every scene in a development or test build', () => {
    expect(listedScenes(scenes, { dev: true })).toHaveLength(3);
  });
});
