import { describe, expect, it } from 'vitest';
import { createSceneBinding } from '../../app/main/scene-binding.js';

const isValidId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);

describe('createSceneBinding', () => {
  it('knows nothing about a page that has not said which scene it runs', () => {
    const binding = createSceneBinding(isValidId);
    expect(binding.get({})).toBeNull();
  });

  it('binds a page to the first valid id it claims', () => {
    const binding = createSceneBinding(isValidId);
    const page = {};
    expect(binding.bind(page, 'fishtank')).toBe(true);
    expect(binding.get(page)).toBe('fishtank');
  });

  it('refuses a later claim of another id and keeps the first', () => {
    const binding = createSceneBinding(isValidId);
    const page = {};
    binding.bind(page, 'fishtank');
    expect(binding.bind(page, 'farmhouse')).toBe(false);
    expect(binding.get(page)).toBe('fishtank');
  });

  it('accepts the same id again, as after a reload', () => {
    const binding = createSceneBinding(isValidId);
    const page = {};
    binding.bind(page, 'fishtank');
    expect(binding.bind(page, 'fishtank')).toBe(true);
  });

  it('refuses ids of a wrong shape and binds nothing', () => {
    const binding = createSceneBinding(isValidId);
    const page = {};
    for (const bad of ['../x', '', 'A', 42, null, undefined, 'a'.repeat(41)]) {
      expect(binding.bind(page, bad)).toBe(false);
    }
    expect(binding.get(page)).toBeNull();
  });

  it('keeps pages apart', () => {
    const binding = createSceneBinding(isValidId);
    const a = {};
    const b = {};
    binding.bind(a, 'fishtank');
    expect(binding.get(b)).toBeNull();
    expect(binding.bind(b, 'farmhouse')).toBe(true);
    expect(binding.get(a)).toBe('fishtank');
  });
});
