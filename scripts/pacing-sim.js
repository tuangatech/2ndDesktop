// Pacing simulator (tech design 3.7, plan 5A): plays 30 days of the game for several visit patterns with the
// shared rules, to check that the numbers keep the promises of the functional spec 7.2.
// Usage: npm run sim
// A visit collects every waiting pellet, feeds every hungry fish until it is full, and hatches every egg.
import { pathToFileURL } from 'node:url';
import { config } from '../scenes/fishtank/config.js';
import { makeRng } from '../shared/rng.js';
import {
  collect,
  eggsAvailable,
  feed,
  hatchEgg,
  isFull,
  newFish,
  newTankState,
  settlePellets,
  settleState,
  stageOf,
} from '../scenes/fishtank/rules.js';

const HOUR = 60 * 60 * 1000;
const SPECIES = ['tetra', 'guppy', 'angelfish'];

/** Visit times in hours since the start, for each pattern. */
export const PATTERNS = {
  'daily, same hour': (days) => Array.from({ length: days }, (_, d) => d * 24),
  'daily, random hour': (days, rng) =>
    Array.from({ length: days }, (_, d) => (d === 0 ? 0 : d * 24 + rng.range(0, 24))),
  'every 12 hours': (days) => Array.from({ length: days * 2 }, (_, i) => i * 12),
  'every 3 days': (days) => Array.from({ length: Math.ceil(days / 3) }, (_, i) => i * 72),
  never: () => [],
};

/**
 * @param {number[]} visitHours  hours since the start, ascending
 * @param {{days?: number, seed?: number, cfg?: typeof config}} [options]
 */
export function simulate(visitHours, { days = 30, seed = 1, cfg = config } = {}) {
  const rng = makeRng(seed);
  const start = 1_790_000_000_000;
  let state = newTankState(start, rng, SPECIES, cfg);
  const original = state.fish.map((fish) => fish.id);
  const result = {
    visits: 0,
    juvenileVisit: null,
    adultVisit: null,
    firstEggVisit: null,
    eighthFishDay: null,
    pelletsLost: 0,
    pelletsFedToOriginals: 0,
    visitsFoundEveryoneFull: 0,
  };

  visitHours.forEach((hours, index) => {
    if (hours > days * 24) return;
    const now = start + hours * HOUR;
    result.visits = index + 1;
    result.pelletsLost += settlePellets(state.tank, now, cfg).lost;
    state = settleState(state, now, cfg);
    if (state.fish.every((fish) => isFull(fish, now, cfg))) result.visitsFoundEveryoneFull++;

    const collected = collect(state, Infinity, now, cfg);
    if (collected.ok) state = collected.state;
    for (const fish of state.fish) {
      for (;;) {
        const fed = feed(state, fish.id, now, cfg);
        if (!fed.ok) break;
        state = fed.state;
        if (original.includes(fish.id)) result.pelletsFedToOriginals++;
      }
    }

    const originals = state.fish.filter((fish) => original.includes(fish.id));
    if (
      result.juvenileVisit === null &&
      originals.every((f) => stageOf(f.growthPoints, cfg) !== 'fry')
    ) {
      result.juvenileVisit = index + 1;
    }
    if (
      result.adultVisit === null &&
      originals.every((f) => stageOf(f.growthPoints, cfg) === 'adult')
    ) {
      result.adultVisit = index + 1;
    }
    if (result.firstEggVisit === null && eggsAvailable(state.tank, cfg) > 0) {
      result.firstEggVisit = index + 1;
    }
    for (;;) {
      const hatched = hatchEgg(state, newFish(now, rng, SPECIES), now, cfg);
      if (!hatched.ok) break;
      state = hatched.state;
      if (state.fish.length === cfg.eggs.maxFish && result.eighthFishDay === null) {
        result.eighthFishDay = Math.floor(hours / 24) + 1;
      }
    }
  });

  return {
    ...result,
    fishCount: state.fish.length,
    finalPoints: state.fish.filter((f) => original.includes(f.id)).map((f) => f.growthPoints),
    pelletsPerOriginalFishPerDay: result.pelletsFedToOriginals / original.length / days,
  };
}

function table() {
  const rows = Object.entries(PATTERNS).map(([name, make]) => {
    const r = simulate(make(30, makeRng(99)));
    const dash = (v) => (v === null ? '-' : String(v));
    return [
      name,
      r.visits,
      dash(r.juvenileVisit),
      dash(r.adultVisit),
      dash(r.firstEggVisit),
      dash(r.eighthFishDay),
      r.pelletsLost,
      r.visitsFoundEveryoneFull,
      r.pelletsPerOriginalFishPerDay.toFixed(2),
    ];
  });
  const head = [
    'pattern',
    'visits',
    'juvenile (visit)',
    'adult (visit)',
    'first egg (visit)',
    '8th fish (day)',
    'pellets lost',
    'visits all full',
    'fed/fish/day',
  ];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(
    ['30 days, the two starting fish, eggs hatched at the next visit', '', line(head)].join('\n'),
  );
  for (const row of rows) console.log(line(row));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) table();
