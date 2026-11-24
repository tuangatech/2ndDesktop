// Which display mode the app starts in, and how a bad desktop attach is remembered (FR-60, FR-64, D27, tech design
// 3.8 "Safe start"). Pure functions over plain settings, so the state machine is unit-tested without Electron.
//
// Two settings are kept in settings.json:
//   displayMode    'window' | 'desktop'              what the player last had (no value yet on the first launch)
//   desktopAttempt 'trying' | 'ok' | 'failed'        'trying' is written before the tank is attached to the desktop
//                                                    and 'ok' after the first frame and 10 stable seconds; a launch
//                                                    that finds 'trying' knows the last attempt crashed or hung.

export const CHOICES = Object.freeze({
  displayMode: ['window', 'desktop'],
  desktopAttempt: ['trying', 'ok', 'failed'],
});

/** The tray note when the app started in a window because the last desktop attempt did not finish (FR-64). */
export const FALLBACK_NOTE = "Couldn't show on the desktop, showing in a window";

/**
 * The mode to start in.
 * @param {{displayMode?: string, desktopAttempt?: string}} settings
 * @param {string} [forced]  DESKTOP2_MODE, for development and tests: used as is and nothing is remembered
 * @returns {{mode: 'window' | 'desktop', reason: string | null, remember: boolean}}
 *   `reason` is set when the desktop was skipped because the last attempt did not finish.
 */
export function chooseStartMode(settings, forced) {
  if (forced === 'window' || forced === 'desktop') {
    return { mode: forced, reason: null, remember: false };
  }
  if (settings?.displayMode === 'desktop') {
    if (settings.desktopAttempt === 'trying') {
      return { mode: 'window', reason: 'the last desktop attempt did not finish', remember: true };
    }
    return { mode: 'desktop', reason: null, remember: true };
  }
  // The first launch has no stored mode: it opens in a window with the hint (spec section 8).
  return { mode: 'window', reason: null, remember: true };
}

/**
 * What to store when the app quits normally. A quit during the 10 seconds of `trying` is not a crash or a hang (the
 * app was running and shut down by itself), so the next launch must not mistake it for one.
 * @returns {{desktopAttempt: 'ok'} | null}  null when nothing changes
 */
export function settingsOnQuit(settings) {
  return settings?.desktopAttempt === 'trying' ? { desktopAttempt: 'ok' } : null;
}

/**
 * What to store when the app is now in `mode`. A mode reached because the desktop did not work (`reason`) is
 * remembered as a window with a failed attempt, so the next launch opens in a window without trying again; the
 * tray menu offers the desktop again.
 */
export function settingsForMode(mode, reason) {
  if (reason) return { displayMode: 'window', desktopAttempt: 'failed' };
  return { displayMode: mode };
}
