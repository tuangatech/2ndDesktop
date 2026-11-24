// For every scene with art (`scenes/<id>/art/*.svg`, platform plan D40): renders each SVG to a PNG at 3x its size, packs
// them into one spritesheet (assets/spritesheets/<id>.png + <id>.json, PixiJS format) and writes a contact sheet
// (assets/contact-sheet-<id>.png) for review. A scene without an `art` folder (a procedural one) gets no atlas.
// Usage: node scripts/build-assets.mjs   (also run by `npm run assets`, `npm run build` and `npm run dev`)
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.join(import.meta.dirname, '..');
export const ART_SCALE = 3;
const PADDING = 2;
const ATLAS_WIDTH = 2048;
// Files in a scene's art folder that are not game art.
const SKIP = new Set(['palette.svg']);

function crc32(buffer) {
  return zlib.crc32(buffer) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Minimal PNG encoder for RGBA pixels (no filtering). */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderSvgs(dir) {
  const images = [];
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.svg') && !SKIP.has(f))
    .sort()) {
    const svg = fs.readFileSync(path.join(dir, file));
    const image = new Resvg(svg, { fitTo: { mode: 'zoom', value: ART_SCALE } }).render();
    images.push({
      name: path.basename(file, '.svg'),
      width: image.width,
      height: image.height,
      pixels: Buffer.from(image.pixels),
    });
  }
  return images;
}

/** Shelf packing: tallest first, left to right, a new row when the row is full. */
function pack(images) {
  const sorted = [...images].sort((a, b) => b.height - a.height);
  let x = PADDING;
  let y = PADDING;
  let rowHeight = 0;
  for (const image of sorted) {
    if (x + image.width + PADDING > ATLAS_WIDTH) {
      x = PADDING;
      y += rowHeight + PADDING;
      rowHeight = 0;
    }
    image.x = x;
    image.y = y;
    x += image.width + PADDING;
    rowHeight = Math.max(rowHeight, image.height);
  }
  // Not rounded up to a power of two: WebGL 2 does not need it, and the unused rows cost video memory.
  const height = Math.ceil(Math.max(64, y + rowHeight + PADDING) / 4) * 4;
  return { sorted, width: ATLAS_WIDTH, height };
}

function composite(sorted, width, height) {
  const atlas = Buffer.alloc(width * height * 4);
  for (const image of sorted) {
    for (let row = 0; row < image.height; row++) {
      image.pixels.copy(
        atlas,
        ((image.y + row) * width + image.x) * 4,
        row * image.width * 4,
        (row + 1) * image.width * 4,
      );
    }
  }
  return atlas;
}

function contactSheet(atlas, width, height) {
  // The atlas over a mid-blue water colour, so both light and dark tones can be judged.
  const out = Buffer.alloc(atlas.length);
  const bg = [0x3f, 0xb0, 0xc4];
  for (let i = 0; i < atlas.length; i += 4) {
    const a = atlas[i + 3] / 255;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(atlas[i + c] * a + bg[c] * (1 - a));
    out[i + 3] = 255;
  }
  return encodePng(width, height, out);
}

function buildScene(id, artDir) {
  const images = renderSvgs(artDir);
  const { sorted, width, height } = pack(images);
  const atlas = composite(sorted, width, height);

  const outDir = path.join(root, 'assets', 'spritesheets');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${id}.png`), encodePng(width, height, atlas));

  const frames = {};
  for (const image of sorted) {
    frames[image.name] = {
      frame: { x: image.x, y: image.y, w: image.width, h: image.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: image.width, h: image.height },
      sourceSize: { w: image.width, h: image.height },
    };
  }
  fs.writeFileSync(
    path.join(outDir, `${id}.json`),
    JSON.stringify(
      {
        frames,
        meta: {
          image: `${id}.png`,
          format: 'RGBA8888',
          size: { w: width, h: height },
          scale: 1,
          artScale: ART_SCALE,
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(root, 'assets', `contact-sheet-${id}.png`),
    contactSheet(atlas, width, height),
  );

  console.log(
    `assets (${id}): ${sorted.length} images packed into ${width}x${height} (art scale ${ART_SCALE}x)`,
  );
}

const scenesDir = path.join(root, 'scenes');
for (const id of fs.readdirSync(scenesDir).sort()) {
  const artDir = path.join(scenesDir, id, 'art');
  if (fs.existsSync(artDir)) buildScene(id, artDir);
}
