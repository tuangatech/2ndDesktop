// The dev kit panel (docs/platform/01 section 12, work package 8.4): what a person needs to look at ANY scene in a window
// without waiting or resizing by hand. It is a tool and not part of the product: shown only in window mode with
// DESKTOP2_DEV=1 (`npm run dev:scene -- <id>` sets it). It never touches the scene itself, only what the host gives it:
//   - the clock (`host.clock`): a date and time, jumps, a speed. A scene that changes with the time of day or the
//     season is looked at in seconds. After a jump forward the scene gets `resume(gap)` as after a pause, and an update;
//   - the window shape: the stage is cut to an aspect ratio (3:2, 16:9, 21:9, a square, a portrait) inside the window, so
//     `resize()` is called with the sizes a scene will meet on real desktops;
//   - a pause, as if the desktop were covered (`setVisible(false)`, and `resume` on the way back).
// Not here yet: weather, place and data kinds (they come with version 0.4), the power state, desktop-mode input
// (`DESKTOP2_TEST_RENDER_MODE=desktop` with `DESKTOP2_TEST=1` draws the desktop scene in a window).

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SHAPES = [
  { id: 'fill', label: 'Fill the window', ratio: null },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '21:9', label: '21:9 (ultrawide)', ratio: 21 / 9 },
  { id: '1:1', label: '1:1 (square)', ratio: 1 },
  { id: '9:16', label: '9:16 (portrait)', ratio: 9 / 16 },
];
export const JUMPS = [
  ['-1 d', -DAY],
  ['+1 h', HOUR],
  ['+6 h', 6 * HOUR],
  ['+1 d', DAY],
  ['+7 d', 7 * DAY],
  ['+30 d', 30 * DAY],
];
export const SPEEDS = [1, 60, 600, 3600];

/** A window narrower than this (css px) starts with the panel closed; the click on "dev kit" opens it. */
export const COLLAPSE_BELOW = 700;

/**
 * The biggest rectangle of a shape that fits in the viewport.
 * @param {number|null} ratio  width / height, or null to fill the viewport
 * @returns {{width: number, height: number}}
 */
export function fitShape(ratio, viewportWidth, viewportHeight) {
  if (!ratio) return { width: viewportWidth, height: viewportHeight };
  const width = Math.min(viewportWidth, viewportHeight * ratio);
  return { width: Math.floor(width), height: Math.floor(width / ratio) };
}

const two = (n) => String(n).padStart(2, '0');

/** The value of an `<input type="datetime-local">` for a time (local time, to the minute). */
export function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** The time of such a value, or NaN. */
export const fromLocalInput = (text) => new Date(text).getTime();

/**
 * @param {{app: import('pixi.js').Application, stage: HTMLElement,
 *          clock: ReturnType<typeof import('./clock.js').createClock>,
 *          onJump: (deltaMs: number) => void, setPaused: (paused: boolean) => void}} options
 */
export function createDevKit({ app, stage, clock, onJump, setPaused }) {
  let shape = SHAPES[0];

  const panel = document.createElement('div');
  panel.id = 'devkit';
  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'head';
  head.textContent = 'dev kit';
  const body = document.createElement('div');
  body.className = 'body';
  head.addEventListener('click', () => body.classList.toggle('hidden'));
  // The window of a run is small (480 x 320): open, the panel would cover half of it and the scene's own buttons.
  if (window.innerWidth < COLLAPSE_BELOW) body.classList.add('hidden');
  panel.append(head, body);

  const row = (...children) => {
    const el = document.createElement('div');
    el.append(...children);
    body.append(el);
    return el;
  };
  const text = (value) => {
    const el = document.createElement('span');
    el.textContent = value;
    return el;
  };
  const button = (label, onClick, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
  };

  // The clock.
  const clockLabel = document.createElement('span');
  clockLabel.className = 'clock';
  const input = document.createElement('input');
  input.type = 'datetime-local';
  input.ariaLabel = 'Set the clock';
  const refresh = () => {
    clockLabel.textContent = `${new Date(clock.now()).toLocaleString()}${clock.speed === 1 ? '' : `  x${clock.speed}`}`;
  };
  const moved = (delta) => {
    refresh();
    input.value = toLocalInput(clock.now());
    onJump(delta);
  };
  input.addEventListener('change', () => {
    const time = fromLocalInput(input.value);
    if (!Number.isFinite(time)) return;
    const delta = time - clock.now();
    clock.set(time);
    moved(delta);
  });
  row(text('clock '), clockLabel);
  row(input);
  row(
    ...JUMPS.map(([label, ms]) =>
      button(label, () => {
        clock.jump(ms);
        moved(ms);
      }),
    ),
  );
  const speed = document.createElement('select');
  speed.ariaLabel = 'Clock speed';
  for (const value of SPEEDS) speed.append(new Option(`x${value}`, String(value)));
  speed.addEventListener('change', () => {
    clock.setSpeed(Number(speed.value));
    refresh();
  });
  row(
    text('speed '),
    speed,
    button('now', () => {
      const delta = Date.now() - clock.now();
      clock.reset();
      speed.value = '1';
      moved(delta);
    }),
  );

  // The shape of the stage.
  const size = () => {
    if (!shape.ratio) return null;
    const { width, height } = fitShape(shape.ratio, innerWidth, innerHeight);
    return [width, height];
  };
  const applyShape = () => {
    const box = size();
    if (!box) {
      stage.style.cssText = '';
      app.resizeTo = window;
    } else {
      // At the top left, so a pointer position in the page is a position on the stage.
      stage.style.cssText = `inset:auto;left:0;top:0;right:auto;bottom:auto;width:${box[0]}px;height:${box[1]}px;outline:1px dashed rgba(255,255,255,0.5)`;
      app.resizeTo = stage;
    }
    app.resize();
  };
  const shapes = document.createElement('select');
  shapes.ariaLabel = 'Window shape';
  for (const s of SHAPES) shapes.append(new Option(s.label, s.id));
  shapes.addEventListener('change', () => {
    shape = SHAPES.find((s) => s.id === shapes.value) ?? SHAPES[0];
    applyShape();
  });
  addEventListener('resize', () => {
    if (shape.ratio) applyShape();
  });
  row(text('shape '), shapes);

  // A pause, as if the desktop were covered.
  const pause = document.createElement('input');
  pause.type = 'checkbox';
  pause.addEventListener('change', () => setPaused(pause.checked));
  const pauseLabel = document.createElement('label');
  pauseLabel.append(pause, text(' paused (as if covered)'));
  row(pauseLabel);

  input.value = toLocalInput(clock.now());
  refresh();
  const timer = setInterval(refresh, 500);
  document.body.append(panel);
  return {
    panel,
    /** The size of the stage in CSS pixels while a shape is chosen, otherwise null (the whole window). */
    size,
    destroy() {
      clearInterval(timer);
      panel.remove();
    },
  };
}
