// Starts Electron with the project folder as the app. Usage: node scripts/run-electron.mjs [args]
// Some terminals and editors (for example the VS Code extension host) set ELECTRON_RUN_AS_NODE, which
// makes Electron behave like plain Node and breaks the app. It is removed here.
import electron from 'electron';
import { spawn } from 'node:child_process';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.length > 2 ? process.argv.slice(2) : ['.'];
const child = spawn(electron, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
