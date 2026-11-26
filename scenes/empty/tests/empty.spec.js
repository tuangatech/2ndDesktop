import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launch, makeDataDir } from '../../../tests/e2e/helpers.js';

// The empty scene runs in the real app when settings.json names it, keeps its own record, and leaves the tank's alone.
test('the empty scene starts from settings.json, counts its starts and never touches the tank record', async () => {
  const dir = makeDataDir();
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ activeScene: 'empty' }));
  const emptyRecord = path.join(dir, 'records', 'empty.json');
  const tankRecord = path.join(dir, 'records', 'fishtank.json');
  try {
    const first = await launch({ dataDir: dir });
    expect(await first.page.evaluate(() => window.__scene.state())).toEqual({
      schema: 1,
      opened: 1,
    });
    await first.close();
    expect(JSON.parse(fs.readFileSync(emptyRecord, 'utf8'))).toEqual({ schema: 1, opened: 1 });

    const second = await launch({ dataDir: dir });
    expect(await second.page.evaluate(() => window.__scene.state())).toEqual({
      schema: 1,
      opened: 2,
    });
    await second.close();
    expect(JSON.parse(fs.readFileSync(emptyRecord, 'utf8')).opened).toBe(2);
    expect(fs.existsSync(tankRecord)).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
