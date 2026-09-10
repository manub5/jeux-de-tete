// tests/games/anagrammes/pick.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { LEVELS, candidates, pickWord } from '../../../games/anagrammes/pick.js';

const FREQUENCES = new Map([
  ['chat', 40],       // 4 lettres : trop court pour tout niveau
  ['chien', 30],      // 5
  ['maison', 25],     // 6
  ['voiture', 20],    // 7
  ['fenêtre', 18],    // 7
  ['montagne', 15],   // 8
  ['téléphone', 10],  // 9
  ['dictionnaire', 5],// 12 : trop long
  ['cœur', 50],       // 3 caractères mais 5 lettres jouées
]);

test('the three levels cover five to ten letters', () => {
  assert.deepEqual(LEVELS.facile, [5, 6]);
  assert.deepEqual(LEVELS.moyen, [7, 8]);
  assert.deepEqual(LEVELS.difficile, [9, 10]);
});

test('a level keeps only the words of its own lengths', () => {
  assert.deepEqual(candidates(FREQUENCES, 'moyen'), ['fenêtre', 'montagne', 'voiture']);
});

test('words too short or too long for any level are never candidates', () => {
  const tous = Object.keys(LEVELS).flatMap((l) => candidates(FREQUENCES, l));
  assert.ok(!tous.includes('chat'));
  assert.ok(!tous.includes('dictionnaire'));
});

test('a ligature counts for the letters it is played with', () => {
  // `cœur` is four characters but five tiles: C O E U R. It belongs to `facile`.
  assert.ok(candidates(FREQUENCES, 'facile').includes('cœur'));
});

test('candidates come back sorted, so a seed always picks the same word', () => {
  const liste = candidates(FREQUENCES, 'facile');
  assert.deepEqual(liste, [...liste].sort());
});

test('the same seed picks the same word', () => {
  assert.equal(
    pickWord(createRng(3), FREQUENCES, 'moyen'),
    pickWord(createRng(3), FREQUENCES, 'moyen')
  );
});

test('a picked word really belongs to its level', () => {
  for (let seed = 0; seed < 50; seed++) {
    const mot = pickWord(createRng(seed), FREQUENCES, 'difficile');
    assert.equal(mot, 'téléphone');
  }
});

test('an unknown level is refused loudly', () => {
  assert.throws(() => candidates(FREQUENCES, 'impossible'), /niveau/);
});

test('a level name inherited from Object.prototype is refused, not looked up', () => {
  assert.throws(() => candidates(FREQUENCES, 'constructor'), /niveau/);
  assert.throws(() => candidates(FREQUENCES, 'toString'), /niveau/);
});

test('a level with no candidate is refused rather than returning nothing', () => {
  assert.throws(() => pickWord(createRng(1), new Map([['chat', 40]]), 'facile'), /aucun mot/);
});
