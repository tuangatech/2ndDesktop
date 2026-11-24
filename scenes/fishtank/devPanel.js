// The development panel (plan Steps 3 and 5): points slider, spawn buttons, stash, and time travel by moving the
// dev clock, so the pacing and the thresholds can be tested without waiting. Shown only in window mode with
// FISHTANK_DEV=1. It is a tool and is not part of the product.

const HOUR = 60 * 60 * 1000;

/**
 * @param {{scene: import('./TankScene.js').TankScene,
 *          repository: ReturnType<typeof import('./repo/LocalTankRepository.js').createLocalRepository>,
 *          clock: {offset: number}, speciesIds?: string[]}} options
 */
export function createDevPanel({ scene, repository, clock, speciesIds = ['tetra'] }) {
  const panel = document.createElement('div');
  panel.id = 'dev';

  const row = (...children) => {
    const el = document.createElement('div');
    el.append(...children);
    panel.append(el);
    return el;
  };
  const button = (label, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  const pointsLabel = document.createElement('span');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '450';
  slider.step = '5';
  slider.value = '150';
  const applyPoints = () => {
    const value = Number(slider.value);
    pointsLabel.textContent = `points ${value}`;
    for (const fish of repository.getState().fish) repository.dev.setPoints(fish.id, value);
  };
  slider.addEventListener('input', applyPoints);
  pointsLabel.textContent = `points ${slider.value}`;
  row(pointsLabel, slider);

  const spawn = (count) => {
    // The species take turns, so the tank shows the whole cast.
    repository.dev.setFish(
      Array.from({ length: count }, (_, i) => ({
        species: speciesIds[i % speciesIds.length],
        points: Number(slider.value),
      })),
    );
  };
  row(
    button('2 fish', () => spawn(2)),
    button('8 fish', () => spawn(8)),
  );

  const stash = document.createElement('span');
  const clockLabel = document.createElement('span');
  const refresh = () => {
    const summary = repository.getSummary();
    stash.textContent = `stash ${summary.stash}, waiting ${summary.waiting}, hungry ${summary.hungry}, eggs ${summary.eggs}`;
    clockLabel.textContent = `clock +${(clock.offset / HOUR).toFixed(1)} h`;
  };
  repository.subscribe(refresh);
  refresh();
  row(
    button('drop pellet', () => scene.feedOne()),
    button('stash +10', () => repository.dev.addStash(10)),
    button('12 fed', () => repository.dev.addFed(12)),
  );
  row(stash);

  // Time travel: the dev clock moves forward, then the tank settles at once.
  const travel = (ms) => () => {
    clock.offset += ms;
    scene.tick();
    refresh();
  };
  row(
    button('+10 min', travel(10 * 60_000)),
    button('+1 h', travel(HOUR)),
    button('+12 h', travel(12 * HOUR)),
    button('+24 h', travel(24 * HOUR)),
  );
  row(clockLabel);

  document.body.append(panel);
  return panel;
}
