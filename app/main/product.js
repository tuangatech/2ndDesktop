// The names of the product, in one place (BOOTSTRAP 7.2 step 3). The window page (app/page/index.html) cannot import
// this file; tests/host/product.test.js checks that its text is the same.

export const PRODUCT_NAME = '2ndDesktop';
// The bundle id and the Windows app id (electron-builder.yml has the same value in `appId`).
export const APP_ID = 'com.tuangatech.2nddesktop';
// The data folder of a development run, next to the real one (tech design 14.4).
export const DEV_DATA_FOLDER = `${PRODUCT_NAME} (dev)`;
// Where the same player's data lived before the rename (the old product had no `productName`, so the folder was the
// package name), and the old development folder. Used once, to copy the saved tank over (app/main/migrate-data.js).
export const OLD_DATA_FOLDER = 'fish-tank';
export const OLD_DEV_DATA_FOLDER = 'Fish Tank (dev)';
