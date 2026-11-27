import { describe, expect, it } from 'vitest';
import { duration, parsePlaywright, parseVitest, summaryLine } from '../../scripts/verify.mjs';

// `npm run verify` reads the closing lines of Vitest and Playwright; these are the shapes those tools print.
const vitestOk = [
  ' RUN  v4.1.0 C:/work/2ndDesktop',
  '',
  ' Test Files  40 passed (40)',
  '      Tests  490 passed (490)',
  '   Start at  14:18:44',
  '   Duration  1.13s (transform 61%, tests 18%)',
].join('\n');

describe('parseVitest', () => {
  it('reads the number of files and tests', () => {
    expect(parseVitest(vitestOk)).toEqual({ files: 40, tests: 490, failed: 0 });
  });

  it('counts failed tests and reads through colour codes', () => {
    const output = [
      '\u001b[2m Test Files \u001b[22m \u001b[1m\u001b[31m1 failed\u001b[39m\u001b[22m\u001b[90m | \u001b[39m\u001b[1m\u001b[32m39 passed\u001b[39m (40)',
      '\u001b[2m      Tests \u001b[22m \u001b[1m\u001b[31m3 failed\u001b[39m\u001b[22m\u001b[90m | \u001b[39m\u001b[1m\u001b[32m487 passed\u001b[39m (490)',
    ].join('\n');
    expect(parseVitest(output)).toEqual({ files: 40, tests: 490, failed: 3 });
  });

  it('says null when there is no summary (Vitest did not run)', () => {
    expect(parseVitest('sh: vitest: not found')).toBeNull();
  });
});

describe('parsePlaywright', () => {
  it('reads passed and skipped', () => {
    const output = [
      '  ok 52 tests/e2e/x.spec.js:3 (1.2s)',
      '',
      '  1 skipped',
      '  52 passed (3.1m)',
    ].join('\n');
    expect(parsePlaywright(output)).toEqual({ passed: 52, failed: 0, skipped: 1, flaky: 0 });
  });

  it('reads failed and flaky', () => {
    const output = [
      '  1 failed',
      '    tests/e2e/x.spec.js:3 > a test',
      '  1 flaky',
      '  50 passed (4m)',
    ].join('\n');
    expect(parsePlaywright(output)).toEqual({ passed: 50, failed: 1, skipped: 0, flaky: 1 });
  });

  it('says null when no test ran', () => {
    expect(parsePlaywright('Error: no tests found')).toBeNull();
  });
});

describe('summaryLine and duration', () => {
  it('prints the same line every time', () => {
    const line = summaryLine({
      unit: { files: 40, tests: 490, failed: 0 },
      e2e: { passed: 52, failed: 0, skipped: 1, flaky: 0 },
      quick: false,
      ms: 130_000,
    });
    expect(line).toBe(
      'verify: lint ok, format ok, 40 files / 490 unit, 52 e2e (1 skipped), 2m 10s',
    );
  });

  it('leaves the e2e out of a quick run', () => {
    const line = summaryLine({
      unit: { files: 40, tests: 490, failed: 0 },
      quick: true,
      ms: 9_000,
    });
    expect(line).toBe('verify: lint ok, format ok, 40 files / 490 unit, 9s');
  });

  it('shows a flaky test in the line (a test that needed its retry is not hidden)', () => {
    const line = summaryLine({
      unit: { files: 1, tests: 2, failed: 0 },
      e2e: { passed: 5, failed: 0, skipped: 0, flaky: 1 },
      quick: false,
      ms: 1000,
    });
    expect(line).toContain('5 e2e (1 flaky)');
  });

  it('formats a duration', () => {
    expect(duration(4_400)).toBe('4s');
    expect(duration(65_000)).toBe('1m 05s');
  });
});
