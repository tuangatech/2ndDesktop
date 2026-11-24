import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A small stand-in for Electron: enough of BrowserWindow, app and screen for the mode controller.
const created = [];
vi.mock('electron', () => {
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.destroyed = false;
      this.sent = [];
      this.webContents = {
        on() {},
        setWindowOpenHandler() {},
        send: (channel, value) => this.sent.push([channel, value]),
      };
      created.push(this);
    }
    on(event, fn) {
      (this.handlers[event] ??= []).push(fn);
    }
    once(event, fn) {
      this.on(event, fn);
    }
    emit(event) {
      for (const fn of this.handlers[event] ?? []) fn();
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.emit('closed');
    }
    isDestroyed() {
      return this.destroyed;
    }
    show() {
      this.shown = 'show';
    }
    showInactive() {
      this.shown = 'showInactive';
    }
    setAlwaysOnTop(on, level) {
      this.alwaysOnTop = { on, level };
    }
    setBounds(bounds) {
      // `inflate` stands for Windows at a fractional scale, which makes a rectangle a few pixels larger.
      this.moved = {
        ...this.options,
        ...bounds,
        width: bounds.width + (globalThis.__inflate ?? 0),
      };
    }
    setAspectRatio(ratio) {
      this.aspectRatio = ratio;
    }
    setMinimumSize(width, height) {
      this.minimumSize = { width, height };
    }
    setMaximumSize(width, height) {
      this.maximumSize = { width, height };
    }
    getBounds() {
      const { x, y, width, height } = this.moved ?? this.options;
      return { x, y, width, height };
    }
    getNormalBounds() {
      return this.getBounds();
    }
    setVisibleOnAllWorkspaces() {}
    setIgnoreMouseEvents() {}
    getContentBounds() {
      return { x: 0, y: 0, width: 1512, height: 982 };
    }
  }
  const display = {
    bounds: { x: 0, y: 0, width: 1512, height: 982 },
    workArea: { x: 0, y: 25, width: 1512, height: 957 },
  };
  return {
    BrowserWindow,
    app: {
      // `ignoreHides` stands for macOS ignoring a Dock hide early in a launch.
      dock: {
        visible: true,
        ignoreHides: 0,
        show() {
          this.visible = true;
        },
        hide() {
          if (this.ignoreHides > 0) this.ignoreHides--;
          else this.visible = false;
        },
        isVisible() {
          return this.visible;
        },
      },
    },
    screen: {
      getPrimaryDisplay: () => display,
      getAllDisplays: () => [display],
      getDisplayMatching: () => display,
      dipToScreenRect: (_w, rect) => rect,
      on() {},
      removeListener() {},
    },
  };
});

const { createDesktopController } = await import('../../electron/desktop.js');
const { app: electronApp } = await import('electron');

const realPlatform = process.platform;
let logs;

function makeController(extra = {}) {
  logs = [];
  return createDesktopController({
    preloadPath: 'preload.cjs',
    loadRenderer: async () => {},
    log: (message) => logs.push(message),
    onModeChanged: () => {},
    ...extra,
  });
}

beforeEach(() => {
  created.length = 0;
  vi.useFakeTimers();
  // The macOS path needs no native code, so the test runs the same on every CI runner.
  Object.defineProperty(process, 'platform', { value: 'darwin' });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(process, 'platform', { value: realPlatform });
});

describe('desktop mode controller', () => {
  it('tells a page that started again that the tank is still paused', async () => {
    const controller = makeController();
    await controller.start('desktop');
    controller.rendererReady();
    const win = controller.getWindow();
    expect(win.sent.filter(([channel]) => channel === 'scene:pause')).toEqual([]);
    controller.setPauseReason('cover', true);
    win.sent.length = 0;
    controller.rendererReady(); // the page reloaded after a lost graphics context
    expect(win.sent).toContainEqual(['scene:pause', true]);
    controller.setPauseReason('cover', false);
    win.sent.length = 0;
    controller.rendererReady();
    expect(win.sent.filter(([channel]) => channel === 'scene:pause')).toEqual([]);
    controller.dispose();
  });

  it('hides the Dock icon on the desktop even when macOS ignores the first tries, and shows it in a window', async () => {
    const dock = electronApp.dock;
    dock.visible = true;
    dock.ignoreHides = 2;
    const controller = makeController();
    await controller.start('desktop');
    expect(dock.isVisible()).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(dock.isVisible()).toBe(false);
    await controller.setMode('window');
    expect(dock.isVisible()).toBe(true);
    controller.dispose();
  });

  it('stops trying to hide the Dock icon when the player goes back to a window', async () => {
    const dock = electronApp.dock;
    dock.visible = true;
    dock.ignoreHides = 100;
    const controller = makeController();
    await controller.start('desktop');
    await controller.setMode('window');
    const before = dock.ignoreHides;
    await vi.advanceTimersByTimeAsync(6000);
    expect(dock.ignoreHides).toBe(before);
    expect(dock.isVisible()).toBe(true);
    controller.dispose();
  });

  it('gives up after 5 seconds and says so in the log', async () => {
    const dock = electronApp.dock;
    dock.visible = true;
    dock.ignoreHides = 100;
    const controller = makeController();
    await controller.start('desktop');
    await vi.advanceTimersByTimeAsync(6000);
    expect(logs).toContain('the Dock icon could not be hidden');
    controller.dispose();
    dock.ignoreHides = 0;
  });

  it('re-creates the desktop window when the system destroys it', async () => {
    const controller = makeController();
    await controller.start('desktop');
    expect(created).toHaveLength(1);
    created[0].destroy(); // as when Explorer rebuilds the desktop
    await vi.advanceTimersByTimeAsync(1500);
    expect(created).toHaveLength(2);
    expect(controller.getWindow()).toBe(created[1]);
  });

  it('does not re-create the window while the app quits', async () => {
    const controller = makeController();
    await controller.start('desktop');
    controller.dispose(); // called on before-quit, before the windows close
    created[0].destroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect(created).toHaveLength(1);
    expect(logs.some((line) => line.includes('creating it again'))).toBe(false);
  });

  it('switches modes without re-creating the old window, and quits on close only in window mode', async () => {
    const controller = makeController();
    await controller.start('window');
    expect(controller.quitWhenAllClosed()).toBe(true);

    const switching = controller.setMode('desktop');
    expect(controller.quitWhenAllClosed()).toBe(false); // the old window closes during the switch
    await switching;
    expect(controller.getMode()).toBe('desktop');
    expect(created[0].destroyed).toBe(true);
    expect(controller.quitWhenAllClosed()).toBe(false); // the tray is the only control in desktop mode

    await controller.setMode('window');
    await vi.advanceTimersByTimeAsync(5000);
    expect(controller.getMode()).toBe('window');
    expect(created).toHaveLength(3); // window, desktop, window: the closed desktop window was not brought back
    expect(controller.quitWhenAllClosed()).toBe(true);
  });

  it('keeps the window above others only in window mode, and only when the setting is on (FR-20)', async () => {
    let on = true;
    const controller = makeController({ getAlwaysOnTop: () => on });
    await controller.start('window');
    expect(created[0].alwaysOnTop).toEqual({ on: true, level: 'floating' }); // macOS level

    on = false;
    controller.applyAlwaysOnTop();
    expect(created[0].alwaysOnTop.on).toBe(false);

    await controller.setMode('desktop');
    expect(created[1].alwaysOnTop).toBeUndefined(); // the tank is behind everything, so no setting
  });

  it('shows the first window without taking focus when the app was started at login (NFR-6)', async () => {
    const controller = makeController({ startedAtLogin: true });
    await controller.start('window');
    created[0].emit('ready-to-show');
    expect(created[0].shown).toBe('showInactive');

    await controller.setMode('desktop');
    await controller.setMode('window'); // a window the player asked for takes focus as usual
    created[2].emit('ready-to-show');
    expect(created[2].shown).toBe('show');
  });

  describe('the safe start of the desktop mode (FR-64)', () => {
    it('says trying before the attach, and ok only after the renderer is ready and 10 stable seconds', async () => {
      const states = [];
      const controller = makeController({ onDesktopAttempt: (state) => states.push(state) });
      await controller.start('desktop');
      expect(states).toEqual(['trying']);

      await vi.advanceTimersByTimeAsync(60_000); // no renderer yet: nothing is trusted
      expect(states).toEqual(['trying']);

      controller.rendererReady();
      await vi.advanceTimersByTimeAsync(9_000);
      expect(states).toEqual(['trying']);
      await vi.advanceTimersByTimeAsync(1_500);
      expect(states).toEqual(['trying', 'ok']);
    });

    it('says ok once, even if the renderer reports ready twice', async () => {
      const states = [];
      const controller = makeController({ onDesktopAttempt: (state) => states.push(state) });
      await controller.start('desktop');
      controller.rendererReady();
      controller.rendererReady();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(states.filter((s) => s === 'ok')).toHaveLength(1);
    });

    it('does not say ok when the window is replaced within the 10 seconds', async () => {
      const states = [];
      const controller = makeController({ onDesktopAttempt: (state) => states.push(state) });
      await controller.start('desktop');
      controller.rendererReady();
      await vi.advanceTimersByTimeAsync(5_000);
      created[0].destroy(); // the system destroyed it; a new one is made after 1 second
      await vi.advanceTimersByTimeAsync(1_500);
      expect(states).toEqual(['trying', 'trying']);
      await vi.advanceTimersByTimeAsync(20_000); // the new window has not said it is ready
      expect(states).toEqual(['trying', 'trying']);
      controller.rendererReady();
      await vi.advanceTimersByTimeAsync(10_500);
      expect(states).toEqual(['trying', 'trying', 'ok']);
    });

    it('does not say ok after the player went back to a window', async () => {
      const states = [];
      const controller = makeController({ onDesktopAttempt: (state) => states.push(state) });
      await controller.start('desktop');
      controller.rendererReady();
      await controller.setMode('window');
      await vi.advanceTimersByTimeAsync(30_000);
      expect(states).toEqual(['trying']);
    });

    it('does not try anything in window mode', async () => {
      const states = [];
      const controller = makeController({ onDesktopAttempt: (state) => states.push(state) });
      await controller.start('window');
      controller.rendererReady();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(states).toEqual([]);
    });

    it('passes the reason for a mode on to onModeChanged', async () => {
      const calls = [];
      const controller = makeController({ onModeChanged: (...args) => calls.push(args) });
      await controller.start('window', 'the last desktop attempt did not finish');
      expect(calls).toEqual([['window', 'the last desktop attempt did not finish']]);
    });
  });

  describe('window rules and placement (FR-19)', () => {
    it('opens in the bottom-right corner on the first launch, in a 3:2 shape with the size limits', async () => {
      const controller = makeController();
      await controller.start('window');
      const { options, aspectRatio } = created[0];
      expect(options).toMatchObject({
        x: 1512 - 480 - 24,
        y: 25 + 957 - 320 - 24,
        width: 480,
        height: 320,
        minWidth: 360,
        minHeight: 240,
        maxWidth: 1200,
        maxHeight: 800,
      });
      expect(aspectRatio).toBe(3 / 2);
    });

    it('has no 3:2 lock on Windows, where it made the window shrink at every start', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const controller = makeController();
      await controller.start('window');
      expect(created[0].aspectRatio).toBeUndefined();
      expect(created[0].options).toMatchObject({ minWidth: 360, maxWidth: 1200 });
    });

    it('asks for a smaller size on Windows when the system makes the window larger than wanted', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      globalThis.__inflate = 3; // the window comes out 3 px wider than asked for
      try {
        const saved = { x: 100, y: 120, width: 600, height: 400 };
        const controller = makeController({ getWindowBounds: () => saved });
        await controller.start('window');
        expect(created[0].getBounds()).toEqual(saved);
      } finally {
        delete globalThis.__inflate;
      }
    });

    it('opens where it was left', async () => {
      const saved = { x: 100, y: 120, width: 600, height: 400 };
      const controller = makeController({ getWindowBounds: () => saved });
      await controller.start('window');
      expect(created[0].options).toMatchObject(saved);
    });

    it('saves the rectangle after the window has been still for a moment, not on every step', async () => {
      const saved = [];
      const controller = makeController({ saveWindowBounds: (bounds) => saved.push(bounds) });
      await controller.start('window');
      for (let i = 0; i < 5; i++) {
        created[0].emit('move');
        await vi.advanceTimersByTimeAsync(100);
      }
      expect(saved).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(500);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ width: 480, height: 320 });
    });

    it('saves at once when the window closes, and when the player switches to desktop mode', async () => {
      const saved = [];
      const controller = makeController({ saveWindowBounds: (bounds) => saved.push(bounds) });
      await controller.start('window');
      created[0].emit('resize');
      created[0].emit('close');
      expect(saved).toHaveLength(1);

      await controller.setMode('desktop');
      await controller.setMode('window');
      created[2].emit('move');
      await controller.setMode('desktop'); // the window is destroyed, no close event
      expect(saved).toHaveLength(2);
    });

    it('keeps the size limits right for the display the window was moved to', async () => {
      const controller = makeController();
      await controller.start('window');
      created[0].emit('moved');
      expect(created[0].maximumSize).toEqual({ width: 1200, height: 800 });
      expect(created[0].minimumSize).toEqual({ width: 360, height: 240 });
    });

    it('does not remember or limit a window made for a screenshot or a test', async () => {
      process.env.DESKTOP2_TEST = '1';
      process.env.DESKTOP2_WINDOW_SIZE = '900x600';
      try {
        const saved = [];
        const controller = makeController({ saveWindowBounds: (bounds) => saved.push(bounds) });
        await controller.start('window');
        created[0].emit('close');
        expect(saved).toHaveLength(0);
        expect(created[0].options).toMatchObject({ width: 900, height: 600 });
        expect(created[0].aspectRatio).toBeUndefined();
      } finally {
        delete process.env.DESKTOP2_TEST;
        delete process.env.DESKTOP2_WINDOW_SIZE;
      }
    });
  });

  it('takes focus normally when it was not started at login', async () => {
    const controller = makeController();
    await controller.start('window');
    created[0].emit('ready-to-show');
    expect(created[0].shown).toBe('show');
  });
});
