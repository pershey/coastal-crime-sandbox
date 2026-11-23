// The pause screen: a full map of Tamarind Coast with districts, shops, the next job and
// the police, beside the mission list, the player's statistics and the save button.
import { CITY, DISTRICTS, PLACES } from '../city/cityLayout.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { RANKS } from '../missions/progression.js';
import { formatCash, formatClock } from '../core/mathUtil.js';
import { paintCityBase, placeColor } from './minimap.js';

const DISTRICT_LABELS = [
  ['sunrow', 4.5, 6.5], ['glass', 4.5, 2.5], ['market', 3.5, 5], ['port', 0.6, 4.6], ['heights', 7.5, 1.5], ['flats', 1.5, 1.2], ['marina', 8, 5.6],
];

export function createPauseMap(game, actions) {
  const root = document.getElementById('pause-map');
  const canvas = document.getElementById('city-map');
  const ctx = canvas.getContext('2d');
  const scale = 0.8;
  const originX = 104, originZ = 60;

  function drawMap() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, originX * scale, originZ * scale);
    paintCityBase(ctx, game.city.plan, true);
    ctx.textAlign = 'center';
    ctx.font = '900 17px Arial';
    for (const [key, i, j] of DISTRICT_LABELS) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillStyle = '#ffffff';
      ctx.strokeText(DISTRICTS[key].name.toUpperCase(), i * CITY.pitch, j * CITY.pitch);
      ctx.fillText(DISTRICTS[key].name.toUpperCase(), i * CITY.pitch, j * CITY.pitch);
    }
    const dot = (x, z, color, radius) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, z, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    for (const place of Object.values(PLACES)) if (place.icon !== 'job') dot(place.x, place.z, placeColor(place.icon), 8);
    for (const marker of game.markers.list) if (marker.kind !== 'service') dot(marker.x, marker.z, marker.color, 11);
    for (const vehicle of game.fleet.vehicles) if (vehicle.role === 'police' && !vehicle.wrecked) dot(vehicle.x, vehicle.z, '#3d8bff', 6);
    const p = game.player.position();
    ctx.save();
    ctx.translate(p.x, p.z);
    ctx.rotate(Math.PI - game.player.state.heading);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(11, 12);
    ctx.lineTo(0, 6);
    ctx.lineTo(-11, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function renderSidebar() {
    const legend = [['You', '#ffffff'], ['Job', '#ff8ad0'], ['Objective', '#ffe14f'], ['Garage', placeColor('home')], ['Ammo Shack', placeColor('ammo')],
      ['Spray Bay', placeColor('spray')], ['Clinic', placeColor('clinic')], ['Police', placeColor('police')], ['Race', placeColor('race')], ['Cab rank', placeColor('taxi')]];
    document.getElementById('map-legend').innerHTML = '<h3>LEGEND</h3>' + legend.map(([name, color]) => `<span><i style="background:${color}"></i>${name}</span>`).join('');
    const done = game.missions.state.index;
    document.getElementById('mission-list').innerHTML = '<h3>JOBS ' + done + '/' + STORY_MISSIONS.length + '</h3>' + STORY_MISSIONS.map((mission, index) =>
      `<div class="${index < done ? 'done' : index === done ? 'next' : 'locked'}">${index < done ? '&#10003;' : index === done ? '&#9654;' : '&#8226;'} ${mission.title}${index === done ? ' - ' + mission.brief : ''}</div>`).join('');
    const stats = game.progress.state.stats;
    const rank = RANKS[game.progress.rankIndex()].name;
    document.getElementById('player-stats').innerHTML = '<h3>MARA QUILL</h3>' + [
      'Rank: ' + rank + ' (' + game.progress.state.rep + ' rep)', 'Cash: ' + formatCash(game.player.state.cash),
      'Cars stolen: ' + stats.carsStolen, 'Police evaded: ' + stats.policeEvaded, 'Cab fares: ' + stats.faresDelivered,
      'Best Boulevard Sprint: ' + (stats.bestSprint === null ? '-' : formatClock(stats.bestSprint)),
    ].map((line) => `<div>${line}</div>`).join('');
  }

  function open() {
    drawMap();
    renderSidebar();
    root.hidden = false;
  }

  function close() {
    root.hidden = true;
  }

  document.getElementById('button-resume').addEventListener('click', () => actions.resume());
  document.getElementById('button-save').addEventListener('click', (event) => {
    const saved = game.saves.save();
    event.target.textContent = saved ? 'SAVED TO SLOT ' + (game.saves.state.slot + 1) : 'SAVE FAILED';
  });
  document.getElementById('button-quit').addEventListener('click', () => actions.quitToTitle());

  return { open, close, drawMap };
}
