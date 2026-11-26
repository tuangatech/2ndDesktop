// The tray icon (Windows notification area, macOS menu bar). Tech design 3.8, FR-61.
// The menu is built again on every click, so it is always current and nothing runs in the background.
// The template comes from app/main/menu.js (buildTrayTemplate); building it waits for what the scene reports.
//
// Light and dark: the icon (`tray.png`, with `tray@2x.png` for scaled screens) is a coral tile with a white "2". It is
// an ordinary coloured image on both systems and reads on a light and on a dark bar alike, so nothing has to follow
// the system theme (no macOS template image, no light and dark pair).

import { Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { PRODUCT_NAME } from './product.js';

export function createTray({ trayDir, buildMenuTemplate }) {
  const image = nativeImage.createFromPath(path.join(trayDir, 'tray.png'));
  const tray = new Tray(image);
  tray.setToolTip(PRODUCT_NAME);

  const show = async () => tray.popUpContextMenu(Menu.buildFromTemplate(await buildMenuTemplate()));
  tray.on('click', show);
  tray.on('right-click', show);
  return tray;
}
