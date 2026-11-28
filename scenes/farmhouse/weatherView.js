// What the scene draws for the sky, the weather and the light (docs/scenes/farmhouse.md section 5, items 1, 2, 10 and 11):
// stars, sun and moon, clouds that drift (and give way to the pointer), banks of fog, rain, snow, leaves and petals, and
// the grade over everything. The numbers come from the pure rules (game/sky.js); this file only puts sprites where they
// say. Every position is a function of the clock (R1): a drop's place comes from its index and the time, so nothing is
// added up from frame to frame and a pause or a jump of the clock makes no difference. Only the clouds' give-way to the
// pointer is eased with the frame time, which is cosmetic and does not touch the clock.
import { Graphics, Sprite } from 'pixi.js';
import { unit } from './game/hash.js';
import { stormness } from './game/weather.js';
import { CLOUDS, blend, cloudStrengths, fogAt, gradeAt, lightningDim } from './game/sky.js';
import { DESIGN } from './layout.js';
import {
  LEAF_COLOURS,
  PETAL_COLOURS,
  cloudPicture,
  flakePicture,
  fogPicture,
  leafPicture,
  moonPicture,
  petalPicture,
  rainPicture,
  starsPicture,
  sunPicture,
  vignettePicture,
} from './art/weather.js';
import { rasterize, spriteOf } from './art/raster.js';

const W = DESIGN.width;
const H = DESIGN.height;
/** The most of each falling thing the scene ever has (the caps of `fallingAt`). */
const POOL = { rain: 420, snow: 360, leaves: 36, petals: 50 };

const mod = (v, m) => ((v % m) + m) % m;
const hexNumber = (hex) => parseInt(hex.slice(1), 16);

/**
 * @param {{renderer: import('pixi.js').Renderer, layers: Record<string, Container>, seed: number}} options
 */
export function createWeatherView({ renderer, layers, seed }) {
  const texture = (picture) => rasterize(picture, renderer);
  /** A sprite centred on its own point (the pictures of art/weather.js are drawn around their centre). */
  const centred = (picture, parent) => {
    const sprite = new Sprite(texture(picture));
    sprite.anchor.set(0.5);
    sprite.width = picture.width;
    sprite.height = picture.height;
    parent.addChild(sprite);
    return sprite;
  };

  // The sky layer: the stars, the sun, the moon and the nine clouds (the sky picture itself is put under them).
  const starsPic = starsPicture();
  const stars = spriteOf(starsPic, texture(starsPic));
  layers.sky.addChild(stars);
  const sun = centred(sunPicture(), layers.sky);
  const moon = centred(moonPicture(), layers.sky);
  const cloudPics = [cloudPicture(0), cloudPicture(1)];
  const cloudTextures = cloudPics.map((p) => texture(p));
  const clouds = Array.from({ length: CLOUDS }, (_, i) => {
    const pic = cloudPics[i % 2];
    const sprite = new Sprite(cloudTextures[i % 2]);
    sprite.anchor.set(0.5);
    const scale = 0.8 + unit(seed, i, 51) * 0.8;
    sprite.width = pic.width * scale;
    sprite.height = pic.height * scale;
    layers.sky.addChild(sprite);
    return {
      sprite,
      push: 0,
      y: 50 + unit(seed, i, 52) * 150,
      start: unit(seed, i, 53),
      speed: 3 + unit(seed, i, 54) * 6,
    };
  });

  // The weather layer: three banks of fog, then the falling things.
  const fogPic = fogPicture();
  const fogTexture = texture(fogPic);
  const fogs = [
    { y: 262, scale: 1.1, k: 1.0 },
    { y: 430, scale: 1.6, k: 0.85 },
    { y: 585, scale: 1.2, k: 0.9 },
  ].map((spec, i) => {
    const sprite = new Sprite(fogTexture);
    sprite.anchor.set(0.5);
    sprite.width = fogPic.width;
    sprite.height = fogPic.height * spec.scale;
    sprite.y = spec.y;
    sprite.visible = false;
    layers.weather.addChild(sprite);
    return { ...spec, sprite, phase: i * 2.1 };
  });
  const pool = (count, make) =>
    Array.from({ length: count }, (_, i) => {
      const sprite = make(i);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      layers.weather.addChild(sprite);
      return sprite;
    });
  const rainPic = rainPicture();
  const flakePic = flakePicture();
  const rainTexture = texture(rainPic);
  const flakeTexture = texture(flakePic);
  const leafTextures = LEAF_COLOURS.map((c) => texture(leafPicture(c)));
  const petalTextures = PETAL_COLOURS.map((c) => texture(petalPicture(c)));
  const rain = pool(POOL.rain, () => new Sprite(rainTexture));
  const snow = pool(POOL.snow, () => new Sprite(flakeTexture));
  const leaves = pool(POOL.leaves, (i) => new Sprite(leafTextures[i % leafTextures.length]));
  const petals = pool(POOL.petals, (i) => new Sprite(petalTextures[i % petalTextures.length]));

  // The grade layer: the multiplied colour, a haze, the vignette. The lit windows are put over the grade by the scene so
  // that they stay bright at night.
  const multiplyLayer = new Graphics().rect(0, 0, W, H).fill(0xffffff);
  multiplyLayer.blendMode = 'multiply';
  const haze = new Graphics().rect(0, 0, W, H).fill(0xcfd6d4);
  haze.alpha = 0;
  const vignettePic = vignettePicture();
  const vignette = spriteOf(vignettePic, texture(vignettePic));
  layers.grade.addChildAt(multiplyLayer, 0);
  layers.grade.addChildAt(haze, 1);
  layers.grade.addChildAt(vignette, 2);

  /** A falling thing's place at a time: from its index and the clock only. */
  function fall(sprite, i, t, kind, wind) {
    const u1 = unit(seed, i, kind, 1);
    const u2 = unit(seed, i, kind, 2);
    const u3 = unit(seed, i, kind, 3);
    let speed;
    let drift;
    if (kind === 61) {
      speed = 760 + u3 * 200; // rain
      drift = wind * 240;
    } else if (kind === 62) {
      speed = 50 + u3 * 45; // snow
      drift = wind * 60 + Math.sin(t * 0.7 + i) * 14;
    } else {
      speed = 32 + u3 * 30; // leaves and petals
      drift = wind * 90 + Math.sin(t * 0.9 + i * 1.7) * 38;
    }
    const x = mod(u1 * (W + 300) + drift * t, W + 300) - 150;
    const y = mod(u2 * (H + 80) + speed * t, H + 80) - 40;
    sprite.position.set(x, y);
    if (kind === 61) {
      sprite.rotation = Math.atan2(drift, speed) * -1;
      sprite.scale.set(0.7 + u3 * 0.5);
      sprite.alpha = 0.3 + u2 * 0.3;
    } else if (kind === 62) {
      sprite.scale.set(0.4 + u3 * 0.7);
      sprite.alpha = 0.6 + u2 * 0.4;
    } else {
      sprite.rotation = t * (0.8 + u3) + i;
      sprite.scale.set(0.8 + u3 * 0.7);
      sprite.alpha = 0.9;
    }
  }
  const place = (sprites, count, kind, t, wind) => {
    sprites.forEach((sprite, i) => {
      const on = i < count;
      sprite.visible = on;
      if (on) fall(sprite, i, t, kind, wind);
    });
  };

  return {
    /**
     * @param {object} frame
     * @param {number} frame.ms  the clock
     * @param {number} frame.dt  seconds since the last frame, capped (only the clouds' give-way to the pointer uses it)
     * @param {object} frame.slow  `slowAt()`
     * @param {object} frame.tod  `timeOfDay()`
     * @param {object} frame.falling  `fallingAt()`
     * @param {{x: number, y: number}|null} frame.pointer  in design units
     */
    update({ ms, dt, slow, tod, falling, pointer }) {
      const t = ms / 1000;
      const { weather } = slow;
      const cloud = Math.max(0, Math.min(1, weather.cloud));
      // Stars, sun, moon.
      stars.alpha = tod.night * (1 - cloud) * 0.95;
      stars.visible = stars.alpha > 0.01;
      sun.visible = tod.sun !== null && (1 - cloud * 0.9) * (1 - tod.night) > 0.02;
      if (sun.visible) {
        sun.position.set(250 + tod.sun * (W - 500), 258 - Math.sin(Math.PI * tod.sun) * 205);
        sun.alpha = (1 - cloud * 0.9) * (1 - tod.night);
      }
      moon.visible = tod.moon !== null && tod.night * (1 - cloud * 0.85) > 0.02;
      if (moon.visible) {
        moon.position.set(250 + tod.moon * (W - 500), 258 - Math.sin(Math.PI * tod.moon) * 190);
        moon.alpha = tod.night * (1 - cloud * 0.85);
      }
      // Clouds: they drift with the wind and give way to the pointer.
      const strengths = cloudStrengths(weather);
      const grey = Math.min(
        1,
        weather.precipitation * 0.8 + stormness(weather) * 0.4 + cloud * 0.25,
      );
      const tint = hexNumber(blend('#ffffff', '#8f989e', grey));
      const dayLight = 1 - tod.night * 0.85;
      const span = W + 700;
      clouds.forEach((c, i) => {
        const s = strengths[i];
        c.sprite.visible = s > 0.02;
        if (!c.sprite.visible) return;
        const baseX = mod(c.start * span + (c.speed + weather.wind * 14) * t, span) - 350;
        let want = 0;
        if (pointer) {
          const dx = baseX - pointer.x;
          const dy = c.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < 280) want = Math.sign(dx || 1) * (1 - d / 280) * 160;
        }
        c.push += (want - c.push) * Math.min(1, dt * 1.5);
        c.sprite.position.set(baseX + c.push, c.y);
        c.sprite.alpha = s * 0.92 * dayLight;
        c.sprite.tint = tint;
      });
      // Fog.
      const fog = fogAt(weather);
      const amounts = [fog.cap, fog.mid, fog.low];
      fogs.forEach((f, i) => {
        f.sprite.visible = amounts[i] > 0.02;
        if (!f.sprite.visible) return;
        f.sprite.alpha = Math.min(1, amounts[i] * f.k * 1.05);
        f.sprite.x = W / 2 + Math.sin(t / 55 + f.phase) * 150;
      });
      // Falling things.
      const wind = weather.wind;
      place(rain, falling.rain, 61, t, wind);
      place(snow, falling.snow, 62, t, wind);
      place(leaves, falling.leaves, 63, t, wind);
      place(petals, falling.petals, 64, t, wind);
      // Grade.
      const dim = lightningDim(ms, weather, seed);
      const grade = gradeAt(tod, weather, dim);
      multiplyLayer.tint = hexNumber(grade.multiply);
      haze.alpha = grade.haze;
    },
    debug: () => ({
      clouds: clouds.filter((c) => c.sprite.visible).length,
      fog: fogs.map((f) => (f.sprite.visible ? +f.sprite.alpha.toFixed(2) : 0)),
      rain: rain.filter((s) => s.visible).length,
      snow: snow.filter((s) => s.visible).length,
      leaves: leaves.filter((s) => s.visible).length,
      petals: petals.filter((s) => s.visible).length,
      sun: sun.visible,
      moon: moon.visible,
      stars: stars.visible,
      grade: multiplyLayer.tint,
    }),
  };
}
