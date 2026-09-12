// A screen file with a syntax error breaks nothing that `npm test` already
// checks: no test imports games/*/screen.js, so the whole suite stayed green
// while games/paires/screen.js threw a SyntaxError at load time (found by a
// task review, not by this suite). This test closes that gap for every
// screen, present and future, without needing a DOM: importing a module
// never runs mountXxx(), only its top-level declarations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const racineGames = fileURLToPath(new URL('../../games/', import.meta.url));

const ecrans = readdirSync(racineGames, { withFileTypes: true })
  .filter((entree) => entree.isDirectory())
  .map((entree) => path.join(racineGames, entree.name, 'screen.js'));

test('chaque écran de jeu s’importe sans lever d’erreur', async () => {
  assert.ok(ecrans.length >= 5, 'la découverte des écrans a dû se tromper de dossier');
  for (const chemin of ecrans) {
    await assert.doesNotReject(
      () => import(pathToFileURL(chemin).href),
      `${chemin} ne s’importe pas`,
    );
  }
});
