// The tray menu as a pure function (FR-61, FR-62, tech design 3.8): the scene gives a status line and its items
// (platform plan D38), so the menu is always current and nothing updates in the background. `settingsItems` is the one
// list of settings items (FR-36) shared by the tray menu and the gear menu of the window; Phase 2 adds Reduced
// effects and Day/night lighting there.

import { PRODUCT_NAME } from './product.js';

const MAX_LABEL = 60;
const MAX_ITEMS = 12;
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

/**
 * Cleans what a scene reported before it reaches a menu: plain text of at most 60 characters, ids of a safe shape,
 * at most 12 items. Anything that does not fit is dropped; nothing here can throw.
 * @param {unknown} raw  `{name, line, diagnostics, items}` from the renderer
 * @returns {{name: string, line: string|null, diagnostics: string|null, items: {id?: string, label: string, enabled: boolean}[]}|null}
 */
export function sanitizeSceneMenu(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Plain text: control characters (newlines, escapes) become spaces.
  const plain = (value, max) =>
    typeof value === 'string'
      ? Array.from(value, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
          .join('')
          .trim()
          .slice(0, max)
      : '';
  const text = (value) => plain(value, MAX_LABEL);
  const items = [];
  for (const item of Array.isArray(raw.items) ? raw.items : []) {
    if (items.length >= MAX_ITEMS) break;
    const label = text(item?.label);
    if (!label) continue;
    const id = typeof item.id === 'string' && ID_PATTERN.test(item.id) ? item.id : undefined;
    items.push({ ...(id ? { id } : {}), label, enabled: Boolean(id) && item.enabled !== false });
  }
  return {
    name: text(raw.name) || 'Scene',
    line: text(raw.line) || null,
    diagnostics: plain(raw.diagnostics, 200) || null,
    items,
  };
}

/**
 * The settings items (FR-36): Always on top (window mode only), Launch at login, Sound, Copy diagnostics, About.
 * @param {{mode?: string, alwaysOnTop?: boolean, sound?: boolean, launchAtLogin?: boolean,
 *          canLaunchAtLogin?: boolean, copied?: boolean}} settings
 * @param {{setSetting?: (key: string, value: boolean) => void, copyDiagnostics?: () => void,
 *          about?: () => void}} handlers
 * @param {{withAbout?: boolean}} [options]  the macOS menu bar has About in the application menu instead
 */
export function settingsItems(settings, handlers, { withAbout = true } = {}) {
  const items = [];
  if (settings.mode !== 'desktop') {
    items.push({
      label: 'Always on top',
      type: 'checkbox',
      checked: Boolean(settings.alwaysOnTop),
      click: (item) => handlers.setSetting?.('alwaysOnTop', item.checked),
    });
  }
  items.push(
    {
      // Only an installed app may register itself to start at login; a development run never does.
      label:
        settings.canLaunchAtLogin === false
          ? 'Launch at login (installed app only)'
          : 'Launch at login',
      type: 'checkbox',
      checked: Boolean(settings.launchAtLogin),
      enabled: settings.canLaunchAtLogin !== false,
      click: (item) => handlers.setSetting?.('launchAtLogin', item.checked),
    },
    {
      label: 'Sound',
      type: 'checkbox',
      checked: settings.sound !== false,
      click: (item) => handlers.setSetting?.('sound', item.checked),
    },
    { type: 'separator' },
    {
      label: settings.copied ? 'Copied' : 'Copy diagnostics',
      click: () => handlers.copyDiagnostics?.(),
    },
  );
  if (withAbout) items.push({ label: `About ${PRODUCT_NAME}`, click: () => handlers.about?.() });
  return items;
}

/**
 * @param {ReturnType<typeof sanitizeSceneMenu>} sceneMenu  what the scene reported when the menu opened, or null
 * @param {Parameters<typeof settingsItems>[0] & {mode: 'desktop'|'window'}} settings
 * @param {string|null} note  a one-line note, for example the desktop fallback message
 * @param {Parameters<typeof settingsItems>[1] & {action: (id: string) => void, setMode: (mode: string) => void,
 *          quit: () => void}} handlers
 */
export function buildTrayTemplate(sceneMenu, settings, note, handlers) {
  const items = [{ label: sceneMenu?.line ?? PRODUCT_NAME, enabled: false }];
  if (note) items.push({ label: note, enabled: false });
  items.push({ type: 'separator' });
  for (const item of sceneMenu?.items ?? []) {
    items.push(
      item.id
        ? { label: item.label, click: () => handlers.action(item.id), enabled: item.enabled }
        : { label: item.label, enabled: false },
    );
  }
  items.push(
    { type: 'separator' },
    settings.mode === 'desktop'
      ? { label: 'Show in a window', click: () => handlers.setMode('window') }
      : { label: 'Show on desktop', click: () => handlers.setMode('desktop') },
    { type: 'separator' },
    ...settingsItems(settings, handlers),
    { type: 'separator' },
    { label: 'Quit', click: () => handlers.quit() },
  );
  return items;
}

/**
 * The macOS menu bar (tech design 3.6): the application menu with About, Hide and Cmd+Q, a menu named after the scene with the mode
 * switch and the shared settings items, and a Window menu with Cmd+M and Cmd+W. It is only visible in window mode
 * (in desktop mode the Dock icon is hidden and the app is never the front app). Windows has no menu bar.
 * Electron's default menu is not used, because it carries Reload and Developer Tools.
 * @param {Parameters<typeof settingsItems>[0] & {mode: 'desktop'|'window'}} settings
 * @param {Parameters<typeof settingsItems>[1] & {setMode: (mode: string) => void}} handlers
 * @param {{dev?: boolean, sceneName?: string|null}} [options]  a development run adds a Developer menu; the second
 *        menu is named after the scene (from its scene.json)
 */
export function buildAppMenuTemplate(settings, handlers, { dev = false, sceneName = null } = {}) {
  const template = [
    {
      label: PRODUCT_NAME,
      submenu: [
        { label: `About ${PRODUCT_NAME}`, click: () => handlers.about?.() },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${PRODUCT_NAME}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${PRODUCT_NAME}` },
      ],
    },
    {
      label: sceneName ?? 'Scene',
      submenu: [
        settings.mode === 'desktop'
          ? { label: 'Show in a window', click: () => handlers.setMode('window') }
          : { label: 'Show on desktop', click: () => handlers.setMode('desktop') },
        { type: 'separator' },
        ...settingsItems(settings, handlers, { withAbout: false }),
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close', label: 'Close Window' }],
    },
  ];
  if (dev) {
    template.push({
      label: 'Developer',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
    });
  }
  return template;
}
