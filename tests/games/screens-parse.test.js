// A screen file with a syntax error breaks nothing that `npm test` already
// checks: no test imports games/*/screen.js, so the whole suite stayed green
// while games/paires/screen.js threw a SyntaxError at load time (found by a
// task review, not by this suite). This test closes that gap for every
// screen, present and future, without needing a DOM: importing a module
// never runs mountXxx(), only its top-level declarations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const racineGames = fileURLToPath(new URL('../../games/', import.meta.url));

// A game is built task by task (see the lot 5 sequence game: zones, then
// sound, then logic, then screen). Its directory exists before screen.js
// does, so this scan keeps only directories that already have one — it still
// catches a broken existing screen, it just doesn't demand one exist early.
const ecrans = readdirSync(racineGames, { withFileTypes: true })
  .filter((entree) => entree.isDirectory())
  .map((entree) => path.join(racineGames, entree.name, 'screen.js'))
  .filter((chemin) => existsSync(chemin));

test('chaque écran de jeu s’importe sans lever d’erreur', async () => {
  assert.ok(ecrans.length >= 5, 'la découverte des écrans a dû se tromper de dossier');
  for (const chemin of ecrans) {
    await assert.doesNotReject(
      () => import(pathToFileURL(chemin).href),
      `${chemin} ne s’importe pas`,
    );
  }
});
