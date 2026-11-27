// The HTML laid over the canvas in window mode (D7): the stash counter, toast messages and the fish label with
// its rename box. Desktop mode shows no HTML at all (D31): the tray menu carries the same information.
import { MAX_NAME_LENGTH, stageOf } from '../game/rules.js';
import { visual } from '../view/visualConfig.js';
import './hud.css';

const STAGE_NAMES = { fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult' };
// The HTML of the tank (D7, D31): the stash counter, a message, the fish label and the first-launch hint.
const MARKUP = `
  <div id="stash" title="Pellets in your stash">
    <span class="dot"></span><span id="stash-count"></span>
  </div>
  <div id="toast" role="status"></div>
  <div id="label"></div>
  <div id="hint" role="note">
    Click food to collect it, then click the water to feed. Find the fish icon in your tray
    (menu bar) to move the tank onto your desktop. Turn on Launch at login to keep it there.
  </div>
`;
const BAD_NAME = `Use letters, numbers and spaces (up to ${MAX_NAME_LENGTH})`;

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
  const labelEl = $('label');

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

  // The fish label (FR-48): name or species, stage, and Hungry, Full or Drowsy. It stays for 3 seconds.
  let shown = null; // the fish the label is about
  let hideTimer = 0;
  let editing = false;
  let anchor = { x: 0, y: 0 }; // where the fish was when it was touched; the label stays there (a button that swims is hard to click)
  let hovered = false;
  const hideLabel = () => {
    clearTimeout(hideTimer);
    shown = null;
    editing = false;
    hovered = false;
    labelEl.classList.remove('show');
  };
  const armHide = () => {
    clearTimeout(hideTimer);
    if (hovered) return;
    hideTimer = setTimeout(hideLabel, visual.touch.labelSeconds * 1000);
  };
  const stateWord = (fish) => {
    if (repository.isDrowsy(fish.id)) return 'Drowsy';
    return repository.isFull(fish.id) ? 'Full' : 'Hungry';
  };

  // Puts the label above the anchor, inside the tank. Called whenever its content (and so its size) changes.
  function placeLabel() {
    const box = labelEl.getBoundingClientRect();
    const x = Math.min(Math.max(anchor.x - box.width / 2, 6), innerWidth - box.width - 6);
    const y = Math.min(
      Math.max(anchor.y - box.height - 16 * scene.layout.unit, 28),
      innerHeight - box.height - 6,
    );
    labelEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  function renderLabel() {
    if (!shown) return;
    const fish = shown;
    labelEl.replaceChildren();
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = fish.name || fish.species.name;
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = `${STAGE_NAMES[stageOf(fish.points, config)]} · ${stateWord(fish)}`;
    const rename = document.createElement('button');
    rename.textContent = 'Rename';
    rename.addEventListener('click', (event) => {
      event.stopPropagation();
      startEditing();
    });
    labelEl.append(title, detail, rename);
    placeLabel();
  }

  function startEditing() {
    if (!shown) return;
    const fish = shown;
    editing = true;
    clearTimeout(hideTimer);
    labelEl.replaceChildren();
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_NAME_LENGTH;
    input.value = fish.name ?? '';
    input.placeholder = fish.species.name;
    input.setAttribute('aria-label', 'Fish name');
    const save = () => {
      const result = scene.rename(fish.id, input.value);
      if (!result.ok) {
        toast(BAD_NAME);
        return;
      }
      editing = false;
      renderLabel();
      armHide();
    };
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') save();
      else if (event.key === 'Escape') {
        editing = false;
        renderLabel();
        armHide();
      }
    });
    labelEl.append(input);
    placeLabel();
    input.focus();
    input.select();
  }

  scene.onFishTouched = (fish) => {
    shown = fish;
    editing = false;
    anchor = { x: fish.pos.x, y: fish.pos.y };
    labelEl.classList.add('show');
    renderLabel();
    armHide();
  };
  // The label keeps up when the numbers change while it is open (a meal, a rename).
  repository.subscribe(() => {
    if (shown && !editing) renderLabel();
  });
  labelEl.addEventListener('pointerdown', (event) => event.stopPropagation());
  // While the pointer is on the label it stays open; it counts its 3 seconds again after the pointer leaves.
  labelEl.addEventListener('pointerenter', () => {
    hovered = true;
    clearTimeout(hideTimer);
  });
  labelEl.addEventListener('pointerleave', () => {
    hovered = false;
    if (shown && !editing) armHide();
  });

  return {
    /** Where collected pellets fly to: the middle of the stash counter, in pixels of the tank. */
    stashTarget() {
      const box = stashEl.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    },
    /** Called every frame: closes the label when its fish is gone. */
    update() {
      if (shown && !scene.fishes.has(shown.id)) hideLabel();
    },
  };
}
