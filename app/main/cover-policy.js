// The setting "When the desktop is covered" (docs/platform/01 section 7.1): what the host does when a window hides the
// scene. Pure, so the table of choices and power states is unit-tested without Electron.
//
//   always  "Always pause" (the default, chosen by the owner on 2026-11-23): stop drawing whenever covered.
//   auto    "Pause on battery only": stop drawing on battery power, or when the power state cannot be read.
//   never   "Never pause": keep drawing.
//
// Lock, sleep, a hidden or minimised window and a full-screen app pause in every case: those are other pause reasons
// (`power`, `hidden`) and this setting is not asked about them.

export const WHEN_COVERED = Object.freeze(['always', 'auto', 'never']);
export const DEFAULT_WHEN_COVERED = 'always';

/** The words the menus show, in the order of `WHEN_COVERED`. */
export const WHEN_COVERED_LABELS = Object.freeze({
  always: 'Always pause',
  auto: 'Pause on battery only',
  never: 'Never pause',
});

/** `setting` as stored, or the default for anything that is not one of the three words. */
export function normalizeWhenCovered(setting) {
  return WHEN_COVERED.includes(setting) ? setting : DEFAULT_WHEN_COVERED;
}

/**
 * Does a covered desktop stop the drawing?
 * @param {string | undefined} setting  `always`, `auto` or `never`; anything else counts as the default
 * @param {boolean | null | undefined} onBattery  true on battery power, false on AC; null or undefined when unknown
 */
export function shouldPauseWhenCovered(setting, onBattery) {
  switch (normalizeWhenCovered(setting)) {
    case 'never':
      return false;
    case 'auto':
      // A desktop computer with no battery reports AC. If the power state cannot be read, stop: the quiet choice.
      return onBattery !== false;
    default:
      return true;
  }
}
