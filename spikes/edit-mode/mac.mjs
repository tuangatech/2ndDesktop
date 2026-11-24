// THROWAWAY Edit mode spike for macOS (platform plan Step 3, docs/edit-mode-spike.md, TODO-Mac W-17). Not part of the
// app: nothing imports it. Run from the repository root: npx electron spikes/edit-mode/mac.mjs   (quit a running tank
// first; unset ELECTRON_RUN_AS_NODE). The log goes to the temp folder as edit-mode-spike-mac.log.
//
// It makes the attached tank window as the app does on the Mac (type 'desktop', mouse events ignored, no Dock icon),
// then tries the two ways of entering an edit mode:
//   S: a new frameless window over the work area, always on top; the attached tank stays
//   R: the attached window is destroyed, the overlay shown, on Done the attached window is made again
// It never captures the screen. It reads: the Dock/activation state, which app is in front (only "this app", "same as
// before" or "another app", never a name), whether the overlay is the key window, the window list (CoreGraphics:
// layer, bounds, owner is this app or not), and whether a posted mouse click and Esc key reach the overlay.
// Posting events is done only while this app is the front app, and the click goes to a point that the window list says
// belongs to the overlay, so no click can land on another app.
import { app, BrowserWindow, screen } from 'electron';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(`${repo}/package.json`);
const koffi = require('koffi');
const outFile = path.join(os.tmpdir(), 'edit-mode-spike-mac.log');
fs.writeFileSync(outFile, '');
const t0 = Date.now();
const log = (message) => {
  const line = `${String(Date.now() - t0).padStart(6)} ms  ${message}`;
  console.log(line);
  fs.appendFileSync(outFile, line + '\n');
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const useScene = process.env.SPIKE_SCENE !== '0'; // load the real renderer from dist/ (no preload) as the overlay page

// ---- CoreGraphics: window list and posted events ---------------------------------------------------------------
const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
koffi.struct('CGPoint', { x: 'double', y: 'double' });
const CGEventCreateMouseEvent = cg.func(
  'void *CGEventCreateMouseEvent(void *source, uint32_t type, CGPoint position, uint32_t button)',
);
const CGEventCreateKeyboardEvent = cg.func(
  'void *CGEventCreateKeyboardEvent(void *source, uint16_t key, bool down)',
);
const CGEventPost = cg.func('void CGEventPost(uint32_t tap, void *event)');
const CFRelease = koffi
  .load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
  .func('void CFRelease(void *ref)');
const post = (event) => {
  CGEventPost(0, event); // kCGHIDEventTap
  CFRelease(event);
};
const mouse = (type, x, y) => post(CGEventCreateMouseEvent(null, type, { x, y }, 0));
const clickAt = (x, y) => {
  mouse(1, x, y); // left down
  mouse(2, x, y); // left up
};
const pressEscape = () => {
  post(CGEventCreateKeyboardEvent(null, 53, true));
  post(CGEventCreateKeyboardEvent(null, 53, false));
};

const ax = koffi.load(
  '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices',
);
const axTrusted = ax.func('bool AXIsProcessTrusted()');

const mac = await import(`${repo}/app/main/desktop-mac.js`);
const windowsHere = () =>
  mac.listWindows().map((w) => ({ ...w, ours: w.pid === process.pid, layer: w.layer }));

// ---- which app is in front (names are never logged) ------------------------------------------------------------
const lsappinfo = (...args) => {
  try {
    return execFileSync('/usr/bin/lsappinfo', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};
const frontPid = () =>
  Number(/pid = (\d+)/.exec(lsappinfo('info', '-only', 'pid', lsappinfo('front')))?.[1] ?? 0);
const appType = () => {
  const asn = lsappinfo('find', `pid=${process.pid}`);
  return (
    /type="([^"]+)"/.exec(lsappinfo('info', '-only', 'applicationtype', asn))?.[1] ?? 'unknown'
  );
};
let before = 0;
const who = () => {
  const f = frontPid();
  if (!f) return 'unknown';
  if (f === process.pid) return 'this app';
  return before && f === before ? 'the app that was in front before' : 'another app';
};
/** macOS ignores a hide that comes early in a launch: retry as app/main/desktop.js hideDock does. */
async function hideDock() {
  const started = Date.now();
  let tries = 0;
  for (; tries < 10 && app.dock.isVisible(); tries++) {
    app.dock.hide();
    await sleep(500);
  }
  log(
    `  dock hidden after ${Date.now() - started} ms (${tries} tries), visible now ${app.dock.isVisible()}`,
  );
}

const page = (color, text) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:${color};color:#fff;font:600 48px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;user-select:none">
<div style="text-align:center">${text}<div style="font-size:20px;margin-top:12px" id="n"></div></div>
<script>
let n = 0;
document.addEventListener('mousedown', () => { n++; document.getElementById('n').textContent = n + ' clicks'; console.log('SPIKE click'); });
document.addEventListener('keydown', (e) => console.log('SPIKE key ' + e.key));
requestAnimationFrame(() => requestAnimationFrame(() => console.log('SPIKE frame')));
</script>`);

async function run() {
  log(`app ready; Electron ${process.versions.electron}; dock visible ${app.dock?.isVisible()}`);
  app.on('window-all-closed', () => {});
  const primary = screen.getPrimaryDisplay();
  const bounds = primary.bounds;
  const wa = primary.workArea;
  log(
    `display ${bounds.width}x${bounds.height}, work area ${wa.x},${wa.y} ${wa.width}x${wa.height}`,
  );

  /** The attached tank as the app makes it on the Mac (app/main/desktop.js, startDesktopMode). */
  async function makeAttached() {
    const started = Date.now();
    const win = new BrowserWindow({
      ...bounds,
      frame: false,
      resizable: false,
      focusable: false,
      hasShadow: false,
      show: false,
      skipTaskbar: true,
      type: 'desktop',
      backgroundColor: '#14507c',
    });
    await win.loadURL(page('#14507c', 'TANK (attached at the desktop level)'));
    win.setVisibleOnAllWorkspaces(true);
    win.setIgnoreMouseEvents(true);
    win.setBounds(bounds);
    win.showInactive();
    log(`attached tank shown in ${Date.now() - started} ms`);
    return win;
  }

  /** The overlay: a normal frameless window over the work area, always on top. */
  async function makeOverlay(label) {
    const started = Date.now();
    const win = new BrowserWindow({
      x: wa.x,
      y: wa.y,
      width: wa.width,
      height: wa.height,
      frame: false,
      resizable: false,
      hasShadow: false,
      show: false,
      alwaysOnTop: true,
      backgroundColor: '#14507c',
      webPreferences: { sandbox: true },
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    let clicks = 0;
    let keys = 0;
    let firstFrame = null;
    win.webContents.on('console-message', (event) => {
      const m = event.message ?? '';
      if (m.startsWith('SPIKE click')) clicks++;
      if (m.startsWith('SPIKE key')) keys++;
      if (m.startsWith('SPIKE frame') && !firstFrame) firstFrame = Date.now() - started;
    });
    const created = Date.now();
    await win.loadURL(page('#14507c', `EDIT MODE (${label}) - Esc or Done`));
    const loaded = Date.now();
    win.show();
    if (process.env.SPIKE_STEAL !== '0') app.focus({ steal: true });
    win.focus();
    const shown = Date.now();
    log(
      `overlay ${label}: created->loaded ${loaded - created} ms, loaded->shown ${shown - loaded} ms, total ${shown - started} ms`,
    );
    return { win, counters: () => ({ clicks, keys }), firstFrame: () => firstFrame };
  }

  /** The real scene as an overlay page: the time to a first drawn frame of the whole renderer. */
  async function timeScene(label) {
    const index = path.join(repo, 'dist', 'renderer', 'index.html');
    if (!useScene || !fs.existsSync(index)) {
      log(`scene timing skipped (${useScene ? 'no dist/renderer' : 'SPIKE_SCENE=0'})`);
      return null;
    }
    const started = Date.now();
    const win = new BrowserWindow({
      x: wa.x,
      y: wa.y,
      width: wa.width,
      height: wa.height,
      frame: false,
      show: false,
      alwaysOnTop: true,
      backgroundColor: '#14507c',
      webPreferences: { sandbox: true },
    });
    await win.loadFile(index, { query: { mode: 'window' } });
    const loaded = Date.now() - started;
    win.show();
    for (let i = 0; i < 100; i++) {
      if (await win.webContents.executeJavaScript('window.__ready === true')) break;
      await sleep(50);
    }
    const ready = Date.now() - started;
    log(`real scene as overlay (${label}): page loaded ${loaded} ms, scene ready ${ready} ms`);
    win.destroy();
    return { loaded, ready };
  }

  async function exercise(overlay) {
    await sleep(500);
    log(
      `  after 500 ms: front = ${who()}, overlay isFocused ${overlay.win.isFocused()}, app type ${appType()}, dock visible ${app.dock.isVisible()}`,
    );
    const pageFocus = await overlay.win.webContents.executeJavaScript('document.hasFocus()');
    log(
      `  page document.hasFocus() = ${pageFocus} (the page gets key events when this is true); Accessibility trusted for posting events: ${axTrusted()}`,
    );
    const mine = windowsHere().filter((w) => w.ours);
    log(
      `  our windows in the window list: ${JSON.stringify(mine.map((w) => ({ layer: w.layer, b: w.bounds })))}`,
    );
    if (who() !== 'this app') {
      log('  this app is not the front app: no posted click or key (they would go to another app)');
      return { clicks: 'not tried', keys: 'not tried' };
    }
    // The list is front to back: find a point where the first window is ours (something else may sit above part of it).
    if (!axTrusted()) {
      log(
        '  posting mouse and key events needs the Accessibility permission, which this run does not have: no posted click or key',
      );
      return { clicks: 'not tried', keys: 'not tried', pageFocus };
    }
    const list = windowsHere();
    const inside = (w, px, py) =>
      w.bounds &&
      px >= w.bounds.x &&
      px < w.bounds.x + w.bounds.width &&
      py >= w.bounds.y &&
      py < w.bounds.y + w.bounds.height;
    let point = null;
    for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      for (const fy of [0.5, 0.3, 0.7]) {
        const px = Math.round(wa.x + wa.width * fx);
        const py = Math.round(wa.y + wa.height * fy);
        // The Dock keeps an invisible full-screen window at layer 20 that passes clicks through; it is not counted.
        const top = list.find((w) => w.layer < 20 && inside(w, px, py));
        if (!point && top?.ours) point = [px, py];
      }
    }
    const above = list.filter(
      (w) => !w.ours && w.layer > 3 && w.bounds && w.bounds.width > 200 && w.bounds.height > 200,
    );
    log(
      `  other windows above our layer and larger than 200 px: ${JSON.stringify(above.map((w) => ({ layer: w.layer, w: w.bounds.width, h: w.bounds.height })))}`,
    );
    if (!point) {
      log('  no point where our overlay is the top window: no posted click');
      return { clicks: 'not tried', keys: 'not tried' };
    }
    const [x, y] = point;
    for (let i = 0; i < 3; i++) {
      clickAt(x + i * 10, y);
      await sleep(120);
    }
    pressEscape();
    await sleep(300);
    const c = overlay.counters();
    log(`  posted 3 clicks and Esc: overlay received ${c.clicks} clicks and ${c.keys} key events`);
    return { clicks: c.clicks, keys: c.keys };
  }

  const summary = { S: {}, R: {} };
  before = frontPid();
  summary.typeBefore = appType();
  log(`front app before: ${before ? 'known' : 'unknown'}; our app type ${summary.typeBefore}`);
  let tank = await makeAttached();
  await hideDock();
  summary.typeAttached = appType();
  log(
    `after the attached tank: app type ${summary.typeAttached}, dock visible ${app.dock.isVisible()}, front = ${who()}`,
  );

  log('--- S: overlay on top, attached tank stays');
  let t = Date.now();
  let overlay = await makeOverlay('S');
  summary.S.enterMs = Date.now() - t;
  Object.assign(summary.S, await exercise(overlay));
  summary.S.firstFrameMs = overlay.firstFrame();
  await sleep(1500);
  t = Date.now();
  overlay.win.close();
  await sleep(600);
  summary.S.frontAfter = who();
  log(
    `  Done S: front after = ${summary.S.frontAfter}, type ${appType()}, dock visible ${app.dock.isVisible()}, close ${Date.now() - t} ms`,
  );
  if (summary.S.frontAfter === 'this app') {
    app.hide();
    await sleep(600);
    summary.S.frontAfterAppHide = who();
    log(`  after app.hide(): front = ${summary.S.frontAfterAppHide}`);
  }
  summary.S.scene = await timeScene('S');
  await sleep(2000);

  log('--- R: attached window destroyed, overlay shown, on Done the attached window is made again');
  t = Date.now();
  tank.destroy();
  overlay = await makeOverlay('R');
  summary.R.enterMs = Date.now() - t;
  Object.assign(summary.R, await exercise(overlay));
  summary.R.firstFrameMs = overlay.firstFrame();
  await sleep(1500);
  t = Date.now();
  overlay.win.close();
  tank = await makeAttached();
  summary.R.doneMs = Date.now() - t;
  await sleep(600);
  const dockAfterR = app.dock.isVisible();
  log(`  dock visible right after the re-created window: ${dockAfterR}`);
  await hideDock();
  summary.R.frontAfter = who();
  log(
    `  Done R: back to attached in ${summary.R.doneMs} ms, front after = ${summary.R.frontAfter}, dock visible ${app.dock.isVisible()}`,
  );
  await sleep(1500);

  log('SUMMARY ' + JSON.stringify(summary));
  tank.destroy();
  app.quit();
}
app
  .whenReady()
  .then(run)
  .catch((error) => {
    log('ERROR ' + (error?.stack ?? error));
    app.exit(1);
  });
