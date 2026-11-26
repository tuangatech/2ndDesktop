// The host's copy of PixiJS as one file (docs/platform/01, section 8.6): the eval-free shader code first, then all of
// PixiJS. The harness serves the built file at scene://spike/_host/pixi.js, and an import map points every
// `import 'pixi.js'` (the host page and the scene) at it, so there is exactly one copy.
import 'pixi.js/unsafe-eval';
export * from 'pixi.js';
