import { expect, test } from '@playwright/test';
import { launch } from './helpers.js';

test('first launch: the window opens with 2 fry of different species, 4 floating pellets and an empty stash', async () => {
  const { page, close } = await launch();
  try {
    await page.waitForSelector('canvas');
    const info = await page.evaluate(() => window.desktop2.getAppInfo());
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(info.mode).toBe('window');

    // Window mode shows the strip; the renderer got its mode from the URL.
    await expect(page.locator('#strip')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.mode)).toBe('window');

    const result = await page.evaluate(() => {
      const { scene, repository } = window.__scene;
      const { fish, tank } = repository.getState();
      return {
        species: fish.map((f) => f.species),
        points: fish.map((f) => f.growthPoints),
        floating: tank.floatingPellets,
        pelletSprites: scene.floating.active.length,
        fishSprites: scene.fishes.size,
        stash: tank.stash,
        hud: document.getElementById('stash-count').textContent,
      };
    });
    expect(result.species).toHaveLength(2);
    expect(result.species[0]).not.toBe(result.species[1]);
    expect(result.points).toEqual([0, 0]);
    expect(result).toMatchObject({ floating: 4, pelletSprites: 4, fishSprites: 2, stash: 0 });
    expect(result.hud).toBe('0 / 30');
  } finally {
    await close();
  }
});

// A window dragged by its edge resizes once a frame; every resize must free what the previous one made.
test('resizing many times keeps the number of textures on the graphics card the same', async () => {
  const { page, close } = await launch();
  try {
    const result = await page.evaluate(() => {
      const { fishtank, app } = window.__scene;
      const textures = () => app.renderer.texture.managedTextures.length;
      const draw = () => app.renderer.render(app.stage);
      const { width, height } = app.screen;
      draw();
      // A first round of sizes, so every texture that is made once already exists.
      fishtank.resize(width + 1, height + 1);
      draw();
      fishtank.resize(width, height);
      draw();
      const before = textures();
      for (let i = 0; i < 30; i++) {
        fishtank.resize(width - (i % 7) * 10, height - (i % 5) * 8);
        draw();
      }
      fishtank.resize(width, height);
      draw();
      return { before, after: textures() };
    });
    expect(result.after).toBe(result.before);
  } finally {
    await close();
  }
});

// The decoded atlas image is closed once it is on the graphics card (scenes/fishtank/view/textures.js), so a lost graphics
// context has to start the page again instead of drawing from an image that is gone.
test('a lost graphics context reloads the page, and the tank draws again', async () => {
  const { page, close } = await launch();
  try {
    expect(
      await page.evaluate(
        () =>
          window.__scene.app.renderer.texture.managedTextures.find((t) =>
            /fishtank-.*png/.test(t.label),
          ).resource?.width,
      ),
    ).toBe(0); // the atlas image was closed after the upload
    await page.evaluate(() => {
      window.__beforeReload = true;
      window.__scene.app.renderer.gl.getExtension('WEBGL_lose_context').loseContext();
    });
    await page.waitForFunction(
      () => window.__ready === true && window.__beforeReload === undefined,
    );
    expect(await page.evaluate(() => window.__scene.scene.fishes.size)).toBe(2);
  } finally {
    await close();
  }
});
