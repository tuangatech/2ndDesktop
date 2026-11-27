import { describe, expect, it } from 'vitest';
import { DEFAULT_PLACE, createPlace, makePlace, roundCoordinate } from '../../app/page/place.js';
import { computeSafeArea, createSafeArea } from '../../app/page/safeArea.js';

describe('host.place', () => {
  it('is "Atlanta, GA" in the north by default (DEC-60)', () => {
    const place = createPlace().get();
    expect(place).toMatchObject({ name: 'Atlanta, GA', source: 'default' });
    expect(place.latitude).toBeGreaterThan(0);
    expect(place).toEqual({ ...DEFAULT_PLACE });
  });

  it('rounds the coordinates to 0.1 degree and trims the name', () => {
    expect(roundCoordinate(33.7490001)).toBe(33.7);
    expect(roundCoordinate(-84.3879)).toBe(-84.4);
    const place = makePlace({
      name: '  Lyon ',
      latitude: 45.7640123,
      longitude: 4.8357,
      source: 'player',
    });
    expect(place).toEqual({ name: 'Lyon', latitude: 45.8, longitude: 4.8, source: 'player' });
  });

  it('anything unusable gives the default place', () => {
    for (const bad of [
      null,
      5,
      {},
      { name: '', latitude: 1, longitude: 1 },
      { name: 'X', latitude: 91, longitude: 0 },
      { name: 'X', latitude: 0, longitude: NaN },
    ]) {
      expect(makePlace(bad)).toEqual({ ...DEFAULT_PLACE });
    }
  });

  it('is read each time, so a changed setting is seen', () => {
    let current = { name: 'Perth', latitude: -31.96, longitude: 115.86, source: 'player' };
    const place = createPlace(() => current);
    expect(place.get().latitude).toBe(-32);
    current = DEFAULT_PLACE;
    expect(place.get().name).toBe('Atlanta, GA');
  });
});

describe('host.safeArea', () => {
  const screen = {
    width: 1920,
    height: 1080,
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1040,
  };

  it('is all zero in a window: nothing covers the scene', () => {
    expect(
      computeSafeArea({ mode: 'window', platform: 'win32', width: 800, height: 600, screen }),
    ).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      iconStrip: null,
    });
  });

  it('Windows: the taskbar at the bottom and the icon column on the left', () => {
    const area = computeSafeArea({
      mode: 'desktop',
      platform: 'win32',
      width: 1920,
      height: 1080,
      screen,
    });
    expect(area).toMatchObject({ top: 0, right: 0, bottom: 40, left: 0 });
    expect(area.iconStrip.side).toBe('left');
    expect(area.iconStrip.width).toBeGreaterThan(0);
    expect(area.iconStrip.width).toBeLessThanOrEqual(140);
  });

  it('Mac: the menu bar at the top, the Dock, and the icon column on the right', () => {
    const mac = {
      width: 1728,
      height: 1117,
      availLeft: 0,
      availTop: 38,
      availWidth: 1728,
      availHeight: 1000,
    };
    const area = computeSafeArea({
      mode: 'desktop',
      platform: 'darwin',
      width: 1728,
      height: 1117,
      screen: mac,
    });
    expect(area.top).toBe(38);
    expect(area.bottom).toBe(79);
    expect(area.iconStrip.side).toBe('right');
  });

  it('scales the insets when the scene is not the size of the screen (a smaller drawing)', () => {
    const area = computeSafeArea({
      mode: 'desktop',
      platform: 'win32',
      width: 960,
      height: 540,
      screen,
    });
    expect(area.bottom).toBe(20);
  });

  it('a dock on the left (work area starts at x)', () => {
    const left = { ...screen, availLeft: 70, availWidth: 1850, availHeight: 1080 };
    const area = computeSafeArea({
      mode: 'desktop',
      platform: 'darwin',
      width: 1920,
      height: 1080,
      screen: left,
    });
    expect(area.left).toBe(70);
    expect(area.right).toBe(0);
  });

  it('never gives negative or absurd numbers (a display that just changed)', () => {
    const odd = {
      width: 1920,
      height: 1080,
      availLeft: -50,
      availTop: NaN,
      availWidth: 4000,
      availHeight: 10,
    };
    const area = computeSafeArea({
      mode: 'desktop',
      platform: 'win32',
      width: 1920,
      height: 1080,
      screen: odd,
    });
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(area[side]).toBeGreaterThanOrEqual(0);
      expect(area[side]).toBeLessThanOrEqual(1920);
    }
    expect(
      computeSafeArea({ mode: 'desktop', platform: 'win32', width: 0, height: 0, screen })
        .iconStrip,
    ).toBeNull();
    expect(
      computeSafeArea({ mode: 'desktop', platform: 'win32', width: 100, height: 100 }).iconStrip,
    ).toBeNull();
  });

  it('is read again each time it is asked', () => {
    let height = 1040;
    const safeArea = createSafeArea(() => ({
      mode: 'desktop',
      platform: 'win32',
      width: 1920,
      height: 1080,
      screen: { ...screen, availHeight: height },
    }));
    expect(safeArea.get().bottom).toBe(40);
    height = 1000;
    expect(safeArea.get().bottom).toBe(80);
  });
});
