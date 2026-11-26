import { describe, expect, it } from 'vitest';
import { SoundPlayer } from '../../app/page/SoundPlayer.js';
import { fakeContext } from '../support/fake-audio.js';

// The engine only: the sounds of a scene are its own recipes (the tank's are tested in scenes/fishtank/tests/).
// These recipes are the smallest ones that use each voice of the engine.
const recipes = {
  note: (voice, at) => voice.partial(880, at, { peak: 0.3, decay: 0.2 }),
  drop: (voice, at) => {
    voice.touch(at, { peak: 0.1, decay: 0.07 });
    voice.bubble(660, at + 0.01, { peak: 0.4, decay: 0.2 });
  },
  pick: (voice, at) =>
    voice.partial([500, 600, 700][voice.pick('pick', 0, 2)], at, { peak: 0.3, decay: 0.1 }),
};

const withFake = (options = {}) => {
  const { ctx, made } = fakeContext();
  const player = new SoundPlayer({ createContext: () => ctx, ...options });
  for (const [name, recipe] of Object.entries(recipes)) player.define(name, recipe);
  return { ctx, made, player };
};

describe('SoundPlayer', () => {
  it('makes no audio context until the first play, and then only one', () => {
    let created = 0;
    const { ctx } = fakeContext();
    const player = new SoundPlayer({
      createContext: () => {
        created++;
        return ctx;
      },
    });
    player.define('note', recipes.note);
    expect(created).toBe(0);
    expect(player.play('note')).toBe(true);
    player.play('note');
    expect(created).toBe(1);
  });

  it('plays every defined sound and refuses an unknown one', () => {
    const { made, player } = withFake();
    for (const name of Object.keys(recipes)) expect(player.play(name)).toBe(true);
    expect(made.oscillators.length).toBeGreaterThan(Object.keys(recipes).length);
    expect(player.play('unknown')).toBe(false);
    expect(made.resumed).toBeGreaterThan(0);
  });

  it('builds the room and the noise once, not on every sound', () => {
    const { made, player } = withFake();
    player.play('drop');
    const buffers = made.buffers;
    expect(buffers).toBe(2); // the room and the noise
    for (let i = 0; i < 5; i++) for (const name of Object.keys(recipes)) player.play(name);
    expect(made.buffers).toBe(buffers);
  });

  it('starts every voice from silence and gives it an exponential tail (no clicks)', () => {
    const { made, player } = withFake();
    for (const name of Object.keys(recipes)) player.play(name);
    const envelopes = made.gains.filter((g) => g.gain.events.some((e) => e[0] === 'linear'));
    expect(envelopes.length).toBeGreaterThan(0);
    for (const gain of envelopes) {
      const [first, ramp, tail] = gain.gain.events;
      expect(first.slice(0, 2)).toEqual(['set', 0]);
      expect(ramp[0]).toBe('linear');
      expect(ramp[1]).toBeGreaterThan(0);
      expect(ramp[2] - first[2]).toBeGreaterThanOrEqual(0.003); // at least 3 ms of attack
      expect(tail[0]).toBe('target');
      expect(tail[1]).toBe(0);
    }
  });

  it('stops every oscillator after its tail and disconnects its nodes when it ends', () => {
    const { made, player } = withFake();
    for (const name of Object.keys(recipes)) player.play(name);
    const voices = [...made.oscillators, ...made.sources];
    for (const voice of voices) {
      expect(voice.stoppedAt === undefined ? voice.duration : voice.stoppedAt).toBeGreaterThan(0);
      expect(voice.disconnected).toBe(false);
      voice.onended();
      expect(voice.disconnected).toBe(true);
    }
    // The gains that belong to the voices (not the shared bus) are all released as well.
    const released = made.gains.filter((g) => g.disconnected);
    expect(released.length).toBeGreaterThan(voices.length);
  });

  it('never repeats the same pick twice in a row for one sound', () => {
    let step = 0;
    const { made, player } = withFake({ random: () => (step++ % 10) / 10 });
    const firsts = [];
    for (let i = 0; i < 12; i++) {
      const before = made.oscillators.length;
      player.play('pick');
      firsts.push(made.oscillators[before].frequency.events[0][1]);
    }
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]).not.toBe(firsts[i - 1]);
  });

  it('plays nothing when the sound is off, and not even a context is made', () => {
    let created = 0;
    const player = new SoundPlayer({
      enabled: false,
      createContext: () => {
        created++;
        return fakeContext().ctx;
      },
    });
    player.define('note', recipes.note);
    expect(player.play('note')).toBe(false);
    expect(created).toBe(0);
    player.setEnabled(true);
    expect(player.play('note')).toBe(true);
  });

  it('never throws, even when audio is missing or breaks', () => {
    const quiet = new SoundPlayer({ createContext: () => null });
    quiet.define('note', recipes.note);
    expect(quiet.play('note')).toBe(false);
    const broken = new SoundPlayer({
      createContext: () => {
        throw new Error('no audio device');
      },
    });
    broken.define('note', recipes.note);
    expect(broken.play('note')).toBe(false);
    expect(broken.play('note')).toBe(false);
  });

  it('survives a recipe that throws: no sound from it, and the game goes on', () => {
    const { player } = withFake();
    player.define('bad', () => {
      throw new Error('a mistake in a scene');
    });
    expect(() => player.play('bad')).not.toThrow();
    expect(player.play('bad')).toBe(false);
  });
});

describe('SoundPlayer.define (what a scene may register)', () => {
  const noop = () => {};

  it('takes a lowercase name of letters, digits and dashes, and a function', () => {
    const player = new SoundPlayer({ createContext: () => null });
    for (const name of ['pop', 'a', 'fish-bell', 'bell2', 'a'.repeat(32)]) {
      expect(player.define(name, noop)).toBe(true);
    }
  });

  it('refuses a name that is not a word, and a recipe that is not a function', () => {
    const player = new SoundPlayer({ createContext: () => null });
    for (const name of [
      '',
      'Pop',
      '1up',
      '-x',
      'a b',
      'a/b',
      '../x',
      'a'.repeat(33),
      null,
      7,
      {},
    ]) {
      expect(player.define(name, noop)).toBe(false);
    }
    for (const recipe of [undefined, null, 'play', {}, 5]) {
      expect(player.define('good', recipe)).toBe(false);
    }
    expect(player.recipes.size).toBe(0);
  });

  it('refuses to define a name twice, so a scene cannot swap a sound it has already given', () => {
    const player = new SoundPlayer({ createContext: () => null });
    const first = () => {};
    expect(player.define('pop', first)).toBe(true);
    expect(player.define('pop', noop)).toBe(false);
    expect(player.recipes.get('pop')).toBe(first);
  });

  it('allows at most 16 sounds', () => {
    const player = new SoundPlayer({ createContext: () => null });
    for (let i = 0; i < 16; i++) expect(player.define(`s${i}`, noop)).toBe(true);
    expect(player.define('one-more', noop)).toBe(false);
    expect(player.recipes.size).toBe(16);
  });
});

describe('what a scene and a recipe can reach', () => {
  it('gives the scene define and play and nothing else of the player', () => {
    const { player } = withFake();
    const api = player.forScene();
    expect(Object.keys(api).sort()).toEqual(['define', 'play']);
    expect(Object.isFrozen(api)).toBe(true);
    expect(api.define('extra', recipes.note)).toBe(true);
    expect(api.play('extra')).toBe(true);
    expect(api.setEnabled).toBeUndefined();
    expect(api.ctx).toBeUndefined();
  });

  it('gives a recipe the voices and nothing else: not the context, not define, not the mute', () => {
    const { player } = withFake();
    let seen;
    player.define('look', (voice) => {
      seen = voice;
    });
    player.play('look');
    expect(Object.keys(seen).sort()).toEqual(['bubble', 'partial', 'pick', 'random', 'touch']);
    expect(Object.isFrozen(seen)).toBe(true);
    expect(seen.ctx).toBeUndefined();
    expect(seen.define).toBeUndefined();
    expect(seen.setEnabled).toBeUndefined();
  });
});
