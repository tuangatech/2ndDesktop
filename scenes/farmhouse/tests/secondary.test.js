import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STYLE, eventAt, pulse, secondaryAt } from '../game/secondary.js';

const KINDS = Object.keys(STYLE);
const T0 = 1_780_000_000; // a clock of today, in seconds
const base = { seed: 20261127, index: 2, phase: 0.3, swing: 0, down: 0 };
const at = (kind, seconds, extra = {}) => secondaryAt(kind, { ...base, ...extra, seconds });
const KEYS = ['head', 'reach', 'ear', 'tail', 'breath', 'sway'];
const spread = (list) => Math.max(...list) - Math.min(...list);

describe('R22 the small movements of an animal (DEC-68)', () => {
  it('are numbers, always, and stay small: no NaN, no wild angle, whatever the state', () => {
    for (const kind of KINDS) {
      for (const swing of [0, 0.5, 1]) {
        for (const down of [0, 0.5, 1]) {
          for (let k = 0; k < 600; k++) {
            const v = at(kind, T0 + k * 0.7, { swing, down, phase: (k % 40) / 40 });
            for (const key of KEYS) expect(Number.isFinite(v[key])).toBe(true);
            expect(Math.abs(v.head)).toBeLessThan(1.6);
            expect(Math.abs(v.ear)).toBeLessThan(0.8);
            expect(Math.abs(v.tail)).toBeLessThan(0.8);
            expect(Math.abs(v.breath - 1)).toBeLessThan(0.02);
            expect(Math.abs(v.sway)).toBeLessThan(0.03);
            expect(v.reach).toBeGreaterThanOrEqual(0);
            expect(v.reach).toBeLessThanOrEqual(STYLE[kind].reach + 1e-9);
          }
        }
      }
    }
  });

  it('have no step in them: a fiftieth of a second moves each angle only a little', () => {
    for (const kind of KINDS) {
      for (const [swing, down] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [0.4, 0.6],
      ]) {
        let last = null;
        for (let k = 0; k < 3000; k++) {
          const v = at(kind, T0 + k / 50, { swing, down, phase: (k / 50 / 1.5) % 1 });
          if (last) {
            for (const key of ['head', 'ear', 'tail', 'sway', 'reach'])
              expect(Math.abs(v[key] - last[key])).toBeLessThan(key === 'reach' ? 0.5 : 0.12);
          }
          last = v;
        }
      }
    }
  });

  it('put the head down to graze and up again to look: low with the head down, up now and then', () => {
    for (const kind of KINDS) {
      const stand = [];
      const graze = [];
      for (let k = 0; k < 1200; k++) {
        stand.push(at(kind, T0 + k * 0.5, { down: 0 }).head);
        graze.push(at(kind, T0 + k * 0.5, { down: 1 }).head);
      }
      const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length;
      expect(mean(graze)).toBeGreaterThan(STYLE[kind].down * 0.6);
      expect(Math.max(...graze)).toBeGreaterThan(STYLE[kind].down * 0.95); // fully down
      expect(Math.min(...graze)).toBeLessThan(STYLE[kind].down * 0.5); // the head is up to look now and then
      expect(Math.max(...stand)).toBeLessThan(0.25); // and a standing head stays about level
      expect(spread(stand)).toBeGreaterThan(0.04); // but it is not stiff
    }
  });

  it('nod the head in step with the walk, once a cycle, and not when it stands', () => {
    for (const kind of KINDS) {
      const walk = [];
      const stand = [];
      for (let k = 0; k < 200; k++) {
        walk.push(at(kind, T0, { swing: 1, phase: k / 200 }).head);
        stand.push(at(kind, T0, { swing: 0, phase: k / 200 }).head);
      }
      expect(spread(walk)).toBeGreaterThan(STYLE[kind].nod * 1.5);
      expect(spread(stand)).toBeLessThan(1e-9);
    }
  });

  it('sway the tail all the time and swish it at a fly now and then; a sheep has none to move', () => {
    for (const kind of KINDS) {
      const tail = [];
      for (let k = 0; k < 4000; k++) tail.push(at(kind, T0 + k * 0.25).tail);
      if (kind === 'sheep') expect(Math.max(...tail.map(Math.abs))).toBeLessThan(0.01);
      else expect(spread(tail)).toBeGreaterThan(STYLE[kind].tail * 1.2);
    }
  });

  it('twitch an ear now and then, between long quiet stretches', () => {
    for (const kind of KINDS) {
      const ear = [];
      for (let k = 0; k < 2400; k++) ear.push(at(kind, T0 + k * 0.25).ear);
      const quiet = ear.filter((v) => Math.abs(v + 0.05) < 0.1).length / ear.length;
      expect(quiet).toBeGreaterThan(0.6);
      expect(Math.min(...ear)).toBeLessThan(-0.05 - STYLE[kind].ear * 0.5);
    }
  });

  it('breathe slowly and rock a little while it stands, less in the walk', () => {
    for (const kind of KINDS) {
      const stand = [];
      const walk = [];
      for (let k = 0; k < 400; k++) {
        stand.push(at(kind, T0 + k * 0.1));
        walk.push(at(kind, T0 + k * 0.1, { swing: 1 }));
      }
      const of = (list, key) => spread(list.map((v) => v[key]));
      expect(of(stand, 'breath')).toBeGreaterThan(0.015);
      expect(of(walk, 'breath')).toBeLessThan(of(stand, 'breath'));
      expect(of(stand, 'sway')).toBeGreaterThan(0.005);
      expect(of(walk, 'sway')).toBe(0);
    }
  });

  it('are not in step: two animals of a kind, or two seeds, move differently', () => {
    const a = at('cow', T0 + 100, { index: 3 });
    const b = at('cow', T0 + 100, { index: 4 });
    const c = at('cow', T0 + 100, { seed: 1 });
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('events come in slots: each lasts its length, and not every slot has one', () => {
    let busy = 0;
    for (let k = 0; k < 20000; k++) {
      if (eventAt(T0 + k * 0.1, 5, 1, 9, 8, 0.5, 0.5) >= 0) busy++;
    }
    // about half of the slots have a half-second event: a sixteenth of the time
    expect(busy / 20000).toBeGreaterThan(0.03);
    expect(busy / 20000).toBeLessThan(0.1);
    expect(pulse(T0, 5, 1, 9, 8, 0, 0.5)).toBe(0); // chance 0: never
  });

  it('is pure: a function of its arguments, no clock, no random, nothing from the scene', () => {
    const v = at('horse', T0 + 12.3, { swing: 0.4, down: 0.7, phase: 0.22 });
    expect(at('horse', T0 + 12.3, { swing: 0.4, down: 0.7, phase: 0.22 })).toEqual(v);
    const source = readFileSync(
      fileURLToPath(new URL('../game/secondary.js', import.meta.url)),
      'utf8',
    );
    expect(source).not.toMatch(/Date\.now|new Date\(|performance\.now|Math\.random|pixi/);
    for (const m of source.matchAll(/^import .* from '([^']+)'/gm))
      expect(m[1].startsWith('./')).toBe(true);
  });
});
