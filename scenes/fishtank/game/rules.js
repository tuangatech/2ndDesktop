// Game rules as pure functions: time and randomness are arguments, nothing here touches the browser,
// Electron or Node (plan section 5, so a server can run the same code in Phase 3).
//
// The state is { localPlayerId, tank, fish }. Every action returns { ok: true, state, ... } or
// { ok: false, reason }, and no state is ever changed in place. Times are epoch milliseconds.
import { config } from './config.js';

/** @typedef {'fry'|'juvenile'|'adult'} Stage */
/**
 * @typedef {object} Fish
 * @property {string} id
 * @property {string} species
 * @property {number} seed
 * @property {number} growthPoints
 * @property {number[]} mealsAt  epoch times of the meals in the last `meals.windowMs` (at most `meals.perFishPerDay`)
 * @property {number|null} lastFedAt
 * @property {number} createdAt
 */
/**
 * @typedef {object} Tank
 * @property {number} floatingPellets
 * @property {number} pelletsUpdatedAt
 * @property {number} stash
 * @property {number} totalFed
 * @property {number} eggsClaimed
 * @property {number} decorSeed
 * @property {boolean} hintShown
 */
/** @typedef {{localPlayerId: string, tank: Tank, fish: Fish[]}} TankState */

/** The stage is always derived from points and never stored (FR-11). */
export function stageOf(points, cfg = config) {
  if (points >= cfg.growth.adultAt) return 'adult';
  if (points >= cfg.growth.juvenileAt) return 'juvenile';
  return 'fry';
}

/** Size as a fraction of the adult size: 50% at 0 points, 100% from 400 points, smooth in between (FR-12). */
export function sizeOf(points, cfg = config) {
  const { fryScale, adultAt } = cfg.growth;
  const p = Math.min(Math.max(points, 0) / adultAt, 1);
  return fryScale + (1 - fryScale) * p;
}

/**
 * Pellets that appeared since `pelletsUpdatedAt` (FR-1, FR-2). A full tank banks nothing: when the tank is
 * full afterwards the timer restarts at `now`. A clock that went backwards re-anchors to `now` (D9).
 * `lost` counts the pellets that did not fit.
 */
export function settlePellets(tank, now, cfg = config) {
  const { spawnIntervalMs, maxFloating } = cfg.pellets;
  if (now < tank.pelletsUpdatedAt) {
    return { floatingPellets: tank.floatingPellets, pelletsUpdatedAt: now, spawned: 0, lost: 0 };
  }
  const due = Math.floor((now - tank.pelletsUpdatedAt) / spawnIntervalMs);
  const room = Math.max(0, maxFloating - tank.floatingPellets);
  const spawned = Math.min(due, room);
  const floatingPellets = tank.floatingPellets + spawned;
  const pelletsUpdatedAt =
    floatingPellets >= maxFloating ? now : tank.pelletsUpdatedAt + due * spawnIntervalMs;
  return { floatingPellets, pelletsUpdatedAt, spawned, lost: due - spawned };
}

/** The meals of the last window: a meal ages out `windowMs` after it was taken; one stamped later than now is dropped. */
export function recentMeals(fish, now, cfg = config) {
  const { windowMs } = cfg.meals;
  return fish.mealsAt.filter((at) => at <= now && now - at < windowMs);
}

/** The fish with the meals that have aged out removed (the same object when none has). */
export function settleFish(fish, now, cfg = config) {
  const recent = recentMeals(fish, now, cfg);
  return recent.length === fish.mealsAt.length ? fish : { ...fish, mealsAt: recent };
}

/** True when the fish has had no food for more than 36 hours; a never-fed fish counts from its creation (D10). */
export function isDrowsy(fish, now, cfg = config) {
  return now - (fish.lastFedAt ?? fish.createdAt) > cfg.drowsy.afterMs;
}

/** True when the fish may take another pellet: fewer than `perFishPerDay` meals in the last window (DEC-71). */
export function canEat(fish, now, cfg = config) {
  return recentMeals(fish, now, cfg).length < cfg.meals.perFishPerDay;
}

/** Eggs waiting: one for every 12 pellets fed, minus the ones already hatched (FR-17). */
export function eggsAvailable(tank, cfg = config) {
  return Math.max(0, Math.floor(tank.totalFed / cfg.eggs.pelletsPerEgg) - tank.eggsClaimed);
}

/** The whole state brought up to date with the clock. */
export function settleState(state, now, cfg = config) {
  const pellets = settlePellets(state.tank, now, cfg);
  return {
    ...state,
    tank: {
      ...state.tank,
      floatingPellets: pellets.floatingPellets,
      pelletsUpdatedAt: pellets.pelletsUpdatedAt,
    },
    fish: state.fish.map((fish) => settleFish(fish, now, cfg)),
  };
}

/** Moves up to `count` floating pellets to the stash (FR-4, FR-5). */
export function collect(state, count, now, cfg = config) {
  const settled = settleState(state, now, cfg);
  const { floatingPellets, stash } = settled.tank;
  if (stash >= cfg.pellets.maxStash) return { ok: false, reason: 'stash_full' };
  if (floatingPellets <= 0) return { ok: false, reason: 'none_available' };
  const moved = Math.min(
    Math.max(0, Math.floor(count)),
    floatingPellets,
    cfg.pellets.maxStash - stash,
  );
  if (moved <= 0) return { ok: false, reason: 'none_available' };
  return {
    ok: true,
    collected: moved,
    state: {
      ...settled,
      tank: { ...settled.tank, floatingPellets: floatingPellets - moved, stash: stash + moved },
    },
  };
}

/**
 * Feeds one pellet from the stash to a fish (FR-6 to FR-9). The economy is committed here (D1). Fails with
 * `unknown_fish`, `stash_empty`, or `enough_today` when the fish has had its meals for the last 24 hours.
 */
export function feed(state, fishId, now, cfg = config) {
  const settled = settleState(state, now, cfg);
  const index = settled.fish.findIndex((fish) => fish.id === fishId);
  if (index < 0) return { ok: false, reason: 'unknown_fish' };
  if (settled.tank.stash < 1) return { ok: false, reason: 'stash_empty' };
  const fish = settled.fish[index];
  if (!canEat(fish, now, cfg)) return { ok: false, reason: 'enough_today' };
  const fed = {
    ...fish,
    mealsAt: [...fish.mealsAt, now],
    growthPoints: fish.growthPoints + cfg.growth.pointsPerPellet,
    lastFedAt: now,
  };
  const fishList = settled.fish.slice();
  fishList[index] = fed;
  return {
    ok: true,
    fish: fed,
    state: {
      ...settled,
      fish: fishList,
      tank: { ...settled.tank, stash: settled.tank.stash - 1, totalFed: settled.tank.totalFed + 1 },
    },
  };
}

/** Hatches a waiting egg into `newFish` (built by the caller from the seeded generator) (FR-17, FR-18). */
export function hatchEgg(state, newFish, now, cfg = config) {
  const settled = settleState(state, now, cfg);
  if (eggsAvailable(settled.tank, cfg) < 1) return { ok: false, reason: 'no_egg' };
  if (settled.fish.length >= cfg.eggs.maxFish) return { ok: false, reason: 'tank_full' };
  return {
    ok: true,
    fish: newFish,
    state: {
      ...settled,
      fish: [...settled.fish, newFish],
      tank: { ...settled.tank, eggsClaimed: settled.tank.eggsClaimed + 1 },
    },
  };
}

/** A random 32-character hex id. */
export const newId = (rng) =>
  Array.from({ length: 4 }, () => rng.int(0, 0xffffffff).toString(16).padStart(8, '0')).join('');

/** A new fry with its own seed (FR-17). The species is random unless given. */
export function newFish(now, rng, speciesIds, species = rng.pick(speciesIds)) {
  return {
    id: newId(rng),
    species,
    seed: rng.int(1, 0x7fffffff),
    growthPoints: 0,
    mealsAt: [],
    lastFedAt: null,
    createdAt: now,
  };
}

/** The first-launch state: 2 fry of different species, 4 floating pellets, an empty stash (FR-16). */
export function newTankState(now, rng, speciesIds, cfg = config) {
  const first = rng.pick(speciesIds);
  const others = speciesIds.filter((id) => id !== first);
  const fish = [newFish(now, rng, speciesIds, first)];
  for (let i = 1; i < cfg.start.fish; i++) {
    fish.push(newFish(now, rng, speciesIds, others.length ? rng.pick(others) : first));
  }
  return {
    localPlayerId: newId(rng),
    tank: {
      floatingPellets: cfg.pellets.startFloating,
      pelletsUpdatedAt: now,
      stash: 0,
      totalFed: 0,
      eggsClaimed: 0,
      decorSeed: rng.int(1, 0x7fffffff),
      hintShown: false,
    },
    fish,
  };
}

/** What the tray menu and the HUD show, computed from the stored values and the clock (FR-61). */
export function summarize(state, now, cfg = config) {
  const settled = settleState(state, now, cfg);
  const eaters = settled.fish.filter((fish) => canEat(fish, now, cfg)).length;
  const eggs = eggsAvailable(settled.tank, cfg);
  return {
    waiting: settled.tank.floatingPellets,
    stash: settled.tank.stash,
    stashFull: settled.tank.stash >= cfg.pellets.maxStash,
    canFeed: eaters > 0,
    fishCount: settled.fish.length,
    eggs,
    eggReady: eggs > 0 && settled.fish.length < cfg.eggs.maxFish,
  };
}
