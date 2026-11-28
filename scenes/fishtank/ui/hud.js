// The HTML laid over the canvas in window mode (D7): the stash counter, toast messages and the first-launch hint.
// Desktop mode shows no HTML at all (D31): the tray menu carries the same information. A fish has no label and no name
// (DEC-71): a click on a fish is only a wiggle.
import './hud.css';

// The HTML of the tank (D7, D31): the stash counter, a message and the first-launch hint.
const MARKUP = `
  <div id="stash" title="Pellets in your stash">
    <span class="dot"></span><span id="stash-count"></span>
  </div>
  <div id="toast" role="status"></div>
  <div id="hint" role="note">
    Click food to collect it, then click the water to feed. Find the fish icon in your tray
    (menu bar) to move the tank onto your desktop. Turn on Launch at login to keep it there.
  </div>
`;

/**
 * @param {{scene: import('../view/TankScene.js').TankScene,
 *          repository: import('../game/repo/TankRepository.js').TankRepository,
 *          config: typeof import('../game/config.js').config,
 *          root: HTMLElement}} options  root: the element the host gives to the scene for HTML (host.ui.root)
 */
export function createHud({ scene, repository, config, root }) {
  root.innerHTML = MARKUP;
  const $ = (id) => root.querySelector(`#${id}`);
  const stashEl = $('stash');
  const countEl = $('stash-count');
  const toastEl = $('toast');

  // The stash counter (FR-4).
  const refreshStash = () => {
    countEl.textContent = `${repository.getState().tank.stash} / ${config.pellets.maxStash}`;
  };
  repository.subscribe(refreshStash);
  refreshStash();

  // The first-launch hint (spec section 8) stays until the first successful feed; fishtank.js then marks it shown.
  const hintEl = $('hint');
  const refreshHint = () => hintEl.classList.toggle('show', !repository.getState().tank.hintShown);
  repository.subscribe(refreshHint);
  refreshHint();

  // Toasts fade after 2 seconds.
  let toastTimer = 0;
  const toast = (text) => {
    if (!text) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
  };
  scene.onMessage = toast;

  return {
    /** Where collected pellets fly to: the middle of the stash counter, in pixels of the tank. */
    stashTarget() {
      const box = stashEl.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    },
  };
}
