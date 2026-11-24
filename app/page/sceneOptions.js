// Development options for the active scene, from `DESKTOP2_SCENE_OPTIONS` (a JSON object such as {"fish":8}): the main
// process passes the text on in the page address and the host hands the object to the scene as `host.options`.
// Anything that is not a JSON object gives {}: a typing mistake in a development switch must never stop the scene.

/**
 * @param {string|null|undefined} text
 * @returns {Record<string, unknown>}
 */
export function parseSceneOptions(text) {
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
