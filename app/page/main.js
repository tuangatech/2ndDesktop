import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
// The Content-Security-Policy forbids eval, so PixiJS uses its eval-free shader code path.
import 'pixi.js/unsafe-eval';
import { Application, Text } from 'pixi.js';
import { drawingResolution } from './drawing.js';
import { makeRng } from '../../shared/rng.js';
import { loadAtlas, releaseAtlasImage } from './art.js';
import { resolveScene } from './scenes.js';
import { reloadAllowed } from './reloadGuard.js';
import { parseSceneOptions } from './sceneOptions.js';
import { SoundPlayer } from './SoundPlayer.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'desktop' ? 'desktop' : 'window';
const debug = params.get('debug') === '1';
const dev = params.get('dev') === '1';
// Development switches for the scene (DESKTOP2_SCENE_OPTIONS, a JSON object). `fish` is the tank's, a named exception
// until `options` is a free bag: the number of fish at the start, species and stages mixed (measurements only).
const sceneOptions = parseSceneOptions(params.get('options'));
const fishCount = Number(sceneOptions.fish) || 0;
// Attach test (docs/desktop-spike.md): a big label and a magenta page background, so what is painted can be told apart.
const lab = params.get('lab') === '1';
const variant = params.get('variant') ?? '';
const tag = params.get('tag') ?? '';
document.documentElement.dataset.mode = mode;

const api = window.desktop2;

async function boot() {
  const info = (await api?.getAppInfo?.()) ?? {};
  const chosen = resolveScene(info.activeScene);
  const { manifest } = chosen;
  if (chosen.fellBack)
    console.log(`scene "${info.activeScene}" is not known, starting ${chosen.id}`);
  // The scene's code is loaded before the renderer starts: the PixiJS parts it imports (meshes, tiling sprites) register
  // themselves when they are imported, and a renderer that has already started would not know them.
  const { default: create } = await chosen.load();

  const app = new Application();
  await app.init({
    preference: 'webgl',
    resizeTo: window,
    resolution: drawingResolution(mode, innerWidth, innerHeight, devicePixelRatio),
    autoDensity: true,
    antialias: false, // multisampling costs 12 MB at the default window and 97 MB at the largest, with no visible gain on this art
    backgroundColor: 0x14507c,
  });
  document.getElementById('stage').appendChild(app.canvas);
  // A scene may ask for fewer frames than the host's cap (`fps` in scene.json), for example slow clouds.
  const fpsCap = mode === 'desktop' ? 30 : 60;
  app.ticker.maxFPS = Math.min(fpsCap, Number(manifest.fps) || fpsCap);

  // A scene names its atlas in scene.json (`atlas`; the id when it is left out). `"atlas": null` is a procedural scene
  // that draws everything in code: it gets no textures and nothing to release.
  const atlasName = 'atlas' in manifest ? manifest.atlas : manifest.id;
  const art = atlasName ? await loadAtlas(atlasName) : { textures: {}, source: null };
  // The decoded atlas image is dropped once it is on the graphics card, so a lost WebGL context starts the page
  // again (the tank is saved as it changes) instead of drawing from an image that is gone.
  if (art.source) releaseAtlasImage(app.renderer, art.source);
  // If it keeps happening (a failing driver), the page stops reloading and stays paused (reloadGuard.js).
  let contextGone = false;
  app.canvas.addEventListener('webglcontextlost', () => {
    let storage = null;
    try {
      storage = sessionStorage;
    } catch {
      // No storage: reload as before.
    }
    if (reloadAllowed(storage)) {
      location.reload();
      return;
    }
    contextGone = true;
    app.ticker.stop();
    api?.reportError('The graphics context was lost again and again; the scene stays paused.');
  });

  // The host's side of the scene contract (app/page/host.js, D33): the record of the active scene, the clock, the
  // random source, the sound and the HTML area. A scene gets nothing else.
  const sceneId = chosen.id;
  const clock = { offset: 0, now: () => Date.now() + clock.offset };
  // A record that had to be repaired or replaced is kept next to it as `<scene>-damaged-<time>.json`.
  const record = api
    ? {
        load: () => api.loadRecord(sceneId),
        save: (data) => api.saveRecord(sceneId, data),
        keepCopy: (data) => api.keepRecordCopy(sceneId, data),
      }
    : { load: async () => ({ status: 'missing' }), save() {} };
  // Sounds (FR-38): switched by the menu in the main process, which tells the renderer.
  const sound = new SoundPlayer({ enabled: (await api?.getSettings?.())?.sound !== false });
  api?.onSettingsChanged?.((settings) => sound.setEnabled(settings.sound !== false));
  const scene = await create({
    app,
    art,
    sound,
    record,
    clock,
    rng: makeRng(info.test?.seed ?? (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0),
    tuning: info.tuning ?? null,
    ui: { root: mode === 'window' ? document.getElementById('hud') : null },
    options: { ...sceneOptions, fish: fishCount, dev: dev && mode === 'window' },
    mode,
    log: (message) => {
      console.log(message);
      api?.reportNote?.(message);
    },
  });
  app.stage.addChild(scene.root);
  scene.resize(app.screen.width, app.screen.height);
  app.renderer.on('resize', () => scene.resize(app.screen.width, app.screen.height));

  if (lab) {
    document.body.style.background = '#ff00ff';
    document.documentElement.style.background = '#ff00ff';
    const big = new Text({
      text: `VARIANT: ${variant}${tag ? ` (${tag})` : ''}`,
      style: { fill: 0xffffff, fontFamily: 'Nunito', fontSize: 72, fontWeight: '600' },
    });
    big.position.set(120, 400);
    app.stage.addChild(big);
  }

  // Window mode: a click goes to the scene (the tank: an egg or pellet, then a fish, then the water, FR-46) and the
  // pointer moves the fish (FR-49). Desktop mode takes no clicks (D31); the main process sends the pointer position.
  if (mode === 'window') {
    app.canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 0) scene.click(event.clientX, event.clientY);
    });
    app.canvas.addEventListener('pointermove', (event) =>
      scene.pointer(event.clientX, event.clientY),
    );
    app.canvas.addEventListener('pointerleave', () => scene.pointer(null));
    addEventListener('blur', () => scene.pointer(null));
  } else {
    api?.onPointer?.((point) => (point ? scene.pointer(point.x, point.y) : scene.pointer(null)));
  }
  // The tray menu (D38, FR-61): the main process asks for the scene's lines and items when the menu opens, and sends
  // back the id of the item that was chosen.
  // A scene that throws here must not break the menu: the answer is null and the main process uses the last one.
  api?.onMenuRequest(() => {
    try {
      return { name: manifest.name, ...scene.status(), items: scene.menuItems() };
    } catch (error) {
      api?.reportError(`menu: ${String(error?.stack ?? error)}`);
      return null;
    }
  });
  api?.onAction((id) => scene.onMenu(id));
  // For screenshots and measurements (scripts/shot.mjs).
  if (debug || dev) window.__scene = { ...scene.debug, clock, fishtank: scene, app, sound };

  let label = null;
  if (debug) {
    label = new Text({
      text: '',
      style: { fill: 0xffffff, fontFamily: 'Nunito', fontSize: 18, fontWeight: '600' },
    });
    label.position.set(12, 30);
    app.stage.addChild(label);
  }

  // Average frame rate over 10 seconds, reported for the performance notes (NFR-2, NFR-3).
  let frames = 0;
  let windowStart = performance.now();
  app.ticker.add((ticker) => {
    // In a test with manual time the scene moves only when the test calls `fishtank.update` itself.
    if (!info.test?.manualTime) scene.update(ticker.deltaMS / 1000);
    frames++;
    const now = performance.now();
    if (now - windowStart >= 10_000) {
      api?.reportFps(Math.round((frames * 1000) / (now - windowStart)));
      frames = 0;
      windowStart = now;
    }
    if (label) {
      label.text = `${mode} ${innerWidth}x${innerHeight} css px, drawing at ${app.renderer.resolution.toFixed(2)}x, ${Math.round(app.ticker.FPS)} fps`;
    }
  });

  // The drawing resolution depends on the size in desktop mode (at most about 1080p of pixels), so it
  // follows every resize, for example when the window is moved onto the desktop or the display changes.
  const syncResolution = () => {
    const wanted = drawingResolution(mode, innerWidth, innerHeight, devicePixelRatio);
    if (Math.abs(wanted - app.renderer.resolution) < 0.01) return;
    app.renderer.resolution = wanted;
    app.renderer.resize(innerWidth, innerHeight);
  };
  addEventListener('resize', syncResolution);

  // Keep the picture sharp when the pixel ratio changes (FR-43), within the desktop cap.
  const watchRatio = () => {
    const query = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        syncResolution();
        watchRatio();
      },
      { once: true },
    );
  };
  watchRatio();

  // Pause when nobody can see the tank (FR-22). Chromium reports minimized and covered windows as hidden; the main
  // process also pauses it (a covered desktop, a locked screen). When it shows again the scene catches up on the
  // time that passed (the tank settles pellets and hunger from the clock).
  let documentHidden = document.visibilityState === 'hidden';
  let mainPaused = false;
  let wasRunning = true;
  let stoppedAt = 0;
  const syncRunning = () => {
    const running = !documentHidden && !mainPaused && !contextGone;
    if (running) app.ticker.start();
    else app.ticker.stop();
    scene.setVisible(running);
    // A scene may settle what happened meanwhile (the optional `resume`, with the length of the pause).
    if (!running && wasRunning) stoppedAt = clock.now();
    if (running && !wasRunning) scene.resume?.(Math.max(0, clock.now() - stoppedAt));
    wasRunning = running;
  };
  document.addEventListener('visibilitychange', () => {
    documentHidden = document.visibilityState === 'hidden';
    api?.reportVisibility(document.visibilityState);
    syncRunning();
  });
  api?.onPause((paused) => {
    mainPaused = paused;
    syncRunning();
  });
  api?.reportVisibility(document.visibilityState);
  syncRunning();

  // Window strip buttons (window mode).
  document.getElementById('btn-min').addEventListener('click', () => api?.windowMinimize());
  document.getElementById('btn-close').addEventListener('click', () => api?.windowClose());
  document.getElementById('btn-menu').addEventListener('click', () => api?.openMenu());

  if (debug) {
    setTimeout(() => {
      const box = app.canvas.getBoundingClientRect();
      console.log(
        `geometry: inner ${innerWidth}x${innerHeight} dpr ${devicePixelRatio} canvas ${box.left},${box.top} ${box.width}x${box.height} buffer ${app.canvas.width}x${app.canvas.height} screen ${app.screen.width}x${app.screen.height}`,
      );
    }, 2500);
  }
  // Minutes of player activity for the usage log (NFR-7): a click or key press, at most one report per 10 seconds.
  // Mouse movement alone does not count.
  let lastActivity = -Infinity;
  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(
      type,
      () => {
        const now = performance.now();
        if (now - lastActivity < 10_000) return;
        lastActivity = now;
        api?.reportActivity?.();
      },
      { capture: true, passive: true },
    );
  }
  window.addEventListener('error', (event) =>
    api?.reportError(String(event.error?.stack ?? event.message)),
  );
  window.addEventListener('unhandledrejection', (event) =>
    api?.reportError(String(event.reason?.stack ?? event.reason)),
  );
  window.__ready = true;
  api?.reportReady?.({ name: manifest.name });
}

boot().catch((err) => {
  console.error(err);
  api?.reportError(String(err?.stack ?? err));
});
