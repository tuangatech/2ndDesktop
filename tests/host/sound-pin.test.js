import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SoundPlayer } from '../../app/page/SoundPlayer.js';
import { fakeContext } from '../support/fake-audio.js';

// Pins what the tank's three sounds do (work package 7.6): every call a sound makes on the audio context, in order,
// with every number, is turned into one SHA-256. The hashes below were taken on the code before the sounds moved out
// of the engine; moving them must not change a single call. A changed sound changes the hash on purpose: the
// person who changes it takes the new value (and listens first: `npm run sounds`).
const PINNED = {
  splash: 'bdf1928841c012e41dc2ae0614427e195d0b9c2b68a0e65081c22786083ba43a',
  pop: 'ad07eafd34eff29b8f4f1349997e082c7d43e9fca4d9f51c27742756bdfe34cd',
  chime: '310e94ea24fc73ec78fe5019ef7c222bffbef26e731390a181468df27e4d428d',
  'one player, in a row': '138ab85a5800ef7583da5328447dda5f4d9be70765b0df9288986bb5cffd6c9d',
};

/** A fixed random source, so the notes picked and the stretch of noise are the same on every run. */
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function callLogHash(names) {
  const { ctx, log } = fakeContext();
  const player = new SoundPlayer({ createContext: () => ctx, random: lcg(20261126) });
  for (const name of names) expect(player.play(name)).toBe(true);
  return createHash('sha256').update(JSON.stringify(log)).digest('hex');
}

describe('the tank sounds are pinned', () => {
  it.each([
    ['splash', ['splash']],
    ['pop', ['pop']],
    ['chime', ['chime']],
    ['one player, in a row', ['splash', 'pop', 'chime', 'splash', 'pop']],
  ])('%s makes the same calls as before', (label, names) => {
    expect(callLogHash(names)).toBe(PINNED[label]);
  });
});
