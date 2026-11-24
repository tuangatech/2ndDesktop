import { describe, expect, it } from 'vitest';
import { SCALE, SOUND_NAMES, SoundPlayer } from '../../renderer/SoundPlayer.js';

// A very small stand-in for the Web Audio API that records what is made and how it is wired and shaped.
function fakeContext() {
  const made = { oscillators: [], sources: [], buffers: 0, resumed: 0, gains: [], nodes: [] };
  const param = (events = []) => ({
    events,
    value: 0,
    setValueAtTime(value, time) {
      events.push(['set', value, time]);
    },
    linearRampToValueAtTime(value, time) {
      events.push(['linear', value, time]);
    },
    exponentialRampToValueAtTime(value, time) {
      events.push(['exp', value, time]);
    },
    setTargetAtTime(value, time, constant) {
      events.push(['target', value, time, constant]);
    },
  });
  const node = (extra = {}) => {
    const n = {
      connected: [],
      disconnected: false,
      connect(to) {
        n.connected.push(to);
      },
      disconnect() {
        n.disconnected = true;
      },
      start(at, offset, duration) {
        n.startedAt = at;
        n.offset = offset;
        n.duration = duration;
      },
      stop(at) {
        n.stoppedAt = at;
      },
      frequency: param(),
      gain: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      Q: param(),
      ...extra,
    };
    made.nodes.push(n);
    return n;
  };
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume() {
      made.resumed++;
      return Promise.resolve();
    },
    createGain() {
      const n = node();
      made.gains.push(n);
      return n;
    },
    createBiquadFilter: () => node(),
    createDynamicsCompressor: () => node(),
    createConvolver: () => node({ buffer: null }),
    createOscillator() {
      const n = node();
      made.oscillators.push(n);
      return n;
    },
    createBuffer(channels, length) {
      made.buffers++;
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, getChannelData: (i) => data[i] };
    },
    createBufferSource() {
      const n = node({ buffer: null });
      made.sources.push(n);
      return n;
    },
  };
  return { ctx, made };
}

const withFake = (options = {}) => {
  const { ctx, made } = fakeContext();
  const player = new SoundPlayer({ createContext: () => ctx, ...options });
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
    expect(created).toBe(0);
    expect(player.play('pop')).toBe(true);
    player.play('splash');
    expect(created).toBe(1);
  });

  it('plays every named sound and refuses an unknown one', () => {
    const { made, player } = withFake();
    for (const name of SOUND_NAMES) expect(player.play(name)).toBe(true);
    expect(made.oscillators.length).toBeGreaterThan(SOUND_NAMES.length);
    expect(player.play('unknown')).toBe(false);
    expect(made.resumed).toBeGreaterThan(0);
  });

  it('builds the room and the noise once, not on every sound', () => {
    const { made, player } = withFake();
    player.play('splash');
    const buffers = made.buffers;
    expect(buffers).toBe(2); // the room and the noise
    for (let i = 0; i < 5; i++) {
      player.play('splash');
      player.play('pop');
      player.play('chime');
    }
    expect(made.buffers).toBe(buffers);
  });

  it('starts every voice from silence and gives it an exponential tail (no clicks)', () => {
    const { made, player } = withFake();
    for (const name of SOUND_NAMES) player.play(name);
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
    for (const name of SOUND_NAMES) player.play(name);
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

  it('keeps every note in the key, in the range of small speakers', () => {
    const { made, player } = withFake();
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
    const { made, player } = withFake({ random: () => (step++ % 10) / 10 });
    const firsts = [];
    for (let i = 0; i < 12; i++) {
      const before = made.oscillators.length;
      player.play('pop');
      firsts.push(made.oscillators[before].frequency.events[0][1]);
    }
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]).not.toBe(firsts[i - 1]);
  });

  it('stays quiet: no gain of a voice goes above 0.5 before the master', () => {
    const { made, player } = withFake();
    for (const name of SOUND_NAMES) player.play(name);
    for (const gain of made.gains) {
      for (const [kind, value] of gain.gain.events)
        if (kind === 'linear') expect(value).toBeLessThanOrEqual(0.5);
    }
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
    expect(player.play('pop')).toBe(false);
    expect(created).toBe(0);
    player.setEnabled(true);
    expect(player.play('pop')).toBe(true);
  });

  it('never throws, even when audio is missing or breaks', () => {
    expect(new SoundPlayer({ createContext: () => null }).play('pop')).toBe(false);
    const broken = new SoundPlayer({
      createContext: () => {
        throw new Error('no audio device');
      },
    });
    expect(broken.play('pop')).toBe(false);
    expect(broken.play('chime')).toBe(false);
  });
});
