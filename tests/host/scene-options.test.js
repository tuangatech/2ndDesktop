import { describe, expect, it } from 'vitest';
import { parseSceneOptions } from '../../app/page/sceneOptions.js';

describe('parseSceneOptions (DESKTOP2_SCENE_OPTIONS)', () => {
  it('reads a JSON object', () => {
    expect(parseSceneOptions('{"fish":8}')).toEqual({ fish: 8 });
    expect(parseSceneOptions('{"fish":8,"x":{"y":[1]}}')).toEqual({ fish: 8, x: { y: [1] } });
  });

  it('gives {} for nothing, for broken text and for anything that is not an object', () => {
    for (const text of [
      undefined,
      null,
      '',
      '{',
      'fish=8',
      '8',
      'null',
      '"text"',
      '[1,2]',
      'true',
    ]) {
      expect(parseSceneOptions(text)).toEqual({});
    }
  });
});
