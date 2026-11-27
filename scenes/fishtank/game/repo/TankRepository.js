// The repository interface (tech design 3.4). The game code never touches files or the network directly: it
// calls these methods. Phase 1 has `LocalTankRepository`; Phase 3 adds a remote one with the same methods.
//
// Every action returns the result object of scenes/fishtank/game/rules.js: `{ ok: true, state, ... }` or
// `{ ok: false, reason }`, where reason is one of stash_full, none_available, stash_empty, fish_full,
// unknown_fish, no_egg, tank_full, bad_name.

/**
 * @typedef {import('../rules.js').TankState} TankState
 * @typedef {import('../rules.js').Fish} Fish
 *
 * @typedef {object} TankRepository
 * @property {() => Promise<void>} load  reads the record, catches up with the clock, or starts a new tank
 * @property {() => TankState} getState
 * @property {() => ReturnType<typeof import('../rules.js').summarize>} getSummary  for the tray and the HUD
 * @property {() => boolean} tick  settles pellets and fullness by the clock; true when something changed
 * @property {(count?: number) => object} collect
 * @property {(fishId: string) => object} feed
 * @property {() => object} hatchEgg
 * @property {(fishId: string, name: string) => object} renameFish
 * @property {(listener: (event: TankEvent) => void) => () => void} subscribe  fires once per change
 *
 * What changed, so a listener never has to guess or be told through side flags. A Phase 3 repository sends the
 * same events, possibly later than the call that caused them.
 * @typedef {{type: 'collect', collected: number}
 *         | {type: 'feed', fishId: string, pointsAfter: number}
 *         | {type: 'hatch', fishId: string}
 *         | {type: 'rename', fishId: string}
 *         | {type: 'tick'}
 *         | {type: 'dev'}} TankEvent
 */

export {};
