// The record of the empty scene: how many times it was started. Pure, so it is unit-tested without PixiJS.

export const RECORD_SCHEMA = 1;
const MAX_OPENED = 1_000_000_000;

/**
 * The record to save after one more start.
 * @param {{status: string, data?: unknown}|undefined} loaded  what `host.record.load()` returned
 * @returns {{schema: number, opened: number}}
 */
export function nextRecord(loaded) {
  const before =
    loaded?.status === 'ok' &&
    Number.isInteger(loaded.data?.opened) &&
    loaded.data.opened >= 0 &&
    loaded.data.opened < MAX_OPENED
      ? loaded.data.opened
      : 0;
  return { schema: RECORD_SCHEMA, opened: before + 1 };
}
