// The host loads the art of a scene (platform plan D40): one atlas per scene, `assets/spritesheets/<atlas>.png` and
// `.json`, built by `npm run assets`. A scene never loads files itself.
import { Assets, Spritesheet } from 'pixi.js';

// Vite knows every atlas at build time, so a packed app needs no file access.
const urls = import.meta.glob('../../assets/spritesheets/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});
const sheets = import.meta.glob('../../assets/spritesheets/*.json', {
  import: 'default',
  eager: true,
});

/**
 * @param {string} atlas  the name in `scene.json` (`atlas`), for example "fishtank"
 * @returns {Promise<{textures: Record<string, import('pixi.js').Texture>, source: import('pixi.js').TextureSource}>}
 */
export async function loadAtlas(atlas) {
  const url = urls[`../../assets/spritesheets/${atlas}.png`];
  const data = sheets[`../../assets/spritesheets/${atlas}.json`];
  if (!url || !data) throw new Error(`No atlas named "${atlas}" (run npm run assets)`);
  // Image decoding in a worker would need `worker-src blob:` in the Content-Security-Policy; not worth loosening it.
  Assets.setPreferences({ preferWorkers: false });
  const texture = await Assets.load(url);
  const sheet = new Spritesheet(texture, data);
  await sheet.parse();
  return { textures: sheet.textures, source: texture.source };
}

/**
 * Uploads the atlas to the graphics card now and drops the decoded copy of the image that PixiJS keeps in the
 * renderer (10 MB, perf-notes.md). After this the atlas cannot be uploaded again, so a lost graphics context has to
 * reload the page (see main.js).
 *
 * Only an `ImageBitmap` can be closed. PixiJS makes one for a PNG atlas; if a later version loads an
 * `HTMLImageElement` instead, `resource.close` does not exist and nothing is freed, silently. The end-to-end
 * test (tests/e2e/smoke.spec.js) checks that the image width is 0 after the upload, so it fails then.
 */
export function releaseAtlasImage(renderer, source) {
  renderer.texture.initSource(source);
  source.resource?.close?.();
}
