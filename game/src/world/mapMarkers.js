// Glowing beacons in the street that mark mission contacts, objectives, checkpoints and
// shops. Each one also shows as a blip on the minimap and on the pause map.
import * as THREE from '../../vendor/three.module.min.js';
import { distance } from '../core/mathUtil.js';

export function createMapMarkers(game) {
  const list = [];
  const ringGeometry = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
  const beamGeometry = new THREE.CylinderGeometry(0.22, 0.22, 1, 8, 1, true);

  /** Add a beacon. kind is 'contact', 'objective', 'checkpoint' or 'service'. */
  function add({ x, z, color = '#ffe14f', kind = 'objective', label = '', radius = 3 }) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.scale.set(radius, 1.5, radius);
    const beam = new THREE.Mesh(beamGeometry, material);
    beam.scale.set(1, kind === 'service' ? 14 : 46, 1);
    beam.position.y = (kind === 'service' ? 14 : 46) / 2;
    const group = new THREE.Group();
    group.add(ring, beam);
    group.position.set(x, game.city.groundHeight(x, z) + 0.75, z);
    game.scene.add(group);
    const marker = { x, z, color, kind, label, radius, group, ring, material };
    list.push(marker);
    return marker;
  }

  function remove(marker) {
    if (!marker) return;
    const index = list.indexOf(marker);
    if (index === -1) return;
    list.splice(index, 1);
    game.scene.remove(marker.group);
    marker.material.dispose();
  }

  /** True when the player stands (or is parked) inside the beacon's ring. */
  function isPlayerInside(marker, extra = 0) {
    const p = game.player.position();
    return distance(p.x, p.z, marker.x, marker.z) < marker.radius + extra;
  }

  function update() {
    const pulse = 0.34 + Math.sin(game.time * 4) * 0.1;
    for (const marker of list) {
      marker.material.opacity = pulse;
      marker.ring.rotation.y = game.time * 0.8;
    }
  }

  return { list, add, remove, isPlayerInside, update };
}
