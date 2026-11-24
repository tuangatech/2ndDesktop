import { expect, test } from '@playwright/test';
import { HOUR, launch } from './helpers.js';

test('three pellets dropped quickly are all eaten before they reach the sand, round after round', async () => {
  const { page, close } = await launch();
  try {
    // Simulated time and fixed drop places and fish, so every run and every system sees the same thing.
    const result = await page.evaluate(
      ({ HOUR }) => {
        const { scene, repository, clock, fishtank } = window.__tank;
        // Four grown fish of mixed species, so each round of three pellets finds hungry fish (a fish holds two).
        const species = Object.keys(scene.art.species);
        repository.dev.setFish(
          Array.from({ length: 4 }, (_, i) => ({
            species: species[i % species.length],
            seed: 6100 + i,
            points: 150 + i,
          })),
        );
        const layout = scene.layout;
        let landed = false;
        const step = (seconds) => {
          for (let t = 0; t < seconds; t += 1 / 30) {
            fishtank.update(1 / 30);
            if (scene.food.pellets.some((p) => p.state === 'resting')) landed = true;
          }
        };
        // Three pellets in the middle part of the tank, about 0.35 seconds apart, at spread-out places.
        const places = [
          [0.25, 0.5, 0.7],
          [0.6, 0.3, 0.45],
          [0.8, 0.2, 0.5],
          [0.35, 0.65, 0.2],
          [0.5, 0.75, 0.3],
        ];
        const rounds = [];
        for (const round of places) {
          const dropped = [];
          for (const fx of round) {
            repository.dev.addStash(1);
            dropped.push(scene.dropAt(layout.width * fx, layout.dropBand.y + 2).ok);
            step(0.35);
          }
          for (let waited = 0; scene.food.pellets.length > 0 && waited < 20; waited += 0.5)
            step(0.5);
          rounds.push({ dropped, remaining: scene.food.pellets.length });
          step(1.5);
          // A day later everyone is hungry again.
          clock.offset += 24 * HOUR;
          scene.tick();
        }
        return { rounds, landed };
      },
      { HOUR },
    );
    for (const round of result.rounds) {
      expect(round.dropped).toEqual([true, true, true]);
      expect(round.remaining).toBe(0);
    }
    expect(result.landed).toBe(false);
  } finally {
    await close();
  }
});

test('fish never leave the tank and swim up and down over a minute of simulated time', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { scene, repository } = window.__tank;
      // Six fish of mixed species and stages instead of the start fish.
      const ids = Object.keys(scene.art.species);
      // Fixed seeds, so every run and every system sees the same fish.
      repository.dev.setFish(
        Array.from({ length: 6 }, (_, i) => ({
          species: ids[i % ids.length],
          seed: 5100 + i,
          points: 100 + i * 60,
        })),
      );
      const layout = scene.layout;
      const swim = layout.swim;
      const env = (fishList) => ({
        layout,
        others: fishList,
        restY: scene.food.restY,
        eat: () => {},
      });
      const fishList = [...scene.fishes.values()];
      const range = new Map(fishList.map((f) => [f.id, { min: Infinity, max: -Infinity }]));
      let outside = 0;
      let overlap = 0;
      let maxPitch = 0;
      const diagonal = { 'up-left': 0, 'up-right': 0, 'down-left': 0, 'down-right': 0 };
      for (let t = 0; t < 120; t += 1 / 30) {
        for (const fish of fishList) {
          fish.update(1 / 30, env(fishList));
          const r = range.get(fish.id);
          r.min = Math.min(r.min, fish.pos.y);
          r.max = Math.max(r.max, fish.pos.y);
          maxPitch = Math.max(maxPitch, Math.abs(fish.pitch));
          // Diagonal swimming: a clear climb or dive while moving sideways, in each of the four directions.
          if (Math.abs(fish.vel.y) > 0.3 * Math.abs(fish.vel.x) && Math.abs(fish.vel.x) > 2) {
            diagonal[`${fish.vel.y < 0 ? 'up' : 'down'}-${fish.vel.x < 0 ? 'left' : 'right'}`]++;
          }
          if (
            fish.pos.x < swim.x - 0.01 ||
            fish.pos.x > swim.x + swim.width + 0.01 ||
            fish.pos.y < swim.y - 0.01 ||
            fish.pos.y > swim.y + swim.height + 0.01
          ) {
            outside++;
          }
        }
        for (let i = 0; i < fishList.length; i++) {
          for (let j = i + 1; j < fishList.length; j++) {
            const a = fishList[i].pos;
            const b = fishList[j].pos;
            if (Math.hypot(a.x - b.x, a.y - b.y) < 6 * layout.unit) overlap++;
          }
        }
      }
      return {
        outside,
        overlapFrames: overlap,
        frames: 120 * 30,
        maxPitchDegrees: (maxPitch * 180) / Math.PI,
        diagonal,
        // How much of its own depth band each fish used.
        travel: fishList.map((f) => {
          const r = range.get(f.id);
          const [low, high] = f.species.depthRange;
          return (r.max - r.min) / swim.height / (high - low);
        }),
      };
    });
    expect(result.outside).toBe(0);
    expect(result.maxPitchDegrees).toBeLessThanOrEqual(25.01);
    // Every fish used at least half of its own depth band, and fish are rarely on top of each other.
    for (const travel of result.travel) expect(travel).toBeGreaterThan(0.5);
    // Fish swim diagonally in all four directions (FR-45), each for at least 5 seconds in total.
    for (const [direction, frames] of Object.entries(result.diagonal)) {
      expect(frames, direction).toBeGreaterThan(150);
    }
    expect(result.overlapFrames / result.frames).toBeLessThan(0.05);
  } finally {
    await close();
  }
});

test('a fish never shrinks back when it eats its pellets in another order than they were dropped', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { scene, repository, fishtank } = window.__tank;
      const species = Object.keys(scene.art.species)[0];
      // One fry 40 points short of a juvenile: two pellets make it one.
      repository.dev.setFish([{ species, seed: 6200, points: 60 }]);
      repository.dev.addStash(2);
      const layout = scene.layout;
      const fish = [...scene.fishes.values()][0];
      // First high in the water, then low, near the sand: the low one is eaten first.
      const high = scene.dropAt(layout.width * 0.5, layout.dropBand.y + 2);
      const low = scene.dropAt(layout.width * 0.5, layout.sandTop - 6 * layout.unit);
      const seen = [];
      for (let t = 0; t < 20 && scene.food.pellets.length > 0; t += 1 / 30) {
        fishtank.update(1 / 30);
        if (seen.at(-1) !== fish.points) seen.push(fish.points);
      }
      return { ok: [high.ok, low.ok], seen, stage: fish.stage, left: scene.food.pellets.length };
    });
    expect(result.ok).toEqual([true, true]);
    expect(result.left).toBe(0);
    expect(result.seen).toEqual([...result.seen].sort((a, b) => a - b));
    expect(result.seen.at(-1)).toBe(100);
    expect(result.stage).toBe('juvenile');
  } finally {
    await close();
  }
});

test('the tray feeds the hungriest fish first, so a fish that swims deep is not left out', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { scene, repository } = window.__tank;
      const species = Object.keys(scene.art.species);
      repository.dev.setFish(
        Array.from({ length: 3 }, (_, i) => ({
          species: species[i % species.length],
          seed: 6300 + i,
        })),
      );
      const fish = [...scene.fishes.values()];
      // One fish right under the surface, the others deep down: a random drop would mostly feed the first.
      fish[0].placeAt(scene.layout.width / 2, scene.layout.swim.y);
      fish[1].placeAt(scene.layout.width * 0.2, scene.layout.sandTop);
      fish[2].placeAt(scene.layout.width * 0.8, scene.layout.sandTop);
      repository.dev.addStash(3);
      const fed = [1, 2, 3].map(() => scene.feedOne({ animate: false }).fish.id);
      return { fed: [...fed].sort(), ids: fish.map((f) => f.id).sort() };
    });
    expect(result.fed).toEqual(result.ids);
  } finally {
    await close();
  }
});

test('hungry fish chasing food keep a little apart', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { scene, repository, fishtank, clock } = window.__tank;
      const species = Object.keys(scene.art.species);
      const layout = scene.layout;
      // The pellet sway uses Math.random: a seeded stand-in makes every run the same.
      const random = Math.random;
      let close = 0;
      let chasing = 0;
      let left = 0;
      for (let seed = 1; seed <= 5; seed++) {
        let s = seed * 7919;
        Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
        repository.dev.setFish(
          Array.from({ length: 8 }, (_, i) => ({
            species: species[i % species.length],
            seed: 6400 + seed * 10 + i,
            points: 150 + i * 30,
          })),
        );
        const fish = [...scene.fishes.values()];
        for (let round = 0; round < 3; round++) {
          // Eight pellets close together in the middle, so the whole crowd swims to the same place.
          for (let i = 0; i < 8; i++) {
            repository.dev.addStash(1);
            scene.dropAt(layout.width * (0.45 + (i % 3) * 0.05), layout.dropBand.y + 2);
          }
          for (let t = 0; t < 15 && scene.food.pellets.length > 0; t += 1 / 30) {
            fishtank.update(1 / 30);
            for (let a = 0; a < fish.length; a++) {
              for (let b = a + 1; b < fish.length; b++) {
                if (fish[a].foodQueue.length === 0 && fish[b].foodQueue.length === 0) continue;
                chasing++;
                const d = Math.hypot(fish[a].pos.x - fish[b].pos.x, fish[a].pos.y - fish[b].pos.y);
                // The bodies overlap: closer than half their mean length.
                const reach =
                  (fish[a].adultLengthPx * fish[a].size + fish[b].adultLengthPx * fish[b].size) / 4;
                if (d < reach) close++;
              }
            }
          }
          left += scene.food.pellets.length;
          clock.offset += 24 * 60 * 60 * 1000; // everyone hungry again
          scene.tick();
        }
      }
      Math.random = random;
      return { closeShare: close / chasing, left };
    });
    // About 3% of the pairs touch near a pellet, where the push fades out so it never stops a fish from eating
    // (3.2% before the push while chasing, 2.9% with it, on the development Mac). A heap would be far more.
    expect(result.closeShare).toBeLessThan(0.05);
    expect(result.left).toBe(0);
  } finally {
    await close();
  }
});
