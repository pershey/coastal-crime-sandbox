// Services around town: the Ammo Shack sells weapons, ammunition and armour (better guns
// unlock with rank), Spray Bay repaints and repairs a car and clears the wanted level, and
// Coast Clinic patches the player up.
import { PLACES } from '../city/cityLayout.js';
import { WEAPONS } from '../combat/weapons.js';
import { RANKS } from '../missions/progression.js';
import { VEHICLES } from '../vehicles/vehicleCatalog.js';
import { formatCash } from '../core/mathUtil.js';

const SPRAY_PRICE = 300;
const CLINIC_PRICE = 150;
const ARMOR_PRICE = 400;

export function createShops(game) {
  const panel = document.getElementById('shop-panel');
  const state = { open: false, cooldown: 0 };
  const ammoMarker = game.markers.add({ ...PLACES.ammoShop, color: '#ff8c42', kind: 'service', label: PLACES.ammoShop.label, radius: 2.6 });
  const sprayMarker = game.markers.add({ x: PLACES.respray.x, z: PLACES.respray.z + 5, color: '#c78bff', kind: 'service', label: PLACES.respray.label, radius: 4.5 });
  const clinicMarker = game.markers.add({ ...PLACES.clinic, color: '#ff6b6b', kind: 'service', label: PLACES.clinic.label, radius: 2.6 });

  /** The Ammo Shack's shelf: each entry has a key to press, a label, a price and a buy action. */
  function stock() {
    const rank = game.progress.rankIndex();
    const owned = game.weapons.state.owned;
    const items = [];
    for (const key of ['pistol', 'smg', 'shotgun', 'rifle']) {
      const weapon = WEAPONS[key];
      const locked = (weapon.rank ?? 0) > rank;
      items.push({
        label: owned[key] ? weapon.name + ' ammo x' + weapon.ammoPack : weapon.name,
        price: owned[key] ? weapon.ammoPrice : weapon.price,
        locked: locked ? 'Rank: ' + RANKS[weapon.rank].name : '',
        buy: () => game.weapons.give(key, weapon.ammoPack),
      });
    }
    items.push({ label: 'Body armour', price: ARMOR_PRICE, locked: '', buy: () => { game.player.state.armor = 100; } });
    return items;
  }

  function render() {
    document.getElementById('shop-title').textContent = 'AMMO SHACK';
    document.getElementById('shop-items').innerHTML = stock().map((item, index) =>
      `<div class="${item.locked ? 'locked' : ''}"><span><kbd>${index + 1}</kbd>${item.label}</span><span>${item.locked || formatCash(item.price)}</span></div>`).join('');
  }

  function buy(index) {
    const item = stock()[index];
    if (!item || item.locked) return;
    if (game.player.state.cash < item.price) {
      game.hud.ticker('NOT ENOUGH CASH', 2);
      return;
    }
    game.player.addCash(-item.price);
    item.buy();
    game.events.emit('purchase', {});
    render();
  }

  function update(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    const player = game.player.state;
    const atShack = !player.vehicle && game.markers.isPlayerInside(ammoMarker);
    if (atShack !== state.open) {
      state.open = atShack;
      panel.hidden = !atShack;
      if (atShack) render();
    }
    if (state.open) {
      for (let k = 0; k < 5; k += 1) if (game.input.wasPressed('Digit' + (k + 1)) || game.input.wasPressed('Numpad' + (k + 1))) buy(k);
    }
    // Spray Bay: roll in, pay, roll out clean.
    const vehicle = player.vehicle;
    if (vehicle && state.cooldown <= 0 && game.markers.isPlayerInside(sprayMarker) && Math.abs(vehicle.speed) < 3) {
      state.cooldown = 6;
      if (game.police.canSeePlayer() && game.wanted.state.stars > 0) game.hud.ticker('THE POLICE CAN SEE YOU', 3);
      else if (player.cash < SPRAY_PRICE) game.hud.ticker('SPRAY BAY COSTS ' + formatCash(SPRAY_PRICE), 3);
      else {
        game.player.addCash(-SPRAY_PRICE);
        vehicle.health = vehicle.spec.health;
        game.wanted.clear();
        game.events.emit('respray', { vehicle, paint: game.random.pick(VEHICLES[vehicle.modelKey].paints) });
        game.hud.announce('RESPRAYED', 'Repaired and clean - ' + formatCash(SPRAY_PRICE), '#c78bff', 3);
      }
    }
    if (!vehicle && state.cooldown <= 0 && game.markers.isPlayerInside(clinicMarker) && player.health < player.maxHealth) {
      state.cooldown = 4;
      if (player.cash < CLINIC_PRICE) game.hud.ticker('THE CLINIC COSTS ' + formatCash(CLINIC_PRICE), 3);
      else {
        game.player.addCash(-CLINIC_PRICE);
        game.player.heal(100);
        game.hud.ticker('PATCHED UP', 3);
      }
    }
  }

  function close() {
    state.open = false;
    panel.hidden = true;
  }

  return { state, update, close, buy };
}
