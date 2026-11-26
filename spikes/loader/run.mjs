// `npm run spike:loader`: builds the host's PixiJS as one file, then starts the harness (spikes/loader/main.js) in
// Electron. Not part of the app, of `npm test` or of CI: it opens a few small windows and a UDP socket.
// Usage: node spikes/loader/run.mjs [--out=<file>]  (the report is also written to <file>)
import electron from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';

const here = import.meta.dirname;
const bundle = fs.mkdtempSync(path.join(os.tmpdir(), '2nddesktop-spike-pixi-'));

await build({
  root: here,
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir: bundle,
    emptyOutDir: true,
    target: 'esnext',
    lib: { entry: path.join(here, 'pixi-entry.js'), formats: ['es'], fileName: () => 'pixi.js' },
  },
});

// Some terminals set ELECTRON_RUN_AS_NODE, which makes Electron behave like plain Node (scripts/run-electron.mjs).
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const extra = process.argv.slice(2).filter((arg) => arg.startsWith('--out='));
const data = fs.mkdtempSync(path.join(os.tmpdir(), '2nddesktop-spike-data-'));
const child = spawn(
  electron,
  [path.join(here, 'main.js'), `--bundle=${bundle}`, `--data=${data}`, ...extra],
  { stdio: 'inherit', env },
);
child.on('exit', (code) => {
  for (const folder of [bundle, data]) fs.rmSync(folder, { recursive: true, force: true });
  process.exit(code ?? 1);
});
