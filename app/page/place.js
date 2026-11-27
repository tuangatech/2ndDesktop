// `host.place` (docs/platform/01 section 10): where the scene's weather and season are. In 0.2 it is the default place;
// the typed city and the settings page come with 0.4 (DEC-57, DEC-60). The place never moves the clock: the time of day
// is the computer's (app/page/time.js). Coordinates are rounded to 0.1 degree, the most a scene or a provider ever sees
// (docs/platform/02).

/** @typedef {{name: string, latitude: number, longitude: number, source: 'default'|'player'}} Place */

/** "Atlanta, GA" is what the weather and the season use when no city is typed (DEC-60). */
export const DEFAULT_PLACE = Object.freeze({
  name: 'Atlanta, GA',
  latitude: 33.7,
  longitude: -84.4,
  source: 'default',
});

/** Rounds a coordinate to 0.1 degree. */
export const roundCoordinate = (degrees) => Math.round(degrees * 10) / 10;

/**
 * Makes a place from what is known, with the coordinates rounded and checked; anything unusable gives the default.
 * @param {unknown} raw
 * @returns {Place}
 */
export function makePlace(raw) {
  const r = /** @type {any} */ (raw);
  const ok =
    r &&
    typeof r.name === 'string' &&
    r.name.trim() !== '' &&
    Number.isFinite(r.latitude) &&
    Math.abs(r.latitude) <= 90 &&
    Number.isFinite(r.longitude) &&
    Math.abs(r.longitude) <= 180;
  if (!ok) return { ...DEFAULT_PLACE };
  return {
    name: r.name.trim().slice(0, 60),
    latitude: roundCoordinate(r.latitude),
    longitude: roundCoordinate(r.longitude),
    source: r.source === 'player' ? 'player' : 'default',
  };
}

/** Builds `host.place`: the current place, read each time (the settings change it in 0.4). */
export function createPlace(getPlace = () => DEFAULT_PLACE) {
  return {
    get: () => makePlace(getPlace()),
  };
}
