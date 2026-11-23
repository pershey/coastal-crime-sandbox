// The radar in the corner of the HUD: the streets and districts around the player, turned
// to match the camera, with blips for police, the helicopter, roadblocks, mission targets,
// shops and pickups. The pause screen's full map is painted from the same base.
import { CITY, DISTRICTS, PLACES } from '../city/cityLayout.js';

const ICON_COLORS = { job: '#ffe14f', home: '#6dff8a', ammo: '#ff8c42', spray: '#c78bff', clinic: '#ff6b6b', police: '#3d8bff', race: '#33e1ff', taxi: '#ffc300' };

/** Paint the whole city in world coordinates (1 unit = 1 metre). The caller sets the transform. */
export function paintCityBase(ctx, plan, detail = false) {
  const h = CITY.roadHalf;
  ctx.fillStyle = '#1d6fa5';
  ctx.fillRect(-900, -900, CITY.width + 1800, CITY.depth + 1800);
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(CITY.quayX, -900, CITY.width + 900, 900 + CITY.beachZ);
  ctx.fillStyle = '#f0deae';
  ctx.fillRect(CITY.quayX, CITY.beachZ, CITY.width + 900, CITY.shoreZ - CITY.beachZ);
  ctx.fillStyle = '#8f9499';
  ctx.fillRect(CITY.quayX, -h - 4, -h - CITY.quayX, CITY.beachZ + h + 4);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(-h, -h, CITY.width + h * 2, CITY.depth + h * 2);
  ctx.fillStyle = '#b08968';
  ctx.fillRect(7.5 * CITY.pitch - 4, CITY.beachZ, 8, 200);
  for (const block of plan.blocks) {
    const r = block.rect;
    ctx.fillStyle = block.kind === 'park' ? '#57a84c' : DISTRICTS[block.district].color;
    ctx.globalAlpha = block.kind === 'park' ? 1 : 0.5;
    ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
    ctx.globalAlpha = 1;
    if (detail) {
      ctx.fillStyle = 'rgba(20, 24, 40, 0.45)';
      for (const lot of block.lots) ctx.fillRect(lot.x0, lot.z0, lot.x1 - lot.x0, lot.z1 - lot.z0);
    }
  }
  ctx.strokeStyle = 'rgba(255, 225, 79, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  for (let i = 0; i <= CITY.cols; i += 1) { ctx.moveTo(i * CITY.pitch, 0); ctx.lineTo(i * CITY.pitch, CITY.depth); }
  for (let j = 0; j <= CITY.rows; j += 1) { ctx.moveTo(0, j * CITY.pitch); ctx.lineTo(CITY.width, j * CITY.pitch); }
  ctx.stroke();
  ctx.setLineDash([]);
}

export function placeColor(icon) {
  return ICON_COLORS[icon] ?? '#ffffff';
}

export function createMinimap(game) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const size = canvas.width, half = size / 2;
  const scale = 0.82;

  // The static city is painted once into an off-screen canvas, then stamped rotated each frame.
  const margin = 420;
  const base = document.createElement('canvas');
  const baseScale = 1.5;
  base.width = Math.ceil((CITY.width + margin * 2) * baseScale);
  base.height = Math.ceil((CITY.depth + margin * 2) * baseScale);
  const baseCtx = base.getContext('2d');
  baseCtx.scale(baseScale, baseScale);
  baseCtx.translate(margin, margin);
  paintCityBase(baseCtx, game.city.plan);

  function blip(x, z, color, radius, shape = 'dot', clampToEdge = false) {
    const p = game.player.position();
    const yaw = game.cameraRig.state.yaw + Math.PI;
    const dx = (x - p.x) * scale, dz = (z - p.z) * scale;
    let sx = dx * Math.cos(yaw) - dz * Math.sin(yaw), sy = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const reach = Math.hypot(sx, sy), limit = half - 12;
    if (reach > limit) {
      if (!clampToEdge) return;
      sx *= limit / reach;
      sy *= limit / reach;
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 'square') ctx.rect(half + sx - radius, half + sy - radius, radius * 2, radius * 2);
    else if (shape === 'diamond') {
      ctx.moveTo(half + sx, half + sy - radius * 1.3);
      ctx.lineTo(half + sx + radius * 1.3, half + sy);
      ctx.lineTo(half + sx, half + sy + radius * 1.3);
      ctx.lineTo(half + sx - radius * 1.3, half + sy);
      ctx.closePath();
    } else ctx.arc(half + sx, half + sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function draw() {
    const p = game.player.position();
    const yaw = game.cameraRig.state.yaw + Math.PI;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(half, half);
    ctx.rotate(yaw);
    ctx.scale(scale / baseScale, scale / baseScale);
    ctx.drawImage(base, -(p.x + margin) * baseScale, -(p.z + margin) * baseScale);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.clip();
    // The search area the police are combing, while the player is out of sight.
    const wanted = game.wanted.state;
    if (wanted.stars > 0 && !wanted.seen) {
      const dx = (wanted.lastSeenX - p.x) * scale, dz = (wanted.lastSeenZ - p.z) * scale;
      ctx.fillStyle = 'rgba(255, 60, 60, 0.25)';
      ctx.beginPath();
      ctx.arc(half + dx * Math.cos(yaw) - dz * Math.sin(yaw), half + dx * Math.sin(yaw) + dz * Math.cos(yaw), 70 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const place of Object.values(PLACES)) {
      if (place.icon !== 'job') blip(place.x, place.z, placeColor(place.icon), 5, 'square');
    }
    for (const pickup of game.pickups.list) blip(pickup.x, pickup.z, pickup.kind === 'cash' ? '#6dff8a' : '#ffffff', 3);
    for (const vehicle of game.fleet.vehicles) {
      if (vehicle.role === 'police' && !vehicle.wrecked) blip(vehicle.x, vehicle.z, Math.floor(game.time * 4) % 2 ? '#ff3b3b' : '#3d8bff', 6);
      else if (vehicle.tag === 'target') blip(vehicle.x, vehicle.z, '#ff4f4f', 7, 'diamond', true);
    }
    for (const gunman of game.gunmen.list) {
      if (!gunman.down) blip(gunman.x, gunman.z, gunman.faction === 'police' ? '#3d8bff' : '#ff4f4f', 4);
    }
    for (const block of game.police.roadblocks) blip(block.x, block.z, '#ff3b3b', 7, 'square');
    if (game.helicopter.state.active) blip(game.helicopter.state.x, game.helicopter.state.z, '#ffffff', 7, 'diamond', true);
    for (const marker of game.markers.list) blip(marker.x, marker.z, marker.color, marker.kind === 'objective' ? 9 : 7, marker.kind === 'objective' ? 'diamond' : 'dot', marker.kind === 'objective' || marker.kind === 'contact');
    ctx.restore();

    // The player: an arrow showing which way they face, relative to the camera.
    const facing = game.cameraRig.state.yaw - game.player.state.heading;
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(facing);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North marker on the rim.
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(yaw);
    ctx.fillStyle = '#fff';
    ctx.font = '900 18px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('N', 0, -(half - 24));
    ctx.fillText('N', 0, -(half - 24));
    ctx.restore();
  }

  return { draw };
}
