import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkManifest } from '../../app/main/scene-registry.js';
import { nameFromId, scaffold } from '../../scripts/new-scene.mjs';

const repo = path.join(import.meta.dirname, '..', '..');
let root;

// A throwaway repository root that holds a copy of the real template.
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'new-scene-'));
  fs.cpSync(path.join(repo, 'templates'), path.join(root, 'templates'), { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

describe('npm run new-scene', () => {
  it('makes a scene folder whose manifest the registry accepts', () => {
    const files = scaffold({ root, id: 'my-garden', name: 'My garden' });
    expect(files).toEqual(['index.js', 'scene.json', 'state.js', 'tests/state.test.js']);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'scenes/my-garden/scene.json'), 'utf8'),
    );
    expect(checkManifest(manifest, 'my-garden')).toMatchObject({ ok: true });
    expect(manifest).toMatchObject({ id: 'my-garden', name: 'My garden', dev: true });
  });

  it('leaves no placeholder behind and writes the id and the name into the code', () => {
    scaffold({ root, id: 'my-garden', name: 'My garden' });
    for (const file of ['index.js', 'scene.json', 'state.js', 'tests/state.test.js']) {
      expect(fs.readFileSync(path.join(root, 'scenes/my-garden', file), 'utf8')).not.toMatch(
        /__[A-Z]+__/,
      );
    }
    const code = fs.readFileSync(path.join(root, 'scenes/my-garden/index.js'), 'utf8');
    expect(code).toContain("id: 'my-garden'");
    expect(code).toContain('My garden (started');
  });

  it('takes the name from the id when none is given', () => {
    scaffold({ root, id: 'farm-house' });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'scenes/farm-house/scene.json'), 'utf8'),
    );
    expect(manifest.name).toBe('Farm house');
    expect(nameFromId('a-b--c')).toBe('A b c');
  });

  it('refuses a bad id, a bad name and a folder that exists, and writes nothing', () => {
    for (const id of [
      '',
      'ab',
      'My-Garden',
      '1garden',
      'a_b_c',
      '../x',
      'x'.repeat(33),
      undefined,
    ]) {
      expect(() => scaffold({ root, id })).toThrow(/not a scene id/);
    }
    for (const name of ['', 'it`s', "it's", 'a${b}', 'a\\b', 'x'.repeat(41)]) {
      expect(() => scaffold({ root, id: 'my-garden', name })).toThrow(/not a name/);
    }
    expect(fs.existsSync(path.join(root, 'scenes'))).toBe(false);
    scaffold({ root, id: 'my-garden' });
    expect(() => scaffold({ root, id: 'my-garden' })).toThrow(/already exists/);
  });

  it('copies a record module that works (the generated unit test is the same file)', async () => {
    scaffold({ root, id: 'my-garden' });
    const state = await import(pathToFileURL(path.join(root, 'scenes/my-garden/state.js')).href);
    expect(state.startState({ status: 'missing' })).toEqual({ schema: 1, opened: 1, taps: 0 });
    expect(state.tap(state.startState(undefined)).taps).toBe(1);
  });
});
