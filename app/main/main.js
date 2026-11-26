import {
  BrowserWindow,
  Menu,
  app,
  clipboard,
  ipcMain,
  nativeImage,
  nativeTheme,
  powerMonitor,
  screen,
  session,
} from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aboutHtml } from './about.js';
import { createDesktopController } from './desktop.js';
import { devSwitchesAllowed, removeDevSwitches } from './dev-switches.js';
import {
  buildText,
  describeGpuDevice,
  displayPath,
  sanitize,
  shortenPaths,
  tailLines,
} from './diagnostics.js';
import { buildAppMenuTemplate, buildTrayTemplate, sanitizeSceneMenu } from './menu.js';
import { createCrashRestart, RESTARTED_ARG, restartCommandLine } from './crash-restart.js';
import { FALLBACK_NOTE, chooseStartMode, settingsForMode, settingsOnQuit } from './display-mode.js';
import { createLineLimiter, createLogFile } from './log-file.js';
import { createSettingsStore } from './settings.js';
import { createSceneBinding } from './scene-binding.js';
import { createRecordStore, readJson } from './store.js';
import { createTray } from './tray.js';
import { createUsageLog, usageLines } from './usage-log.js';
import { startSampler } from './sampler.js';
import { migrateOldData } from './migrate-data.js';
import { createRequestFilter, installSessionPolicy } from './session-policy.js';
import {
  APP_ID,
  DEV_DATA_FOLDER,
  OLD_DATA_FOLDER,
  OLD_DEV_DATA_FOLDER,
  PRODUCT_NAME,
} from './product.js';

// A small log that testers can send back (Step 1 desktop attach test). It stays under 1 MB (one old file is kept) and
// every line loses the home folder and the user name when it is written (the stack of an error holds a path). It is
// defined first: the start-up code below already writes to it.
let whoAmI = null;
const logFile = createLogFile({
  file: () => path.join(app.getPath('userData'), 'desktop-spike.log'),
  clean: (text) => {
    whoAmI ??= (() => {
      try {
        return { home: os.homedir(), userName: os.userInfo().username };
      } catch {
        return { home: os.homedir() };
      }
    })();
    return sanitize(text, whoAmI);
  },
});
function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(`[2nddesktop] ${line}`);
  logFile.write(line);
}

const root = path.join(import.meta.dirname, '..', '..');
// The channel ("release" or "test") comes from package.json; only development and test builds read tuning.json (D25).
const channel = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).desktop2?.channel;
  } catch {
    return 'release';
  }
})();
// An installed release ignores every development and test switch (app/main/dev-switches.js).
if (!devSwitchesAllowed({ packaged: app.isPackaged, channel })) removeDevSwitches(process.env);
const devUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(devUrl) || !app.isPackaged;

// Development runs use their own data folder, so they never touch a real save (tech design 14.4).
if (process.env.DESKTOP2_USER_DATA) {
  app.setPath('userData', process.env.DESKTOP2_USER_DATA);
} else {
  if (isDev) app.setPath('userData', path.join(app.getPath('appData'), DEV_DATA_FOLDER));
  // The first start after the rename copies the saved tank and the settings from the old product's folder (a copy,
  // never a move). A run with its own data folder (tests, screenshots) never does.
  migrateOldData({
    oldDir: path.join(app.getPath('appData'), isDev ? OLD_DEV_DATA_FOLDER : OLD_DATA_FOLDER),
    newDir: app.getPath('userData'),
    log: (message) => log(message),
  });
}
app.setAppUserModelId(APP_ID);

const userData = app.getPath('userData');
// The app icon, for the window and the About box. The installed app gets its icon from the .exe and the .icns.
const appIconPath = path.join(root, 'assets', 'app-icon.png');
// One file per scene (docs/03-platform-design.md section 5); the tank is the only scene for now (D33).
const records = createRecordStore({
  dir: path.join(userData, 'records'),
  // The error code only: the message holds a file path of the user.
  onError: (id, error, failures) =>
    log(`record:save of ${id} failed (${error?.code ?? error?.name}), attempt ${failures}`),
});
const DEFAULT_SCENE = 'fishtank';
const settingsStore = createSettingsStore({ file: path.join(userData, 'settings.json') });
function readSettings() {
  const data = settingsStore.get();
  const activeScene = records.isValidId(data.activeScene) ? data.activeScene : DEFAULT_SCENE;
  return { ...data, activeScene };
}
function readTuning() {
  if (!isDev && channel !== 'test') return null;
  const read = readJson(path.join(userData, 'tuning.json'));
  return read.status === 'ok' && read.data && typeof read.data === 'object' ? read.data : null;
}

// Attach test only: extra Chromium switches, for example DESKTOP2_CHROMIUM_FLAGS=disable-gpu-compositing.
for (const flag of (process.env.DESKTOP2_CHROMIUM_FLAGS ?? '').split(',').filter(Boolean)) {
  // `name` or `name=value` (for example force-color-profile=srgb).
  const [name, ...value] = flag.split('=');
  if (value.length) app.commandLine.appendSwitch(name, value.join('='));
  else app.commandLine.appendSwitch(name);
}

// Test runs open real windows; the sounds still run (a test can check them) but nothing reaches the speakers.
if (process.env.DESKTOP2_TEST === '1') app.commandLine.appendSwitch('mute-audio');

// Attach test only: software drawing instead of the GPU, to see whether GPU compositing is the problem.
if (process.env.DESKTOP2_NO_GPU === '1') app.disableHardwareAcceleration();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

// The local diagnostics log (NFR-7): days, minutes drawn, activity, a sample a minute, errors, start times.
const who = () => ({ home: os.homedir(), userName: os.userInfo().username });
const usage = createUsageLog({
  file: path.join(app.getPath('userData'), 'diagnostics.json'),
  getMetrics: () => app.getAppMetrics(),
  getState: () => ({
    mode: controller?.getMode() ?? 'window',
    paused: controller?.isPaused() ?? false,
  }),
  cleanText: (text) => shortenPaths(sanitize(text, who())),
  onWriteError: (error, failures) =>
    log(`diagnostics.json: write failed (${error?.code ?? error?.name}), attempt ${failures}`),
});

// Why the app ended, in the log (the Explorer restart test ended it without a trace). The error text is the
// first lines of the stack only, and diagnostics sanitizes it before it is copied.
process.on('uncaughtException', (error) =>
  log(
    `uncaught exception: ${String(error?.stack ?? error)
      .split('\n')
      .slice(0, 6)
      .join(' | ')}`,
  ),
);
process.on('unhandledRejection', (reason) =>
  log(
    `unhandled rejection: ${String(reason?.stack ?? reason)
      .split('\n')
      .slice(0, 6)
      .join(' | ')}`,
  ),
);
process.on('uncaughtException', (error) =>
  usage.error(`uncaught exception: ${error?.stack ?? error}`),
);
process.on('unhandledRejection', (reason) =>
  usage.error(`unhandled rejection: ${reason?.stack ?? reason}`),
);
process.on('exit', (code) => log(`process exit, code ${code}`));
app.on('render-process-gone', (_event, _contents, details) =>
  log(`renderer process gone: ${details.reason}, exit code ${details.exitCode}`),
);
app.on('child-process-gone', (_event, details) =>
  log(`${details.type} process gone: ${details.reason}, exit code ${details.exitCode}`),
);

async function loadRenderer(win, mode, extra = {}) {
  if (process.env.DESKTOP2_DEBUG === '1') {
    win.webContents.on('console-message', (event) => log('renderer console: ' + event.message));
  }
  // Test and screenshot runs can draw the desktop scene in an ordinary window (DESKTOP2_TEST=1 only).
  const testMode = process.env.DESKTOP2_TEST === '1' ? process.env.DESKTOP2_TEST_RENDER_MODE : null;
  const query = { mode: testMode || mode, ...extra };
  if (process.env.DESKTOP2_DEBUG === '1') query.debug = '1';
  if (process.env.DESKTOP2_DEV === '1') query.dev = '1';
  // Development switches for the scene, a JSON object (app/page/sceneOptions.js).
  if (process.env.DESKTOP2_SCENE_OPTIONS) query.options = process.env.DESKTOP2_SCENE_OPTIONS;
  if (devUrl) {
    await win.loadURL(`${devUrl}?${new URLSearchParams(query)}`);
  } else {
    await win.loadFile(path.join(root, 'dist', 'renderer', 'index.html'), { query });
  }
}

// Windows starts the tank again after a crash while it is on the desktop (an Explorer restart ends the app, see
// app/main/crash-restart.js). A development run restarts with the app folder as its first argument.
const crashRestart = createCrashRestart({
  commandLine: () =>
    restartCommandLine({
      appPath: app.isPackaged ? null : app.getAppPath(),
      flags: process.argv.slice(app.isPackaged ? 1 : 2),
    }),
  log: (message) => log(message),
});

let controller = null;
let fallbackNote = null;
// False when the mode was forced by DESKTOP2_MODE: such a run must not change the player's saved choice.
let rememberMode = true;

// The tray menu is built from what the scene reports every time it opens (FR-61, D38): the main process asks the
// renderer, waits at most 300 ms, and uses the last answer if the renderer is late. The answer is cleaned before it is
// used (plain text, at most 60 characters), and only the ids of the last menu are forwarded back to the renderer.
let lastSceneMenu = null;
let sceneName = null; // from the renderer once the scene runs (scene.json name)
let allowedIds = new Set();
function requestSceneMenu() {
  const win = controller?.getWindow();
  if (!win || win.isDestroyed()) return Promise.resolve(lastSceneMenu);
  return new Promise((resolve) => {
    const done = (menu) => {
      clearTimeout(timer);
      ipcMain.removeListener('scene:menu', onMenu);
      resolve(menu);
    };
    const onMenu = (event, raw) => {
      if (event.sender !== win.webContents) return;
      lastSceneMenu = sanitizeSceneMenu(raw) ?? lastSceneMenu;
      allowedIds = new Set(
        (lastSceneMenu?.items ?? []).flatMap((item) => (item.id ? [item.id] : [])),
      );
      done(lastSceneMenu);
    };
    const timer = setTimeout(() => done(lastSceneMenu), 300);
    ipcMain.on('scene:menu', onMenu);
    win.webContents.send('scene:menu-request');
  });
}

// Desktop mode takes no clicks, so the main process reads the pointer about 10 times a second and sends it to the
// renderer (FR-49, tech design 3.8). It only runs while the tank is drawn in desktop mode (NFR-1).
let pointerTimer = null;
let lastPointer;
function syncPointerPolling() {
  const wanted = controller && controller.getMode() === 'desktop' && !controller.isPaused();
  if (!wanted) {
    clearInterval(pointerTimer);
    pointerTimer = null;
    lastPointer = undefined;
    return;
  }
  lastPointer = undefined; // a new window knows nothing yet
  if (pointerTimer) return;
  pointerTimer = setInterval(() => {
    const win = controller?.getWindow();
    if (!win || win.isDestroyed()) return;
    const bounds = screen.getPrimaryDisplay().bounds;
    const cursor = screen.getCursorScreenPoint();
    const inside =
      cursor.x >= bounds.x &&
      cursor.x < bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y < bounds.y + bounds.height;
    const point = inside ? { x: cursor.x - bounds.x, y: cursor.y - bounds.y } : null;
    if (
      point?.x === lastPointer?.x &&
      point?.y === lastPointer?.y &&
      Boolean(point) === Boolean(lastPointer)
    ) {
      return;
    }
    lastPointer = point;
    win.webContents.send('pointer:pos', point);
  }, 100);
}

// Launch at login (FR-37): the real state comes from the operating system, never from a stored copy, and only an
// installed app registers itself (a development run would register `electron`). The `--login` argument tells the
// next start that it was opened at login, so it shows its window without taking focus.
const LOGIN_ARGS = ['--login'];
const canLaunchAtLogin = () => app.isPackaged;
function launchAtLogin() {
  if (!canLaunchAtLogin()) return false;
  try {
    return app.getLoginItemSettings({ args: LOGIN_ARGS }).openAtLogin;
  } catch {
    return false;
  }
}
function startedAtLogin() {
  if (process.argv.includes('--login') || process.argv.includes(RESTARTED_ARG)) return true;
  try {
    return app.getLoginItemSettings().wasOpenedAtLogin === true;
  } catch {
    return false;
  }
}

// A setting changed in a menu: save it, apply it, and tell the renderer (the sound flag lives there).
function setSetting(key, value) {
  if (key === 'launchAtLogin') {
    if (canLaunchAtLogin())
      app.setLoginItemSettings({ openAtLogin: Boolean(value), args: LOGIN_ARGS });
    return;
  }
  if (!settingsStore.set(key, value)) return;
  if (key === 'alwaysOnTop') controller?.applyAlwaysOnTop();
  controller?.getWindow()?.webContents.send('settings:changed', { sound: readSettings().sound });
  refreshAppMenu();
}

/** The graphics card(s), for example `NVIDIA (vendor 0x10de) device 0x2684 (active)`, or `unknown`. */
async function describeGpu() {
  try {
    const info = await app.getGPUInfo('basic');
    const devices = (info.gpuDevice ?? []).map(describeGpuDevice);
    return devices.length ? devices.join('; ') : 'unknown';
  } catch {
    return 'unknown';
  }
}

// "Copy diagnostics" (NFR-7): the text goes to the clipboard, and the menu item says "Copied" for a few seconds.
let copiedAt = 0;
async function copyDiagnostics() {
  let logLines = [];
  try {
    logLines = tailLines(fs.readFileSync(path.join(userData, 'desktop-spike.log'), 'utf8'), 80);
  } catch {
    // No log yet.
  }
  const display = screen.getPrimaryDisplay();
  const settings = readSettings();
  const sceneMenu = await requestSceneMenu();
  const bounds = controller?.getWindow()?.getBounds();
  const text = buildText(
    {
      appInfo: {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
      },
      mode: controller?.getMode(),
      display: {
        width: display.size.width,
        height: display.size.height,
        scale: display.scaleFactor,
      },
      displays: screen.getAllDisplays().map((d) => ({
        width: d.size.width,
        height: d.size.height,
        scale: d.scaleFactor,
        primary: d.id === display.id,
      })),
      gpu: await describeGpu(),
      windowSize: controller?.getMode() === 'window' && bounds ? bounds : null,
      sceneLine: sceneMenu?.diagnostics,
      tuningKeys: Object.keys(readTuning() ?? {}),
      settings,
      usage: usageLines(usage.get()),
      logLines,
    },
    who(),
  );
  clipboard.writeText(text);
  copiedAt = Date.now();
  // The macOS menu bar menu says "Copied" too, and goes back after 5 seconds (one timer, started by the click).
  refreshAppMenu();
  setTimeout(refreshAppMenu, 5100).unref();
}

// One About window at a time (a second request brings it forward). Its page is built by about.js.
let aboutWindow = null;

function showAbout() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }
  // For the player: what this is, the licenses, where the save is. How the menus work is in the first-launch hint.
  const paragraphs = [
    'Your desktop, alive, and quiet about it.',
    '2ndDesktop shows one living scene behind your icons or in a small window, and rests when the desktop is covered. No account, no telemetry.',
    'Open source (MIT license). The font is Nunito (SIL Open Font License). The art is original, drawn with an AI tool, and the sounds are made for this app.',
    `Your saved progress stays on this computer, in: ${displayPath(path.join(userData, 'records'), {
      platform: process.platform,
      home: os.homedir(),
      appData: app.getPath('appData'),
    })}`,
  ];
  const icon = nativeImage.createFromPath(appIconPath);
  const dark = nativeTheme.shouldUseDarkColors;
  const win = new BrowserWindow({
    width: 520,
    height: 360,
    useContentSize: true,
    show: false,
    title: `About ${PRODUCT_NAME}`,
    icon,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: dark ? '#1e1e1e' : '#ffffff',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  aboutWindow = win;
  win.on('closed', () => {
    aboutWindow = null;
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') win.close();
  });
  // The window is as high as the text: measured once the page is drawn, then shown.
  win.webContents.once('did-finish-load', async () => {
    try {
      const height = await win.webContents.executeJavaScript('document.body.scrollHeight');
      if (!win.isDestroyed()) win.setContentSize(520, Math.ceil(height));
    } catch {
      // Keep the default height.
    }
    if (!win.isDestroyed()) win.show();
  });
  const html = aboutHtml({
    name: PRODUCT_NAME,
    version: app.getVersion(),
    iconUrl: icon.resize({ width: 128 }).toDataURL(),
    paragraphs,
    dark,
  });
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

const menuSettings = () => ({
  mode: controller?.getMode(),
  alwaysOnTop: readSettings().alwaysOnTop,
  sound: readSettings().sound,
  launchAtLogin: launchAtLogin(),
  canLaunchAtLogin: canLaunchAtLogin(),
  copied: Date.now() - copiedAt < 5000,
});
const menuHandlers = () => ({
  setMode: (mode) => controller.setMode(mode),
  setSetting,
  copyDiagnostics,
  about: showAbout,
});

async function buildMenuTemplate() {
  return buildTrayTemplate(await requestSceneMenu(), menuSettings(), fallbackNote, {
    ...menuHandlers(),
    action: (id) => {
      if (!allowedIds.has(id)) return;
      usage.activity(); // a tray menu action counts as player activity (NFR-7)
      controller.getWindow()?.webContents.send('scene:action', id);
    },
    quit: () => app.quit(),
  });
}

// The application menu (the macOS menu bar). Windows has none, and Electron's default menu is not used anywhere: it
// carries Reload and Developer Tools. The macOS menu is built again when something it shows changes (a setting, the
// mode, the window gaining focus, which also catches Launch at login being changed in System Settings).
function refreshAppMenu() {
  if (process.platform !== 'darwin' || !app.isReady()) return;
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildAppMenuTemplate(menuSettings(), menuHandlers(), { dev: isDev, sceneName }),
    ),
  );
}

app.whenReady().then(async () => {
  if (!gotLock) return;
  // No permissions and no request outside the app's own files (the dev server in a development run), for every window.
  installSessionPolicy({
    session: session.defaultSession,
    app,
    allow: createRequestFilter({
      rendererDir: path.join(root, 'dist', 'renderer'),
      devUrl,
      caseInsensitive: process.platform === 'win32',
    }),
    log: (message) => log(message),
  });
  controller = createDesktopController({
    preloadPath: path.join(import.meta.dirname, 'preload.cjs'),
    iconPath: appIconPath,
    loadRenderer,
    log,
    onModeChanged: (mode, reason) => {
      fallbackNote = reason ? FALLBACK_NOTE : null;
      log(`mode is now ${mode}${reason ? ` (${reason})` : ''}`);
      // The mode is remembered for the next launch (FR-60); a forced mode (development, tests) is not.
      if (rememberMode) settingsStore.setChoices(settingsForMode(mode, reason));
      crashRestart.set(mode === 'desktop');
      syncPointerPolling();
      refreshAppMenu();
    },
    onPausedChanged: () => syncPointerPolling(),
    getAlwaysOnTop: () => readSettings().alwaysOnTop,
    startedAtLogin: startedAtLogin(),
    // The safe start (FR-64): 'trying' goes to disk before the tank is attached to the desktop, 'ok' once it was stable.
    onAttachResult: (result) => usage.desktopResult(result),
    onDesktopAttempt: (state) => {
      if (rememberMode) settingsStore.setChoices({ desktopAttempt: state });
      log(`desktop attempt: ${state}`);
    },
    getWindowBounds: () => settingsStore.get().window ?? null,
    saveWindowBounds: (bounds) => settingsStore.setWindow(bounds),
  });

  // Lock, sleep and suspend pause the tank (FR-22, NFR-1); it catches up when it resumes.
  for (const [event, on] of [
    ['lock-screen', true],
    ['unlock-screen', false],
    ['suspend', true],
    ['resume', false],
  ]) {
    powerMonitor.on(event, () => controller.setPauseReason('power', on));
  }

  createTray({ trayDir: path.join(root, 'assets', 'tray'), buildMenuTemplate });

  // No default menu anywhere (it has Reload and Developer Tools). Windows has no menu bar; macOS gets its own.
  if (process.platform === 'darwin') {
    // A development run is the bare Electron app, so the Dock would show Electron's icon. The 1024 px image is
    // scaled to 256 px first: set at full size it kept about 35 MB in the main process (M1, 2026-11-22), which
    // made every development-run measurement look 35 MB worse than the packaged app.
    if (!app.isPackaged) {
      const dockIcon = nativeImage
        .createFromPath(path.join(root, 'build', 'icon-mac.png'))
        .resize({ width: 256, quality: 'best' });
      if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
    }
    app.on('browser-window-focus', refreshAppMenu);
    refreshAppMenu();
  } else {
    Menu.setApplicationMenu(null);
  }

  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    mode: controller.getMode(),
    activeScene: readSettings().activeScene,
    tuning: readTuning(),
    // Test runs only (DESKTOP2_TEST=1): a fixed random seed, and time that moves only when a test steps the scene.
    test:
      process.env.DESKTOP2_TEST === '1'
        ? {
            seed: process.env.DESKTOP2_SEED ? Number(process.env.DESKTOP2_SEED) >>> 0 : null,
            manualTime: process.env.DESKTOP2_MANUAL_TIME === '1',
          }
        : null,
  }));
  // The saved progress of a scene (D8, D33): the renderer sends the whole record on every change, main writes it
  // after one second of quiet, and `before-quit` writes whatever is still waiting.
  ipcMain.handle('settings:get', () => ({ sound: readSettings().sound }));
  // The scene id comes from the host part of the page, once, before any scene code runs (app/main/scene-binding.js);
  // the id in a record call is never taken from the page, so a scene reaches only its own record.
  const sceneOf = createSceneBinding(records.isValidId);
  ipcMain.on('scene:bind', (event, id) => {
    if (!sceneOf.bind(event.sender, id)) log(`scene:bind refused (${String(id).slice(0, 40)})`);
  });
  ipcMain.handle('record:load', (event) => {
    const id = sceneOf.get(event.sender);
    return id ? records.load(id) : { status: 'missing' };
  });
  ipcMain.on('record:save', (event, record) => {
    const id = sceneOf.get(event.sender);
    if (!id || !records.queue(id, record)) log(`record:save refused (${id ?? 'no scene'})`);
  });
  // A record the renderer had to repair or replace: main keeps the original next to it and says if it could not.
  ipcMain.on('record:keep-copy', (event, record) => {
    const id = sceneOf.get(event.sender);
    const result = id ? records.keepCopy(id, record) : { ok: false, reason: 'no_scene' };
    if (!result.ok) {
      log(`record:keep-copy of ${id ?? 'no scene'} failed (${result.code ?? result.reason})`);
    }
  });
  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.on('menu:open', async (event) => {
    const template = await buildMenuTemplate();
    Menu.buildFromTemplate(template).popup({
      window: BrowserWindow.fromWebContents(event.sender) ?? undefined,
    });
  });
  let startupLogged = false;
  ipcMain.on('scene:ready', (event, info) => {
    if (event.sender !== controller.getWindow()?.webContents) return;
    if (typeof info?.name === 'string' && info.name !== sceneName) {
      sceneName = info.name.slice(0, 40);
      refreshAppMenu(); // the Tank menu of the macOS menu bar is named after the scene
    }
    controller.rendererReady();
    // The time from the start of the process to a running tank (NFR-5), once per start.
    if (!startupLogged) {
      startupLogged = true;
      usage.startup(process.uptime() * 1000);
    }
  });
  ipcMain.on('diag:activity', (event) => {
    if (event.sender === controller.getWindow()?.webContents) usage.activity();
  });
  ipcMain.on('diag:visibility', (_event, state) => log(`renderer visibility: ${state}`));
  ipcMain.on('diag:fps', (_event, fps) => {
    log(`renderer frame rate: ${fps} fps`);
    usage.frameRate(fps);
  });
  // Lines from the page are limited to 20 a second each (docs/platform/02 section 4); a count of the lines left out follows.
  const limited = (handler) => {
    const limit = createLineLimiter();
    return (...args) => {
      if (!limit.allow()) return;
      const dropped = limit.takeDropped();
      if (dropped > 0) log(`renderer: ${dropped} lines left out (more than 20 a second)`);
      handler(...args);
    };
  };
  ipcMain.on(
    'diag:error',
    limited((_event, text) => {
      log(`renderer error: ${text}`);
      usage.error(`renderer: ${text}`);
    }),
  );
  ipcMain.on(
    'diag:note',
    limited((_event, text) => log(`renderer: ${String(text).slice(0, 2000)}`)),
  );

  if (process.env.DESKTOP2_ATTACH_LAB === '1') {
    const names = process.env.DESKTOP2_LAB_VARIANTS?.split(',').filter(Boolean);
    await controller.runLab(
      names?.length ? names : undefined,
      Number(process.env.DESKTOP2_LAB_SECONDS) || 15,
      process.env.DESKTOP2_CHROMIUM_FLAGS || (process.env.DESKTOP2_NO_GPU === '1' ? 'no gpu' : ''),
    );
    app.quit();
    return;
  }
  if (process.env.DESKTOP2_SAMPLE === '1') startSampler(log, 10_000);
  // Measurement runs only: minimize the window after N seconds and restore it after N + 30 (DESKTOP2_TEST=1).
  const minimizeAt = Number(process.env.DESKTOP2_TEST_MINIMIZE_AT);
  if (process.env.DESKTOP2_TEST === '1' && minimizeAt > 0) {
    setTimeout(() => controller.getWindow()?.minimize(), minimizeAt * 1000);
    setTimeout(() => controller.getWindow()?.restore(), (minimizeAt + 30) * 1000);
  }
  usage.open();
  // Tests can ask for a short interval (DESKTOP2_TEST=1 only); a normal run samples once a minute.
  usage.start(
    process.env.DESKTOP2_TEST === '1'
      ? Number(process.env.DESKTOP2_DIAG_MS) || undefined
      : undefined,
  );
  const start = chooseStartMode(readSettings(), process.env.DESKTOP2_MODE);
  rememberMode = start.remember;
  if (start.reason) log(`starting in a window: ${start.reason}`);
  await controller.start(start.mode, start.reason ?? undefined);
});

app.on('second-instance', () => {
  const win = controller?.getWindow();
  if (win && controller.getMode() === 'window') {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// Window mode: closing the window quits (D6). Desktop mode: the tray is the only control, so never quit here.
app.on('window-all-closed', () => {
  if (!controller || controller.quitWhenAllClosed()) app.quit();
});

app.on('before-quit', () => {
  log('quitting');
  usage.stop();
  usage.flush();
  // A normal quit during the first 10 seconds on the desktop is not a failed attempt (FR-64).
  const onQuit = rememberMode ? settingsOnQuit(settingsStore.get()) : null;
  if (onQuit) settingsStore.setChoices(onQuit);
  if (!flushRecordsOnQuit()) log('quitting with an unsaved record');
  controller?.dispose();
});

/**
 * Writes the waiting records before the app ends. A file held for a moment by an antivirus or the indexer is
 * usually free again after a short pause, so a failed write is tried again after 150 ms, up to three times in all.
 * Returns false when something is still unsaved.
 */
function flushRecordsOnQuit() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (records.flushAll()) return true;
    if (attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
  }
  return false;
}
