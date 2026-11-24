// The tank's own textures: the one made in code, and the scale of its atlas. The host loads the atlas itself (D40,
// renderer/art.js) and hands it to the scene as `host.art`.
import { Texture } from 'pixi.js';
import atlasData from '../../assets/spritesheets/fishtank.json';
import { makeRng } from '../../shared/rng.js';

/** Art is rendered at this many times its size in the default window (scripts/build-assets.mjs). */
export const ART_SCALE = atlasData.meta.artScale;

/** A seamless sand tile: warm base colour with light and dark grains. */
export function makeSandTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#d6bb86';
  g.fillRect(0, 0, size, size);
  const rng = makeRng(20261120);
  const grain = (color, alpha, count, minR, maxR) => {
    g.fillStyle = color;
    g.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const x = rng.range(0, size);
      const y = rng.range(0, size);
      const r = rng.range(minR, maxR);
      // Draw wrapped copies near the edges so the tile is seamless.
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          g.beginPath();
          g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  };
  grain('#efdfb0', 0.4, 700, 0.6, 1.8);
  grain('#a98f5e', 0.28, 600, 0.6, 1.6);
  grain('#efdfb0', 0.18, 90, 2, 4);
  g.globalAlpha = 1;
  return Texture.from(canvas);
}
