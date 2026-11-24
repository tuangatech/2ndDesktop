// THROWAWAY Edit mode spike for Windows (platform plan Step 3, docs/edit-mode-spike.md). Not part of the app: nothing
// imports it, and it is kept only so that the Mac session can adapt it and the measurement can be repeated.
// Run: npx electron spikes/edit-mode/win.mjs   (from the repository root; quit a running tank first; unset
// ELECTRON_RUN_AS_NODE). The log is written to the temp folder as edit-mode-spike.log.
// A tiny Electron app that attaches a "tank" window behind the desktop icons exactly like the app does (it uses the
// repository's app/main/desktop-win.js), then tries two ways of entering a mode in which the scene takes clicks:
//   S: a separate full work-area window on top (the attached tank stays where it is)
//   R: the attached window is destroyed, the overlay shown, and on Done the attached window is made again
// It measures time, focus and click delivery, and prints what a person must look at on the screen.
import { app, BrowserWindow, screen } from 'electron';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const outFile = path.join(os.tmpdir(), 'edit-mode-spike.log');
fs.writeFileSync(outFile, '');
const t0 = Date.now();
const log = (message) => {
  const line = `${String(Date.now() - t0).padStart(6)} ms  ${message}`;
  console.log(line);
  fs.appendFileSync(outFile, line + '\n');
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

log('script started');
const win32 = await import(pathToFileURL(`${repo}/app/main/desktop-win.js`).href);
log('desktop-win.js imported');
const koffi = createRequire(`${repo}/package.json`)('koffi');
log('koffi loaded');
const user32 = koffi.load('user32.dll');
const SetCursorPos = user32.func('int __stdcall SetCursorPos(int x, int y)');
const mouse_event = user32.func(
  'void __stdcall mouse_event(uint32_t flags, uint32_t dx, uint32_t dy, uint32_t data, uintptr_t extra)',
);
const keybd_event = user32.func(
  'void __stdcall keybd_event(uint8_t vk, uint8_t scan, uint32_t flags, uintptr_t extra)',
);
const click = (x, y) => {
  SetCursorPos(x, y);
  mouse_event(0x0002, 0, 0, 0, 0); // left down
  mouse_event(0x0004, 0, 0, 0, 0); // left up
};
const pressEscape = () => {
  keybd_event(0x1b, 0, 0, 0);
  keybd_event(0x1b, 0, 0x0002, 0);
};

const page = (title, color, text) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:${color};color:#fff;font:600 48px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;user-select:none">
<div style="text-align:center">${text}<div style="font-size:20px;margin-top:12px" id="n"></div></div>
<script>
let n = 0;
document.addEventListener('mousedown', (e) => { n++; document.getElementById('n').textContent = n + ' clicks'; console.log('SPIKE click ' + e.screenX + ',' + e.screenY); });
document.addEventListener('keydown', (e) => console.log('SPIKE key ' + e.key));
</script>`);

const foreground = () => {
  const f = win32.describeForeground();
  if (!f) return 'none';
  return `${f.className} pid ${f.pid}${f.pid === process.pid ? ' (this app)' : ''}`;
};

log('waiting for ready');
// Electron emits 'ready' only after an ES module entry has finished loading, so the work runs in a callback.
async function run() {
  log('app ready');
  app.on('window-all-closed', () => {});

  const primary = screen.getPrimaryDisplay();
  const physical = () => screen.dipToScreenRect(null, primary.bounds);

  /** The tank window as the app makes it in desktop mode ('opaque+show'): small in a corner first, then attached. */
  async function makeAttachedTank() {
    const b = primary.bounds;
    const started = Date.now();
    const win = new BrowserWindow({
      x: b.x + b.width - 264,
      y: b.y + b.height - 174,
      width: 240,
      height: 150,
      frame: false,
      resizable: false,
      focusable: false,
      hasShadow: false,
      show: false,
      skipTaskbar: true,
      backgroundColor: '#14507c',
    });
    await win.loadURL(page('tank', '#14507c', 'TANK (attached behind the icons)'));
    win.showInactive();
    await sleep(200);
    const result = win32.attachToDesktop(win.getNativeWindowHandle(), physical(), {
      showFirst: true,
    });
    log(
      `tank attach: ${JSON.stringify({ ok: result.ok, layout: result.layout, ms: result.ms })}, total ${Date.now() - started} ms`,
    );
    return { win, attachment: result };
  }

  /** The overlay: a normal top-level window over the work area, frameless, no taskbar button, takes focus. */
  async function makeOverlay() {
    const wa = primary.workArea;
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
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#14507c',
    });
    let clicks = 0;
    let keys = 0;
    win.webContents.on('console-message', (event) => {
      const m = event.message ?? '';
      if (m.startsWith('SPIKE click')) clicks++;
      if (m.startsWith('SPIKE key')) keys++;
    });
    const created = Date.now();
    await win.loadURL(page('overlay', '#14507c', 'EDIT MODE (overlay) - Esc or Done'));
    const loaded = Date.now();
    win.show();
    win.focus();
    const shown = Date.now();
    log(
      `overlay: created->loaded ${loaded - created} ms, loaded->shown ${shown - loaded} ms, total ${shown - started} ms`,
    );
    return { win, counters: () => ({ clicks, keys }) };
  }

  async function exercise(overlay) {
    await sleep(400);
    log(
      `  after 400 ms: foreground = ${foreground()}, isFocused ${overlay.win.isFocused()}, visible ${overlay.win.isVisible()}`,
    );
    const wa = primary.workArea;
    const scale = screen.getPrimaryDisplay().scaleFactor;
    const points = [
      [wa.x + wa.width * 0.5, wa.y + wa.height * 0.5],
      [wa.x + wa.width * 0.1, wa.y + wa.height * 0.15], // where a desktop icon usually is
      [wa.x + wa.width * 0.9, wa.y + wa.height * 0.8],
    ].map(([x, y]) => [Math.round(x * scale), Math.round(y * scale)]);
    const f = win32.describeForeground();
    if (!f || f.pid !== process.pid) {
      log('  foreground is not this app: no simulated clicks (they could hit something else)');
      return { clicksDelivered: 'not tried', keyDelivered: 'not tried' };
    }
    for (const [x, y] of points) {
      click(x, y);
      await sleep(120);
    }
    pressEscape();
    await sleep(200);
    const c = overlay.counters();
    log(
      `  simulated 3 clicks and Esc: overlay received ${c.clicks} clicks and ${c.keys} key events`,
    );
    return { clicksDelivered: c.clicks, keyDelivered: c.keys };
  }

  const summary = { S: {}, R: {} };

  log(
    'SPIKE START. For the next 10 seconds click into any other app (for example Notepad) so that it has the focus.',
  );
  let tank = await makeAttachedTank();
  for (let i = 10; i > 0; i--) {
    await tank.win.webContents.executeJavaScript(
      `document.getElementById('n').textContent = 'Click into another app now: ${i}'`,
    );
    await sleep(1000);
  }
  await tank.win.webContents.executeJavaScript(`document.getElementById('n').textContent = ''`);
  summary.foregroundBefore = foreground();
  log(`foreground before the edit mode: ${summary.foregroundBefore}`);

  // Variant S: overlay on top, the attached tank stays.
  log(
    '--- S: overlay on top, tank stays attached. WATCH: flash, taskbar button, taskbar covered?, icons.',
  );
  let t = Date.now();
  let overlay = await makeOverlay();
  summary.S.enterMs = Date.now() - t;
  Object.assign(summary.S, await exercise(overlay));
  log('  overlay stays 3 more seconds (look at it)');
  await sleep(3000);
  t = Date.now();
  overlay.win.close();
  await sleep(500);
  summary.S.foregroundAfter = foreground();
  summary.S.stillAttached = win32.isStillAttached(tank.attachment);
  log(
    `  Done: foreground after = ${summary.S.foregroundAfter}, tank still attached = ${summary.S.stillAttached}, close ${Date.now() - t} ms`,
  );
  await sleep(3000);

  // Variant R: the attached window is destroyed for the edit, made again on Done.
  log(
    '--- R: attached window destroyed, overlay shown, on Done the attached window is made again. WATCH: flash, corner flash on the way back.',
  );
  t = Date.now();
  tank.win.destroy();
  overlay = await makeOverlay();
  summary.R.enterMs = Date.now() - t;
  Object.assign(summary.R, await exercise(overlay));
  log('  overlay stays 3 more seconds (look at it)');
  await sleep(3000);
  t = Date.now();
  overlay.win.close();
  tank = await makeAttachedTank();
  summary.R.doneMs = Date.now() - t;
  await sleep(500);
  summary.R.foregroundAfter = foreground();
  summary.R.stillAttached = win32.isStillAttached(tank.attachment);
  log(
    `  Done: back to attached in ${summary.R.doneMs} ms, foreground after = ${summary.R.foregroundAfter}, attached = ${summary.R.stillAttached}`,
  );
  await sleep(3000);

  log('SUMMARY ' + JSON.stringify(summary));
  tank.win.destroy();
  app.quit();
}
app
  .whenReady()
  .then(run)
  .catch((error) => {
    log('ERROR ' + (error?.stack ?? error));
    app.exit(1);
  });
