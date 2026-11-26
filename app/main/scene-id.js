// The one rule for a scene id, used by the registry (scene.json), the record store (the file name), the settings
// (`activeScene`) and the scene switch. Lowercase letters, digits and dashes, starting with a letter, 3 to 32 characters.
// A scene's folder name is its id (app/main/scene-registry.js), so the id is also safe as a file name.
// Plain Node, so it is unit-tested.
export const SCENE_ID_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;

/** @param {unknown} id */
export const isSceneId = (id) => typeof id === 'string' && SCENE_ID_PATTERN.test(id);
