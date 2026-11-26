import { describe, expect, it } from 'vitest';
import { createSceneBinding } from '../../app/main/scene-binding.js';

const isValidId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);

describe('createSceneBinding', () => {
  it('knows nothing about a page the main process has not assigned', () => {
    const binding = createSceneBinding(isValidId);
    expect(binding.get({})).toBeNull();
  });

  it('gives a page the scene the main process assigned', () => {
    const binding = createSceneBinding(isValidId);
    const page = {};
    expect(binding.assign(page, 'fishtank')).toBe(true);
    expect(binding.get(page)).toBe('fishtank');
  });

  it('replaces the scene when the main process assigns another one (a scene switch)', () => {
    const binding = createSceneBinding(isValidId);
    const page = {};
    binding.assign(page, 'fishtank');
    expect(binding.assign(page, 'empty')).toBe(true);
    expect(binding.get(page)).toBe('empty');
  });

  it('refuses ids of a wrong shape and keeps what was assigned before', () => {
    const binding = createSceneBinding(isValidId);
    const page = {};
    binding.assign(page, 'fishtank');
    for (const bad of ['../x', '', 'A', 42, null, undefined, 'a'.repeat(41)]) {
      expect(binding.assign(page, bad)).toBe(false);
    }
    expect(binding.get(page)).toBe('fishtank');
  });

  it('keeps pages apart', () => {
    const binding = createSceneBinding(isValidId);
    const a = {};
    const b = {};
    binding.assign(a, 'fishtank');
    expect(binding.get(b)).toBeNull();
    binding.assign(b, 'empty');
    expect(binding.get(a)).toBe('fishtank');
    expect(binding.get(b)).toBe('empty');
  });

  it('has no way for a page to claim a scene', () => {
    expect(Object.keys(createSceneBinding(isValidId)).sort()).toEqual(['assign', 'get']);
  });
});
