import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { HOUR, launch, makeDataDir } from '../../../tests/e2e/helpers.js';

// Steps the scene by simulated time, so a test does not have to wait for the real clock.
const stepScene = `(seconds) => {
  const { fishtank } = window.__scene;
  for (let t = 0; t < seconds; t += 1 / 30) fishtank.update(1 / 30);
}`;

test('a new player collects, feeds both fish fully and is told that everyone is full', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(`(async () => {
      const step = ${stepScene};
      const { scene, repository } = window.__scene;
      // Click the four floating pellets (FR-4).
      for (const e of [...scene.floating.active]) {
        const p = scene.floating.position(e);
        scene.click(p.x, p.y);
      }
      const stashAfterCollect = repository.getStash();
      step(2);
      // Four clicks on the water feed both fish fully (FR-6, FR-8); each fish holds two pellets.
      const layout = scene.layout;
      const drops = [0.2, 0.4, 0.6, 0.8].map((fx) => scene.dropAt(layout.width * fx, layout.height * 0.3).ok);
      step(40);
      // dropAt, not click: after 40 seconds a fish may be at that spot, and a click on a fish only touches it.
      const fifth = scene.dropAt(layout.width * 0.5, layout.height * 0.3);
      return {
        stashAfterCollect,
        drops,
        fifth,
        toast: document.getElementById('toast').textContent,
        stash: repository.getStash(),
        points: repository.getState().fish.map((f) => f.growthPoints),
        shown: [...scene.fishes.values()].map((f) => f.points),
        pellets: scene.food.pellets.length,
        summary: scene.getSummary(),
      };
    })()`);
    expect(result.stashAfterCollect).toBe(4);
    expect(result.drops).toEqual([true, true, true, true]);
    expect(result.fifth).toMatchObject({ ok: false, reason: 'all_full' });
    expect(result.toast).toBe('Everyone is full and happy. Come back later!');
    expect(result.stash).toBe(0);
    expect(result.points).toEqual([40, 40]);
    expect(result.shown).toEqual([40, 40]);
    expect(result.pellets).toBe(0);
    expect(result.summary).toMatchObject({ allFull: true, hungry: 0 });
  } finally {
    await close();
  }
});

test('feed until full stops when the stash runs out and never overfeeds', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(`(async () => {
      const step = ${stepScene};
      const { scene, repository, fishtank } = window.__scene;
      repository.dev.addStash(3); // three pellets for two fish that could take four
      fishtank.onMenu('feedUntilFull');
      const running = scene.getSummary().feeding;
      step(30);
      const first = { running, summary: scene.getSummary(), fullness: repository.getState().fish.map((f) => f.fullness) };
      repository.dev.addStash(30);
      fishtank.onMenu('feedUntilFull');
      step(60);
      return { first, stash: repository.getStash(), fullness: repository.getState().fish.map((f) => f.fullness) };
    })()`);
    expect(result.first.running).toBe(true);
    expect(result.first.summary).toMatchObject({ stash: 0, feeding: false });
    expect(result.first.fullness.reduce((a, b) => a + b, 0)).toBe(3);
    // Topped up: only the one missing pellet was used.
    expect(result.fullness).toEqual([2, 2]);
    expect(result.stash).toBe(29);
  } finally {
    await close();
  }
});

test('a paused tank ends a tray feed with the same numbers as a visible one', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(`(async () => {
      const { scene, repository, fishtank } = window.__scene;
      scene.setVisible(false);
      fishtank.onMenu('collect');
      fishtank.onMenu('feedUntilFull');
      const out = {
        summary: scene.getSummary(),
        points: repository.getState().fish.map((f) => f.growthPoints),
        shown: [...scene.fishes.values()].map((f) => f.points),
        pellets: scene.food.pellets.length,
        floatingSprites: scene.floating.active.length,
      };
      scene.setVisible(true);
      return out;
    })()`);
    expect(result.summary).toMatchObject({ waiting: 0, stash: 0, hungry: 0, allFull: true });
    expect(result.points).toEqual([40, 40]);
    expect(result.shown).toEqual([40, 40]);
    expect(result.pellets).toBe(0);
    expect(result.floatingSprites).toBe(0);
  } finally {
    await close();
  }
});

test('the tray protocol: the scene menu on request and an action from the menu', async () => {
  const { app, page, close } = await launch();
  try {
    const ask = () =>
      app.evaluate(
        ({ BrowserWindow, ipcMain }) =>
          new Promise((resolve) => {
            ipcMain.once('scene:menu', (_event, menu) => resolve(menu));
            BrowserWindow.getAllWindows()[0].webContents.send('scene:menu-request');
          }),
      );
    const first = await ask();
    expect(first).toMatchObject({
      name: 'Tank',
      line: '4 pellets waiting · 0 in the stash · 2 hungry',
    });
    expect(first.diagnostics).toBe('Fish: 2, pellets fed in total: 0');
    expect(first.items.map((item) => item.id)).toEqual(['collect', undefined]);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('scene:action', 'collect'),
    );
    await page.waitForFunction(() => window.__scene.repository.getStash() === 4);
    expect(await ask()).toMatchObject({ line: '4 in the stash · 2 hungry' });
  } finally {
    await close();
  }
});

test('once a day: juvenile on day 3, adult on day 10, the first egg on day 3', async () => {
  const { page, close } = await launch();
  try {
    const days = await page.evaluate(
      ({ HOUR }) => {
        const { scene, repository, clock, fishtank } = window.__scene;
        const original = repository.getState().fish.map((f) => f.id);
        const rows = [];
        scene.setVisible(false); // apply every meal at once
        for (let day = 1; day <= 10; day++) {
          if (day > 1) clock.offset += 24 * HOUR;
          scene.tick();
          fishtank.onMenu('collect');
          fishtank.onMenu('feedUntilFull');
          const state = repository.getState();
          rows.push({
            day,
            points: original.map((id) => state.fish.find((f) => f.id === id).growthPoints),
            eggs: repository.getSummary().eggs,
          });
        }
        scene.setVisible(true);
        return rows;
      },
      { HOUR },
    );
    const at = (day) => days.find((d) => d.day === day);
    expect(at(2).points.every((p) => p < 100)).toBe(true);
    expect(at(3).points.every((p) => p >= 100 && p < 400)).toBe(true);
    expect(at(9).points.every((p) => p < 400)).toBe(true);
    expect(at(10).points.every((p) => p >= 400)).toBe(true);
    expect(at(2).eggs).toBe(0);
    expect(at(3).eggs).toBe(1);
  } finally {
    await close();
  }
});

test('a click goes to a pellet first, then a fish, then the water, and the sand drops nothing', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { scene, repository } = window.__scene;
      const fish = [...scene.fishes.values()];
      // One pellet in the middle with a fish right under it; the other pellets and fish are far away.
      // The clicked pellet is the newest, so the test sees that the clicked one flies, not the oldest.
      const others = scene.floating.active.slice(0, -1);
      const pellet = scene.floating.active.at(-1);
      pellet.fx = 0.5;
      pellet.fy = 0.35;
      others.forEach((e, i) => {
        e.fx = 0.1;
        e.fy = 0.2 + i * 0.1;
      });
      const p = scene.floating.position(pellet);
      fish[0].placeAt(p.x, p.y);
      fish[1].placeAt(scene.layout.width, scene.layout.swim.y);
      const first = scene.click(p.x, p.y);
      const afterPellet = { stash: repository.getStash() };
      const flown = {
        clicked: pellet.state,
        othersStay: others.every((e) => scene.floating.active.includes(e)),
      };
      const second = scene.click(p.x, p.y);
      const afterFish = { stash: repository.getStash() };
      repository.dev.addStash(2);
      // Both fish far from the spot, so the click must reach the water and drop a pellet, not touch a fish.
      fish[0].placeAt(scene.layout.width, scene.layout.swim.y);
      const stashBeforeDrop = repository.getStash();
      const third = scene.click(scene.layout.width * 0.6, scene.layout.height * 0.5);
      const dropCost = stashBeforeDrop - repository.getStash();
      const stashBeforeSand = repository.getStash();
      const sand = scene.click(scene.layout.width * 0.3, scene.layout.sandTop + 5);
      const sandCost = stashBeforeSand - repository.getStash();
      return {
        first,
        afterPellet,
        flown,
        second,
        afterFish,
        third,
        dropCost,
        sand,
        sandCost,
      };
    });
    expect(result.first).toMatchObject({ ok: true, collected: 1 });
    expect(result.afterPellet).toEqual({ stash: 1 });
    expect(result.flown).toEqual({ clicked: 'flying', othersStay: true });
    expect(result.second.touched).toBeTruthy();
    expect(result.afterFish).toEqual({ stash: 1 });
    expect(result.third.ok).toBe(true);
    expect(result.third.touched).toBeUndefined(); // the water, not a fish
    expect(result.dropCost).toBe(1);
    // A click on the sand drops nothing and costs no pellet.
    expect(result.sand).toMatchObject({ ok: false, reason: 'sand' });
    expect(result.sandCost).toBe(0);
  } finally {
    await close();
  }
});

test('a full stash refuses a pellet and says so', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { scene, repository } = window.__scene;
      repository.dev.addStash(30);
      const e = scene.floating.active[0];
      const p = scene.floating.position(e);
      const r = scene.click(p.x, p.y);
      return {
        r,
        toast: document.getElementById('toast').textContent,
        waiting: repository.getState().tank.floatingPellets,
      };
    });
    expect(result.r).toMatchObject({ ok: false, reason: 'stash_full' });
    expect(result.toast).toBe('Stash is full');
    expect(result.waiting).toBe(4);
  } finally {
    await close();
  }
});

test('an egg hatches into a new fish; a full tank keeps the egg', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(`(async () => {
      const step = ${stepScene};
      const { scene, repository } = window.__scene;
      repository.dev.addFed(12);
      const egg = scene.eggs.resting[0];
      const eggsBefore = scene.eggs.resting.length;
      const hit = scene.eggs.hit(egg.sprite.x, egg.sprite.y - 8 * scene.layout.unit);
      const clicked = scene.click(egg.sprite.x, egg.sprite.y - 8 * scene.layout.unit);
      step(2);
      const afterHatch = { fish: repository.getState().fish.length, eggs: scene.eggs.entities.length, sprites: scene.fishes.size };

      // A tank of 8 fish: the egg waits.
      repository.dev.setFish(Array.from({ length: 8 }, () => ({ species: 'tetra', points: 150 })));
      repository.dev.addFed(12);
      const waiting = scene.eggs.resting[0];
      const refused = scene.click(waiting.sprite.x, waiting.sprite.y - 8 * scene.layout.unit);
      step(2);
      return { eggsBefore, hit: Boolean(hit), clicked, afterHatch, refused, toast: document.getElementById('toast').textContent, stillThere: scene.eggs.resting.length, fish: repository.getState().fish.length };
    })()`);
    expect(result.eggsBefore).toBe(1);
    expect(result.hit).toBe(true);
    expect(result.clicked.ok).toBe(true);
    expect(result.afterHatch).toEqual({ fish: 3, eggs: 0, sprites: 3 });
    expect(result.refused).toMatchObject({ ok: false, reason: 'tank_full' });
    expect(result.toast).toBe('The tank is full');
    expect(result.stillThere).toBe(1);
    expect(result.fish).toBe(8);
  } finally {
    await close();
  }
});

test('touching a fish only makes it wiggle: no label, no name', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { scene, repository } = window.__scene;
      // A click goes to an egg first, then a floating pellet, then a fish (FR-46). The pellets float at random
      // places, so one can lie under the fish and take the click: park them far to the left first.
      scene.floating.active.forEach((pellet, i) => {
        pellet.fx = 0.1;
        pellet.fy = 0.2 + i * 0.1;
      });
      const fish = [...scene.fishes.values()][0];
      fish.placeAt(scene.layout.width * 0.5, scene.layout.height * 0.4);
      const before = JSON.stringify(repository.getState());
      const clicked = scene.click(fish.pos.x, fish.pos.y);
      return {
        clicked,
        id: fish.id,
        wiggling: fish.wiggleTimer > 0,
        unchanged: JSON.stringify(repository.getState()) === before,
        hasName: 'name' in fish || repository.getState().fish.some((f) => 'name' in f),
      };
    });
    expect(result.clicked).toMatchObject({ ok: true, touched: result.id });
    expect(result.wiggling).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(result.hasName).toBe(false);
    await expect(page.locator('#label')).toHaveCount(0);
  } finally {
    await close();
  }
});

test('a curious fish comes over to a moving pointer and a shy fish swims away', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(`(async () => {
      const step = ${stepScene};
      const { scene, repository } = window.__scene;
      // Find one seed of each personality.
      const seeds = { curious: null, shy: null };
      for (let seed = 1; seed < 60 && (!seeds.curious || !seeds.shy); seed++) {
        repository.dev.setFish([{ species: 'tetra', seed, points: 150 }]);
        seeds[[...scene.fishes.values()][0].personality] ??= seed;
      }
      const trial = (seed) => {
        repository.dev.setFish([{ species: 'tetra', seed, points: 150 }]);
        const fish = [...scene.fishes.values()][0];
        const c = { x: scene.layout.width * 0.5, y: scene.layout.height * 0.4 };
        fish.placeAt(c.x, c.y);
        fish.vel = { x: 0, y: 0 };
        const pointer = { x: c.x + 70 * scene.layout.unit, y: c.y };
        const before = Math.hypot(pointer.x - fish.pos.x, pointer.y - fish.pos.y);
        for (let t = 0; t < 2.5; t += 1 / 30) {
          // The pointer wiggles a little, so it counts as moving.
          scene.setPointer(pointer.x + Math.sin(t * 6) * 3, pointer.y);
          window.__scene.fishtank.update(1 / 30);
        }
        const after = Math.hypot(pointer.x - fish.pos.x, pointer.y - fish.pos.y);
        const state = fish.reaction.state;
        scene.clearPointer();
        return { before, after, state };
      };
      return { seeds, curious: trial(seeds.curious), shy: trial(seeds.shy) };
    })()`);
    expect(result.seeds.curious).not.toBeNull();
    expect(result.seeds.shy).not.toBeNull();
    expect(result.curious.after).toBeLessThan(result.curious.before - 10);
    expect(['approach', 'follow']).toContain(result.curious.state);
    expect(result.shy.after).toBeGreaterThan(result.shy.before + 10);
    expect(result.shy.state).toBe('flee');
  } finally {
    await close();
  }
});

test.describe('the saved record', () => {
  const readRecord = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

  test('quit and relaunch keeps the fish, the stash, the growth and the eggs', async () => {
    const dataDir = makeDataDir();
    try {
      let saved;
      const first = await launch({ dataDir });
      try {
        saved = await first.page.evaluate(`(async () => {
          const step = ${stepScene};
          const { scene, repository, fishtank } = window.__scene;
          fishtank.onMenu('collect');
          fishtank.onMenu('feed');
          fishtank.onMenu('feed');
          step(20);
          repository.dev.addFed(12);
          return repository.getState();
        })()`);
      } finally {
        await first.close();
      }
      const second = await launch({ dataDir });
      try {
        const loaded = await second.page.evaluate(() => ({
          state: window.__scene.repository.getState(),
          status: window.__scene.repository.status,
          eggs: window.__scene.scene.eggs.resting.length,
          shown: [...window.__scene.scene.fishes.values()].map((f) => f.points),
        }));
        expect(loaded.status).toMatchObject({ source: 'saved', problem: null });
        expect(loaded.state.fish).toEqual(saved.fish);
        expect(loaded.state.tank.stash).toBe(saved.tank.stash);
        expect(loaded.state.tank.totalFed).toBe(saved.tank.totalFed);
        expect(loaded.state.tank.decorSeed).toBe(saved.tank.decorSeed);
        expect(loaded.eggs).toBe(1);
        expect(loaded.shown.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
      } finally {
        await second.close();
      }
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('pellets that appeared while the app was closed are there on the next launch, up to 16', async () => {
    const dataDir = makeDataDir();
    try {
      const first = await launch({ dataDir });
      const file = first.recordFile;
      await first.page.evaluate(() => window.__scene.fishtank.onMenu('collect')); // timer runs from now
      await first.close();

      const record = readRecord(file);
      record.state.tank.pelletsUpdatedAt -= 3 * HOUR;
      fs.writeFileSync(file, JSON.stringify(record));
      const second = await launch({ dataDir });
      const three = await second.page.evaluate(
        () => window.__scene.repository.getState().tank.floatingPellets,
      );
      await second.close();
      expect(three).toBe(3);

      const again = readRecord(file);
      again.state.tank.pelletsUpdatedAt -= 100 * HOUR;
      fs.writeFileSync(file, JSON.stringify(again));
      const third = await launch({ dataDir });
      const sprites = await third.page.evaluate(() => ({
        floating: window.__scene.repository.getState().tank.floatingPellets,
        sprites: window.__scene.scene.floating.active.length,
      }));
      await third.close();
      expect(sprites).toEqual({ floating: 16, sprites: 16 });
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  // Falling back to the backup when only the main file is damaged is covered by store.test.js.
  test('two damaged files start a new tank, say so, and keep the bad file', async () => {
    const dataDir = makeDataDir();
    try {
      // A different seed for the second run, so a new tank is told apart from the old one by its fish ids.
      const run = async (action, seed = '20261121') => {
        const app = await launch({ dataDir, env: { DESKTOP2_SEED: seed } });
        try {
          return await app.page.evaluate(action);
        } finally {
          await app.close();
        }
      };
      const ids = await run(() => window.__scene.repository.getState().fish.map((f) => f.id));
      const recordFile = path.join(dataDir, 'records', 'fishtank.json');
      fs.writeFileSync(recordFile, 'garbage');
      fs.writeFileSync(path.join(dataDir, 'records', 'fishtank.backup.json'), 'garbage too');
      const fresh = await run(
        () => ({
          ids: window.__scene.repository.getState().fish.map((f) => f.id),
          problem: window.__scene.repository.status.problem,
          toast: document.getElementById('toast').textContent,
        }),
        '777',
      );
      expect(fresh.problem).toBe('damaged');
      expect(fresh.ids).not.toEqual(ids);
      expect(fresh.toast).toMatch(/damaged/);
      const kept = fs
        .readdirSync(path.join(dataDir, 'records'))
        .filter((f) => f.includes('.corrupt-'));
      expect(kept).toHaveLength(1);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('a record over a lowered cap is repaired: the fish stay and the original is kept beside it', async () => {
    const dataDir = makeDataDir();
    try {
      // A different seed for the second run, so a new tank is told apart from the old one by its fish ids.
      const run = async (action, seed = '20261121') => {
        const app = await launch({ dataDir, env: { DESKTOP2_SEED: seed } });
        try {
          return await app.page.evaluate(action);
        } finally {
          await app.close();
        }
      };
      const ids = await run(() => window.__scene.repository.getState().fish.map((f) => f.id));
      const records = path.join(dataDir, 'records');
      const file = path.join(records, 'fishtank.json');
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      record.state.tank.stash = 99; // more than the stash holds
      fs.writeFileSync(file, JSON.stringify(record));
      const loaded = await run(() => ({
        ids: window.__scene.repository.getState().fish.map((f) => f.id),
        status: window.__scene.repository.status,
        stash: window.__scene.repository.getStash(),
      }));
      expect(loaded.ids).toEqual(ids);
      expect(loaded.status).toMatchObject({ source: 'saved', problem: 'repaired' });
      expect(loaded.stash).toBe(30);
      const copies = fs.readdirSync(records).filter((f) => f.startsWith('fishtank-damaged-'));
      expect(copies).toHaveLength(1);
      expect(JSON.parse(fs.readFileSync(path.join(records, copies[0]), 'utf8'))).toEqual(record);
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).state.tank.stash).toBe(30);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('a record from a newer version is left alone', async () => {
    const dataDir = makeDataDir();
    try {
      fs.mkdirSync(path.join(dataDir, 'records'), { recursive: true });
      const file = path.join(dataDir, 'records', 'fishtank.json');
      const newer = JSON.stringify({ schemaVersion: 99, state: { from: 'the future' } });
      fs.writeFileSync(file, newer);
      const app = await launch({ dataDir });
      try {
        const result = await app.page.evaluate(() => {
          window.__scene.fishtank.onMenu('collect');
          return window.__scene.repository.status.problem;
        });
        expect(result).toBe('newer');
      } finally {
        await app.close();
      }
      expect(fs.readFileSync(file, 'utf8')).toBe(newer);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
