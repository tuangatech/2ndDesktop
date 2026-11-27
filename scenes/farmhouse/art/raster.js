// Turns a picture of the art modules (a list of drawing operations, draw.js) into one PixiJS texture: the canvas paints it,
// the bitmap is uploaded to the graphics card at once and the canvas copy is dropped, as the host does with an atlas
// (app/page/art.js `releaseAtlasImage`): after this the texture cannot be uploaded again, so a lost graphics context
// reloads the page (app/page/main.js). No file and no network.
import { Sprite, Texture } from 'pixi.js';
import { paint } from './draw.js';

/**
 * @param {{ops: object[], x: number, y: number, pixelWidth: number, pixelHeight: number, width: number}} picture
 * @param {import('pixi.js').Renderer} renderer
 * @returns {Texture}
 */
export function rasterize(picture, renderer) {
  const canvas = new OffscreenCanvas(picture.pixelWidth, picture.pixelHeight);
  // A software canvas (`willReadFrequently`): the graphics card's canvas keeps about 40 MB of the GPU process for these
  // eighteen pictures; painting on the processor costs a few milliseconds more and leaves only the bitmap.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scale = picture.pixelWidth / picture.width;
  ctx.scale(scale, scale);
  ctx.translate(-picture.x, -picture.y);
  paint(ctx, picture.ops);
  const bitmap = canvas.transferToImageBitmap();
  canvas.width = canvas.height = 0; // let go of the canvas memory now, not at the next garbage collection
  const texture = Texture.from(bitmap);
  renderer.texture.initSource(texture.source);
  bitmap.close();
  return texture;
}

/**
 * A sprite for a picture: placed at its strip of the design and sized in design units whatever the resolution it was
 * drawn at.
 * @param {{x: number, y: number, width: number, height: number}} picture
 * @param {Texture} texture
 */
export function spriteOf(picture, texture) {
  const sprite = new Sprite(texture);
  sprite.position.set(picture.x, picture.y);
  sprite.width = picture.width;
  sprite.height = picture.height;
  return sprite;
}
