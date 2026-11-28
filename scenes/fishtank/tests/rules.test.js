import { describe, expect, it } from 'vitest';
import { applyTuning, config } from '../game/config.js';
import {
  collect,
  eggsAvailable,
  feed,
  hatchEgg,
  canEat,
  isDrowsy,
  newFish,
  newTankState,
  settleFish,
  settlePellets,
  sizeOf,
  stageOf,
  summarize,
} from '../game/rules.js';
import { makeRng } from '../../../shared/rng.js';

const H = 60 * 60 * 1000;
const T0 = 1_790_000_000_000;
const SPECIES = ['tetra', 'guppy', 'angelfish'];

const fishAt = (overrides = {}) => ({
  id: 'f1',
  species: 'tetra',
  seed: 1,
  growthPoints: 0,
  mealsAt: [],
  lastFedAt: null,
  createdAt: T0,
  ...overrides,
});
const stateWith = (tank = {}, fish = [fishAt()]) => ({
  localPlayerId: 'p',
  tank: {
    floatingPellets: 0,
    pelletsUpdatedAt: T0,
    stash: 0,
    totalFed: 0,
    eggsClaimed: 0,
    decorSeed: 1,
    hintShown: false,
    ...tank,
  },
  fish,
});
const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe('stageOf', () => {
  it('changes at 100 and 400 points', () => {
    expect(stageOf(0)).toBe('fry');
    expect(stageOf(99)).toBe('fry');
    expect(stageOf(100)).toBe('juvenile');
    expect(stageOf(399)).toBe('juvenile');
    expect(stageOf(400)).toBe('adult');
    expect(stageOf(1000)).toBe('adult');
  });
});

describe('sizeOf', () => {
  it('starts at half the adult size and reaches full size at 400 points', () => {
    expect(sizeOf(0)).toBe(0.5);
    expect(sizeOf(200)).toBe(0.75);
    expect(sizeOf(400)).toBe(1);
    expect(sizeOf(900)).toBe(1);
  });

  it('never goes below the fry size for bad input', () => {
    expect(sizeOf(-10)).toBe(0.5);
  });
});

describe('settlePellets', () => {
  const tank = (floatingPellets, minutesAgo = 0) => ({
    floatingPellets,
    pelletsUpdatedAt: T0 - minutesAgo * 60_000,
  });

  it('adds none before 60 minutes and one at 60 minutes', () => {
    expect(settlePellets(tank(0, 59), T0).floatingPellets).toBe(0);
    expect(settlePellets(tank(0, 60), T0).floatingPellets).toBe(1);
  });

  it('adds 5 after 5 hours', () => {
    expect(settlePellets(tank(0, 300), T0).floatingPellets).toBe(5);
  });

  it('is capped at 16 after a day, with 24 spawned', () => {
    const result = settlePellets(tank(0, 24 * 60), T0);
    expect(result.floatingPellets).toBe(16);
    expect(result.lost).toBe(8);
  });

  it('keeps the remainder: 150 minutes gives 2 pellets and 30 minutes toward the next', () => {
    const result = settlePellets(tank(0, 150), T0);
    expect(result.floatingPellets).toBe(2);
    expect(T0 - result.pelletsUpdatedAt).toBe(30 * 60_000);
  });

  it('banks nothing when the tank is full', () => {
    const result = settlePellets(tank(16, 600), T0);
    expect(result.floatingPellets).toBe(16);
    expect(result.pelletsUpdatedAt).toBe(T0);
  });

  it('does not gain pellets when the clock goes backwards, then spawns normally again', () => {
    const back = settlePellets(tank(3, -120), T0);
    expect(back.floatingPellets).toBe(3);
    expect(back.pelletsUpdatedAt).toBe(T0);
    const later = settlePellets(
      { floatingPellets: 3, pelletsUpdatedAt: back.pelletsUpdatedAt },
      T0 + 2 * H,
    );
    expect(later.floatingPellets).toBe(5);
  });
});

describe('settleFish and canEat', () => {
  const MEAL = 2; // meals.perFishPerDay

  it('lets a meal age out 24 hours after it was taken, and not before', () => {
    const fish = fishAt({ mealsAt: [T0, T0 + 3 * H] });
    expect(settleFish(fish, T0 + 23 * H).mealsAt).toEqual([T0, T0 + 3 * H]);
    expect(settleFish(fish, T0 + 24 * H).mealsAt).toEqual([T0 + 3 * H]);
    expect(settleFish(fish, T0 + 27 * H).mealsAt).toEqual([]);
  });

  it('gives back the same object when nothing has aged out', () => {
    const fish = fishAt({ mealsAt: [T0] });
    expect(settleFish(fish, T0 + H)).toBe(fish);
  });

  it('drops a meal stamped later than now (the clock went backwards)', () => {
    const fish = fishAt({ mealsAt: [T0 + 5 * H] });
    expect(settleFish(fish, T0).mealsAt).toEqual([]);
    expect(canEat(fish, T0)).toBe(true);
  });

  it('lets a fish eat at any hour until it has had its meals for the last 24 hours', () => {
    expect(config.meals.perFishPerDay).toBe(MEAL);
    expect(canEat(fishAt(), T0)).toBe(true);
    expect(canEat(fishAt({ mealsAt: [T0] }), T0 + H)).toBe(true);
    const fed = fishAt({ mealsAt: [T0, T0 + H] });
    expect(canEat(fed, T0 + 2 * H)).toBe(false);
    expect(canEat(fed, T0 + 23 * H)).toBe(false);
    expect(canEat(fed, T0 + 24 * H)).toBe(true); // the first meal has aged out
  });
});

describe('isDrowsy', () => {
  it('is drowsy only after 36 hours without food', () => {
    const fish = fishAt({ lastFedAt: T0 });
    expect(isDrowsy(fish, T0 + 36 * H)).toBe(false);
    expect(isDrowsy(fish, T0 + 36 * H + 1)).toBe(true);
  });

  it('counts a never-fed fish from its creation, and feeding clears it', () => {
    const fish = fishAt();
    expect(isDrowsy(fish, T0 + 37 * H)).toBe(true);
    const fed = feed(stateWith({ stash: 1 }, [fish]), 'f1', T0 + 37 * H);
    expect(isDrowsy(fed.state.fish[0], T0 + 37 * H)).toBe(false);
  });
});

describe('collect', () => {
  it('moves pellets from the tank to the stash', () => {
    const result = collect(stateWith({ floatingPellets: 4 }), 3, T0);
    expect(result.ok).toBe(true);
    expect(result.collected).toBe(3);
    expect(result.state.tank.floatingPellets).toBe(1);
    expect(result.state.tank.stash).toBe(3);
  });

  it('settles the pellets that appeared in the meantime', () => {
    const result = collect(stateWith({ floatingPellets: 1 }), 99, T0 + 3 * H);
    expect(result.collected).toBe(4);
  });

  it('collects only what fits when the stash has less room', () => {
    const result = collect(stateWith({ floatingPellets: 10, stash: 27 }), 10, T0);
    expect(result.collected).toBe(3);
    expect(result.state.tank.stash).toBe(30);
    expect(result.state.tank.floatingPellets).toBe(7);
  });

  it('refuses when the stash is full or nothing is waiting', () => {
    expect(collect(stateWith({ floatingPellets: 5, stash: 30 }), 1, T0)).toEqual({
      ok: false,
      reason: 'stash_full',
    });
    expect(collect(stateWith({ floatingPellets: 0 }), 1, T0)).toEqual({
      ok: false,
      reason: 'none_available',
    });
  });

  it('starts the spawn timer at the moment of collecting from a full tank', () => {
    const result = collect(
      stateWith({ floatingPellets: 16, pelletsUpdatedAt: T0 - 50 * H }),
      1,
      T0,
    );
    expect(result.state.tank.floatingPellets).toBe(15);
    expect(result.state.tank.pelletsUpdatedAt).toBe(T0);
  });
});

describe('feed', () => {
  it('costs a pellet, gives 20 points and counts the meal', () => {
    const result = feed(stateWith({ stash: 3 }), 'f1', T0 + H);
    expect(result.ok).toBe(true);
    const [fish] = result.state.fish;
    expect(fish.mealsAt).toEqual([T0 + H]);
    expect(fish.growthPoints).toBe(20);
    expect(fish.lastFedAt).toBe(T0 + H);
    expect(result.state.tank.stash).toBe(2);
    expect(result.state.tank.totalFed).toBe(1);
  });

  it('takes a second meal at once, and refuses a third until the first has aged out', () => {
    let state = stateWith({ stash: 5 });
    state = feed(state, 'f1', T0).state;
    state = feed(state, 'f1', T0 + 1000).state;
    expect(state.fish[0].mealsAt).toEqual([T0, T0 + 1000]);
    expect(feed(state, 'f1', T0 + 2000)).toEqual({ ok: false, reason: 'enough_today' });
    expect(feed(state, 'f1', T0 + 24 * H - 1)).toEqual({ ok: false, reason: 'enough_today' });
    const later = feed(state, 'f1', T0 + 24 * H);
    expect(later.ok).toBe(true);
    expect(later.state.fish[0].mealsAt).toEqual([T0 + 1000, T0 + 24 * H]);
  });

  it('counts the limit for each fish on its own', () => {
    let state = stateWith({ stash: 9 }, [fishAt({ id: 'a' }), fishAt({ id: 'b' })]);
    state = feed(feed(state, 'a', T0).state, 'a', T0).state;
    expect(feed(state, 'a', T0).ok).toBe(false);
    expect(feed(state, 'b', T0).ok).toBe(true);
  });

  it('refuses an empty stash and an unknown fish', () => {
    expect(feed(stateWith({ stash: 0 }), 'f1', T0)).toEqual({ ok: false, reason: 'stash_empty' });
    expect(feed(stateWith({ stash: 1 }), 'nope', T0)).toEqual({
      ok: false,
      reason: 'unknown_fish',
    });
  });
});

describe('eggs', () => {
  it('appear for every 12 pellets fed', () => {
    expect(eggsAvailable({ totalFed: 11, eggsClaimed: 0 })).toBe(0);
    expect(eggsAvailable({ totalFed: 12, eggsClaimed: 0 })).toBe(1);
    expect(eggsAvailable({ totalFed: 24, eggsClaimed: 0 })).toBe(2);
    expect(eggsAvailable({ totalFed: 24, eggsClaimed: 5 })).toBe(0);
  });

  it('hatch into a new fish and use up the egg', () => {
    const state = stateWith({ totalFed: 12 });
    const fry = newFish(T0, makeRng(1), SPECIES);
    const result = hatchEgg(state, fry, T0);
    expect(result.ok).toBe(true);
    expect(result.state.fish).toHaveLength(2);
    expect(result.state.tank.eggsClaimed).toBe(1);
    expect(hatchEgg(result.state, fry, T0)).toEqual({ ok: false, reason: 'no_egg' });
  });

  it('wait while the tank holds 8 fish, and work again when there is room', () => {
    const rng = makeRng(2);
    const eight = Array.from({ length: 8 }, () => newFish(T0, rng, SPECIES));
    const full = stateWith({ totalFed: 12 }, eight);
    expect(hatchEgg(full, newFish(T0, rng, SPECIES), T0)).toEqual({
      ok: false,
      reason: 'tank_full',
    });
    const seven = { ...full, fish: eight.slice(1) };
    expect(hatchEgg(seven, newFish(T0, rng, SPECIES), T0).ok).toBe(true);
  });
});

describe('newTankState', () => {
  it('has 2 fry of different species, 4 floating pellets and an empty stash', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = newTankState(T0, makeRng(seed), SPECIES);
      expect(state.fish).toHaveLength(2);
      expect(state.fish[0].species).not.toBe(state.fish[1].species);
      expect(state.fish.every((f) => f.growthPoints === 0)).toBe(true);
      expect(state.tank.floatingPellets).toBe(4);
      expect(state.tank.stash).toBe(0);
    }
  });

  it('gives each fish its own id and seed', () => {
    const state = newTankState(T0, makeRng(3), SPECIES);
    expect(state.fish[0].id).not.toBe(state.fish[1].id);
    expect(state.fish[0].seed).not.toBe(state.fish[1].seed);
  });
});

describe('summarize', () => {
  it('describes the tank for the menu', () => {
    const state = stateWith({ floatingPellets: 2, stash: 5, totalFed: 12 }, [
      fishAt({ id: 'a', mealsAt: [T0, T0] }),
      fishAt({ id: 'b', mealsAt: [T0] }),
    ]);
    expect(summarize(state, T0, config)).toEqual({
      waiting: 2,
      stash: 5,
      stashFull: false,
      canFeed: true,
      fishCount: 2,
      eggs: 1,
      eggReady: true,
    });
  });

  it('says that nobody can be fed while every fish has had its meals, and again after a day', () => {
    const state = stateWith({}, [fishAt({ mealsAt: [T0, T0] })]);
    expect(summarize(state, T0).canFeed).toBe(false);
    expect(summarize(state, T0 + 24 * H).canFeed).toBe(true);
  });
});

describe('purity', () => {
  it('never changes the state it is given', () => {
    const state = deepFreeze(stateWith({ floatingPellets: 3, stash: 4, totalFed: 12 }));
    const fry = Object.freeze(newFish(T0, makeRng(5), SPECIES));
    expect(() => {
      collect(state, 2, T0 + H);
      feed(state, 'f1', T0 + H);
      hatchEgg(state, fry, T0);
      summarize(state, T0 + 5 * H);
    }).not.toThrow();
  });
});

describe('applyTuning', () => {
  it('applies known numbers inside their range and ignores everything else', () => {
    const {
      config: tuned,
      applied,
      ignored,
    } = applyTuning(config, {
      'pellets.spawnIntervalMs': 600_000,
      'pellets.maxFloating': 9999,
      'growth.nonsense': 3,
      'fullness.max': 'two',
    });
    expect(tuned.pellets.spawnIntervalMs).toBe(600_000);
    expect(tuned.pellets.maxFloating).toBe(16);
    expect(applied).toEqual(['pellets.spawnIntervalMs']);
    expect(ignored.sort()).toEqual(['fullness.max', 'growth.nonsense', 'pellets.maxFloating']);
    expect(config.pellets.spawnIntervalMs).toBe(60 * 60 * 1000); // the base is untouched
  });
});
