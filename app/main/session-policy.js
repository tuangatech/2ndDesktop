// What the page's session may do (docs/platform/02 section 3): no permissions (camera, location, notifications, ...),
// and no request except the app's own files, `data:` and `blob:` addresses and, in development, the dev server.
// The page has no network need: the real network traffic of later versions is made by the main process.
// `createRequestFilter` is plain Node and unit-tested; `installSessionPolicy` is the small part that touches Electron.
import { pathToFileURL } from 'node:url';

/**
 * @param {object} options
 * @param {string} options.rendererDir  the folder of the built page (`dist/renderer`); files under it may be loaded
 * @param {string} [options.devUrl]  the dev server address of a development run, for example http://localhost:5173
 * @param {boolean} [options.caseInsensitive]  true on Windows, where paths ignore case
 * @returns {(url: string) => boolean}  true when the page may request this address
 */
export function createRequestFilter({ rendererDir, devUrl, caseInsensitive = false }) {
  const fold = (text) => (caseInsensitive ? text.toLowerCase() : text);
  const base = pathToFileURL(rendererDir).pathname.replace(/\/?$/, '/');
  let devHost = null;
  if (devUrl) {
    try {
      devHost = new URL(devUrl).host;
    } catch {
      devHost = null;
    }
  }
  return (url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    switch (parsed.protocol) {
      case 'data:':
      case 'blob:':
        return true;
      case 'file:':
        return fold(parsed.pathname).startsWith(fold(base));
      case 'http:':
      case 'ws:':
        // The dev server and its hot-reload socket, only while developing.
        return devHost !== null && parsed.host === devHost;
      case 'devtools:':
        return devHost !== null; // the developer tools of a development run
      default:
        return false;
    }
  };
}

/**
 * Denies every permission and every request outside the filter, for one session, and makes every web contents that is
 * created later start without webviews and without new windows.
 * @param {object} options
 * @param {import('electron').Session} options.session
 * @param {import('electron').App} options.app
 * @param {(url: string) => boolean} options.allow
 * @param {(message: string) => void} [options.log]
 */
export function installSessionPolicy({ session, app, allow, log = () => {} }) {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => {
    const ok = allow(details.url);
    // Only the scheme and host of a refused address are logged: a path or a query may hold something private.
    if (!ok) log(`request refused: ${String(details.url).split('/').slice(0, 3).join('/')}`);
    callback({ cancel: !ok });
  });
  // The navigation rule of a window is in app/main/desktop.js (lockDown); this covers any web contents made later.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
}
