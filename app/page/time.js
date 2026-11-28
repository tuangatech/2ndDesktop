// `host.time` (docs/platform/01 sections 8.3 and 10): the real time of the player's computer, in the computer's own time
// zone, and what follows from it: the date, sunrise and sunset, and how dark it is. Pure (the clock and the zone are
// passed in), so it is unit-tested; the page builds it in main.js. A scene reads time only through this and
// `host.clock` (ESLint refuses `Date` in a scene).
//
// The place never moves the clock (docs/scenes/farmhouse.md section 4): solar noon comes from the computer's time zone,
// taken at its STANDARD offset (the smaller of the January and July offsets, so noon is not an hour late all summer in a
// zone with daylight saving), and only the length of the day comes from the latitude of the place and the date. A player
// in another zone than the place sees their own noon and a day as long as the place's. The clock the player sees is the
// current offset, so in summer sunrise and sunset shift by the one hour of daylight saving, as on the wall clock.
//
// DEC-64: when the place lies within 15 degrees of longitude of the meridian of the zone, the player is in the place's own
// region and solar noon also moves by 4 minutes for each degree the place lies west (later) or east (earlier) of that
// meridian. Atlanta is 9.4 degrees west of the Eastern meridian, so its sun comes about 38 minutes later than the plain
// zone rule gave. Further away the meridian of the zone is kept, as before.

const MINUTE = 60_000;
const DAY = 86_400_000;
const RAD = Math.PI / 180;
/** The sun's centre is 0.833 degrees below the horizon at sunrise and sunset (refraction and the disc). */
const HORIZON = 90.833 * RAD;

/**
 * The offset of a zone from UTC at a moment, in minutes (east is positive), read with Intl.
 * @param {string} zone  an IANA name such as "America/New_York"
 * @param {number} epochMs
 */
export function zoneOffsetMinutes(zone, epochMs) {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const part = {};
  for (const { type, value } of format.formatToParts(epochMs)) part[type] = Number(value);
  const asUtc = Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
  return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / MINUTE);
}

/**
 * The standard (non-daylight-saving) offset of a zone in the year of `epochMs`: the smaller of its January and July
 * offsets (daylight saving always adds time).
 */
export function standardOffsetMinutes(zone, epochMs) {
  const year = new Date(epochMs).getUTCFullYear();
  return Math.min(
    zoneOffsetMinutes(zone, Date.UTC(year, 0, 1)),
    zoneOffsetMinutes(zone, Date.UTC(year, 6, 1)),
  );
}

/** The widest gap in longitude, in degrees, at which a place still counts as being in the computer's own region. */
export const REGION_DEGREES = 15;

/**
 * Minutes by which solar noon is later than on the meridian of the zone, for a place at `longitude` (degrees, east
 * positive): 4 minutes per degree the place lies west of the meridian. Zero without a longitude or when the place is
 * more than `REGION_DEGREES` from the meridian (the player is elsewhere, DEC-64).
 * @param {number|null|undefined} longitude
 * @param {number} standardOffsetMinutes  the zone's standard offset from UTC, minutes
 */
export function longitudeNoonShiftMinutes(longitude, standardOffsetMinutes) {
  if (longitude === null || longitude === undefined || !Number.isFinite(longitude)) return 0;
  const meridian = standardOffsetMinutes / 4; // degrees: 15 degrees per hour
  const west = meridian - longitude;
  return Math.abs(west) <= REGION_DEGREES ? west * 4 : 0;
}

/** Day of the year, 1 to 366, of a calendar date. */
export function dayOfYear(year, month, day) {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY) + 1;
}

/**
 * The date and time on the wall of a zone with a given offset.
 * @param {number} epochMs
 * @param {number} offsetMinutes
 */
export function localParts(epochMs, offsetMinutes) {
  const shifted = new Date(epochMs + offsetMinutes * MINUTE);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return {
    year,
    month,
    day,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    /** Minutes since local midnight, with a fraction. */
    minuteOfDay:
      shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60,
    dayOfYear: dayOfYear(year, month, day),
    /** 0 is Sunday. */
    weekday: shifted.getUTCDay(),
  };
}

/** Declination of the sun (radians) and the equation of time (minutes) for a day of the year (NOAA's series). */
export function sunPosition(dayOfYearValue, hour = 12) {
  const g = ((2 * Math.PI) / 365) * (dayOfYearValue - 1 + (hour - 12) / 24);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  return { declination, equationOfTime };
}

/**
 * Sunrise, solar noon and sunset of the local day that contains `epochMs`.
 * @param {number} epochMs
 * @param {number} latitude  degrees, north positive (the place)
 * @param {{offsetMinutes: number, standardOffsetMinutes: number}} zone  the computer's zone now, and at standard time
 * @param {number|null} [longitude]  degrees, east positive (the place); moves solar noon when the place is in the region (DEC-64)
 * @returns {{noon: number, sunrise: number|null, sunset: number|null, dayLengthMinutes: number,
 *            polar: 'day'|'night'|null}}  epoch ms; sunrise and sunset are null in polar day or night
 */
export function sunTimes(epochMs, latitude, zone, longitude = null) {
  const parts = localParts(epochMs, zone.offsetMinutes);
  const midnight = epochMs - parts.minuteOfDay * MINUTE; // local midnight, epoch ms
  const { declination, equationOfTime } = sunPosition(parts.dayOfYear);
  // Solar noon in standard time on the meridian of the zone: 12:00 minus the equation of time; the wall clock adds the
  // daylight saving hour when it is in force.
  const noonMinute =
    720 -
    equationOfTime +
    (zone.offsetMinutes - zone.standardOffsetMinutes) +
    longitudeNoonShiftMinutes(longitude, zone.standardOffsetMinutes);
  const noon = midnight + noonMinute * MINUTE;
  const lat = Math.max(-89.9, Math.min(89.9, latitude)) * RAD;
  const cosHour =
    (Math.cos(HORIZON) - Math.sin(lat) * Math.sin(declination)) /
    (Math.cos(lat) * Math.cos(declination));
  if (cosHour >= 1)
    return { noon, sunrise: null, sunset: null, dayLengthMinutes: 0, polar: 'night' };
  if (cosHour <= -1)
    return { noon, sunrise: null, sunset: null, dayLengthMinutes: 1440, polar: 'day' };
  const half = (Math.acos(cosHour) / RAD) * 4; // minutes from noon to sunrise or sunset
  return {
    noon,
    sunrise: noon - half * MINUTE,
    sunset: noon + half * MINUTE,
    dayLengthMinutes: half * 2,
    polar: null,
  };
}

const smooth = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * How dark it is, 0 (full day) to 1 (night): a smooth fall from 20 minutes before sunset to 40 minutes after it, and the
 * same in the morning (from 40 minutes before sunrise to 20 minutes after). Polar day is 0 and polar night 1.
 */
export function nightnessAt(epochMs, sun) {
  if (sun.polar === 'day') return 0;
  if (sun.polar === 'night') return 1;
  if (epochMs >= sun.noon) return smooth((epochMs - (sun.sunset - 20 * MINUTE)) / (60 * MINUTE));
  return 1 - smooth((epochMs - (sun.sunrise - 40 * MINUTE)) / (60 * MINUTE));
}

/**
 * Builds `host.time`.
 * @param {{clock: {now: () => number}, readZone?: () => string, latitude: () => number, longitude?: () => number}} options
 *        `readZone` gives the computer's IANA zone (Intl by default); it is read again at most once a minute of clock
 *        time, so a laptop that travels changes zone without a restart
 */
export function createTime({
  clock,
  readZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  latitude,
  longitude = () => null,
}) {
  let zone = null;
  let readAt = -Infinity;
  const currentZone = (ms) => {
    if (zone === null || Math.abs(ms - readAt) >= MINUTE) {
      zone = readZone();
      readAt = ms;
    }
    return zone;
  };
  const offsets = (ms) => {
    const name = currentZone(ms);
    return {
      offsetMinutes: zoneOffsetMinutes(name, ms),
      standardOffsetMinutes: standardOffsetMinutes(name, ms),
    };
  };
  return {
    /** The IANA name of the computer's zone. */
    zone: () => currentZone(clock.now()),
    /** The date and time on the player's wall (the computer's zone), of `ms` or now. */
    parts: (ms = clock.now()) => localParts(ms, offsets(ms).offsetMinutes),
    /** Sunrise, noon and sunset of the day of `ms` or today (epoch ms), for the place's latitude. */
    sun: (ms = clock.now()) => sunTimes(ms, latitude(), offsets(ms), longitude()),
    /** 0 (day) to 1 (night), smooth around sunrise and sunset. */
    nightness: (ms = clock.now()) =>
      nightnessAt(ms, sunTimes(ms, latitude(), offsets(ms), longitude())),
  };
}
