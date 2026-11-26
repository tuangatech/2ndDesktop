import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SoundPlayer } from '../../../app/page/SoundPlayer.js';
import { fakeContext } from '../../../tests/support/fake-audio.js';
import { SCALE, SOUND_NAMES, defineSounds, recipes } from '../sounds.js';

// The tank's three sounds (FR-38). The engine is tested in tests/host/sound.test.js; here are the recipes, played on a
// fake audio context through the real engine.
function playerWithTankSounds(options = {}) {
  const { ctx, made, log } = fakeContext();
  const player = new SoundPlayer({ createContext: () => ctx, ...options });
  defineSounds(player.forScene());
  return { ctx, made, log, player };
}

/** A fixed random source, so the notes picked and the stretch of noise are the same on every run. */
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('the tank sounds', () => {
  it('has the three names, all defined by defineSounds, and nothing else', () => {
    expect(SOUND_NAMES).toEqual(['splash', 'pop', 'chime']);
    expect(Object.keys(recipes)).toEqual(SOUND_NAMES);
    const { player } = playerWithTankSounds();
    expect([...player.recipes.keys()]).toEqual(SOUND_NAMES);
  });

  it('plays every one of them, and an unknown name makes nothing', () => {
    const { made, player } = playerWithTankSounds();
    for (const name of SOUND_NAMES) expect(player.play(name)).toBe(true);
    expect(made.oscillators.length).toBeGreaterThan(SOUND_NAMES.length);
    expect(player.play('unknown')).toBe(false);
  });

  it('is fine without a sound engine (a scene run alone)', () => {
    expect(() => defineSounds(undefined)).not.toThrow();
    expect(() => defineSounds({})).not.toThrow();
  });

  it('keeps every note in the key, in the range of small speakers', () => {
    const { made, player } = playerWithTankSounds();
    for (let i = 0; i < 20; i++) for (const name of SOUND_NAMES) player.play(name);
    const heard = new Set();
    for (const osc of made.oscillators) {
      const [, start] = osc.frequency.events[0];
      heard.add(Math.round(start * 100) / 100);
      expect(start).toBeGreaterThanOrEqual(500);
      expect(start).toBeLessThanOrEqual(4000); // the overtones go higher than the notes
    }
    // The first partial of a voice is a note of the scale (or the octave or the bell overtone of one).
    const allowed = SCALE.flatMap((f) => [f, f * 2, f * 2.76]).map(
      (f) => Math.round(f * 100) / 100,
    );
    for (const frequency of heard) expect(allowed).toContain(frequency);
  });

  it('never repeats the same note twice in a row for one sound', () => {
    let step = 0;
    const { made, player } = playerWithTankSounds({ random: () => (step++ % 10) / 10 });
    const firsts = [];
    for (let i = 0; i < 12; i++) {
      const before = made.oscillators.length;
      player.play('pop');
      firsts.push(made.oscillators[before].frequency.events[0][1]);
    }
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]).not.toBe(firsts[i - 1]);
  });

  it('stays quiet: no gain of a voice goes above 0.5 before the master', () => {
    const { made, player } = playerWithTankSounds();
    for (const name of SOUND_NAMES) player.play(name);
    for (const gain of made.gains) {
      for (const [kind, value] of gain.gain.events)
        if (kind === 'linear') expect(value).toBeLessThanOrEqual(0.5);
    }
  });
});

// Pins what the three sounds do (work package 7.6): every call a sound makes on the audio context, in order, with
// every number, is turned into one SHA-256. The hashes below were taken on the code before the sounds moved out of the
// engine (commit 1 of the PR) and did not change with the move. A changed sound changes the hash on purpose: the
// person who changes it takes the new value, and listens first (`npm run sounds`).
const PINNED = {
  splash: 'bdf1928841c012e41dc2ae0614427e195d0b9c2b68a0e65081c22786083ba43a',
  pop: 'ad07eafd34eff29b8f4f1349997e082c7d43e9fca4d9f51c27742756bdfe34cd',
  chime: '310e94ea24fc73ec78fe5019ef7c222bffbef26e731390a181468df27e4d428d',
  'one player, in a row': '138ab85a5800ef7583da5328447dda5f4d9be70765b0df9288986bb5cffd6c9d',
};

function callLogHash(names) {
  const { log, player } = playerWithTankSounds({ random: lcg(20261126) });
  for (const name of names) expect(player.play(name)).toBe(true);
  return createHash('sha256').update(JSON.stringify(log)).digest('hex');
}

describe('the tank sounds are pinned', () => {
  it.each([
    ['splash', ['splash']],
    ['pop', ['pop']],
    ['chime', ['chime']],
    ['one player, in a row', ['splash', 'pop', 'chime', 'splash', 'pop']],
  ])('%s makes the same calls as before the move', (label, names) => {
    expect(callLogHash(names)).toBe(PINNED[label]);
  });
});
