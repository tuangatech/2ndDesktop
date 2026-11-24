import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Some editors set ELECTRON_RUN_AS_NODE, which would make Electron behave like Node.
const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;

export const HOUR = 60 * 60 * 1000;

/**
 * Starts the app in window mode with its own data folder. Pass `dataDir` to start again with the same save;
 * the folder is then left for the caller to remove.
 */
export async function launch({ dataDir, env = {} } = {}) {
  const ownsDir = !dataDir;
  const dir = dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-e2e-'));
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...cleanEnv,
      FISHTANK_USER_DATA: dir,
      FISHTANK_MODE: 'window',
      FISHTANK_DEBUG: '1',
      FISHTANK_TEST: '1',
      // The same fish, decorations and swimming on every run, and a scene that moves only when a test steps it, so
      // no test depends on where a fish happens to swim. A test that needs real time passes FISHTANK_MANUAL_TIME: '0'.
      FISHTANK_SEED: '20261121',
      FISHTANK_MANUAL_TIME: '1',
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__ready === true);
  return {
    app,
    page,
    dir,
    recordFile: path.join(dir, 'records', 'fishtank.json'),
    close: async () => {
      await app.close();
      if (ownsDir) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function makeDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-e2e-'));
}
