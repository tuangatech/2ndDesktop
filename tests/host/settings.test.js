import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULTS, createSettingsStore, normalizeSettings } from '../../app/main/settings.js';

describe('normalizeSettings', () => {
  it('fills in the defaults and keeps unknown keys', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULTS);
    expect(normalizeSettings({ activeScene: 'fishtank' })).toEqual({
      ...DEFAULTS,
      activeScene: 'fishtank',
    });
  });

  it('ignores a value of the wrong type', () => {
    expect(normalizeSettings({ sound: 'no', alwaysOnTop: 1 })).toEqual(DEFAULTS);
    expect(normalizeSettings([1, 2])).toEqual(DEFAULTS);
  });

  it('starts with sound on and Always on top off (FR-20, FR-38)', () => {
    expect(DEFAULTS).toEqual({ alwaysOnTop: false, sound: true });
  });
});

describe('createSettingsStore', () => {
  let dir;
  let file;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-settings-'));
    file = path.join(dir, 'settings.json');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('saves a change and reads it back in a new store', () => {
    const store = createSettingsStore({ file });
    expect(store.get().sound).toBe(true);
    expect(store.set('sound', false)).toBe(true);
    expect(createSettingsStore({ file }).get().sound).toBe(false);
  });

  it('keeps the other keys of the file, such as the active scene', () => {
    fs.writeFileSync(file, JSON.stringify({ activeScene: 'fishtank', note: 1 }));
    const store = createSettingsStore({ file });
    store.set('alwaysOnTop', true);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({
      activeScene: 'fishtank',
      note: 1,
      alwaysOnTop: true,
    });
  });

  it('refuses an unknown key or a value that is not a boolean', () => {
    const store = createSettingsStore({ file });
    expect(store.set('volume', true)).toBe(false);
    expect(store.set('sound', 'yes')).toBe(false);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('remembers the window rectangle (FR-19) and reads it back', () => {
    const store = createSettingsStore({ file });
    expect(store.get().window).toBeUndefined();
    expect(store.setWindow({ x: 10, y: 20, width: 480, height: 320 })).toBe(true);
    expect(createSettingsStore({ file }).get().window).toEqual({
      x: 10,
      y: 20,
      width: 480,
      height: 320,
    });
  });

  it('does not write the file again for a window rectangle that did not change', () => {
    const store = createSettingsStore({ file });
    store.setWindow({ x: 1, y: 2, width: 480, height: 320 });
    const before = fs.statSync(file).mtimeMs;
    fs.rmSync(file);
    expect(store.setWindow({ x: 1, y: 2, width: 480, height: 320 })).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
    expect(before).toBeGreaterThan(0);
  });

  it('refuses a window rectangle that is not one, and drops a damaged one from the file', () => {
    const store = createSettingsStore({ file });
    expect(store.setWindow({ x: 1, y: 2, width: 'wide', height: 3 })).toBe(false);
    expect(store.setWindow(null)).toBe(false);
    fs.writeFileSync(file, JSON.stringify({ sound: false, window: { x: 'a' } }));
    const fresh = createSettingsStore({ file }).get();
    expect(fresh.window).toBeUndefined();
    expect(fresh.sound).toBe(false);
  });

  it('keeps the display mode and the desktop attempt as known words, in one write', () => {
    const store = createSettingsStore({ file });
    expect(store.setChoices({ displayMode: 'desktop', desktopAttempt: 'trying' })).toBe(true);
    expect(createSettingsStore({ file }).get()).toMatchObject({
      displayMode: 'desktop',
      desktopAttempt: 'trying',
    });
    expect(store.setChoices({ desktopAttempt: 'ok' })).toBe(true);
    expect(createSettingsStore({ file }).get()).toMatchObject({
      displayMode: 'desktop',
      desktopAttempt: 'ok',
    });
  });

  it('refuses a word it does not know, and writes nothing then', () => {
    const store = createSettingsStore({ file });
    expect(store.setChoices({ displayMode: 'fullscreen' })).toBe(false);
    expect(store.setChoices({ displayMode: 'window', desktopAttempt: 'maybe' })).toBe(false);
    expect(store.setChoices({ sound: 'window' })).toBe(false);
    expect(store.setChoices({})).toBe(false);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('drops an unknown word found in the file', () => {
    fs.writeFileSync(file, JSON.stringify({ displayMode: 'sideways', desktopAttempt: 'ok' }));
    const read = createSettingsStore({ file }).get();
    expect(read.displayMode).toBeUndefined();
    expect(read.desktopAttempt).toBe('ok');
  });

  it('remembers the active scene, keeps the other keys, and refuses what is not a scene id', () => {
    const store = createSettingsStore({ file });
    expect(store.set('sound', false)).toBe(true);
    expect(store.setActiveScene('empty')).toBe(true);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({
      activeScene: 'empty',
      sound: false,
    });
    expect(createSettingsStore({ file }).get().activeScene).toBe('empty');
    for (const bad of ['../x', 'A', 'ab', '', null, 7, {}]) {
      expect(store.setActiveScene(bad)).toBe(false);
    }
    expect(store.get().activeScene).toBe('empty');
  });

  it('does not write the file again for the scene that is already active', () => {
    const store = createSettingsStore({ file });
    store.setActiveScene('empty');
    fs.utimesSync(file, new Date(1000), new Date(1000));
    expect(store.setActiveScene('empty')).toBe(true);
    expect(fs.statSync(file).mtimeMs).toBe(1000);
  });

  it('starts with the defaults when the file is damaged', () => {
    fs.writeFileSync(file, '{not json');
    expect(createSettingsStore({ file }).get()).toEqual(DEFAULTS);
  });
});
