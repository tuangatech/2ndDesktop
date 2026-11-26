// One command for the proofs of every PR (docs/bootstrap/BOOTSTRAP.md section 7.3 and 9, point 6): lint, format check,
// unit tests, then the end-to-end suite (`npm run test:e2e` builds first). It stops at the first step that fails,
// prints the end of that step's output, and prints the same one line every time, so a PR text and a mailbox reply
// quote the same thing:
//   verify: lint ok, format ok, 40 files / 490 unit, 52 e2e (1 skipped), 2m 10s
// Usage: npm run verify            all steps
//        npm run verify -- --quick  lint, format and unit tests only (no build, no e2e)
// What it does not check: the golden hash and the two pictures. The golden hash is part of the e2e suite; the pictures
// are `npm run shot` (BOOTSTRAP 7.1) and are compared by hand, on the same machine.
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// eslint-disable-next-line no-control-regex -- the escape character of colour codes is what is removed
const ANSI = /\u001b\[[0-9;]*m/g;
const clean = (text) => text.replace(ANSI, '');

/**
 * Vitest's summary lines: "Test Files  1 failed | 39 passed (40)" and "Tests  3 failed | 487 passed (490)".
 * @param {string} output
 * @returns {{files: number, tests: number, failed: number}|null}
 */
export function parseVitest(output) {
  const text = clean(output);
  const files = /Test Files\s+([^\n]*?)\((\d+)\)/.exec(text);
  const tests = /^\s*Tests\s+([^\n]*?)\((\d+)\)/m.exec(text);
  if (!files || !tests) return null;
  const count = (part, word) => Number(new RegExp(`(\\d+) ${word}`).exec(part)?.[1] ?? 0);
  return { files: Number(files[2]), tests: Number(tests[2]), failed: count(tests[1], 'failed') };
}

/**
 * Playwright's closing lines of the list reporter: "  1 skipped", "  52 passed (3.1m)", "  2 failed", "  1 flaky".
 * @param {string} output
 * @returns {{passed: number, failed: number, skipped: number, flaky: number}|null}
 */
export function parsePlaywright(output) {
  const text = clean(output);
  const get = (word) => Number(new RegExp(`^\\s*(\\d+) ${word}\\b`, 'm').exec(text)?.[1] ?? 0);
  const result = {
    passed: get('passed'),
    failed: get('failed'),
    skipped: get('skipped'),
    flaky: get('flaky'),
  };
  return result.passed + result.failed + result.skipped + result.flaky === 0 ? null : result;
}

/** @param {number} ms */
export function duration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/**
 * The one line.
 * @param {{unit?: ReturnType<typeof parseVitest>, e2e?: ReturnType<typeof parsePlaywright>, quick: boolean, ms: number}} r
 */
export function summaryLine({ unit, e2e, quick, ms }) {
  const parts = ['lint ok', 'format ok'];
  if (unit) parts.push(`${unit.files} files / ${unit.tests} unit`);
  if (!quick && e2e) {
    const extra = [
      e2e.skipped && `${e2e.skipped} skipped`,
      e2e.flaky && `${e2e.flaky} flaky`,
    ].filter(Boolean);
    parts.push(`${e2e.passed} e2e${extra.length ? ` (${extra.join(', ')})` : ''}`);
  }
  parts.push(duration(ms));
  return `verify: ${parts.join(', ')}`;
}

/** Runs `npm run <script>` the way the shell would, without a shell: through the npm that started this script. */
function npmRun(script) {
  const npmCli = process.env.npm_execpath;
  // Started by `node scripts/verify.mjs` there is no npm to borrow: one command string through the shell (npm is a
  // .cmd file on Windows).
  const [command, args, shell] = npmCli
    ? [process.execPath, [npmCli, 'run', script], false]
    : [`npm run ${script}`, [], true];
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', (error) => resolve({ code: 1, output: output + String(error) }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function main() {
  const quick = process.argv.includes('--quick');
  const steps = [
    { name: 'lint', script: 'lint' },
    { name: 'format', script: 'format:check' },
    { name: 'unit', script: 'test', parse: parseVitest },
    ...(quick ? [] : [{ name: 'e2e', script: 'test:e2e', parse: parsePlaywright }]),
  ];
  const began = Date.now();
  const parsed = {};
  for (const step of steps) {
    const stepBegan = Date.now();
    const { code, output } = await npmRun(step.script);
    const result = step.parse?.(output) ?? null;
    const failed = code !== 0 || (result && result.failed > 0);
    if (failed || (step.parse && !result)) {
      console.log(
        `verify: ${step.name} FAILED (npm run ${step.script}, exit ${code}). The end of its output:\n`,
      );
      console.log(clean(output).trimEnd().split('\n').slice(-60).join('\n'));
      process.exitCode = 1;
      return;
    }
    if (step.parse) parsed[step.name] = result;
    console.log(`  ${step.name} ok (${duration(Date.now() - stepBegan)})`);
  }
  console.log(summaryLine({ unit: parsed.unit, e2e: parsed.e2e, quick, ms: Date.now() - began }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
