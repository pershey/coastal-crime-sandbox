# coastal-crime-sandbox

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/pershey/coastal-crime-sandbox/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/pershey/coastal-crime-sandbox/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Tamarind Coast** is an original open-world crime game that runs in a desktop browser from static files.
You are Mara Quill, a mechanic keeping her uncle's garage alive in a sun-soaked seaside city, one job at a
time, until the developer buying up the seafront comes for the whole coast.

- **A city to explore on foot and by car**: seven districts (Sunrow Beach, Glasswater, Saffron Market,
  Port Calder, Mirador Heights, Guava Flats, Pelican Marina) on a street grid between the hills and the sea,
  with a day-night cycle, a beach, a marina pier, a container port and a skyline of glass towers.
- **Traffic and pedestrians**: drivers keep their lanes, stop at red lights and panic at gunfire; people
  stroll the sidewalks and the promenade, flee, and drop their cash.
- **Eleven vehicles to steal and drive**, from the Pico compact to the Kestrel GT, with arcade handling,
  handbrake drifts, damage, fires and explosions.
- **A five-star wanted level**: cruisers that chase and ram, officers who arrest or open fire, roadblocks,
  tactical vans and the Air One helicopter with its searchlight. Break the line of sight to lose them, or
  pay Spray Bay for a new coat of paint.
- **An eight-mission story** with seven characters, plus side jobs (the Boulevard Sprint street race and
  Cabana Cab fares), five weapons, shops, reputation ranks, and three save slots with autosave.
- **A HUD with a rotating minimap**, a pause map, a title screen, synthesised sound effects and three
  radio stations of generated music.

Everything is made in code: the city, the cars, the people, the textures, the sounds and the music. No
image, model or audio file is loaded, and no name, character or map comes from any existing game.

## Controls

| Keys | Action |
| --- | --- |
| `W` `A` `S` `D` | Walk / drive |
| Mouse | Look and aim (click the game to capture the mouse); `Q` `E` also turn the camera |
| `Shift` / `Space` | Sprint / handbrake |
| `F` | Enter, exit or steal a vehicle |
| Left click / right click | Shoot or punch / aim |
| `1`-`5`, wheel, `R` | Choose a weapon |
| `N`, `T`, `H` | Radio station, start a cab fare, siren |
| `M` or `Esc` | Map, missions, statistics and saving |

## Run it

```sh
node serve.ts                                # then open http://localhost:8080 in desktop Chrome
MAKEFUN_OUTPUT_DIR=../out node main.ts       # hand-in: copies game/ and screenshots/, writes dossier.json
node tools/capture-screenshots.mjs           # retake screenshots/ from the running game (needs Chrome)
```

Node.js 22.18 or later. The game itself needs no build step and makes no network request.

## How it is laid out

- `game/index.html`, `game/styles/` - the page, the HUD and the menus.
- `game/src/city/` - the map, streets, buildings, coast, sky and day-night cycle.
- `game/src/vehicles/`, `game/src/actors/` - cars, physics, traffic, the player and pedestrians.
- `game/src/police/`, `game/src/combat/` - wanted level, dispatch, helicopter, weapons and gunmen.
- `game/src/missions/`, `game/src/world/` - the story, side jobs, progression, shops, markers and pickups.
- `game/src/ui/`, `game/src/audio/`, `game/src/effects/`, `game/src/core/` - HUD, minimap, menus, sound, radio, particles, camera, input and saving.
- `game/src/shots/` and `tools/capture-screenshots.mjs` - the scenes behind the four screenshots, which are
  unedited frames of the game rendered by Chrome.

## Credits

- [three.js](https://threejs.org) r160 (MIT), vendored unmodified as `game/vendor/three.module.min.js`
  from `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js`.
- `serve.ts` and `vendor/makefun-game.ts` come from the make.fun starter kit.
- Everything else was written for this entry. MIT licensed.

---

<sub>Entered on [make.fun](https://make.fun/?ref=0xhfwpmz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
