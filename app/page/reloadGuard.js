// A lost graphics context reloads the page (app/page/main.js). If the context is lost again and again (a failing
// driver, the graphics process crashing), reloading forever would burn CPU and flicker. After RELOAD_LIMIT reloads
// within RELOAD_WINDOW_MS the page stays as it is, paused. The times are kept in sessionStorage, which survives a
// reload of the same window and is gone when the app quits.

export const RELOAD_LIMIT = 3;
export const RELOAD_WINDOW_MS = 60_000;
const KEY = 'desktop2.reloads';

/**
 * Decides whether to reload now. Pure: `times` are the earlier reloads (ms), the answer carries the list to keep.
 * @param {number[]} times
 * @param {number} now
 * @returns {{reload: boolean, times: number[]}}
 */
export function decideReload(
  times,
  now,
  { limit = RELOAD_LIMIT, windowMs = RELOAD_WINDOW_MS } = {},
) {
  const recent = (Array.isArray(times) ? times : []).filter(
    (t) => Number.isFinite(t) && t <= now && now - t < windowMs,
  );
  if (recent.length >= limit) return { reload: false, times: recent };
  return { reload: true, times: [...recent, now] };
}

/**
 * Reads and updates the reload times in `storage` (sessionStorage). Returns false when the page should not
 * reload again. Without usable storage it returns true, which is the old behaviour (always reload).
 * @param {Pick<Storage, 'getItem'|'setItem'>|null|undefined} storage
 * @param {number} [now]
 */
export function reloadAllowed(storage, now = Date.now()) {
  try {
    const times = JSON.parse(storage?.getItem(KEY) ?? '[]');
    const decision = decideReload(times, now);
    storage?.setItem(KEY, JSON.stringify(decision.times));
    return decision.reload;
  } catch {
    return true;
  }
}
