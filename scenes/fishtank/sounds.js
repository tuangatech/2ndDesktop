// The tank's three sounds (FR-38, D19, D36): recipes for the host's sound engine (app/page/SoundPlayer.js), which
// makes the voices and the shared room. The scene defines them when it is created and plays them by name, only as an
// answer to something the player did (a click or a menu action; a test checks that the tick makes none).
//
// One key for everything, D major pentatonic: no note clashes with another, so any two sounds can overlap. Notes stay
// between 500 Hz and 1.5 kHz because laptop speakers do not reproduce much below that. The water sounds are small
// bubbles (a sine whose pitch glides up a little as it rings, the way a trapped air bubble does, Minnaert) with a very
// soft, dark touch of noise for the surface.

/** D major pentatonic, D5 to E6, in Hz. */
export const SCALE = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51];

export const SOUND_NAMES = ['splash', 'pop', 'chime'];

/** Each recipe is `(voice, at) => void`: `voice` is the engine's `partial`, `bubble`, `touch`, `pick` and `random`. */
export const recipes = {
  /** Food landing in the water: a soft touch and two small bubbles, the second higher and fainter. */
  splash(voice, at) {
    const index = voice.pick('splash', 0, 2);
    voice.touch(at, { peak: 0.1, decay: 0.07 });
    voice.bubble(SCALE[index], at + 0.012, { peak: 0.42, decay: 0.2 });
    voice.bubble(SCALE[index + 2], at + 0.075 + voice.random() * 0.02, {
      peak: 0.16,
      decay: 0.14,
      glide: 1.25,
    });
  },

  /** A pellet collected: one small, bright bubble that rises. */
  pop(voice, at) {
    voice.bubble(SCALE[voice.pick('pop', 3, 5)], at, {
      peak: 0.45,
      decay: 0.12,
      glide: 1.5,
      glideTime: 0.04,
      send: 0.2,
    });
  },

  /** A new fish: three bell notes going up the D major triad, each with a soft overtone, in the room. */
  chime(voice, at) {
    const notes = [SCALE[2], SCALE[3], SCALE[5]]; // F#5, A5, D6
    notes.forEach((frequency, i) => {
      const start = at + i * 0.15;
      const last = i === notes.length - 1;
      const decay = last ? 1.5 : 0.9;
      voice.partial(frequency, start, { peak: 0.24, attack: 0.008, decay, send: 0.5 });
      // A bar-like overtone (about 2.76 times the pitch) gives the glassy bell colour; it dies sooner.
      voice.partial(frequency * 2.76, start, {
        peak: 0.036,
        attack: 0.004,
        decay: decay * 0.3,
        send: 0.5,
      });
    });
  },
};

/** Gives the tank's sounds to the host's engine (`host.sound`). A host without sound (a test, a scene run alone) is fine. */
export function defineSounds(sound) {
  if (!sound?.define) return;
  for (const name of SOUND_NAMES) sound.define(name, recipes[name]);
}
