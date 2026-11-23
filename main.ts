// Tamarind Coast - hand-in program (Node 22, standard library only, no network).
//
// The game is the static site under game/ (open game/index.html through any static file
// server: three.js is vendored, nothing is fetched). This program hands it to the grader:
// it copies game/ and screenshots/ from beside this file into the output directory, file by
// file in sorted order, checks the copy against the gate's limits so a broken entry fails
// loudly here rather than silently there, and writes dossier.json with the kit's library.
//
//   MAKEFUN_OUTPUT_DIR=../out node main.ts      (the grader uses /output)
//   node serve.ts                               (play the game at http://localhost:8080)
//   node tools/capture-screenshots.mjs          (retake screenshots/ from the running game)

import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The gate's limits for this bounty (RULES.txt, "The gate"). */
const LIMITS = {
  gameEntries: 993,
  gameBytes: 48 * 1024 * 1024,
  pathBytes: 1000,
  indexBytes: 1024 * 1024,
  screenshotsMin: 3,
  screenshotsMax: 4,
  screenshotBytes: 256 * 1024,
  dossierBytes: 1.5 * 1024 * 1024,
  dossierTextBytes: 163840,
};

interface CopyTally {
  entries: number;
  bytes: number;
}

const repository = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * Copy a directory tree, visiting names in sorted order so two runs do exactly the same
 * work. Returns how many files and directories were written and their total size.
 * `relative` is the path under game/ that the gate measures.
 */
function copyTree(from: string, to: string, relative: string, tally: CopyTally): CopyTally {
  mkdirSync(to, { recursive: true });
  const names = readdirSync(from).sort();
  for (const name of names) {
    const source = join(from, name);
    const target = join(to, name);
    const path = relative === '' ? name : relative + '/' + name;
    if (Buffer.byteLength(path, 'utf8') > LIMITS.pathBytes) throw new Error(`path too long for the gate: ${path}`);
    const stats = statSync(source);
    tally.entries += 1;
    if (stats.isDirectory()) {
      copyTree(source, target, path, tally);
    } else if (stats.isFile()) {
      copyFileSync(source, target);
      tally.bytes += stats.size;
    } else {
      throw new Error(`only plain files and directories may be handed in: ${path}`);
    }
  }
  return tally;
}

function isScreenshot(name: string): boolean {
  return !name.startsWith('.') && /\.(png|jpe?g)$/i.test(name);
}

// 1. The game.
const game = copyTree(join(repository, 'game'), join(output, 'game'), '', { entries: 0, bytes: 0 });
if (game.entries > LIMITS.gameEntries) throw new Error(`game/ holds ${game.entries} entries, the gate allows ${LIMITS.gameEntries}`);
if (game.bytes > LIMITS.gameBytes) throw new Error(`game/ is ${game.bytes} bytes, the gate allows ${LIMITS.gameBytes}`);
if (statSync(join(output, 'game', 'index.html')).size > LIMITS.indexBytes) throw new Error('game/index.html is over 1 MiB');

// 2. The screenshots: real frames of the game taken by tools/capture-screenshots.mjs. The
//    first by name is the cover.
const shotsFrom = join(repository, 'screenshots');
const shotsTo = join(output, 'screenshots');
mkdirSync(shotsTo, { recursive: true });
const shots = readdirSync(shotsFrom).filter(isScreenshot).sort();
if (shots.length < LIMITS.screenshotsMin || shots.length > LIMITS.screenshotsMax) {
  throw new Error(`screenshots/ holds ${shots.length} images, the gate wants ${LIMITS.screenshotsMin} to ${LIMITS.screenshotsMax}`);
}
for (const name of shots) {
  const size = statSync(join(shotsFrom, name)).size;
  if (size > LIMITS.screenshotBytes) throw new Error(`screenshot ${name} is ${size} bytes, over 256 KiB`);
  copyFileSync(join(shotsFrom, name), join(shotsTo, name));
}

// 3. The dossier the judge reads, built from the copy by the kit's own library so the gate
//    can rebuild it byte for byte.
const dossier = buildDossier(output, {
  text_max_bytes: LIMITS.dossierTextBytes,
  screenshots: { max: LIMITS.screenshotsMax, max_bytes: LIMITS.screenshotBytes },
  game_max_files: LIMITS.gameEntries,
  game_max_bytes: 50331648,
  game_path_max_bytes: LIMITS.pathBytes,
});
if (dossier.byteLength > LIMITS.dossierBytes) throw new Error(`dossier.json is ${dossier.byteLength} bytes, over 1.5 MiB`);
writeFileSync(join(output, 'dossier.json'), dossier);

console.log(`Tamarind Coast handed in: ${game.entries} game entries (${game.bytes} bytes), ${shots.length} screenshots, dossier ${dossier.byteLength} bytes`);
