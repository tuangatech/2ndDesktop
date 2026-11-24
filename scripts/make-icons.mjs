// Renders the tray icons and the app icon from SVG to PNG (the first piece of `npm run assets`, Step 2).
// Usage: node scripts/make-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');

function render(svgPath, outPath, size) {
  const svg = fs.readFileSync(path.join(root, svgPath));
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.mkdirSync(path.dirname(path.join(root, outPath)), { recursive: true });
  fs.writeFileSync(path.join(root, outPath), png);
  console.log(`${outPath} (${size}px)`);
}

render('assets/tray/tray-template.svg', 'assets/tray/trayTemplate.png', 16);
render('assets/tray/tray-template.svg', 'assets/tray/trayTemplate@2x.png', 32);
render('assets/tray/tray-color.svg', 'assets/tray/tray.png', 32);
// App icon. `build/icon.png` (Windows, and what electron-builder converts to .ico) uses the whole canvas. macOS does
// not shape icons itself, and its icon grid puts the rounded square at 824 of 1024 px, so the same drawing is
// scaled down for `build/icon-mac.png` (converted to .icns). `assets/app-icon.png` is the 256 px copy the app loads
// at run time (window icon, About box).
render('build/app-icon.svg', 'build/icon.png', 1024);
render('build/app-icon.svg', 'assets/app-icon.png', 256);

const MAC_SCALE = 824 / 896; // the drawing's square is 896 px of 1024; the macOS grid wants 824
const source = fs.readFileSync(path.join(root, 'build/app-icon.svg'), 'utf8');
const macSvg = source
  .replace(
    /(<svg[^>]*>)/,
    `$1<g transform="translate(512 512) scale(${MAC_SCALE}) translate(-512 -512)">`,
  )
  .replace('</svg>', '</g></svg>');
const macTemp = path.join(root, 'build/.app-icon-mac.svg');
fs.writeFileSync(macTemp, macSvg);
try {
  render('build/.app-icon-mac.svg', 'build/icon-mac.png', 1024);
} finally {
  fs.rmSync(macTemp, { force: true });
}
