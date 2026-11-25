// Before a universal macOS build (`npm run dist:universal`; `dist` and `dist:test` do not run it): make sure both koffi native packages are in node_modules.
// npm installs only the package of the build machine's processor (@koromix/koffi-darwin-arm64 on an M1), and
// `npm install --os=darwin --cpu=x64` refuses it with "notsup", so the missing one is fetched with `npm pack` and
// unpacked by hand, at the version of the installed koffi. Nothing is saved to package.json or the lock file.
// Does nothing on Windows and Linux, or when both packages are already there.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (process.platform !== 'darwin') process.exit(0);

const root = path.join(import.meta.dirname, '..');
const scope = path.join(root, 'node_modules', '@koromix');
const { version } = JSON.parse(
  fs.readFileSync(path.join(root, 'node_modules', 'koffi', 'package.json'), 'utf8'),
);
for (const arch of ['arm64', 'x64']) {
  const name = `koffi-darwin-${arch}`;
  const target = path.join(scope, name);
  if (fs.existsSync(path.join(target, 'package.json'))) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koffi-'));
  try {
    const file = execFileSync('npm', ['pack', `@koromix/${name}@${version}`, '--silent'], {
      cwd: tmp,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .pop();
    fs.mkdirSync(target, { recursive: true });
    execFileSync('tar', ['-xzf', path.join(tmp, file), '-C', target, '--strip-components=1']);
    console.log(`added @koromix/${name}@${version} for the universal build`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
