import { expect, test } from '@playwright/test';
import { launch } from './helpers.js';

// `host.time`, `host.place` and `host.safeArea` (P2, docs/platform/01 section 10) exist in the real page and follow the
// host's clock; the unit tests (tests/host/time.test.js, place-safe-area.test.js) cover the arithmetic.
test('the host gives a scene the time, the place and the safe area', async () => {
  const run = await launch();
  try {
    const result = await run.page.evaluate(() => {
      const { host, clock } = window.__scene;
      clock.set(Date.UTC(2026, 9, 20, 22, 30)); // an October evening in UTC
      return {
        zone: host.time.zone(),
        parts: host.time.parts(),
        local: host.time.parts(Date.UTC(2026, 0, 15, 12, 0)),
        sun: host.time.sun(),
        night: host.time.nightness(),
        place: host.place.get(),
        area: host.safeArea.get(),
      };
    });
    expect(typeof result.zone).toBe('string');
    expect(result.zone.length).toBeGreaterThan(2);
    expect(result.parts.dayOfYear).toBeGreaterThan(290); // 20 October, or the 21st in a zone far east
    expect(result.parts.dayOfYear).toBeLessThan(296);
    expect(result.local.month).toBe(1);
    expect(result.sun.sunset).toBeGreaterThan(result.sun.sunrise);
    expect(result.night).toBeGreaterThanOrEqual(0);
    expect(result.night).toBeLessThanOrEqual(1);
    expect(result.place).toMatchObject({ name: 'Atlanta, GA', source: 'default' });
    // A window: nothing covers the scene.
    expect(result.area).toEqual({ top: 0, right: 0, bottom: 0, left: 0, iconStrip: null });
  } finally {
    await run.close();
  }
});
