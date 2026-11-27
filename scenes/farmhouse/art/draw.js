// A picture is a list of drawing operations (plain data), painted onto a canvas once and uploaded as one texture
// (raster.js). The first spike drew SVG text through an <img>: it looked right, but the browser kept the SVG document of
// every picture alive until a garbage collection that never came (the page's script heap is tiny, so it never runs one),
// and the page grew by about 30 MB per rebuild. Painting the same shapes with the canvas leaves only the bitmap.
//
// The operations, all in the design space of layout.js:
//   {t: 'rect', x, y, w, h, fill, rx?}
//   {t: 'ellipse', x, y, rx, ry, fill}               (x, y the centre)
//   {t: 'path', d, fill?, stroke?, width?, cap?}      (d is SVG path text, drawn with Path2D)
//   {t: 'clip', x, y, rx, ry, ops}                    (the operations inside, only where the ellipse is)
// and on any of them alpha?, and stroke? and width? on a rect or an ellipse.
// A fill is a '#rrggbb' colour or a vertical gradient {y0, y1, stops: [[offset, '#rrggbb', alpha], ...]}.

/** '#rrggbb' and an alpha as a CSS colour. */
export function rgba(hex, alpha = 1) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

/** A vertical gradient fill from the top colour to the bottom one (both may be clear). */
export const gradient = (y0, y1, c1, c2, a1 = 1, a2 = 1) => ({
  y0,
  y1,
  stops: [
    [0, c1, a1],
    [1, c2, a2],
  ],
});

/** A band that is clear at both edges, thickest a third of the way down: no line shows where it starts. */
export const band = (y0, y1, colour, alpha) => ({
  y0,
  y1,
  stops: [
    [0, colour, 0],
    [0.35, colour, alpha],
    [1, colour, 0],
  ],
});

function styleOf(ctx, fill) {
  if (typeof fill === 'string') return fill;
  const g = ctx.createLinearGradient(0, fill.y0, 0, fill.y1);
  for (const [offset, colour, alpha] of fill.stops) g.addColorStop(offset, rgba(colour, alpha));
  return g;
}

/**
 * A picture: its operations and the strip of the design it covers (x, y, width, height in design units), drawn at a
 * resolution (pixels per design unit).
 * @param {{x?: number, y: number, width?: number, height: number, resolution: number}} strip
 * @param {Array<object>} ops
 */
export function makePicture(strip, ops) {
  const { x = 0, y, width = 2100, height, resolution } = strip;
  return {
    x,
    y,
    width,
    height,
    pixelWidth: Math.max(1, Math.round(width * resolution)),
    pixelHeight: Math.max(1, Math.round(height * resolution)),
    ops,
  };
}

/**
 * Paints the operations of a picture. The context is already scaled to the design space. Every operation may have an
 * `alpha`; a rect may have `rx` (rounded corners) and a `stroke` and `width`; a path may have no fill (a line) and a
 * `cap`.
 * @param {OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D} ctx
 * @param {Array<object>} ops
 */
export function paint(ctx, ops) {
  for (const op of ops) {
    ctx.globalAlpha = op.alpha ?? 1;
    if (op.t === 'rect') {
      ctx.beginPath();
      if (op.rx) ctx.roundRect(op.x, op.y, op.w, op.h, op.rx);
      else ctx.rect(op.x, op.y, op.w, op.h);
      if (op.fill) {
        ctx.fillStyle = styleOf(ctx, op.fill);
        ctx.fill();
      }
      if (op.stroke) outline(ctx, op);
    } else if (op.t === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(op.x, op.y, op.rx, op.ry, 0, 0, Math.PI * 2);
      if (op.fill) {
        ctx.fillStyle = styleOf(ctx, op.fill);
        ctx.fill();
      }
      if (op.stroke) outline(ctx, op);
    } else if (op.t === 'path') {
      const path = new Path2D(op.d);
      if (op.fill) {
        ctx.fillStyle = styleOf(ctx, op.fill);
        ctx.fill(path);
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.width ?? 1;
        ctx.lineJoin = 'round';
        ctx.lineCap = op.cap ?? 'butt';
        ctx.stroke(path);
      }
    } else if (op.t === 'clip') {
      // The operations inside are drawn only where the ellipse is.
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(op.x, op.y, op.rx, op.ry, 0, 0, Math.PI * 2);
      ctx.clip();
      paint(ctx, op.ops);
      ctx.restore();
    } else {
      throw new Error('unknown drawing operation ' + op.t);
    }
  }
  ctx.globalAlpha = 1;
}

function outline(ctx, op) {
  ctx.strokeStyle = op.stroke;
  ctx.lineWidth = op.width ?? 1;
  ctx.stroke();
}
