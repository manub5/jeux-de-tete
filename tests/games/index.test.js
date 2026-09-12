import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../../games/index.js';

test('every game has the four fields the menu and the router need', () => {
  for (const game of GAMES) {
    assert.equal(typeof game.id, 'string', `id manquant`);
    assert.equal(typeof game.title, 'string', `titre manquant pour ${game.id}`);
    assert.equal(typeof game.subtitle, 'string', `sous-titre manquant pour ${game.id}`);
    assert.equal(typeof game.mount, 'function', `mount manquant pour ${game.id}`);
  }
});

test('the identifiers are unique and usable in a URL hash', () => {
  const ids = GAMES.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)));
});

test('no game is called accueil, which is the menu itself', () => {
  assert.ok(!GAMES.some((g) => g.id === 'accueil'));
});

test('the six games are registered', () => {
  assert.deepEqual(GAMES.map((g) => g.id).sort(),
    ['anagrammes', 'mot-le-plus-long', 'motus', 'paires', 'sudoku', 'tous-les-mots']);
});

test('the sudoku needs no frequency file, being made of digits', () => {
  const sudoku = GAMES.find((g) => g.id === 'sudoku');
  assert.ok(!sudoku.needsFrequencies);
});

test('needsFrequencies, when present, is a boolean, and at least one game does not need it', () => {
  for (const game of GAMES) {
    if ('needsFrequencies' in game) {
      assert.equal(typeof game.needsFrequencies, 'boolean',
        `needsFrequencies devrait être un booléen pour ${game.id}`);
    }
  }
  // Otherwise the fallback path (empty frequency map) could never show anything.
  assert.ok(GAMES.some((g) => !g.needsFrequencies));
});
