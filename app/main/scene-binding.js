// Which scene a page runs, as the main process knows it. The main process decides: it chooses the scene (app/main/
// scene-registry.js, `chooseActiveScene`), assigns it to the page's web contents before it loads the page, and every
// record call after that uses this id. A page cannot say which scene it is, so a scene reaches only its own record
// (docs/platform/02 section 4: "the path is chosen by the main process"). Until PR 7.3 the page claimed its own id once
// and the first claim won; that claim, and the bridge call for it, are gone.
// Plain Node, so it is unit-tested.

/** @param {(id: unknown) => boolean} isValidId */
export function createSceneBinding(isValidId) {
  // Keyed by the page's web contents, so a page that is closed and made again (a mode switch) starts unassigned.
  const assigned = new WeakMap();
  return {
    /**
     * Sets the scene of `owner`; only the main process calls this. A later call replaces the id (the scene switch of
     * work package 7.4 loads the same page again for another scene). Returns false and changes nothing for an id that
     * is not valid.
     */
    assign(owner, id) {
      if (!isValidId(id)) return false;
      assigned.set(owner, id);
      return true;
    },
    /** The scene id of `owner`, or null when the main process has not assigned one. */
    get: (owner) => assigned.get(owner) ?? null,
  };
}
