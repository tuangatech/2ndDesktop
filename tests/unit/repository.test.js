import { describe, expect, it } from 'vitest';
import { config } from '../../scenes/fishtank/config.js';
import { makeRng } from '../../shared/rng.js';
import {
  SCHEMA_VERSION,
  createLocalRepository,
  migrate,
  repairState,
} from '../../scenes/fishtank/repo/LocalTankRepository.js';

const H = 60 * 60 * 1000;
const T0 = 1_790_000_000_000;
const speciesIds = ['tetra', 'guppy', 'angelfish'];

/** An in-memory stand-in for the main process: keeps the last record that was saved. */
function fakeStorage(initial = { status: 'missing' }) {
  const box = { result: initial, saves: [], copies: [] };
  return {
    box,
    load: async () => box.result,
    keepCopy: (record) => box.copies.push(structuredClone(record)),
    save(record) {
      box.saves.push(record);
      box.result = { status: 'ok', data: structuredClone(record) };
    },
  };
}

function setup({ storage = fakeStorage(), start = T0, seed = 1 } = {}) {
  const clock = { time: start, now: () => clock.time };
  const repo = createLocalRepository({
    storage,
    clock,
    rng: makeRng(seed),
    config,
    speciesIds,
  });
  return { repo, clock, storage };
}

describe('load', () => {
  it('starts a new tank when nothing was saved, and saves it at once', async () => {
    const { repo, storage } = setup();
    await repo.load();
    const state = repo.getState();
    expect(repo.status).toMatchObject({ source: 'new', problem: null });
    expect(state.fish).toHaveLength(2);
    expect(state.tank.floatingPellets).toBe(4);
    expect(storage.box.saves).toHaveLength(1);
    expect(storage.box.saves[0].schemaVersion).toBe(SCHEMA_VERSION);
  });

  // Also covers D1: a pellet that was dropped (fed) just before quitting is neither lost nor fed twice.
  it('gives the same state after a reload', async () => {
    const first = setup();
    await first.repo.load();
    first.repo.collect(4);
    const fishId = first.repo.getState().fish[0].id;
    first.repo.feed(fishId);
    first.repo.renameFish(fishId, 'Bubbles');
    const saved = first.repo.getState();

    const second = setup({ storage: first.storage });
    await second.repo.load();
    expect(second.repo.status.source).toBe('saved');
    expect(second.repo.getState()).toEqual(saved);
  });

  it('catches up after 3 hours closed: three more pellets', async () => {
    const first = setup();
    await first.repo.load();
    first.repo.collect(4); // the tank is empty, the timer runs from T0
    const second = setup({ storage: first.storage, start: T0 + 3 * H });
    await second.repo.load();
    expect(second.repo.getState().tank.floatingPellets).toBe(3);
  });

  it('starts a new tank when the record is damaged', async () => {
    const { repo } = setup({ storage: fakeStorage({ status: 'corrupt', movedTo: 'x' }) });
    await repo.load();
    expect(repo.status).toMatchObject({ source: 'new', problem: 'damaged' });
    expect(repo.getState().fish).toHaveLength(2);
  });

  it('treats a record of the wrong shape as damaged, and keeps a copy of it', async () => {
    const bad = { status: 'ok', data: { schemaVersion: 1, state: { fish: 'many' } } };
    const storage = fakeStorage(bad);
    const { repo } = setup({ storage });
    await repo.load();
    expect(repo.status.problem).toBe('damaged');
    expect(storage.box.copies).toEqual([bad.data]);
  });

  // A later build or tuning.json may lower a cap; the player's fish must survive that (it used to start a new tank).
  it('repairs a record with a count over a lowered cap and keeps the fish, saving a copy of the original', async () => {
    const first = setup();
    await first.repo.load();
    const fishId = first.repo.getState().fish[0].id;
    first.repo.dev.setPoints(fishId, 300);
    first.repo.dev.addStash(25);
    const original = first.storage.box.result.data;

    const storage = fakeStorage({ status: 'ok', data: structuredClone(original) });
    const lowered = { ...config, pellets: { ...config.pellets, maxStash: 10 } };
    const clock = { now: () => T0 };
    const repo = createLocalRepository({
      storage,
      clock,
      rng: makeRng(2),
      config: lowered,
      speciesIds,
    });
    await repo.load();
    expect(repo.status).toMatchObject({ source: 'saved', problem: 'repaired' });
    expect(repo.status.fixes).toEqual(['stash 25 -> 10']);
    expect(repo.getState().fish.map((f) => f.id)).toEqual(original.state.fish.map((f) => f.id));
    expect(repo.getState().fish[0].growthPoints).toBe(300);
    expect(repo.getState().tank.stash).toBe(10);
    expect(storage.box.copies).toEqual([original]);
    expect(storage.box.saves.at(-1).state.tank.stash).toBe(10); // the repaired record is saved at once
  });

  it('loads a clean record without repairs, copies or saves', async () => {
    const first = setup();
    await first.repo.load();
    const storage = fakeStorage(first.storage.box.result);
    const { repo } = setup({ storage });
    await repo.load();
    expect(repo.status).toEqual({ source: 'saved', problem: null, fixes: [] });
    expect(storage.box.copies).toHaveLength(0);
    expect(storage.box.saves).toHaveLength(0);
  });

  it('shows a fresh tank for a record from a newer version and never overwrites it', async () => {
    const newer = { status: 'ok', data: { schemaVersion: 99, state: { anything: true } } };
    const storage = fakeStorage(newer);
    const { repo } = setup({ storage });
    await repo.load();
    expect(repo.status.problem).toBe('newer');
    repo.collect(4);
    repo.feed(repo.getState().fish[0].id);
    expect(storage.box.saves).toHaveLength(0);
    expect(storage.box.result.data.schemaVersion).toBe(99);
  });
});

describe('actions', () => {
  it('save after every successful action and not after a refused one', async () => {
    const { repo, storage } = setup();
    await repo.load();
    const before = storage.box.saves.length;
    expect(repo.collect(2).ok).toBe(true);
    expect(storage.box.saves.length).toBe(before + 1);
    expect(repo.feed('nobody').ok).toBe(false);
    expect(storage.box.saves.length).toBe(before + 1);
  });

  it('notify the subscribers once per change, saying what changed', async () => {
    const { repo } = setup();
    await repo.load();
    const events = [];
    const stop = repo.subscribe((event) => events.push(event));
    const fishId = repo.getState().fish[0].id;
    repo.collect(2);
    repo.feed(fishId);
    repo.feed('nobody');
    repo.renameFish(fishId, 'Bubbles');
    repo.dev.addFed(12);
    const hatched = repo.hatchEgg();
    expect(events).toEqual([
      { type: 'collect', collected: 2 },
      { type: 'feed', fishId, pointsAfter: 20 },
      { type: 'rename', fishId },
      { type: 'dev' },
      { type: 'hatch', fishId: hatched.fish.id },
    ]);
    stop();
    repo.collect(1);
    expect(events).toHaveLength(5);
  });
});

describe('tick', () => {
  it('adds the pellets that appeared and tells the subscribers, but does not save', async () => {
    const { repo, clock, storage } = setup();
    await repo.load();
    repo.collect(4);
    const saves = storage.box.saves.length;
    let events = 0;
    repo.subscribe(() => events++);
    clock.time += 59 * 60_000;
    expect(repo.tick()).toBe(false);
    clock.time += 2 * 60_000;
    expect(repo.tick()).toBe(true);
    expect(repo.getState().tank.floatingPellets).toBe(1);
    expect(events).toBe(1);
    expect(storage.box.saves.length).toBe(saves);
  });

  it('lets fullness decay', async () => {
    const { repo, clock } = setup();
    await repo.load();
    repo.collect(4);
    const id = repo.getState().fish[0].id;
    repo.feed(id);
    repo.feed(id);
    expect(repo.isFull(id)).toBe(true);
    clock.time += 12 * H;
    expect(repo.tick()).toBe(true);
    expect(repo.isFull(id)).toBe(false);
  });
});

describe('repairState and migrate', () => {
  const good = () => ({
    localPlayerId: 'p',
    tank: {
      floatingPellets: 4,
      pelletsUpdatedAt: T0,
      stash: 0,
      totalFed: 0,
      eggsClaimed: 0,
      decorSeed: 5,
      hintShown: false,
    },
    fish: [
      {
        id: 'a',
        species: 'tetra',
        seed: 1,
        name: 'Bubbles',
        growthPoints: 120,
        fullness: 0,
        fullnessUpdatedAt: T0,
        lastFedAt: null,
        createdAt: T0,
      },
    ],
  });
  const repair = (state) =>
    repairState(state, { config, speciesIds, now: T0 + 1, rng: makeRng(3) });

  it('leaves a good state as it is', () => {
    expect(repair(good())).toEqual({ state: good(), fixes: [] });
  });

  it('clamps counts into their caps and fills missing values, keeping the fish', () => {
    const cases = [
      [(s) => (s.tank.floatingPellets = 17), (r) => r.tank.floatingPellets === 16],
      [(s) => (s.tank.stash = 31), (r) => r.tank.stash === 30],
      [(s) => (s.tank.stash = -1), (r) => r.tank.stash === 0],
      [(s) => (s.tank.stash = 'x'), (r) => r.tank.stash === 0],
      [(s) => (s.fish[0].fullness = 3), (r) => r.fish[0].fullness === 2],
      [(s) => (s.fish[0].growthPoints = 1.5), (r) => r.fish[0].growthPoints === 1],
      [(s) => (s.fish[0].name = 'x'.repeat(17)), (r) => r.fish[0].name === 'x'.repeat(16)],
      [(s) => (s.fish[0].name = 5), (r) => r.fish[0].name === null],
      [(s) => delete s.fish[0].createdAt, (r) => r.fish[0].createdAt === T0 + 1],
      [(s) => delete s.tank.pelletsUpdatedAt, (r) => r.tank.pelletsUpdatedAt === T0 + 1],
      [(s) => delete s.tank.decorSeed, (r) => Number.isInteger(r.tank.decorSeed)],
      [(s) => delete s.localPlayerId, (r) => /^[0-9a-f]{32}$/.test(r.localPlayerId)],
    ];
    for (const [mutate, check] of cases) {
      const state = good();
      mutate(state);
      const result = repair(state);
      expect(result.fixes.length, String(mutate)).toBeGreaterThan(0);
      expect(check(result.state), String(mutate)).toBe(true);
      expect(result.state.fish[0]).toMatchObject({ id: 'a', growthPoints: expect.any(Number) });
    }
  });

  it('gives a fish of a species that no longer exists a known one, with its growth and name', () => {
    const state = good();
    state.fish[0].species = 'shark';
    const { state: fixed, fixes } = repair(state);
    expect(speciesIds).toContain(fixed.fish[0].species);
    expect(fixed.fish[0]).toMatchObject({ id: 'a', name: 'Bubbles', growthPoints: 120 });
    expect(fixes).toHaveLength(1);
  });

  it('drops only fish without a usable id, keeps fish over a lowered maxFish, and never leaves the tank empty', () => {
    const state = good();
    state.fish.push({ ...state.fish[0] }, null, { ...state.fish[0], id: 'b' }); // a duplicate id, junk, a good one
    expect(repair(state).state.fish.map((f) => f.id)).toEqual(['a', 'b']);

    const many = good();
    many.fish = Array.from({ length: 9 }, (_, i) => ({ ...many.fish[0], id: `f${i}` }));
    expect(repair(many)).toMatchObject({ fixes: [] });
    expect(repair(many).state.fish).toHaveLength(9);

    const empty = good();
    empty.fish = [null];
    const { state: refilled } = repair(empty);
    expect(refilled.fish).toHaveLength(2);
    expect(refilled.fish.every((f) => f.growthPoints === 0)).toBe(true);
  });

  it('gives up only when there is no tank at all', () => {
    for (const bad of [
      null,
      'x',
      { fish: [] },
      { tank: {}, fish: 'many' },
      { tank: null, fish: [] },
    ]) {
      expect(repair(bad)).toBe(null);
    }
  });

  it('migrate passes version 1 through and refuses newer and broken records', () => {
    const state = good();
    expect(migrate({ schemaVersion: 1, state })).toEqual({ ok: true, state });
    expect(migrate({ schemaVersion: 2, state })).toEqual({ ok: false, reason: 'newer' });
    expect(migrate({ schemaVersion: 0, state })).toEqual({ ok: false, reason: 'bad' });
    expect(migrate(null)).toEqual({ ok: false, reason: 'bad' });
    expect(migrate({ state })).toEqual({ ok: false, reason: 'bad' });
  });
});
