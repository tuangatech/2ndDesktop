// The colours of the forest for a day of the year (docs/scenes/farmhouse.md table 4.2). Pure. `season` is what
// `seasonAt()` gives (leaf, turn, day, winter); the same tree keeps its place all year and only its colour moves:
// fresh light green in spring, deep green in summer, yellow, orange and red in autumn (the concept picture), brown and
// then bare grey-brown in winter, with snow on top when it snows.
import { smooth } from '../game/hash.js';
import { mix } from './colour.js';

// Nine tones in every stage; a tree takes the same index in each, so a tree that is red in October was a deep green in July.
const GREEN_FRESH = [
  '#8cba5c',
  '#9cc566',
  '#7fae52',
  '#a6cc6e',
  '#86b458',
  '#95c060',
  '#7aa84e',
  '#a0c868',
  '#8ab656',
];
const GREEN_DEEP = [
  '#4f7a3c',
  '#5c8a44',
  '#456f36',
  '#648f48',
  '#527f3f',
  '#5a8642',
  '#406a33',
  '#5f8d46',
  '#4a7539',
];
const AUTUMN = [
  '#c9983f',
  '#d9b04a',
  '#c2692f',
  '#a9482d',
  '#8f8a43',
  '#b87a35',
  '#7d8a4a',
  '#d2a23c',
  '#b4552e',
];
const BROWN = [
  '#8a6a46',
  '#9b7b52',
  '#7a5f40',
  '#a58763',
  '#86684a',
  '#947551',
  '#7c6246',
  '#a08060',
  '#836548',
];
const BARE = [
  '#8d7f72',
  '#9a8c7c',
  '#7f7468',
  '#a39684',
  '#877a6d',
  '#948777',
  '#7b7064',
  '#9d8f7f',
  '#85796c',
];
export const TONES = GREEN_DEEP.length;

/** The dark conifers keep their green all year. */
export const CONIFERS = ['#3f5a45', '#35503f', '#4a6048'];
export const TRUNK = '#5d4a3b';
const SNOW = '#f1f2ee';

/**
 * The colour of one deciduous crown.
 * @param {{leaf: number, turn: number, day: number}} season
 * @param {number} tone  0 to 8, the tree's tone
 * @param {number} [jitter]  -0.15 to 0.15: a tree turns a little earlier or later than its neighbour
 */
export function crownColour(season, tone, jitter = 0) {
  const fresh = 1 - smooth((season.day - 100) / 60); // spring green is lighter until about June
  const green = mix(GREEN_DEEP[tone], GREEN_FRESH[tone], fresh);
  const t = Math.max(0, Math.min(1, season.turn + jitter));
  let c = mix(green, AUTUMN[tone], smooth(t / 0.8));
  c = mix(c, BROWN[tone], smooth((t - 0.8) / 0.2));
  return mix(c, BARE[tone], 1 - smooth(season.leaf * 1.25));
}

/** Snow on a colour that points up (crowns, the hill, the field): `cover` 0 to 1. */
export const snowy = (colour, cover) => mix(colour, SNOW, Math.max(0, Math.min(1, cover)) * 0.6);

/**
 * The key of the forest's palette: it changes when the colours have moved enough to be worth drawing the forest again
 * (steps of 0.04 of the leaf, the colour and the snow), so a day in Calendar mode rarely makes a new key.
 */
export const paletteKey = (season, snowCover) =>
  [season.leaf, season.turn, season.day < 100 ? 0 : 1 - smooth((season.day - 100) / 60), snowCover]
    .map((v) => Math.round(v / 0.04))
    .join(':');
