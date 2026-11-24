// Display mode controller (tech design 3.8, FR-60, FR-64, decisions D27 and D29).
// Desktop mode: the tank fills the primary display, behind the icons and all windows.
// Window mode: a small frameless window.
// Switching re-creates the window, which is simpler and safer than re-parenting a live one.

import { BrowserWindow, app, screen } from 'electron';
import { coveredShare, decideCovered, MAC_COVER_SHARE, rectToEdges } from './cover.js';
import { WINDOW_RULES, fitWindowToDisplays, sizeLimitsFor } from './placement.js';

// How long the window must be still before its position and size are written to the settings.
const SAVE_BOUNDS_MS = 500;
// A desktop attach counts as good when it is still in place this long after the tank was attached and ready (FR-64).
const STABLE_MS = 10_000;
// Ways to attach a Chromium window to the Windows desktop. The attach test (docs/desktop-spike.md) tries
// them and the one that works becomes the default.
const VARIANTS = {
  base: { transparent: true },
  layered: { transparent: false, layered: true },
  'layered-transparent': { transparent: true, layered: true },
  opaque: { transparent: false },
  'in-workerw': { transparent: false, layered: true, parent: 'workerw' },
  // "+show": the window is shown as a normal top-level window first, so that Chromium starts drawing,
  // and is moved onto the desktop afterwards. (Showing a window through Win32 alone may leave Chromium's
  // compositor thinking the window is hidden.)
  'base+show': { transparent: true, showFirst: true },
  'layered+show': { transparent: false, layered: true, showFirst: true },
  'opaque+show': { transparent: false, showFirst: true },
  'in-workerw+show': { transparent: false, layered: true, parent: 'workerw', showFirst: true },
};
// The attach test showed that Chromium only draws in the attached window when it was shown as a normal
// window first ("+show"). Which of the +show variants is best is confirmed in docs/desktop-spike.md.
const DEFAULT_VARIANT = 'opaque+show';
const CHECK_MS = 2000;
// After an Explorer restart the desktop takes a few seconds to come back; the attach is tried again every
// RETRY_MS, and the app falls back to window mode after MAX_FAILURES failures within FAILURE_WINDOW_MS.
const RETRY_MS = 3000;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 60_000;

/**
 * @param {object} deps
 * @param {string} deps.preloadPath
 * @param {(win: BrowserWindow, mode: string, extra?: object) => Promise<void>} deps.loadRenderer
 * @param {(message: string) => void} deps.log
 * @param {(mode: string, reason?: string) => void} deps.onModeChanged
 * @param {(paused: boolean) => void} [deps.onPausedChanged]  called when the tank starts or stops being paused
 * @param {() => boolean} [deps.getAlwaysOnTop]  the "Always on top" setting (window mode only, FR-20)
 * @param {boolean} [deps.startedAtLogin]  the first window is shown without taking focus (NFR-6)
 * @param {(result: {ok: boolean, layout?: string, ms?: number, reason?: string}) => void} [deps.onAttachResult]  the outcome of each attach (diagnostics)
 * @param {(state: 'trying' | 'ok') => void} [deps.onDesktopAttempt]  the safe start (FR-64): 'trying' before an attach, 'ok' after it was stable
 * @param {() => ({x: number, y: number, width: number, height: number} | null)} [deps.getWindowBounds]  the remembered window rectangle (FR-19)
 * @param {(bounds: {x: number, y: number, width: number, height: number}) => void} [deps.saveWindowBounds]
 */
export function createDesktopController({
  preloadPath,
  iconPath,
  loadRenderer,
  log,
  onModeChanged,
  onPausedChanged,
  getAlwaysOnTop = () => false,
  startedAtLogin = false,
  getWindowBounds = () => null,
  saveWindowBounds = () => {},
  onDesktopAttempt = () => {},
  onAttachResult = () => {},
}) {
  let mode = null;
  let win = null;
  let attachment = null;
  let monitor = null;
  let displayTimer = null;
  let switching = false;
  // Set on quit, so a window that closes because the app is quitting is not re-created.
  let quitting = false;
  let quietStart = startedAtLogin;
  let covered = false;
  let lastForegroundKey = '';
  // Why the tank is paused (FR-22): 'cover' (a window covers the desktop), 'hidden' (window mode: minimized
  // or hidden), 'power' (screen locked, display asleep, suspended). The renderer is told only when
  // "paused or not" changes.
  const pauseReasons = new Set();
  function setPauseReason(reason, on) {
    const before = pauseReasons.size > 0;
    if (on) pauseReasons.add(reason);
    else pauseReasons.delete(reason);
    const after = pauseReasons.size > 0;
    if (before !== after) {
      win?.webContents.send('scene:pause', after);
      onPausedChanged?.(after);
    }
  }
  let failures = [];
  // Writes a window rectangle that is still waiting to be saved (before the window goes away without closing).
  let flushBounds = () => {};
  // Safe start (FR-64): the attach is trusted after the window is in place, the renderer has said it is ready, and
  // STABLE_MS have passed without the window being replaced.
  let attachedOk = false;
  let rendererIsReady = false;
  let stableTimer = null;
  function clearStable() {
    clearTimeout(stableTimer);
    stableTimer = null;
    attachedOk = false;
    rendererIsReady = false;
  }
  function armStable() {
    if (!attachedOk || !rendererIsReady || stableTimer || mode !== 'desktop') return;
    const current = win;
    stableTimer = setTimeout(() => {
      stableTimer = null;
      if (win === current && mode === 'desktop' && !quitting) onDesktopAttempt('ok');
    }, STABLE_MS);
  }
  let win32 = null; // electron/desktop-win.js, loaded only on Windows
  let mac = null; // electron/desktop-mac.js, loaded only on macOS
  let lastShareLogged = -1;

  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  function primaryRect() {
    const bounds = screen.getPrimaryDisplay().bounds;
    return isWindows ? screen.dipToScreenRect(null, bounds) : { ...bounds };
  }

  function baseWebPreferences() {
    // Sounds answer something the player did, also a tray action that came without a click in the window.
    return {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    };
  }

  function lockDown(target) {
    // Only a reload of the same page is allowed: the tank reloads itself after a lost graphics context.
    target.webContents.on('will-navigate', (event) => {
      if (event.url !== target.webContents.getURL()) event.preventDefault();
    });
    target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }

  // Window rules (FR-19, D22): 3:2, between 360 x 240 and 1200 x 800 and never larger than the display it is on.
  // Placement is decided once, at launch, by the pure fitWindowToDisplays (electron/placement.js).
  function windowOptions(testSize) {
    // Screenshots and tests can ask for any size (FISHTANK_TEST=1 only); the normal rules do not apply.
    if (testSize) {
      const [width, height] = testSize.split('x').map(Number);
      return {
        x: 20,
        y: 20,
        width,
        height,
        minWidth: 100,
        minHeight: 100,
        maxWidth: 10000,
        maxHeight: 10000,
      };
    }
    const placed = fitWindowToDisplays(
      getWindowBounds(),
      screen.getAllDisplays(),
      screen.getPrimaryDisplay(),
    );
    return { ...placed, ...sizeLimitsFor(screen.getDisplayMatching(placed).workArea) };
  }

  // Remembers the window rectangle (debounced) and keeps the size limits right for the display it is on.
  function trackWindowBounds(target) {
    let timer = null;
    const save = () => {
      clearTimeout(timer);
      timer = null;
      if (target.isDestroyed()) return;
      saveWindowBounds(target.getNormalBounds());
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_BOUNDS_MS);
    };
    const limits = () => {
      if (target.isDestroyed()) return;
      const { minWidth, minHeight, maxWidth, maxHeight } = sizeLimitsFor(
        screen.getDisplayMatching(target.getBounds()).workArea,
      );
      target.setMinimumSize(minWidth, minHeight);
      target.setMaximumSize(maxWidth, maxHeight);
    };
    target.on('resize', later);
    target.on('move', later);
    target.on('moved', limits);
    // Closing quits the app (FR-19), so the last position is written at once.
    target.on('close', save);
    target.on('closed', () => clearTimeout(timer));
    flushBounds = () => {
      if (timer) save();
    };
  }

  // On Windows at a fractional scale (125%, 150%) the system rounds a window rectangle outwards, so a window made
  // with the saved size came out a few pixels larger, and the saved size grew at every start. The request is
  // corrected until the window reports the size that was wanted (measured: 420 x 280 is asked for to get 421 x 281).
  function settleBounds(target) {
    if (!isWindows || !win) return;
    let request = { ...target };
    for (let attempt = 0; attempt < 4; attempt++) {
      win.setBounds(request);
      const got = win.getBounds();
      const dw = target.width - got.width;
      const dh = target.height - got.height;
      if (dw === 0 && dh === 0) return;
      request = { ...request, width: request.width + dw, height: request.height + dh };
    }
  }

  async function startWindowMode() {
    if (isMac) {
      clearTimeout(dockTimer);
      dockTimer = null;
      app.dock?.show();
    }
    const testSize = process.env.FISHTANK_TEST === '1' ? process.env.FISHTANK_WINDOW_SIZE : null;
    const options = windowOptions(testSize);
    win = new BrowserWindow({
      ...options,
      frame: false,
      resizable: true,
      show: false,
      ...(iconPath ? { icon: iconPath } : {}),
      backgroundColor: '#14507c',
      webPreferences: baseWebPreferences(),
    });
    lockDown(win);
    if (!testSize) {
      // The 3:2 lock is macOS only: on Windows, setAspectRatio counts the invisible frame of the window (about 8 px)
      // and the window lost a few pixels at every start. Without it the size round-trips exactly (tech design 3.7).
      if (isMac) win.setAspectRatio(WINDOW_RULES.ratio);
      settleBounds({ x: options.x, y: options.y, width: options.width, height: options.height });
      trackWindowBounds(win);
    }
    // Started at login: show the window without taking focus from what the player is doing (NFR-6).
    const quiet = quietStart;
    quietStart = false;
    win.once('ready-to-show', () => (quiet ? win?.showInactive() : win?.show()));
    applyAlwaysOnTop();
    for (const name of ['minimize', 'hide']) win.on(name, () => setPauseReason('hidden', true));
    for (const name of ['restore', 'show']) win.on(name, () => setPauseReason('hidden', false));
    const current = win;
    win.on('closed', () => {
      if (win === current) win = null;
    });
    await loadRenderer(win, 'window');
    if (pauseReasons.size > 0) win?.webContents.send('scene:pause', true);
  }

  async function startDesktopMode(variantName = DEFAULT_VARIANT, lab = false, tag = '') {
    const variant = VARIANTS[variantName] ?? VARIANTS[DEFAULT_VARIANT];
    clearStable();
    if (!lab) onDesktopAttempt('trying');
    const bounds = screen.getPrimaryDisplay().bounds;
    // A window that is shown first starts small, in a corner, so the player sees no full-screen flash.
    const small = isWindows && variant.showFirst;
    const options = {
      x: small ? bounds.x + bounds.width - 264 : bounds.x,
      y: small ? bounds.y + bounds.height - 174 : bounds.y,
      width: small ? 240 : bounds.width,
      height: small ? 150 : bounds.height,
      frame: false,
      resizable: false,
      focusable: false,
      hasShadow: false,
      show: false,
      skipTaskbar: true,
      // In the attach test the window is green, so "Chromium paints nothing" can be told from "only the page background".
      backgroundColor: lab ? '#00aa00' : '#14507c',
      webPreferences: baseWebPreferences(),
    };
    if (isWindows) options.transparent = variant.transparent;
    if (isMac) options.type = 'desktop';
    win = new BrowserWindow(options);
    lockDown(win);
    const current = win;
    win.on('closed', () => {
      if (win !== current) return;
      win = null;
      attachment = null;
      // On Windows the child window is destroyed when Explorer rebuilds the desktop (Win+D, restart).
      if (!quitting && !switching && mode === 'desktop') {
        log('desktop window was destroyed; creating it again in 1 second');
        setTimeout(() => {
          if (!quitting && !switching && mode === 'desktop' && !win)
            restartDesktop('window destroyed').catch((e) => log(`restart failed: ${e}`));
        }, 1000);
      }
    });
    await loadRenderer(win, 'desktop', lab ? { lab: '1', variant: variantName, tag } : {});

    if (!win) return;

    if (isWindows) {
      win32 ??= await import('./desktop-win.js');
      if (variant.showFirst) {
        win.showInactive();
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!win) return;
      }
      const result = win32.attachToDesktop(win.getNativeWindowHandle(), primaryRect(), variant);
      log(`variant ${variantName}: desktop tree: ${win32.describeDesktopTree()}`);
      if (!result.ok) {
        log(`attach failed (${variantName}): ${result.reason}`);
        if (!lab) onAttachResult({ ok: false, reason: result.reason });
        if (!lab && !recordFailure(result.reason)) {
          // Explorer may still be starting (after a restart there is no desktop yet): try again soon.
          log(`trying again in ${RETRY_MS / 1000} seconds`);
          const old = win;
          win = null;
          attachment = null;
          old?.destroy();
          setTimeout(() => {
            if (!quitting && !switching && mode === 'desktop' && !win)
              restartDesktop('retry').catch((e) => log(`retry failed: ${e}`));
          }, RETRY_MS);
        }
        return;
      }
      attachment = result;
      if (!lab) onAttachResult({ ok: true, layout: result.layout, ms: result.ms });
      log(
        `attached (${variantName}): layout=${result.layout} layered=${result.layered} in ${result.ms} ms (hwnd ${result.hwnd})`,
      );
    } else if (isMac) {
      // A failed load leaves only the Space check of Chromium (full-screen apps); the tank still works.
      mac ??= await import('./desktop-mac.js').catch((error) => {
        log(`cover check unavailable: ${error}`);
        return false;
      });
      if (!win) return;
      win.setVisibleOnAllWorkspaces(true);
      win.setIgnoreMouseEvents(true);
      win.setBounds(bounds);
      win.showInactive();
      hideDock();
      log(`macOS desktop window shown at ${JSON.stringify(bounds)}`);
    } else {
      win.showInactive();
    }
    if (!lab) {
      startMonitor();
      attachedOk = true;
      armStable();
    }
    if (isWindows && attachment) {
      const hwnd = attachment.hwnd;
      setTimeout(() => {
        if (win && mode === 'desktop')
          log(
            `window geometry: ${win32.describeWindow(hwnd)} content ${JSON.stringify(win.getContentBounds())} primary ${JSON.stringify(primaryRect())}`,
          );
      }, 2500);
    }
  }

  // macOS ignores a Dock hide early in a launch: on M1 (macOS 27.2) the first call at start had no effect, and one
  // a second later worked. So it is checked and repeated every half second, for up to 5 seconds, while the tank is
  // still on the desktop.
  let dockTimer = null;
  function hideDock(triesLeft = 10) {
    clearTimeout(dockTimer);
    dockTimer = null;
    if (!app.dock || mode !== 'desktop' || quitting) return;
    app.dock.hide();
    if (!app.dock.isVisible()) return;
    if (triesLeft <= 0) {
      log('the Dock icon could not be hidden');
      return;
    }
    dockTimer = setTimeout(() => hideDock(triesLeft - 1), 500);
  }

  /** Counts a failure. Returns true when there were too many and the app fell back to window mode. */
  function recordFailure(reason) {
    const now = Date.now();
    failures = failures.filter((t) => now - t < FAILURE_WINDOW_MS);
    failures.push(now);
    if (failures.length >= MAX_FAILURES) {
      fallbackToWindow(reason);
      return true;
    }
    return false;
  }

  function fallbackToWindow(reason) {
    log(`falling back to window mode: ${reason}`);
    stopMonitor();
    clearStable();
    const old = win;
    win = null;
    attachment = null;
    old?.destroy();
    mode = 'window';
    onModeChanged('window', reason);
    startWindowMode().catch((error) => log(`window mode failed: ${error}`));
  }

  async function restartDesktop(reason) {
    log(`re-creating desktop window (${reason})`);
    stopMonitor();
    const old = win;
    win = null;
    attachment = null;
    old?.destroy();
    await startDesktopMode();
  }

  function startMonitor() {
    stopMonitor();
    monitor = setInterval(() => {
      if (!win || mode !== 'desktop') return;
      if (isWindows && attachment) {
        if (!win32.isStillAttached(attachment)) {
          if (!recordFailure('detached') && mode === 'desktop')
            restartDesktop('detached').catch((e) => log(`restart failed: ${e}`));
          return;
        }
        let nowCovered = false;
        try {
          const foreground = win32.describeForeground();
          nowCovered = decideCovered(foreground, rectToEdges(primaryRect()), process.pid);
          // Written only when the foreground window changes, so the log shows why a pause did or did not happen.
          const key = foreground
            ? `${foreground.className}|${foreground.pid}|${foreground.zoomed}|${foreground.visible}|${foreground.rect.left},${foreground.rect.top},${foreground.rect.right},${foreground.rect.bottom}`
            : 'none';
          if (key !== lastForegroundKey) {
            lastForegroundKey = key;
            log(
              `foreground: ${key} primary=${JSON.stringify(primaryRect())} covered=${nowCovered}`,
            );
          }
        } catch (error) {
          log(`cover check failed: ${error}`);
        }
        setCovered(nowCovered);
      } else if (isMac && mac) {
        let nowCovered = false;
        try {
          const share = coveredShare(
            mac.listWindows(),
            screen.getPrimaryDisplay().workArea,
            process.pid,
          );
          nowCovered = share >= MAC_COVER_SHARE;
          // Logged in steps of a tenth, so the log shows why a pause did or did not happen without a line every check.
          const step = Math.floor(share * 10);
          if (step !== lastShareLogged) {
            lastShareLogged = step;
            log(`windows hide ${Math.round(share * 100)}% of the desktop; covered=${nowCovered}`);
          }
        } catch (error) {
          log(`cover check failed: ${error}`);
        }
        setCovered(nowCovered);
      }
    }, CHECK_MS);
  }

  function setCovered(nowCovered) {
    if (nowCovered === covered) return;
    covered = nowCovered;
    log(covered ? 'desktop is covered: pausing' : 'desktop is visible: resuming');
    setPauseReason('cover', covered);
  }

  function stopMonitor() {
    if (monitor) clearInterval(monitor);
    monitor = null;
    covered = false;
    lastShareLogged = -1;
    pauseReasons.delete('cover');
  }

  function onDisplayChange() {
    if (mode !== 'desktop' || !win) return;
    clearTimeout(displayTimer);
    displayTimer = setTimeout(() => {
      const bounds = screen.getPrimaryDisplay().bounds;
      log(`display changed; resizing to ${bounds.width}x${bounds.height}`);
      if (isWindows && attachment) win32.moveOnDesktop(attachment, primaryRect());
      else win?.setBounds(bounds);
    }, 500);
  }

  for (const name of ['display-metrics-changed', 'display-added', 'display-removed']) {
    screen.on(name, onDisplayChange);
  }

  /** `reason` says why the mode is not the one that was asked for (the desktop was skipped or failed). */
  async function start(nextMode, reason) {
    mode = nextMode;
    if (mode === 'desktop') await startDesktopMode();
    else await startWindowMode();
    onModeChanged(mode, reason);
  }

  /** The attach test: show each variant for a while so the result can be judged by eye. */
  async function runLab(names = Object.keys(VARIANTS), seconds = 15, tag = '') {
    mode = 'desktop';
    for (const name of names) {
      log(`LAB: variant ${name} for ${seconds} s`);
      stopMonitor();
      const old = win;
      win = null;
      attachment = null;
      switching = true;
      old?.destroy();
      await startDesktopMode(name, true, tag);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
    log('LAB: finished');
  }

  async function setMode(nextMode) {
    if (nextMode === mode) return;
    log(`switching to ${nextMode} mode`);
    switching = true;
    try {
      stopMonitor();
      clearStable();
      if (mode === 'window') flushBounds();
      const old = win;
      win = null;
      attachment = null;
      old?.destroy();
      failures = [];
      pauseReasons.delete('hidden');
      pauseReasons.delete('cover');
      await start(nextMode);
    } finally {
      switching = false;
    }
  }

  // FR-20, D20: above other windows in window mode. macOS uses the "floating" level, which stays below full-screen
  // apps; Windows may show it above them, which the operating system allows. Desktop mode ignores the setting.
  function applyAlwaysOnTop() {
    if (!win || win.isDestroyed() || mode !== 'window') return;
    if (getAlwaysOnTop()) win.setAlwaysOnTop(true, isMac ? 'floating' : undefined);
    else win.setAlwaysOnTop(false);
  }

  return {
    start,
    runLab,
    setMode,
    applyAlwaysOnTop,
    getMode: () => mode,
    getWindow: () => win,
    isSwitching: () => switching,
    isPaused: () => pauseReasons.size > 0,
    setPauseReason,
    /** The renderer of the current window finished starting (the safe start waits for it). */
    rendererReady() {
      rendererIsReady = true;
      // A page that started again (a lost graphics context reloads it) knows nothing of a pause, and the
      // pause is otherwise sent only when it changes. Without this a covered tank drew again after a reload.
      if (pauseReasons.size > 0) win?.webContents.send('scene:pause', true);
      armStable();
    },
    /** In desktop mode the tray is the only control, so closing windows never quits. */
    quitWhenAllClosed: () => !switching && mode === 'window',
    /** Called on before-quit: stops the monitor and any re-create, before the windows close. */
    dispose() {
      quitting = true;
      clearStable();
      clearTimeout(displayTimer);
      clearTimeout(dockTimer);
      stopMonitor();
      for (const name of ['display-metrics-changed', 'display-added', 'display-removed']) {
        screen.removeListener(name, onDisplayChange);
      }
    },
  };
}
