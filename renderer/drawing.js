// Drawing resolution rules (tech design 3.8, FR-63).
// Desktop mode never draws more pixels than 1600 x 900, and the browser scales the canvas up. Every megapixel costs
// about 21 MB in the graphics process (perf-notes.md); 1600 x 900 looks almost the same as 1920 x 1080.
export const MAX_DESKTOP_PIXELS = 1600 * 900;

export function drawingResolution(mode, cssWidth, cssHeight, devicePixelRatio) {
  if (mode !== 'desktop') return devicePixelRatio;
  const cap = Math.sqrt(MAX_DESKTOP_PIXELS / Math.max(1, cssWidth * cssHeight));
  return Math.min(devicePixelRatio, cap);
}
