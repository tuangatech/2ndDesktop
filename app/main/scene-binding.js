// Which scene a page runs, as the main process knows it. The host part of the page says it once, before any scene
// code is loaded, and every record call after that uses this id: a scene cannot read or write the record of another
// scene by sending another id (docs/platform/02 section 4: "the path is chosen by the main process").
// The first valid claim of a page wins and a later one with another id is refused. Plain Node, so it is unit-tested.

/** @param {(id: unknown) => boolean} isValidId */
export function createSceneBinding(isValidId) {
  // Keyed by the page's web contents, so a page that is closed and made again (a mode switch) starts unbound.
  const bound = new WeakMap();
  return {
    /** Returns true when `owner` is bound to `id` afterwards (a repeated claim of the same id, for example after a reload, is fine). */
    bind(owner, id) {
      if (!isValidId(id)) return false;
      if (!bound.has(owner)) bound.set(owner, id);
      return bound.get(owner) === id;
    },
    /** The scene id of `owner`, or null when the page has not said yet. */
    get: (owner) => bound.get(owner) ?? null,
  };
}
