// The throwaway scene pack: one ES module that imports PixiJS by its plain name, like a scene written for the host.
// It must get the host's copy through the import map (it cannot bundle its own, see docs/platform/01 section 8.6).
import { Container, Graphics } from 'pixi.js';

export { Container };

/** A red square at 0,0, 32 by 32 pixels. */
export function makeScene() {
  const root = new Container();
  root.addChild(new Graphics().rect(0, 0, 32, 32).fill(0xff0000));
  return root;
}
