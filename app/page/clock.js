// The host's clock (`host.clock`, docs/platform/01): the one source of time for a scene. In the product it is the wall
// clock. In a development run the dev kit (app/page/devKit.js) moves it, so a scene that changes with the time of day or
// the season can be looked at without waiting: `jump`, `set` and `setSpeed`. The tank's own panel and tests move it with
// `clock.offset += ms`, which keeps working: `offset` is how far the clock is ahead of the wall clock.
// Pure (the wall clock is passed in), so it is unit-tested.

/**
 * @param {() => number} [wallNow]  epoch milliseconds, `Date.now` by default
 */
export function createClock(wallNow = Date.now) {
  let wallBase = wallNow();
  let clockBase = wallBase;
  let speed = 1;

  // Start counting again from `time` (epoch ms) at this moment, keeping the speed.
  const rebase = (time) => {
    wallBase = wallNow();
    clockBase = time;
  };

  const clock = {
    /** Epoch milliseconds on this clock. */
    now: () => clockBase + (wallNow() - wallBase) * speed,
    /** Milliseconds this clock is ahead of the wall clock (negative: behind). */
    get offset() {
      return clock.now() - wallNow();
    },
    set offset(value) {
      rebase(wallNow() + value);
    },
    /** How many clock seconds pass in a wall second (1 in the product). */
    get speed() {
      return speed;
    },
    /** Changes the speed without a jump: the clock shows the same time before and after. */
    setSpeed(value) {
      const current = clock.now();
      speed = value;
      rebase(current);
    },
    /** Sets the time (epoch ms); the clock runs on from there at the current speed. */
    set(time) {
      rebase(time);
    },
    /** Moves the clock by `ms` (negative goes back). */
    jump(ms) {
      rebase(clock.now() + ms);
    },
    /** Back to the wall clock at speed 1. */
    reset() {
      speed = 1;
      rebase(wallNow());
    },
  };
  return clock;
}
