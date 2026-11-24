import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE, listScenes, resolveScene } from '../../renderer/scenes.js';

describe('the scene registry of the host', () => {
  it('knows the tank, with a manifest that names its atlas', () => {
    const tank = listScenes().find((scene) => scene.id === 'fishtank');
    expect(tank).toMatchObject({ id: 'fishtank', name: 'Tank', schema: 1, atlas: 'fishtank' });
  });

  it('gives every scene the fields the host needs', () => {
    for (const scene of listScenes()) {
      expect(scene.id).toMatch(/^[a-z_][a-z0-9-]*$/);
      expect(typeof scene.name).toBe('string');
      expect(Number.isInteger(scene.schema)).toBe(true);
      expect(typeof scene.license?.code).toBe('string');
      if (scene.fps !== undefined) expect(scene.fps).toBeGreaterThan(0);
      // An atlas is a name, or null for a scene drawn in code.
      if ('atlas' in scene)
        expect(scene.atlas === null || typeof scene.atlas === 'string').toBe(true);
    }
  });

  it('resolves a known id', () => {
    const chosen = resolveScene('fishtank');
    expect(chosen).toMatchObject({ id: 'fishtank', fellBack: false });
    expect(typeof chosen.load).toBe('function');
  });

  it('falls back to the tank for an unknown id, and says so', () => {
    expect(resolveScene('nope')).toMatchObject({ id: DEFAULT_SCENE, fellBack: true });
    expect(resolveScene('../x')).toMatchObject({ id: DEFAULT_SCENE, fellBack: true });
    expect(resolveScene(undefined)).toMatchObject({ id: DEFAULT_SCENE, fellBack: false });
  });
});
