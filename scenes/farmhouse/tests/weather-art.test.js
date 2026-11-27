import { describe, expect, it } from 'vitest';
import { DESIGN } from '../layout.js';
import {
  LEAF_COLOURS,
  PETAL_COLOURS,
  cloudPicture,
  flakePicture,
  fogPicture,
  leafPicture,
  moonPicture,
  petalPicture,
  rainPicture,
  starsPicture,
  sunPicture,
  vignettePicture,
} from '../art/weather.js';

const pictures = () => [
  cloudPicture(0),
  cloudPicture(1),
  fogPicture(),
  rainPicture(),
  flakePicture(),
  ...LEAF_COLOURS.map(leafPicture),
  ...PETAL_COLOURS.map(petalPicture),
  sunPicture(),
  moonPicture(),
  starsPicture(),
  vignettePicture(),
];

describe('the weather art', () => {
  it('is the same every time and has no bad numbers', () => {
    expect(pictures()).toEqual(pictures());
    for (const picture of pictures()) {
      expect(picture.ops.length).toBeGreaterThan(0);
      expect(JSON.stringify(picture.ops)).not.toMatch(/NaN|undefined|Infinity|null/);
    }
  });

  it('draws the things that move around their own centre, so an anchored sprite can be put at a point', () => {
    const centred = [
      cloudPicture(0),
      fogPicture(),
      rainPicture(),
      flakePicture(),
      sunPicture(),
      moonPicture(),
    ];
    for (const picture of centred) {
      expect(picture.x + picture.width / 2).toBeCloseTo(0, 5);
      expect(picture.y + picture.height / 2).toBeCloseTo(0, 5);
    }
  });

  it('keeps every texture small: the fog is wider than the design, the whole set under a million pixels', () => {
    expect(fogPicture().width).toBeGreaterThan(DESIGN.width);
    const pixels = pictures().reduce((sum, p) => sum + p.pixelWidth * p.pixelHeight, 0);
    expect(pixels).toBeLessThan(1_000_000);
  });

  it('has ninety stars in the top of the sky and a vignette over the whole picture', () => {
    const stars = starsPicture();
    expect(stars.ops).toHaveLength(90);
    expect(stars.y + stars.height).toBeLessThan(300);
    expect(vignettePicture().width).toBe(DESIGN.width);
    expect(vignettePicture().height).toBe(DESIGN.height);
  });
});
