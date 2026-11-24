#!/usr/bin/env node
// One-time import of the fish-tank files into the 2ndDesktop repository (commit 1 of the bootstrap, see
// docs/bootstrap/BOOTSTRAP.md). Copies files with the SAME paths, except the documents, and renames
// nothing: the point of commit 1 is to prove that the copy is complete (npm ci, lint, test, build, e2e, golden hash).
//
// Usage:  node import-from-fishtank.mjs <fish-tank checkout> <2ndDesktop checkout> [--dry-run]
//
// It never changes the source. It refuses a target that already holds files, except .git, a first README.md and LICENSE,
// and a docs/ folder (kept, never overwritten). Node 24, no dependencies, same on Windows and macOS.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
if (args.length !== 2) {
  console.error('Usage: node import-from-fishtank.mjs <fish-tank checkout> <2ndDesktop checkout> [--dry-run]');
  process.exit(2);
}
const src = path.resolve(args[0]);
const dst = path.resolve(args[1]);

if (!existsSync(path.join(src, 'electron', 'main.js'))) throw new Error(`${src} does not look like fish-tank`);
if (!existsSync(dst)) throw new Error(`${dst} does not exist: clone the new repository first`);
// Allowed to exist already: .git; a first README.md and LICENSE (the initial commit that creates `main`); and docs/ when the
// owner has put the design set there by hand (it is then kept as it is: the import never overwrites a file in docs/).
const present = readdirSync(dst).filter((n) => !['.git', 'docs', 'README.md', 'LICENSE'].includes(n));
if (present.length > 0) throw new Error(`${dst} is not empty (${present.join(', ')}): the import is done once`);

const git = (...a) => execFileSync('git', ['-C', src, ...a], { encoding: 'utf8' }).trim();
const commit = git('rev-parse', '--short', 'HEAD');
const dirty = git('status', '--porcelain', '--untracked-files=no');
if (dirty) throw new Error(`The fish-tank checkout has uncommitted changes:\n${dirty}\nImport only from a clean checkout of a known commit.`);

// Never copied from any folder.
const SKIP = new Set(['node_modules', 'dist', 'release', 'test-results', 'playwright-report', '.DS_Store', 'Thumbs.db']);
const filter = (from) => !SKIP.has(path.basename(from));

let count = 0;
function copy(rel, to = rel, keepExisting = false) {
  const from = path.join(src, rel);
  if (!existsSync(from)) throw new Error(`missing in fish-tank: ${rel}`);
  const target = path.join(dst, to);
  const n = statSync(from).isDirectory() ? countFiles(from) : 1;
  count += n;
  console.log(`${dryRun ? 'would copy' : 'copy'}  ${rel}${to === rel ? '' : '  ->  ' + to}  (${n} files)`);
  if (dryRun) return;
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(from, target, { recursive: true, filter, force: !keepExisting, errorOnExist: false });
}
function countFiles(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
}

// 1. Code, same paths (docs2 of platform/04, section 4).
for (const d of ['electron', 'renderer', 'scenes', 'shared', 'scripts', 'spikes', 'tests']) copy(d);

// 2. Root files: configuration and tooling. package.json and electron-builder.yml are renamed in commit 2, not now.
for (const f of [
  '.editorconfig', '.gitattributes', '.gitignore', '.nvmrc', '.prettierignore', '.prettierrc',
  'eslint.config.js', 'electron-builder.yml', 'package.json', 'package-lock.json',
  'playwright.config.js', 'vite.config.js', 'vitest.config.js', 'LICENSE',
]) copy(f);
copy('.github/workflows/ci.yml');

// 3. Icons and the style guide. The generated atlas (assets/spritesheets) and contact sheets are rebuilt by `npm run assets`.
for (const f of ['build/app-icon.svg', 'build/icon.png', 'build/icon-mac.png', 'assets/app-icon.png', 'assets/tray', 'assets/art/STYLE.md']) copy(f);

// 4. Documents. The new design set (docs2/) becomes docs/. Every old numbered plan and note is kept as reference,
//    because the code cites them (FR-n, D-n, "docs/desktop-spike.md"): see docs/reference/README.md (written by hand).
for (const e of readdirSync(path.join(src, 'docs2'), { withFileTypes: true })) {
  if (e.name === 'bootstrap') continue; // this script and the bootstrap notes are handled below
  copy(path.join('docs2', e.name), path.join('docs', e.name), true);
}
copy('docs2/bootstrap', 'docs/bootstrap', true);
for (const e of readdirSync(path.join(src, 'docs'), { withFileTypes: true })) {
  if (e.isFile() && e.name.endsWith('.md')) copy(path.join('docs', e.name), path.join('docs', 'reference', 'fishtank-v1', e.name));
}

// 5. The mailbox files start with the rules only (no history).
function mailboxHead(file, stopAt) {
  const text = readFileSync(path.join(src, file), 'utf8');
  const cut = text.indexOf(stopAt);
  if (cut < 0) throw new Error(`${file}: no "${stopAt}"`);
  return text.slice(0, cut).replaceAll('tuangatech/fish-tank', 'tuangatech/2ndDesktop');
}
const tail = '## The two machines\n\n(Each session describes its own machine here: OS, display, Node, shell, gotchas.)\n\n## Replies\n\n## Requests\n\n## Closed\n';
const mac = mailboxHead('TODO-Mac.md', '## The two machines') + tail;
const win = mailboxHead('TODO-Win.md', '## The Mac machine') + tail;
console.log(`${dryRun ? 'would write' : 'write'} TODO-Mac.md, TODO-Win.md (rules only), NOTICE`);
const notice =
  `2ndDesktop\n\nThe host code, the fish tank scene and the tests were imported on ${new Date().toISOString().slice(0, 10)} from the\n` +
  `fish-tank repository (github.com/tuangatech/fish-tank, now private) at commit ${commit}. Same author, same MIT license.\n` +
  `The art was drawn by an AI tool (SVG written by Claude Code); see the README.\n`;
if (!dryRun) {
  writeFileSync(path.join(dst, 'TODO-Mac.md'), mac);
  writeFileSync(path.join(dst, 'TODO-Win.md'), win);
  writeFileSync(path.join(dst, 'NOTICE'), notice);
}
console.log(`\n${count} files ${dryRun ? 'would be ' : ''}copied from fish-tank at ${commit}.`);
console.log('Not copied on purpose: CLAUDE.md and README.md (rewritten), design-comments.md, TODO history, docs/screenshots, assets/spritesheets, dist, release.');
