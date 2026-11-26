// The tray icon (Windows notification area, macOS menu bar). Tech design 3.8, FR-61.
// The menu is built again on every click, so it is always current and nothing runs in the background.
// The template comes from app/main/menu.js (buildTrayTemplate); building it waits for what the scene reports.
//
// Light and dark: macOS draws a template image (`trayTemplate.png`, black on transparency) in the colour of the menu
// bar by itself. Windows has no such thing, so there is one drawing per taskbar theme and the icon is swapped when
// the system theme changes.

import { Menu, Tray, nativeImage, nativeTheme } from 'electron';
import path from 'node:path';
import { PRODUCT_NAME } from './product.js';

export function createTray({ trayDir, buildMenuTemplate }) {
  const load = (file) => nativeImage.createFromPath(path.join(trayDir, file));
  const windowsImage = () =>
    load(nativeTheme.shouldUseDarkColors ? 'tray-on-dark.png' : 'tray-on-light.png');

  let image;
  if (process.platform === 'darwin') {
    image = load('trayTemplate.png');
    image.setTemplateImage(true);
  } else {
    image = windowsImage();
  }
  const tray = new Tray(image);
  tray.setToolTip(PRODUCT_NAME);

  if (process.platform !== 'darwin') {
    const follow = () => {
      if (!tray.isDestroyed()) tray.setImage(windowsImage());
    };
    nativeTheme.on('updated', follow);
  }

  const show = async () => tray.popUpContextMenu(Menu.buildFromTemplate(await buildMenuTemplate()));
  tray.on('click', show);
  tray.on('right-click', show);
  return tray;
}
