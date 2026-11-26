// The sound engine of the host (FR-38, D19, D36): synthesized with the Web Audio API, short and quiet. No sound files
// are shipped. A scene brings its own sounds as recipes: `define(name, recipe)`, then `play(name)` (work package 7.6;
// the tank's are in scenes/fishtank/sounds.js). `play` is only ever called from something the player did (a click or
// a tray action), never from a timer or from the game tick; the scene decides when, and a test checks it. The audio
// context is created on the first play, which is always a reaction to the player.
//
// A recipe is `(voice, at) => void`: it makes one sound from the engine's voices (`partial`, `bubble`, `touch`, `pick`,
// `random`), starting at the time `at`.
//
// How the sounds are made (docs/04, D36):
// - One shared chain, built once with the context: voices go to a dry bus and to a send into a small generated
//   room (convolution reverb), both into a master gain, a soft low-pass that takes the edge off, and a gentle
//   compressor that keeps stacked sounds from getting louder than one.
// - Every voice starts from silence with a few milliseconds of attack and ends with an exponential tail
//   (`setTargetAtTime`), so there is never a click; its nodes are disconnected when it ends.
// - The water sounds are small bubbles: a sine whose pitch glides up a little as it rings, the way a trapped air
//   bubble does (Minnaert), with a very soft, dark touch of noise for the surface.

const MASTER = 0.5;
const REVERB_SECONDS = 1.1;
const NOISE_SECONDS = 0.4;
const TAIL = 7; // an exponential tail is 7 time constants long: down to about -61 dB, then the voice stops

// What a scene may call a sound, and how many it may define: a name is a word, not a path or a message.
const NAME_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_SOUNDS = 16;

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
    this.recipes = new Map();
    // What a recipe is given: the voices, and nothing of the player (not the context, not `define`, not `setEnabled`).
    this.voice = Object.freeze({
      partial: (...args) => this.partial(...args),
      bubble: (...args) => this.bubble(...args),
      touch: (...args) => this.touch(...args),
      pick: (...args) => this.pick(...args),
      random: () => this.random(),
    });
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
  }

  /**
   * Registers a sound. Returns false (and registers nothing) for a name that is not a lowercase word of at most 32
   * characters, a name that is already defined, a recipe that is not a function, or more than 16 sounds.
   * @param {string} name
   * @param {(voice: SoundPlayer['voice'], at: number) => void} recipe
   */
  define(name, recipe) {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) return false;
    if (typeof recipe !== 'function' || this.recipes.has(name)) return false;
    if (this.recipes.size >= MAX_SOUNDS) return false;
    this.recipes.set(name, recipe);
    return true;
  }

  /** What a scene gets as `host.sound`: define and play, and nothing else of the player. */
  forScene() {
    return Object.freeze({
      define: (name, recipe) => this.define(name, recipe),
      play: (name) => this.play(name),
    });
  }

  /** @param {string} name  a sound the scene defined */
  play(name) {
    if (!this.enabled || this.failed) return false;
    try {
      this.ctx ??= this.createContext();
      if (!this.ctx) {
        this.failed = true;
        return false;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume?.()?.catch?.(() => {});
      const recipe = this.recipes.get(name);
      if (!recipe) return false;
      this.bus ??= this.buildBus();
      const now = this.ctx.currentTime + 0.005; // a hair of lead time so the start is scheduled, not late
      recipe(this.voice, now);
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

  /** An index into a scale of the scene, not the one this sound picked last. `from`..`to` is an index range. */
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
