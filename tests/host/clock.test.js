import { describe, expect, it } from 'vitest';
import { createClock } from '../../app/page/clock.js';

// A wall clock the test moves by hand.
const wall = (start = 1_000_000) => {
  let t = start;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
};

describe('the host clock', () => {
  it('is the wall clock when nothing was changed', () => {
    const w = wall();
    const clock = createClock(w);
    expect(clock.now()).toBe(w());
    w.advance(5000);
    expect(clock.now()).toBe(w());
    expect(clock.offset).toBe(0);
    expect(clock.speed).toBe(1);
  });

  it('keeps working with `clock.offset += ms` (the tank panel and its tests)', () => {
    const w = wall();
    const clock = createClock(w);
    clock.offset += 24 * 60 * 60 * 1000;
    expect(clock.now()).toBe(w() + 86_400_000);
    w.advance(1000);
    expect(clock.now()).toBe(w() + 86_400_000);
    clock.offset += 1000;
    expect(clock.offset).toBe(86_401_000);
  });

  it('jumps forward and back', () => {
    const w = wall();
    const clock = createClock(w);
    clock.jump(3_600_000);
    expect(clock.now()).toBe(w() + 3_600_000);
    clock.jump(-7_200_000);
    expect(clock.now()).toBe(w() - 3_600_000);
  });

  it('is set to a time and runs on from there', () => {
    const w = wall();
    const clock = createClock(w);
    const noon = Date.UTC(2026, 6, 15, 12, 0, 0);
    clock.set(noon);
    expect(clock.now()).toBe(noon);
    w.advance(2500);
    expect(clock.now()).toBe(noon + 2500);
  });

  it('runs faster without a jump when the speed changes', () => {
    const w = wall();
    const clock = createClock(w);
    clock.jump(1_000_000);
    const before = clock.now();
    clock.setSpeed(60);
    expect(clock.now()).toBe(before);
    w.advance(1000);
    expect(clock.now()).toBe(before + 60_000);
    // Changing the speed again does not jump either.
    const mid = clock.now();
    clock.setSpeed(1);
    expect(clock.now()).toBe(mid);
    w.advance(1000);
    expect(clock.now()).toBe(mid + 1000);
  });

  it('keeps a jump and a speed together', () => {
    const w = wall();
    const clock = createClock(w);
    clock.setSpeed(3600);
    w.advance(1000);
    clock.jump(86_400_000);
    const at = clock.now();
    w.advance(1000);
    expect(clock.now()).toBe(at + 3_600_000);
  });

  it('resets to the wall clock at speed 1', () => {
    const w = wall();
    const clock = createClock(w);
    clock.jump(999_999);
    clock.setSpeed(600);
    clock.reset();
    expect(clock.now()).toBe(w());
    expect(clock.speed).toBe(1);
    w.advance(10);
    expect(clock.now()).toBe(w());
  });
});
