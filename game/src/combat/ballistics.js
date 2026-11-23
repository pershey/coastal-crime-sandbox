// Hit detection for every bullet and punch: a shot is a ray across the flat world that
// stops at the first wall, person or vehicle it meets. Used by the player's weapons, by
// police officers, by gang gunmen and by the police helicopter.

/** Distance along a unit ray to a circle, or Infinity when it misses. */
function rayToCircle(ox, oz, dx, dz, cx, cz, radius) {
  const mx = cx - ox, mz = cz - oz;
  const along = mx * dx + mz * dz;
  if (along < 0) return Infinity;
  const off2 = mx * mx + mz * mz - along * along;
  if (off2 > radius * radius) return Infinity;
  return along - Math.sqrt(radius * radius - off2);
}

export function createBallistics(game) {
  /**
   * Trace a shot from (ox, oz) along heading. Returns what it hit first:
   * { kind: 'wall' | 'person' | 'vehicle' | 'none', target, distance, x, z }.
   * `shooter` is skipped, and so is the vehicle the shooter sits in.
   */
  function trace(ox, oz, heading, range, shooter) {
    const dx = Math.sin(heading), dz = Math.cos(heading);
    let best = { kind: 'none', target: null, distance: range };
    const wall = game.city.collision.raycast(ox, oz, dx, dz, range, 1.3);
    if (wall < best.distance) best = { kind: 'wall', target: null, distance: wall };

    const considerPerson = (person) => {
      if (person === shooter || person.down) return;
      const d = rayToCircle(ox, oz, dx, dz, person.x, person.z, 0.48);
      if (d < best.distance) best = { kind: 'person', target: person, distance: d };
    };
    for (const ped of game.pedestrians.list) considerPerson(ped);
    for (const gunman of game.gunmen.list) considerPerson(gunman);
    const player = game.player.state;
    if (!player.vehicle && !player.down) considerPerson(player);

    for (const vehicle of game.fleet.vehicles) {
      if (shooter && (shooter.vehicle === vehicle || shooter.ride === vehicle)) continue;
      if (Math.abs(vehicle.x - ox) > range + 4 || Math.abs(vehicle.z - oz) > range + 4) continue;
      const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
      const reach = vehicle.spec.length / 2 - vehicle.spec.width / 2;
      for (const end of [-1, 0, 1]) {
        const d = rayToCircle(ox, oz, dx, dz, vehicle.x + fx * reach * end, vehicle.z + fz * reach * end, vehicle.spec.width / 2 + 0.1);
        if (d < best.distance) best = { kind: 'vehicle', target: vehicle, distance: d };
      }
    }
    best.x = ox + dx * best.distance;
    best.z = oz + dz * best.distance;
    return best;
  }

  /**
   * Fire one projectile and apply its damage. `shot` has x, z, heading, range, damage,
   * shooter and byPlayer. Returns the hit.
   */
  function fire(shot) {
    const hit = trace(shot.x, shot.z, shot.heading, shot.range, shot.shooter);
    const y = shot.y ?? 1.35;
    game.effects.tracer(shot.x, y, shot.z, hit.x, hit.kind === 'none' ? y : 1.1, hit.z, shot.byPlayer ? 0xfff3b0 : 0xffb199);
    if (hit.kind === 'wall') game.effects.dust(hit.x, 1.2, hit.z);
    if (hit.kind === 'person') {
      const person = hit.target;
      game.effects.sparks(hit.x, 1.3, hit.z, 3, 0xff4d4d);
      const cause = { byPlayer: shot.byPlayer === true, how: 'shot', x: shot.x, z: shot.z, shooter: shot.shooter };
      if (person.kind === 'player') game.player.hurt(shot.damage, cause);
      else if (person.kind === 'gunman') game.gunmen.hurt(person, shot.damage, cause);
      else game.pedestrians.hurt(person, shot.damage, cause);
    }
    if (hit.kind === 'vehicle') {
      const vehicle = hit.target;
      game.effects.sparks(hit.x, 1, hit.z, 4);
      game.fleet.damage(vehicle, shot.damage * 0.55, shot.byPlayer === true);
      if (vehicle.role === 'player') game.player.hurt(shot.damage * 0.22, { how: 'shot', shooter: shot.shooter });
      else if (vehicle.driver && vehicle.driver.panic !== undefined) vehicle.driver.panic = 9;
      if (shot.byPlayer) game.events.emit('vehicleShot', { vehicle });
    }
    return hit;
  }

  return { trace, fire };
}
