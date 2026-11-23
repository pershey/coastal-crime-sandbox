// The player's arsenal: fists, pistol, SMG, shotgun and rifle. Handles ammunition, rate of
// fire, spread, aim assist, drive-by shooting from a car, and switching weapons.
import { angleDelta, headingTo } from '../core/mathUtil.js';

export const WEAPONS = {
  fists: { name: 'Fists', slot: 1, melee: true, damage: 16, interval: 0.38, range: 1.9, price: 0 },
  pistol: { name: 'P9 Pistol', slot: 2, damage: 24, interval: 0.26, spread: 0.018, range: 70, pellets: 1, auto: false, price: 250, ammoPack: 60, ammoPrice: 60 },
  smg: { name: 'Stinger SMG', slot: 3, damage: 13, interval: 0.075, spread: 0.045, range: 60, pellets: 1, auto: true, price: 900, ammoPack: 150, ammoPrice: 120, rank: 1 },
  shotgun: { name: 'Breaker 12', slot: 4, damage: 15, interval: 0.75, spread: 0.11, range: 26, pellets: 7, auto: false, price: 1400, ammoPack: 30, ammoPrice: 110, rank: 2 },
  rifle: { name: 'Marlin AR', slot: 5, damage: 30, interval: 0.105, spread: 0.022, range: 110, pellets: 1, auto: true, price: 2800, ammoPack: 120, ammoPrice: 200, rank: 3 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export function createWeapons(game) {
  const state = { current: 'fists', ammo: { pistol: 0, smg: 0, shotgun: 0, rifle: 0 }, owned: { fists: true }, cooldown: 0, flash: 0 };

  function give(key, ammo = 0) {
    state.owned[key] = true;
    if (key !== 'fists') state.ammo[key] = Math.min(999, (state.ammo[key] ?? 0) + ammo);
    game.events.emit('weaponChanged', { key: state.current });
  }

  function select(key) {
    if (!state.owned[key]) return false;
    state.current = key;
    game.events.emit('weaponChanged', { key });
    return true;
  }

  function cycle(direction) {
    const owned = WEAPON_ORDER.filter((key) => state.owned[key]);
    const index = owned.indexOf(state.current);
    select(owned[(index + direction + owned.length) % owned.length]);
  }

  function removeAll() {
    state.owned = { fists: true };
    state.ammo = { pistol: 0, smg: 0, shotgun: 0, rifle: 0 };
    state.current = 'fists';
  }

  /** Everyone a bullet could be meant for: gunmen first, then civilians. */
  function assistedHeading(x, z, heading, range) {
    let best = heading, bestScore = 0.1;
    const consider = (target, weight) => {
      if (target.down) return;
      const d = Math.hypot(target.x - x, target.z - z);
      if (d > range || d < 0.5) return;
      const off = Math.abs(angleDelta(heading, headingTo(x, z, target.x, target.z)));
      const score = off * weight;
      if (score < bestScore && game.city.collision.hasLineOfSight(x, z, target.x, target.z, 1.3)) {
        bestScore = score;
        best = headingTo(x, z, target.x, target.z);
      }
    };
    for (const gunman of game.gunmen.list) consider(gunman, 0.7);
    for (const ped of game.pedestrians.list) consider(ped, 1.4);
    return best;
  }

  function punch(player) {
    const reach = WEAPONS.fists.range;
    let victim = null, bestD = reach;
    const consider = (target) => {
      if (target.down) return;
      const d = Math.hypot(target.x - player.x, target.z - player.z);
      const facing = Math.abs(angleDelta(player.heading, headingTo(player.x, player.z, target.x, target.z)));
      if (d < bestD && facing < 1.1) { bestD = d; victim = target; }
    };
    for (const gunman of game.gunmen.list) consider(gunman);
    for (const ped of game.pedestrians.list) consider(ped);
    game.events.emit('punch', { x: player.x, z: player.z, hit: victim !== null });
    if (!victim) return;
    const cause = { byPlayer: true, how: 'punch', x: player.x, z: player.z, vx: Math.sin(player.heading) * 3, vz: Math.cos(player.heading) * 3 };
    if (victim.kind === 'gunman') game.gunmen.hurt(victim, WEAPONS.fists.damage, cause);
    else game.pedestrians.hurt(victim, WEAPONS.fists.damage, cause);
    game.effects.sparks(victim.x, 1.4, victim.z, 2, 0xffffff);
  }

  function shoot(player, weapon, key) {
    const vehicle = player.vehicle;
    const yaw = game.cameraRig.state.yaw;
    const originX = vehicle ? vehicle.x : player.x, originZ = vehicle ? vehicle.z : player.z;
    const aimed = assistedHeading(originX, originZ, yaw, weapon.range);
    const muzzleX = originX + Math.sin(aimed) * (vehicle ? 1.2 : 0.7), muzzleZ = originZ + Math.cos(aimed) * (vehicle ? 1.2 : 0.7);
    for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
      const spread = weapon.spread * (vehicle ? 1.6 : player.aiming && game.input.state.aim ? 0.6 : 1);
      game.ballistics.fire({
        x: muzzleX, z: muzzleZ, heading: aimed + game.random.range(-spread, spread), range: weapon.range,
        damage: weapon.damage, shooter: player, byPlayer: true,
      });
    }
    state.ammo[key] -= 1;
    state.flash = 0.05;
    game.effects.muzzleFlash(muzzleX, 1.4, muzzleZ);
    game.cameraRig.addShake(key === 'shotgun' ? 0.35 : 0.12);
    game.events.emit('gunshot', { x: originX, z: originZ, byPlayer: true, weapon: key });
  }

  function update(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    const input = game.input;
    const player = game.player.state;
    // At the Ammo Shack counter the number keys buy instead.
    if (!game.shops.state.open) {
      for (const key of WEAPON_ORDER) {
        if (input.wasPressed('Digit' + WEAPONS[key].slot)) select(key);
      }
    }
    if (input.state.wheel !== 0) cycle(Math.sign(input.state.wheel));
    if (input.wasPressed('KeyR')) cycle(1);
    const weapon = WEAPONS[state.current];
    player.armed = !weapon.melee;
    if (player.down || game.mode !== 'play') return;
    const trigger = weapon.auto ? input.state.fire : input.wasPressed('MouseLeft') || input.wasPressed('ControlLeft');
    if (!trigger && !(weapon.auto && input.isHeld('ControlLeft'))) return;
    if (state.cooldown > 0) return;
    if (weapon.melee) {
      if (player.vehicle) return;
      state.cooldown = weapon.interval;
      punch(player);
      return;
    }
    // Only one-handed guns can be fired from the driver's seat.
    if (player.vehicle && state.current !== 'pistol' && state.current !== 'smg') return;
    if (state.ammo[state.current] <= 0) {
      game.events.emit('dryFire', {});
      state.cooldown = 0.3;
      return;
    }
    state.cooldown = weapon.interval;
    shoot(player, weapon, state.current);
  }

  return { state, give, select, cycle, removeAll, update };
}
