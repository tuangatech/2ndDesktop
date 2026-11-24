// The tray icon (Windows notification area, macOS menu bar). Tech design 3.8, FR-61.
// The menu is built again on every click, so it is always current and nothing runs in the background.
// The template comes from app/main/menu.js (buildTrayTemplate); building it waits for what the scene reports.

import { Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { PRODUCT_NAME } from './product.js';

export function createTray({ trayDir, buildMenuTemplate }) {
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  const image = nativeImage.createFromPath(path.join(trayDir, file));
  if (process.platform === 'darwin') image.setTemplateImage(true);
  const tray = new Tray(image);
  tray.setToolTip(PRODUCT_NAME);

  const show = async () => tray.popUpContextMenu(Menu.buildFromTemplate(await buildMenuTemplate()));
  tray.on('click', show);
  tray.on('right-click', show);
  return tray;
}
