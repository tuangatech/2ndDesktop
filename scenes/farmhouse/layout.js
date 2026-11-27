// Where the picture goes on the screen (docs/scenes/farmhouse.md section 5, P2 plan decision 2). The layers are painted
// once in a fixed design space, 2100 x 900, wider than 16:9 and with the house in the middle; the stage is scaled to
// cover the screen and anchored at the bottom, so a narrow screen (down to 4:3) crops the sides, an ultrawide one (21:9)
// shows more forest, fence and field, and nothing is painted again on a resize. Pure, so it is unit-tested.

export const DESIGN = Object.freeze({ width: 2100, height: 900, houseX: 1050 });

/**
 * The scale and position of the stage for a screen of `width` x `height` CSS pixels.
 * @returns {{scale: number, x: number, y: number}}  the stage's scale and top-left position
 */
export function coverFit(width, height) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const scale = Math.max(h / DESIGN.height, w / DESIGN.width);
  return {
    scale,
    x: (w - DESIGN.width * scale) / 2,
    y: h - DESIGN.height * scale, // anchored at the bottom: the field stays, the sky is cropped first
  };
}

/** A point of the screen in design units (the inverse of `coverFit`). */
export function toDesign(fit, screenX, screenY) {
  return { x: (screenX - fit.x) / fit.scale, y: (screenY - fit.y) / fit.scale };
}

/** The part of the design space that is on the screen, in design units. */
export function visibleDesign(width, height) {
  const fit = coverFit(width, height);
  const a = toDesign(fit, 0, 0);
  const b = toDesign(fit, width, height);
  return { left: a.x, top: a.y, right: b.x, bottom: b.y };
}
