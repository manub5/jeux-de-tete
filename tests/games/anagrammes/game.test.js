// tests/games/anagrammes/game.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createSolver } from '../../../lexicon/solver.js';
import { createLexicon } from '../../../lexicon/lexicon.js';
import { signature } from '../../../lexicon/signature.js';
import { HINT_COST, POINTS_PER_LETTER, createAnagram } from '../../../games/anagrammes/game.js';

const MOTS = ['chien', 'niche', 'maison', 'cœur', 'chat'];

function build() {
  const index = new Map();
  for (const mot of MOTS) {
    const clef = signature(mot);
    if (!index.has(clef)) index.set(clef, []);
    index.get(clef).push(mot);
  }
  const solver = createSolver(index);
  const lexicon = createLexicon(index, { accepted: new Set(), rejected: new Set(), save() {} });
  const frequencies = new Map(MOTS.map((m) => [m, 10]));
  return { solver, lexicon, frequencies };
}

function partie(word = 'chien') {
  const { solver, lexicon, frequencies } = build();
  return createAnagram({ solver, lexicon, rng: createRng(1), frequencies, level: 'facile', word });
}

test('a game starts scrambled, with nothing revealed', () => {
  const jeu = partie();
  assert.equal(jeu.phase, 'recherche');
  assert.equal(jeu.tiles.length, 5);
  assert.deepEqual(jeu.revealed, [null, null, null, null, null]);
  assert.equal(jeu.hints, 0);
});

test('the tiles never spell the word', () => {
  assert.notEqual(partie().tiles.join(''), 'chien');
});

test('the target word is not exposed while the game is on', () => {
  assert.equal(partie().word, undefined);
});

test('finding the word wins', () => {
  const jeu = partie();
  const resultat = jeu.propose('chien');
  assert.equal(resultat.ok, true);
  assert.equal(jeu.phase, 'terminée');
});

test('any real anagram of the same letters is accepted', () => {
  // He was given the letters of `chien` and found `niche`. He solved it.
  const jeu = partie();
  assert.equal(jeu.propose('niche').ok, true);
});

test('a real word with the wrong letters is refused', () => {
  assert.equal(partie().propose('chat').reason, 'lettres');
});

test('an invented word is refused with the dictionary reason', () => {
  assert.equal(partie().propose('nihec').reason, 'inconnu');
});

test('the score is ten points per played letter', () => {
  const jeu = partie();
  jeu.propose('chien');
  assert.equal(jeu.score, 5 * POINTS_PER_LETTER);
});

test('a ligature scores the letters it is played with', () => {
  const jeu = partie('cœur');
  jeu.propose('cœur');
  assert.equal(jeu.score, 5 * POINTS_PER_LETTER);
});

test('a hint reveals the next unrevealed letter, from the left', () => {
  const jeu = partie();
  assert.equal(jeu.hint(), 0);
  assert.equal(jeu.revealed[0], 'c');
  assert.equal(jeu.hint(), 1);
  assert.equal(jeu.revealed[1], 'h');
});

test('each hint costs points', () => {
  const jeu = partie();
  jeu.hint();
  jeu.hint();
  jeu.propose('chien');
  assert.equal(jeu.score, 5 * POINTS_PER_LETTER - 2 * HINT_COST);
});

test('hints eat into the score without ever taking it below zero', () => {
  // Four hints on a five-letter word: one letter left to find, and the score
  // is still positive. Ten points a letter against three a hint cannot go
  // negative — the clamp guards a future change of numbers, not this one.
  const jeu = partie();
  jeu.hint();
  jeu.hint();
  jeu.hint();
  jeu.hint();
  jeu.propose('chien');
  assert.equal(jeu.score, 5 * POINTS_PER_LETTER - 4 * HINT_COST);
  assert.ok(jeu.score > 0);
});

test('revealing every letter ends the game rather than giving it away for free', () => {
  const jeu = partie();
  for (let i = 0; i < 5; i++) jeu.hint();
  assert.equal(jeu.phase, 'terminée');
  assert.equal(jeu.finish().found, false);
});

test('a finished game refuses proposals and hints', () => {
  const jeu = partie();
  jeu.propose('chien');
  assert.throws(() => jeu.propose('niche'), /terminée/);
  assert.throws(() => jeu.hint(), /terminée/);
});

test('finishing reveals the word and says whether he found it', () => {
  const jeu = partie();
  jeu.propose('chien');
  assert.deepEqual(jeu.finish(), { score: 50, word: 'chien', found: true });
});

test('giving up reveals the word and scores nothing', () => {
  const jeu = partie();
  assert.deepEqual(jeu.finish(), { score: 0, word: 'chien', found: false });
});

test('a word can be drawn instead of given, and belongs to the level', () => {
  const { solver, lexicon, frequencies } = build();
  const jeu = createAnagram({ solver, lexicon, rng: createRng(4), frequencies, level: 'facile' });
  assert.ok(jeu.tiles.length >= 5 && jeu.tiles.length <= 6);
});

test('nothing handed out can reach back into the game', () => {
  const jeu = partie();
  jeu.tiles[0] = 'z';
  jeu.revealed[0] = 'z';
  assert.notEqual(jeu.tiles[0], 'z');
  assert.equal(jeu.revealed[0], null);
});
