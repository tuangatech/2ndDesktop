// Switching the scene (work package 7.4, docs/platform/01 section 4): the main process asks the old page for a final
// save, waits a moment for the answer, writes every waiting record, remembers the new scene, and loads the page again.
// The page never navigates itself. A switch that cannot keep the old scene's save does not happen: the old scene goes on.
// Plain Node (the Electron parts are passed in), so it is unit-tested.

/** How long the old page has to answer the save request. */
export const SAVE_TIMEOUT_MS = 1000;

/**
 * @param {object} deps
 * @param {() => string} deps.current  the scene that runs now
 * @param {(id: string) => boolean} deps.canChoose  a scene the player may have in this build
 * @param {() => Promise<boolean>} deps.askSave  asks the page to save and waits for its answer; false after the timeout
 * @param {() => boolean} deps.flush  writes the waiting records; false when something is still unsaved
 * @param {(id: string) => boolean} deps.activate  remembers the scene (settings.json); false when it could not be written
 * @param {() => Promise<boolean>} deps.reload  loads the page again for the scene that was activated
 * @param {() => boolean} [deps.ready]  false while the window is changing mode or is gone
 * @param {(message: string) => void} [deps.log]
 */
export function createSceneSwitcher({
  current,
  canChoose,
  askSave,
  flush,
  activate,
  reload,
  ready = () => true,
  log = () => {},
}) {
  let busy = false;
  return {
    isBusy: () => busy,
    /** @returns {Promise<{ok: boolean, reason?: string}>} */
    async switchTo(id) {
      if (busy) return { ok: false, reason: 'busy' };
      if (!canChoose(id)) return { ok: false, reason: 'unknown' };
      if (id === current()) return { ok: false, reason: 'same' };
      if (!ready()) return { ok: false, reason: 'not-ready' };
      busy = true;
      const from = current();
      try {
        if (!(await askSave())) log(`switch ${from} to ${id}: the page did not answer in time`);
        if (!flush()) {
          log(`switch ${from} to ${id}: refused, a record is still unsaved`);
          return { ok: false, reason: 'unsaved' };
        }
        if (!activate(id)) {
          log(`switch ${from} to ${id}: refused, the choice could not be written`);
          return { ok: false, reason: 'not-written' };
        }
        if (!(await reload())) {
          // The window went away on the way (the app is closing); the choice stays, the next start runs it.
          log(`switch ${from} to ${id}: no window to load`);
          return { ok: false, reason: 'no-window' };
        }
        log(`scene is now ${id} (was ${from})`);
        return { ok: true };
      } catch (error) {
        log(`switch ${from} to ${id} failed: ${error?.code ?? error?.name ?? 'error'}`);
        return { ok: false, reason: 'error' };
      } finally {
        busy = false;
      }
    },
  };
}
