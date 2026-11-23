// Things to grab off the street: cash dropped by the fallen, weapons and ammunition left by
// gunmen, and health and body armour hidden around the city.
import * as THREE from '../../vendor/three.module.min.js';
import { distanceSquared } from '../core/mathUtil.js';
import { CITY, kerbPoint } from '../city/cityLayout.js';

const COLORS = { cash: 0x39d353, health: 0xff4f4f, armor: 0x3d8bff, weapon: 0xff8c42 };

export function createPickups(game) {
  const list = [];
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const materials = {};
  for (const [kind, hex] of Object.entries(COLORS)) materials[kind] = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });

  /** Drop a pickup. kind: cash (amount), health, armor, weapon (weapon key and ammo). */
  function drop(kind, x, z, detail = {}) {
    const mesh = new THREE.Mesh(geometry, materials[kind]);
    mesh.scale.setScalar(kind === 'cash' ? 0.7 : 1.1);
    game.scene.add(mesh);
    const pickup = { kind, x, z, mesh, age: 0, lasting: detail.lasting ?? (kind === 'cash' ? 40 : 600), ...detail };
    list.push(pickup);
    return pickup;
  }

  function collect(pickup) {
    const player = game.player;
    if (pickup.kind === 'cash') player.addCash(pickup.amount);
    else if (pickup.kind === 'health') player.heal(60);
    else if (pickup.kind === 'armor') player.state.armor = 100;
    else if (pickup.kind === 'weapon') game.weapons.give(pickup.weapon, pickup.ammo);
    game.events.emit('pickup', { pickup });
  }

  function update(dt) {
    const p = game.player.position();
    const onFoot = !game.player.state.vehicle;
    for (let k = list.length - 1; k >= 0; k -= 1) {
      const pickup = list[k];
      pickup.age += dt;
      pickup.mesh.position.set(pickup.x, game.city.groundHeight(pickup.x, pickup.z) + 0.8 + Math.sin(pickup.age * 3) * 0.15, pickup.z);
      pickup.mesh.rotation.y = pickup.age * 2.4;
      const near = distanceSquared(p.x, p.z, pickup.x, pickup.z) < (onFoot ? 2.2 : 6);
      const usable = pickup.kind === 'cash' || onFoot;
      const wanted = pickup.kind !== 'health' || game.player.state.health < game.player.state.maxHealth;
      if ((near && usable && wanted) || pickup.age > pickup.lasting) {
        if (near && usable && wanted) collect(pickup);
        game.scene.remove(pickup.mesh);
        list.splice(k, 1);
      }
    }
  }

  /** Health and armour that wait in the same spots in every game. */
  function placeHiddenStock() {
    const spots = [
      ['health', kerbPoint(6, 4, 'n', 0.3)], ['health', kerbPoint(3, 5, 'w', 0.7)], ['health', kerbPoint(7, 1, 'e', 0.4)], ['health', kerbPoint(0, 5, 'n', 0.6)],
      ['armor', kerbPoint(4, 3, 'n', 0.8)], ['armor', kerbPoint(1, 6, 'e', 0.3)], ['armor', kerbPoint(8, 5, 's', 0.6)], ['armor', kerbPoint(5, 0, 'w', 0.5)],
    ];
    for (const [kind, spot] of spots) drop(kind, spot.x, spot.z, { lasting: Infinity });
    drop('weapon', CITY.pitch * 2.5, CITY.depth + 20, { weapon: 'pistol', ammo: 36, lasting: Infinity });
  }

  game.events.on('pedDown', ({ ped }) => drop('cash', ped.x + 0.6, ped.z + 0.4, { amount: ped.cash }));
  game.events.on('gunmanDown', ({ gunman }) => {
    const loot = gunman.kindName === 'tactical' || gunman.kindName === 'enforcer' ? 'smg' : 'pistol';
    drop('weapon', gunman.x + 0.5, gunman.z + 0.5, { weapon: loot, ammo: loot === 'smg' ? 45 : 18, lasting: 60 });
    if (gunman.faction !== 'police') drop('cash', gunman.x - 0.5, gunman.z - 0.4, { amount: game.random.int(40, 160) });
  });

  return { list, drop, update, placeHiddenStock };
}
