// Assembles the whole city of Tamarind Coast from its parts and keeps its living details
// (signals, sea, lit windows, street lamps) in step with the clock.
import { CITY, planCity } from './cityLayout.js';
import { createRoadNetwork, createSidewalkGraph } from './roadNetwork.js';
import { createCityCollision } from './cityCollision.js';
import { createCityMaterials } from './facadeTextures.js';
import { buildCityBlocks } from './buildingGenerator.js';
import { buildStreetFurniture } from './streetFurniture.js';
import { buildCoast } from './coastAndSea.js';
import { createSkyAndDaylight, nightGlow } from './skyAndDaylight.js';
import { createRandom } from '../core/seededRandom.js';

export function buildTamarindCoast(scene, renderer, seed) {
  const plan = planCity(seed);
  const roads = createRoadNetwork();
  const sidewalks = createSidewalkGraph();
  const collision = createCityCollision();
  const materials = createCityMaterials(createRandom(seed + 5));
  const { palms } = buildCityBlocks(plan, scene, collision, materials, seed);
  const furniture = buildStreetFurniture(scene, roads, materials, palms, seed);
  const sea = buildCoast(scene, materials, collision, seed);
  const daylight = createSkyAndDaylight(scene, renderer, seed);

  /** Advance the city's clock-driven details. `time` is seconds of game time. */
  function update(time, focus, cameraPosition) {
    furniture.updateSignals(time);
    sea.uTime.value = time;
    const glow = nightGlow(daylight.state.night);
    materials.wall.emissiveIntensity = glow * 0.9;
    materials.glass.emissiveIntensity = glow * 0.5;
    furniture.lampGlow.halo.opacity = glow * 0.9;
    furniture.lampGlow.pool.opacity = glow * 0.55;
    furniture.lampGlow.pool.visible = glow > 0.02;
    sea.uDaylight.value = 1 - daylight.state.night * 0.85;
    sea.uFogColor.value.copy(daylight.fog.color);
    sea.uFogDensity.value = daylight.fog.density;
    daylight.follow(focus, cameraPosition);
  }

  /** Height of the ground: streets are level, the blocks between them are a kerb higher. */
  function groundHeight(x, z) {
    const h = CITY.roadHalf;
    if (x < -h || z < -h || x > CITY.width + h) return 0;
    if (z > CITY.depth + h) return z < CITY.beachZ ? 0.2 : 0.12;
    return roads.isOnRoad(x, z) ? 0 : 0.2;
  }

  return { plan, roads, sidewalks, collision, materials, daylight, update, groundHeight };
}
