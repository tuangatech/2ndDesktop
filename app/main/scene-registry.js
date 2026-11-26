// The scenes the main process knows: every folder `scenes/<id>/` with a `scene.json` and an `index.js`, read from disk
// without loading any scene code (docs/platform/01 section 8.2, "the host reads manifests without loading any scene
// code"). The page finds the same scenes at build time (app/page/scenes.js, Vite's glob); tests/host/scene-registry.test.js
// checks that both lists agree. Plain Node, so it is unit-tested.
import fs from 'node:fs';
import path from 'node:path';

// The id is also the folder name and the name of the scene's record file (docs/platform/01 section 8.2: lowercase and
// dashes, 3 to 32 characters).
const ID_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const MAX_NAME = 40;

const isPlainText = (value) =>
  typeof value === 'string' &&
  Array.from(value).every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127);

/**
 * Checks what the host needs of a bundled scene's `scene.json`. Other keys are allowed and ignored (the manifest grows
 * with the contract); only the fields below are checked.
 * @param {unknown} raw  the parsed manifest
 * @param {string} folder  the name of the folder it was read from
 * @returns {{ok: true, manifest: object} | {ok: false, problems: string[]}}
 */
export function checkManifest(raw, folder) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: ['scene.json is not an object'] };
  }
  const problems = [];
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    problems.push(
      'id must be 3 to 32 characters: lowercase letters, digits and dashes, a letter first',
    );
  } else if (raw.id !== folder) {
    problems.push(`id "${raw.id}" is not the folder name "${folder}"`);
  }
  if (!isPlainText(raw.name) || raw.name.trim() === '' || raw.name.length > MAX_NAME) {
    problems.push(`name must be plain text of 1 to ${MAX_NAME} characters`);
  }
  if (typeof raw.version !== 'string' || !VERSION_PATTERN.test(raw.version)) {
    problems.push('version must look like 0.1.0');
  }
  if (!Number.isInteger(raw.schema) || raw.schema < 1) {
    problems.push('schema must be a whole number from 1');
  }
  if (typeof raw.license?.code !== 'string' || raw.license.code.trim() === '') {
    problems.push('license.code is required');
  }
  if ('fps' in raw && !(typeof raw.fps === 'number' && raw.fps >= 5 && raw.fps <= 30)) {
    problems.push('fps must be a number from 5 to 30');
  }
  if ('atlas' in raw && raw.atlas !== null && !(typeof raw.atlas === 'string' && raw.atlas)) {
    problems.push('atlas must be a name, or null for a scene drawn in code');
  }
  if ('dev' in raw && typeof raw.dev !== 'boolean') {
    problems.push('dev must be true or false');
  }
  return problems.length ? { ok: false, problems } : { ok: true, manifest: { ...raw } };
}

/**
 * Reads every scene folder under `scenesDir`. A folder that is not a scene (no `scene.json`) is skipped; a scene whose
 * manifest does not pass `checkManifest`, or that has no `index.js`, is left out and reported in `rejected`.
 * @param {string} scenesDir
 * @returns {{scenes: object[], rejected: {folder: string, problems: string[]}[]}}  scenes sorted by id
 */
export function readSceneManifests(scenesDir) {
  const scenes = [];
  const rejected = [];
  let entries;
  try {
    entries = fs.readdirSync(scenesDir, { withFileTypes: true });
  } catch {
    return { scenes, rejected };
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(scenesDir, entry.name);
    const manifestFile = path.join(dir, 'scene.json');
    if (!fs.existsSync(manifestFile)) continue;
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch {
      rejected.push({ folder: entry.name, problems: ['scene.json is not valid JSON'] });
      continue;
    }
    const checked = checkManifest(raw, entry.name);
    if (!checked.ok) {
      rejected.push({ folder: entry.name, problems: checked.problems });
    } else if (!fs.existsSync(path.join(dir, 'index.js'))) {
      rejected.push({ folder: entry.name, problems: ['index.js is missing'] });
    } else {
      scenes.push(checked.manifest);
    }
  }
  scenes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { scenes, rejected };
}

/**
 * The scenes a player may choose. A scene marked `dev: true` (the empty scene, used for baselines and tests) is listed
 * only in a development or test build; an installed release never shows it.
 * @param {object[]} scenes
 * @param {{dev: boolean}} options
 */
export function listedScenes(scenes, { dev }) {
  return scenes.filter((scene) => dev || scene.dev !== true);
}
