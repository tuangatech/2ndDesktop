import { describe, expect, it } from 'vitest';
import { SCENE_ID_PATTERN, isSceneId } from '../../app/main/scene-id.js';
import { createRecordStore } from '../../app/main/store.js';

describe('the scene id rule', () => {
  it('accepts lowercase letters, digits and dashes, 3 to 32 characters, starting with a letter', () => {
    for (const id of ['fishtank', 'empty', 'a-b', 'meadow-2', 'a'.repeat(32)]) {
      expect(isSceneId(id)).toBe(true);
    }
  });

  it('refuses everything else, paths first', () => {
    const bad = ['../x', 'a/b', 'a\\b', 'A', 'Meadow', 'ab', '1ab', '-ab', 'a b', ''];
    for (const id of [...bad, 'a'.repeat(33), null, 7, {}]) {
      expect(isSceneId(id)).toBe(false);
    }
  });

  it('is the rule of the record store as well, so a record file name follows the same rule', () => {
    const store = createRecordStore({ dir: 'unused', onError() {} });
    for (const id of ['fishtank', 'ab', '1ab', 'a'.repeat(33), 'A', '../x']) {
      expect(store.isValidId(id)).toBe(SCENE_ID_PATTERN.test(id));
    }
  });
});
