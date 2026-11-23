// The title screen: new game, continue, three save slots, the story so far and a controls
// card, shown over a slow flight around the living city.
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { CAST } from './characterPortraits.js';
import { formatCash } from '../core/mathUtil.js';

const CONTROLS = [
  ['W A S D', 'Walk / drive'], ['Mouse', 'Look and aim'], ['Shift', 'Sprint'], ['Space', 'Handbrake'],
  ['F', 'Enter, exit or steal a vehicle'], ['Left click', 'Shoot or punch'], ['Right click', 'Aim'],
  ['1-5 / wheel', 'Choose weapon'], ['N', 'Change radio station'], ['T', 'Start a cab fare (in a Cabana Cab)'],
  ['H', 'Siren (in a police car)'], ['Q E', 'Turn the camera'], ['M / Esc', 'Map, missions and saving'],
];

export function createStartMenu(game, actions) {
  const root = document.getElementById('start-menu');
  const slotsBox = document.getElementById('save-slots');
  const storyBox = document.getElementById('story-so-far');
  const controlsBox = document.getElementById('controls-help');
  const continueButton = document.getElementById('button-continue');

  controlsBox.innerHTML = CONTROLS.map(([keys, what]) => `<div><kbd>${keys}</kbd> ${what}</div>`).join('');

  /** The save slots, each showing where its story stands. */
  function renderSlots() {
    const slots = game.saves.listSlots();
    slotsBox.innerHTML = slots.map((slot, index) => slot
      ? `<div class="save-slot" data-slot="${index}"><b>SLOT ${index + 1} - ${slot.title}</b>${slot.rank} - ${formatCash(slot.cash)} - ${slot.missionIndex}/${STORY_MISSIONS.length} jobs - saved ${slot.savedAt.slice(0, 16)}</div>`
      : `<div class="save-slot empty" data-slot="${index}"><b>SLOT ${index + 1} - EMPTY</b>Start a new story here</div>`).join('');
    continueButton.disabled = !game.saves.hasAnySave();
  }

  /** The mission list on the title screen: done, next and still locked. */
  function renderStory(doneCount) {
    const lines = STORY_MISSIONS.map((mission, index) => {
      const status = index < doneCount ? 'done' : index === doneCount ? 'next' : 'locked';
      const mark = status === 'done' ? '&#10003;' : status === 'next' ? '&#9654;' : '&#8226;';
      return `<li class="${status}">${mark} ${mission.title} <small>- ${CAST[mission.contact].name}</small></li>`;
    });
    storyBox.innerHTML = '<h3>THE STORY - 8 JOBS</h3><ul style="list-style:none;margin:0;padding-left:14px">' + lines.join('') + '</ul>';
  }

  function show() {
    const latest = game.saves.latestSlot();
    const slots = game.saves.listSlots();
    renderSlots();
    renderStory(latest >= 0 ? slots[latest].missionIndex : 0);
    root.hidden = false;
  }

  function hide() {
    root.hidden = true;
    controlsBox.hidden = true;
  }

  document.getElementById('button-new-game').addEventListener('click', () => actions.newGame(game.saves.firstEmptySlot()));
  continueButton.addEventListener('click', () => {
    const slot = game.saves.latestSlot();
    if (slot >= 0) actions.loadGame(slot);
  });
  document.getElementById('button-controls').addEventListener('click', () => { controlsBox.hidden = !controlsBox.hidden; });
  slotsBox.addEventListener('click', (event) => {
    const box = event.target.closest('.save-slot');
    if (!box) return;
    const slot = Number(box.dataset.slot);
    if (box.classList.contains('empty')) actions.newGame(slot);
    else actions.loadGame(slot);
  });

  return { show, hide, renderSlots, renderStory };
}
