// Fast mode (docs/scenes/farmhouse.md section 4.3): each real day runs through one month, so a year takes twelve days.
// Pure. The fast date is a function of the moment and of the moment Fast mode was switched on (kept in the record), so
// after a gap it is right at once, like everything else (R1). The day the player switches it on is the first of January
// of the place's own calendar (in a southern city that is summer: `seasonAt` shifts the hemisphere).
import { YEAR, wrapDay } from './season.js';

const DAY_MS = 86_400_000;
/** Days of the fast calendar that pass in one real day: a twelfth of a year. */
export const FAST_DAYS_PER_DAY = YEAR / 12;
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** Where each month starts, as a day of the year (365-day year). */
const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/**
 * How many fast days have passed since Fast mode was switched on.
 * @param {number} ms
 * @param {number} startedAt  epoch ms of the switch
 */
export const fastElapsed = (ms, startedAt) =>
  (Math.max(0, ms - startedAt) / DAY_MS) * FAST_DAYS_PER_DAY;

/** The fast date: the day of the year (1 to 365) and a number that goes up by one with each fast day, for the weather. */
export function fastDate(ms, startedAt) {
  const elapsed = fastElapsed(ms, startedAt);
  return { dayOfYear: wrapDay(1 + Math.floor(elapsed)), dayIndex: Math.floor(elapsed) };
}

/** The name of the month a day of the year is in (the place's own calendar). */
export function monthOf(dayOfYear) {
  let month = 0;
  for (let i = 0; i < MONTH_START.length; i++) if (dayOfYear >= MONTH_START[i]) month = i;
  return MONTHS[month];
}
