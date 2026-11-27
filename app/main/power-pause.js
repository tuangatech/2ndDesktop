// Which power events pause the scene, and under which reason (docs/platform/01 section 7; FR-22, NFR-1). A locked screen
// and a suspended computer are two reasons, not one: after a wake the Mac and Windows often show the lock screen
// first, so a `resume` must not start the scene again while the screen is still locked (Mac, 2026-11-27, a simulation).
// The scene runs again only when no reason is left (`setPauseReason` in desktop.js keeps the set).
export const POWER_PAUSES = [
  ['lock-screen', 'locked', true],
  ['unlock-screen', 'locked', false],
  ['suspend', 'asleep', true],
  ['resume', 'asleep', false],
];

/**
 * @param {{on(event: string, listener: () => void): unknown}} powerMonitor  Electron's `powerMonitor`
 * @param {(reason: string, on: boolean) => void} setPauseReason
 */
export function wirePowerPause(powerMonitor, setPauseReason) {
  for (const [event, reason, on] of POWER_PAUSES) {
    powerMonitor.on(event, () => setPauseReason(reason, on));
  }
}
