// The contract between the host (the app: window, tray, saving, pausing, the drawing loop) and a scene (what lives
// on the desktop: the fish tank today). It is a typedef only; the host loads a scene through app/page/scenes.js, which
// lists `scenes/<id>/index.js`, and calls its default export `create(host)`. The contract is v0 until a third scene
// exists (platform plan D47, docs/03-platform-design.md section 4).

/**
 * What the host gives to a scene. Nothing else: no Node, no files, no window control.
 * @typedef {object} SceneHost
 * @property {import('pixi.js').Application} app  the PixiJS application (the scene's `root` is added to its stage)
 * @property {{textures: Record<string, import('pixi.js').Texture>}} art  the scene's own atlas, loaded by the host (D40);
 *           `textures` is empty when `scene.json` has `"atlas": null`
 * @property {{load: () => Promise<{status: string, data?: object}>, save: (record: object) => void,
 *             keepCopy?: (record: object) => void}} record
 *           the scene's own saved record (one file per scene id); `keepCopy` keeps a damaged record next to it
 * @property {{play: (name: 'splash'|'pop'|'chime') => unknown}} [sound]  short sounds, only for the player's own
 *           actions (v0: the names are the tank's; a scene with its own sounds has no way in yet)
 * @property {{now: () => number}} clock  epoch milliseconds; the dev panel can move it. The only source of time.
 * @property {ReturnType<typeof import('../../shared/rng.js').makeRng>} rng
 * @property {Record<string, unknown>|null} tuning  numbers a test build may change (tuning.json); the scene checks them
 * @property {{root: HTMLElement|null}} ui  the element for the scene's own HTML in window mode; null in desktop mode (D31)
 * @property {{fish?: number, dev?: boolean}} options  development switches (DESKTOP2_SCENE_OPTIONS, a JSON object; DESKTOP2_DEV); `fish`
 *           is the tank's, a named exception until `options` becomes a free bag
 * @property {'window'|'desktop'} mode
 * @property {(message: string) => void} log  a line in the app's log (no personal data)
 */

/**
 * What a scene gives to the host.
 * @typedef {object} Scene
 * @property {string} id  the scene id, which is also the name of its record
 * @property {import('pixi.js').Container} root
 * @property {(width: number, height: number) => void} resize  the size in CSS pixels; every size must work (FR-63)
 * @property {(dt: number) => void} update  seconds since the last frame (not called while paused). The host does not
 *           cap it: a scene that changes over time computes it from `host.clock` (wall time), not by adding up `dt`, and
 *           settles a pause in `setVisible(true)` or `resume(gapMs)`
 * @property {(visible: boolean) => void} setVisible  false while nobody can see the scene; true again catches up
 * @property {(gapMs: number) => void} [resume]  optional: called after a pause with how long it lasted
 * @property {(x: number|null, y?: number) => void} pointer  the pointer is over the scene at (x, y); `pointer(null)` says it left
 * @property {(x: number, y: number) => void} click  window mode only
 * @property {() => {line?: string, diagnostics?: string}} status  `line` is the first line of the tray menu,
 *           `diagnostics` a line of the Copy diagnostics text
 * @property {() => {id?: string, label: string, enabled?: boolean}[]} menuItems  items of the tray menu, in order; one
 *           without an `id` is a greyed line (D38)
 * @property {(id: string) => void} onMenu  an item of `menuItems()` was chosen
 * @property {() => object} serialize  the state that is saved
 * @property {() => void} dispose
 * @property {object} [debug]  objects for tests and measurements, exposed on `window.__scene` with `?debug=1`
 */

export {};
