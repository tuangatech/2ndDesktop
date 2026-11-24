// The sounds (FR-38, D19, D36): synthesized with the Web Audio API, short and quiet. No sound files are shipped.
// `play` is only ever called from something the player did (a click or a tray action), never from a timer or from
// the game tick; the scene decides when, and a test checks it. The audio context is created on the first play, which
// is always a reaction to the player.
//
// How the sounds are made (docs/04, D36):
// - One shared chain, built once with the context: voices go to a dry bus and to a send into a small generated
//   room (convolution reverb), both into a master gain, a soft low-pass that takes the edge off, and a gentle
//   compressor that keeps stacked sounds from getting louder than one.
// - One key for everything, D major pentatonic (no note clashes with another, so any two sounds can overlap).
//   Notes stay between 500 Hz and 1.5 kHz because laptop speakers do not reproduce much below that.
// - Every voice starts from silence with a few milliseconds of attack and ends with an exponential tail
//   (`setTargetAtTime`), so there is never a click; its nodes are disconnected when it ends.
// - The water sounds are small bubbles: a sine whose pitch glides up a little as it rings, the way a trapped air
//   bubble does (Minnaert), with a very soft, dark touch of noise for the surface.

const MASTER = 0.5;
const REVERB_SECONDS = 1.1;
const NOISE_SECONDS = 0.4;
const TAIL = 7; // an exponential tail is 7 time constants long: down to about -61 dB, then the voice stops

/** D major pentatonic, D5 to E6, in Hz. */
export const SCALE = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51];

export const SOUND_NAMES = ['splash', 'pop', 'chime'];

export class SoundPlayer {
  /**
   * @param {{createContext?: () => AudioContext|null, enabled?: boolean, random?: () => number}} [options]
   */
  constructor({ createContext = defaultContext, enabled = true, random = Math.random } = {}) {
    this.createContext = createContext;
    this.enabled = enabled;
    this.random = random;
    this.ctx = null;
    this.failed = false;
    this.bus = null;
    this.noise = null;
    this.last = {}; // the last note picked per sound, so the same note never comes twice in a row
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
  }

  /** @param {'splash'|'pop'|'chime'} name */
  play(name) {
    if (!this.enabled || this.failed) return false;
    try {
      this.ctx ??= this.createContext();
      if (!this.ctx) {
        this.failed = true;
        return false;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume?.()?.catch?.(() => {});
      if (!SOUND_NAMES.includes(name)) return false;
      this.bus ??= this.buildBus();
      const now = this.ctx.currentTime + 0.005; // a hair of lead time so the start is scheduled, not late
      this[name](now);
      return true;
    } catch {
      // Sound must never break the game.
      this.failed = true;
      return false;
    }
  }

  /** The shared chain, built once: dry bus and reverb send into master, low-pass and compressor. */
  buildBus() {
    const ctx = this.ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;
    compressor.connect(ctx.destination);

    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 6500;
    soften.Q.value = 0.5;
    soften.connect(compressor);

    const master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(soften);

    const dry = ctx.createGain();
    dry.connect(master);

    const send = ctx.createGain();
    const room = ctx.createConvolver();
    room.buffer = makeRoom(ctx, REVERB_SECONDS);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    send.connect(room);
    room.connect(wet);
    wet.connect(master);

    this.noise = makeNoise(ctx, NOISE_SECONDS);
    return { dry, send };
  }

  /** An index into `SCALE`, not the one this sound picked last. `from`..`to` is an index range. */
  pick(name, from, to) {
    let index;
    do index = from + Math.floor(this.random() * (to - from + 1));
    while (index === this.last[name] && to > from);
    this.last[name] = index;
    return index;
  }

  /**
   * One partial of a voice: a sine that starts silent, rises to `peak` in `attack` seconds, and falls away over
   * `decay` seconds. `glide` > 1 makes the pitch rise by that factor in the first `glideTime` seconds.
   */
  partial(frequency, at, { peak, attack = 0.006, decay, glide = 1, glideTime = 0.05, send = 0.2 }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, at);
    if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(frequency * glide, at + glideTime);
    const gain = ctx.createGain();
    envelope(gain.gain, at, peak, attack, decay);
    osc.connect(gain);
    const tap = this.route(gain, send);
    osc.start(at);
    osc.stop(at + attack + decay);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      tap?.disconnect();
    };
  }

  /** Sends a voice to the dry bus and, by `send` (0 to 1), into the room. Returns the send's own gain node. */
  route(gain, send) {
    gain.connect(this.bus.dry);
    if (send <= 0) return null;
    const tap = this.ctx.createGain();
    tap.gain.value = send;
    gain.connect(tap);
    tap.connect(this.bus.send);
    return tap;
  }

  /** A bubble: a fundamental that glides up, with a quiet octave above it for presence on small speakers. */
  bubble(frequency, at, { peak, decay, glide = 1.35, glideTime = 0.06, send = 0.25 }) {
    this.partial(frequency, at, { peak, decay, glide, glideTime, send });
    this.partial(frequency * 2, at, {
      peak: peak * 0.12,
      decay: decay * 0.5,
      glide,
      glideTime,
      send,
    });
  }

  /** A very short, dark burst of noise: the surface being touched. */
  touch(at, { peak, decay, from = 1500, to = 500 }) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + decay);
    const gain = ctx.createGain();
    envelope(gain.gain, at, peak, 0.004, decay);
    source.connect(filter);
    filter.connect(gain);
    const tap = this.route(gain, 0.3);
    // A different stretch of the noise each time, so two splashes are never the same hiss.
    source.start(at, this.random() * (NOISE_SECONDS - decay - 0.05), decay + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      tap?.disconnect();
    };
  }

  /** Food landing in the water: a soft touch and two small bubbles, the second higher and fainter. */
  splash(at) {
    const index = this.pick('splash', 0, 2);
    this.touch(at, { peak: 0.1, decay: 0.07 });
    this.bubble(SCALE[index], at + 0.012, { peak: 0.42, decay: 0.2 });
    this.bubble(SCALE[index + 2], at + 0.075 + this.random() * 0.02, {
      peak: 0.16,
      decay: 0.14,
      glide: 1.25,
    });
  }

  /** A pellet collected: one small, bright bubble that rises. */
  pop(at) {
    this.bubble(SCALE[this.pick('pop', 3, 5)], at, {
      peak: 0.45,
      decay: 0.12,
      glide: 1.5,
      glideTime: 0.04,
      send: 0.2,
    });
  }

  /** A new fish: three bell notes going up the D major triad, each with a soft overtone, in the room. */
  chime(at) {
    const notes = [SCALE[2], SCALE[3], SCALE[5]]; // F#5, A5, D6
    notes.forEach((frequency, i) => {
      const start = at + i * 0.15;
      const last = i === notes.length - 1;
      const decay = last ? 1.5 : 0.9;
      this.partial(frequency, start, { peak: 0.24, attack: 0.008, decay, send: 0.5 });
      // A bar-like overtone (about 2.76 times the pitch) gives the glassy bell colour; it dies sooner.
      this.partial(frequency * 2.76, start, {
        peak: 0.036,
        attack: 0.004,
        decay: decay * 0.3,
        send: 0.5,
      });
    });
  }
}

/** Silence, a quick rise, then an exponential tail. Never a jump, so never a click. */
function envelope(param, at, peak, attack, decay) {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.setTargetAtTime(0, at + attack, decay / TAIL);
}

/** Noise for the surface touch: made once per context (about 0.4 s), not on every sound. */
function makeNoise(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const next = lcg(12345);
  for (let i = 0; i < length; i++) data[i] = next() * 2 - 1;
  return buffer;
}

/**
 * A small room as an impulse response: stereo noise that decays exponentially and gets darker as it goes
 * (Moorer's idea of decaying noise), with a short fade-in. Made once per context; fixed seeds, so it sounds the
 * same on every start.
 */
function makeRoom(ctx, seconds) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const next = lcg(777 + channel * 101);
    let low = 0;
    const fade = Math.floor(rate * 0.01);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const decay = Math.exp(-6.5 * t);
      // The one-pole low-pass closes over time: bright at first, dull in the tail.
      const coefficient = 0.55 - 0.45 * t;
      low += coefficient * (next() * 2 - 1 - low);
      data[i] = low * decay * Math.min(1, i / fade) * 0.5;
    }
  }
  return buffer;
}

/** A tiny seeded random generator (the same noise on every start). */
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function defaultContext() {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Context ? new Context() : null;
}
