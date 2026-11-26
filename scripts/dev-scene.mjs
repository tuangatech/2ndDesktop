// Runs one scene in an ordinary window with the dev kit (app/page/devKit.js): `npm run dev:scene -- <id>`.
// It is `npm run dev` (Vite and Electron, the page reloads on save) with three things set:
//   - the scene: a settings.json that names it, in its own data folder, so the player's own tank and records are never
//     touched and the scene's record is kept from one run to the next (delete the folder to start from nothing);
//   - window mode, and DESKTOP2_DEV=1, which shows the dev kit (clock, shape of the stage, pause) and, in the tank, its own panel;
//   - nothing else: the scene sees the same host as in the product.
// The data folder is <temp>/2nddesktop-dev-scene/<id>.
//   npm run dev:scene -- empty
//   npm run dev:scene -- my-garden
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSceneManifests } from '../app/main/scene-registry.js';

/**
 * Checks the id and prepares the data folder.
 * @param {{root: string, id: string|undefined, tempDir?: string}} options
 * @returns {{dataDir: string, env: Record<string, string>}}
 */
export function prepareDevScene({ root, id, tempDir = os.tmpdir() }) {
  const { scenes } = readSceneManifests(path.join(root, 'scenes'));
  if (!scenes.some((scene) => scene.id === id)) {
    const known = scenes.map((scene) => scene.id).join(', ');
    throw new Error(
      `There is no scene "${id}" in scenes/. Scenes: ${known}. Make one with: npm run new-scene -- <id>`,
    );
  }
  const dataDir = path.join(tempDir, '2nddesktop-dev-scene', id);
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'settings.json');
  let settings = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) settings = parsed;
  } catch {
    // no settings yet, or damaged: start again
  }
  fs.writeFileSync(file, JSON.stringify({ ...settings, activeScene: id }));
  return {
    dataDir,
    env: { DESKTOP2_USER_DATA: dataDir, DESKTOP2_MODE: 'window', DESKTOP2_DEV: '1' },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2];
  try {
    if (!id) throw new Error('Usage: npm run dev:scene -- <id>');
    const root = path.join(import.meta.dirname, '..');
    const { dataDir, env } = prepareDevScene({ root, id });
    console.log(`Scene "${id}", data folder ${dataDir}`);
    const npmCli = process.env.npm_execpath;
    const [command, args, shell] = npmCli
      ? [process.execPath, [npmCli, 'run', 'dev'], false]
      : ['npm run dev', [], true];
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell,
      env: { ...process.env, ...env },
    });
    child.on('close', (code) => process.exit(code ?? 0));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
