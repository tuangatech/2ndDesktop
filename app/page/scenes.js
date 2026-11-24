// The scenes the app knows (platform plan Step 1): every folder `scenes/<id>/` with a `scene.json` and an `index.js`.
// Vite lists them at build time, so a packed app needs no file access, and a scene is loaded only when it is chosen.

export const DEFAULT_SCENE = 'fishtank';

const manifests = import.meta.glob('../../scenes/*/scene.json', { eager: true, import: 'default' });
const modules = import.meta.glob('../../scenes/*/index.js');

const idOf = (path) => path.split('/').at(-2);

/** The ids of every scene in the build, with their manifests. */
export function listScenes() {
  return Object.entries(manifests).map(([path, manifest]) => ({ ...manifest, id: idOf(path) }));
}

/**
 * Finds the scene to run. An unknown or broken id falls back to the tank (the one scene that must always work).
 * @param {string|undefined} wanted
 * @returns {{id: string, manifest: object, load: () => Promise<{default: Function}>, fellBack: boolean}}
 */
export function resolveScene(wanted) {
  const known = (id) =>
    `../../scenes/${id}/scene.json` in manifests && `../../scenes/${id}/index.js` in modules;
  const id = wanted && known(wanted) ? wanted : DEFAULT_SCENE;
  return {
    id,
    manifest: { ...manifests[`../../scenes/${id}/scene.json`], id },
    load: modules[`../../scenes/${id}/index.js`],
    fellBack: Boolean(wanted) && id !== wanted,
  };
}
