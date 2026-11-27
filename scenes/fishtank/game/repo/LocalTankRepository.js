// The Phase 1 repository: the tank state lives here, the rules in scenes/fishtank/game/rules.js change it, and every change
// is saved (D8). Nothing here touches Electron or the disk: `storage` is { load(), save(record) }, which in the
// app talks to the main process and in tests is a fake (plan 5B).
import * as rules from '../rules.js';

export const SCHEMA_VERSION = 1;

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * Repairs a loaded state instead of throwing it away: losing the player's fish is the worst thing a save can do.
 * Counts are clamped into their caps (a later build or tuning.json may have lowered a cap), missing values get a
 * neutral default, and a fish of a species that no longer exists keeps its growth and name but gets a species
 * that does. Only a fish without a usable id is dropped. Returns `{ state, fixes }`, where `fixes` lists what was
 * changed (empty for a clean state), or null when there is no tank to repair.
 * @param {unknown} state
 * @param {{config: object, speciesIds: string[], now: number, rng: {int: (lo: number, hi: number) => number}}} options
 */
export function repairState(state, { config, speciesIds, now, rng }) {
  if (!isObject(state) || !isObject(state.tank) || !Array.isArray(state.fish)) return null;
  const fixes = [];
  const count = (value, max, name) => {
    if (!isNumber(value)) {
      fixes.push(`${name} missing`);
      return 0;
    }
    const fixed = Math.min(max, Math.max(0, Math.floor(value)));
    if (fixed !== value) fixes.push(`${name} ${value} -> ${fixed}`);
    return fixed;
  };
  const time = (value, name) => {
    if (isNumber(value)) return value;
    fixes.push(`${name} missing`);
    return now;
  };

  const t = state.tank;
  const tank = {
    ...t,
    floatingPellets: count(t.floatingPellets, config.pellets.maxFloating, 'floatingPellets'),
    pelletsUpdatedAt: time(t.pelletsUpdatedAt, 'pelletsUpdatedAt'),
    stash: count(t.stash, config.pellets.maxStash, 'stash'),
    totalFed: count(t.totalFed, 1e9, 'totalFed'),
    eggsClaimed: count(t.eggsClaimed, 1e9, 'eggsClaimed'),
    decorSeed: isNumber(t.decorSeed) ? t.decorSeed : rng.int(1, 0x7fffffff),
    hintShown: typeof t.hintShown === 'boolean' ? t.hintShown : false,
  };
  if (!isNumber(t.decorSeed)) fixes.push('decorSeed missing');
  if (typeof t.hintShown !== 'boolean') fixes.push('hintShown missing');

  const ids = new Set();
  const fish = [];
  for (const [i, f] of state.fish.entries()) {
    if (!isObject(f) || typeof f.id !== 'string' || f.id === '' || ids.has(f.id)) {
      fixes.push(`fish ${i} dropped`);
      continue;
    }
    ids.add(f.id);
    const seed = isNumber(f.seed) ? f.seed : rng.int(1, 0x7fffffff);
    if (!isNumber(f.seed)) fixes.push(`fish ${i} seed missing`);
    let species = f.species;
    if (!speciesIds.includes(species)) {
      species = speciesIds[Math.abs(Math.floor(seed)) % speciesIds.length];
      fixes.push(`fish ${i} species ${String(f.species).slice(0, 20)} -> ${species}`);
    }
    let name = f.name ?? null;
    if (name !== null && typeof name !== 'string') name = null;
    if (name !== null && [...name].length > rules.MAX_NAME_LENGTH) {
      name = [...name].slice(0, rules.MAX_NAME_LENGTH).join('');
    }
    if (name !== (f.name ?? null)) fixes.push(`fish ${i} name`);
    const lastFedAt = f.lastFedAt === null || isNumber(f.lastFedAt) ? f.lastFedAt : null;
    if (lastFedAt !== f.lastFedAt) fixes.push(`fish ${i} lastFedAt`);
    fish.push({
      ...f,
      species,
      seed,
      name,
      growthPoints: count(f.growthPoints, 1e9, `fish ${i} growthPoints`),
      fullness: count(f.fullness, config.fullness.max, `fish ${i} fullness`),
      fullnessUpdatedAt: time(f.fullnessUpdatedAt, `fish ${i} fullnessUpdatedAt`),
      lastFedAt,
      createdAt: time(f.createdAt, `fish ${i} createdAt`),
    });
  }
  // More fish than maxFish (the cap was lowered) are all kept; the rules then only refuse new eggs.
  // A tank never has no fish (nothing removes one), so an empty list gets the first-launch fry (FR-16).
  if (fish.length === 0) {
    fish.push(...rules.newTankState(now, rng, speciesIds, config).fish);
    fixes.push('no fish: first-launch fry added');
  }
  let localPlayerId = state.localPlayerId;
  if (typeof localPlayerId !== 'string' || localPlayerId === '') {
    localPlayerId = rules.newId(rng);
    fixes.push('localPlayerId missing');
  }
  return { state: { ...state, localPlayerId, tank, fish }, fixes };
}

/**
 * Brings an old record up to the current format. Only version 1 exists, so this is the place later phases
 * extend: add one step per version. Returns `{ ok: true, state }`, `{ ok: false, reason: 'newer' }` for a record
 * written by a newer app (it must not be overwritten) or `{ ok: false, reason: 'bad' }`.
 */
export function migrate(record) {
  if (!record || typeof record !== 'object' || !Number.isInteger(record.schemaVersion)) {
    return { ok: false, reason: 'bad' };
  }
  if (record.schemaVersion > SCHEMA_VERSION) return { ok: false, reason: 'newer' };
  if (record.schemaVersion < 1) return { ok: false, reason: 'bad' };
  const state = record.state;
  // (version 1 is current; later versions add `if (record.schemaVersion < 2) { state = ... }` here)
  return { ok: true, state };
}

/**
 * `storage.keepCopy(record)`, when given, stores a copy of a record that had to be repaired or replaced, so the
 * original is never lost (it is the only copy once the next save has replaced the backup).
 * @param {{storage: {load: () => Promise<{status: string, data?: object}>, save: (record: object) => void,
 *                    keepCopy?: (record: object) => void},
 *          clock: {now: () => number}, rng: ReturnType<typeof import('../../../../shared/rng.js').makeRng>,
 *          config: typeof import('../config.js').config, speciesIds: string[]}} options
 */
export function createLocalRepository({ storage, clock, rng, config, speciesIds }) {
  /** @type {import('../rules.js').TankState | null} */
  let state = null;
  let readOnly = false;
  /** @type {{source: 'saved'|'new', problem: null|'damaged'|'newer'|'repaired', fixes: string[]}} */
  const status = { source: 'new', problem: null, fixes: [] };
  const listeners = new Set();
  /** @param {import('./TankRepository.js').TankEvent} event */
  const notify = (event) => listeners.forEach((listener) => listener(event));

  const persist = () => {
    if (readOnly) return;
    storage.save({ schemaVersion: SCHEMA_VERSION, savedAt: clock.now(), state });
  };
  /** Applies a successful result; `event(result)` builds the event that tells the listeners what changed. */
  const apply = (result, event) => {
    if (!result.ok) return result;
    state = result.state;
    persist();
    notify(event(result));
    return result;
  };
  const devResult = (next) => ({ ok: true, state: next });
  const devEvent = () => ({ type: 'dev' });
  const startNew = (problem = null) => {
    state = rules.newTankState(clock.now(), rng, speciesIds, config);
    status.source = 'new';
    status.problem = problem;
    persist();
  };

  const repository = {
    /** Where the state came from and what went wrong; `fixes` lists what a repair changed. */
    status,

    async load() {
      const loaded = await storage.load();
      if (loaded.status === 'missing') return startNew();
      if (loaded.status === 'corrupt') return startNew('damaged');
      const migrated = migrate(loaded.data);
      if (!migrated.ok && migrated.reason === 'newer') {
        // A newer app wrote this record: show a fresh tank for now but never overwrite the record (plan 5B).
        readOnly = true;
        return startNew('newer');
      }
      const repaired = migrated.ok
        ? repairState(migrated.state, { config, speciesIds, now: clock.now(), rng })
        : null;
      if (!repaired) {
        storage.keepCopy?.(loaded.data);
        return startNew('damaged');
      }
      // The catch-up of FR-1: while the app was closed, pellets appeared and hunger decayed.
      state = rules.settleState(repaired.state, clock.now(), config);
      status.source = 'saved';
      status.fixes = repaired.fixes;
      status.problem = repaired.fixes.length ? 'repaired' : null;
      if (repaired.fixes.length) {
        storage.keepCopy?.(loaded.data);
        persist();
      }
    },

    getState: () => state,
    getFish: () => state.fish,
    getStash: () => state.tank.stash,
    getSummary: () => rules.summarize(state, clock.now(), config),
    isFull: (id) => {
      const fish = state.fish.find((f) => f.id === id);
      return fish ? rules.isFull(fish, clock.now(), config) : true;
    },
    isDrowsy: (id) => {
      const fish = state.fish.find((f) => f.id === id);
      return fish ? rules.isDrowsy(fish, clock.now(), config) : false;
    },

    /** Settles pellets and fullness by the clock. Returns true (and notifies) when the numbers changed. */
    tick() {
      const settled = rules.settleState(state, clock.now(), config);
      const changed =
        settled.tank.floatingPellets !== state.tank.floatingPellets ||
        settled.fish.some((f, i) => f.fullness !== state.fish[i].fullness);
      // The settled values are what the stored values mean at this time, so they replace them either way
      // (nothing needs saving: loading settles again from the same numbers).
      state = settled;
      if (changed) notify({ type: 'tick' });
      return changed;
    },

    collect: (count = Infinity) =>
      apply(rules.collect(state, count, clock.now(), config), (r) => ({
        type: 'collect',
        collected: r.collected,
      })),
    feed: (fishId) =>
      apply(rules.feed(state, fishId, clock.now(), config), (r) => ({
        type: 'feed',
        fishId: r.fish.id,
        pointsAfter: r.fish.growthPoints,
      })),
    hatchEgg() {
      const now = clock.now();
      return apply(
        rules.hatchEgg(state, rules.newFish(now, rng, speciesIds), now, config),
        (r) => ({ type: 'hatch', fishId: r.fish.id }),
      );
    },
    renameFish: (fishId, name) =>
      apply(rules.renameFish(state, fishId, name), (r) => ({ type: 'rename', fishId: r.fish.id })),
    markHintShown() {
      if (state.tank.hintShown) return;
      state = { ...state, tank: { ...state.tank, hintShown: true } };
      persist();
      notify('hint');
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Development and test helpers. They are not part of the interface and never run in normal play. */
    dev: {
      /** Stops saving, so a measurement run cannot overwrite a real record. */
      freeze() {
        readOnly = true;
      },
      /** Replaces the fish: [{ species, seed?, points? }]. */
      setFish(list) {
        const now = clock.now();
        const fish = list.map(({ species, seed, points = 0 }) => ({
          ...rules.newFish(now, rng, speciesIds, species),
          ...(seed === undefined ? {} : { seed }),
          growthPoints: points,
        }));
        return apply(devResult({ ...state, fish }), devEvent);
      },
      addFish({ species, seed, points = 0 } = {}) {
        const now = clock.now();
        const fish = {
          ...rules.newFish(now, rng, speciesIds, species),
          ...(seed === undefined ? {} : { seed }),
          growthPoints: points,
        };
        apply(devResult({ ...state, fish: [...state.fish, fish] }), devEvent);
        return fish;
      },
      removeFish(id) {
        apply(devResult({ ...state, fish: state.fish.filter((f) => f.id !== id) }), devEvent);
      },
      setPoints(id, points) {
        const fish = state.fish.map((f) => (f.id === id ? { ...f, growthPoints: points } : f));
        apply(devResult({ ...state, fish }), devEvent);
      },
      addStash(count) {
        const stash = Math.min(config.pellets.maxStash, state.tank.stash + count);
        apply(devResult({ ...state, tank: { ...state.tank, stash } }), devEvent);
      },
      addFed(count) {
        const tank = { ...state.tank, totalFed: state.tank.totalFed + count };
        apply(devResult({ ...state, tank }), devEvent);
      },
    },
  };
  return repository;
}
