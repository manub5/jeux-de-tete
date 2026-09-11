// tests/games/motus/pick.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import {
  DAILY_LENGTH,
  DEFAULT_LENGTH,
  LENGTHS,
  candidates,
  dailyWord,
  freeWord,
} from '../../../games/motus/pick.js';

const FREQUENCES = new Map([
  ['maison', 10],
  ['bonjour', 20],
  ['comment', 15],
  ['pourquoi', 30],
  ['rat', 99],           // trop court, jamais candidat
  ['apparaitre', 5],
  ['apparaître', 7],     // même puzzle une fois replié
  ['cœur', 12],          // cinq lettres jouées, pas quatre
]);

test('the lengths offered are six to eight, seven by default', () => {
  assert.deepEqual(LENGTHS, [6, 7, 8]);
  assert.equal(DEFAULT_LENGTH, 7);
  assert.equal(DAILY_LENGTH, 7);
});

test('candidates are the words of exactly that played length', () => {
  assert.deepEqual(candidates(FREQUENCES, 6), ['maison']);
  assert.deepEqual(candidates(FREQUENCES, 7), ['bonjour', 'comment']);
  assert.deepEqual(candidates(FREQUENCES, 8), ['pourquoi']);
});

test('candidates come back folded, because the board is played folded', () => {
  assert.ok(candidates(FREQUENCES, 5).includes('coeur'));
  assert.ok(!candidates(FREQUENCES, 4).includes('cœur'));
});

test('two spellings that fold alike are one puzzle, not two', () => {
  assert.deepEqual(candidates(FREQUENCES, 10), ['apparaitre']);
});

test('candidates are sorted, so a given day always gives the same word', () => {
  const liste = candidates(FREQUENCES, 7);
  assert.deepEqual(liste, [...liste].sort());
});

test('the word of the day is the same word every time it is asked', () => {
  assert.equal(dailyWord(FREQUENCES, '2026-09-11'), dailyWord(FREQUENCES, '2026-09-11'));
});

test('a different day gives, in general, a different word', () => {
  // Twenty days, not five: with a two-word pool, five draws land on the same
  // word about one run in sixteen, and an intermittent test teaches people to
  // re-run the suite rather than read it. Twenty puts it under one in 500 000.
  const jours = Array.from({ length: 20 }, (_, i) => `2026-09-${String(11 + i).padStart(2, '0')}`);
  const mots = new Set(jours.map((jour) => dailyWord(FREQUENCES, jour)));
  assert.ok(mots.size > 1, `un seul mot sur vingt jours : ${[...mots]}`);
});

test('the word of the day is always of the daily length', () => {
  assert.equal(dailyWord(FREQUENCES, '2026-09-11').length, DAILY_LENGTH);
});

test('a free word is drawn from the length asked for', () => {
  assert.equal(freeWord(createRng(1), FREQUENCES, 6), 'maison');
  assert.equal(freeWord(createRng(1), FREQUENCES, 8), 'pourquoi');
});

test('the same seed draws the same free word', () => {
  assert.equal(
    freeWord(createRng(7), FREQUENCES, 7),
    freeWord(createRng(7), FREQUENCES, 7)
  );
});

test('a length nobody can serve is refused rather than returning nothing', () => {
  // A legal length with nothing behind it: `rat` is three letters, so the
  // seven-letter pool is empty even though seven is a length we offer.
  assert.throws(() => freeWord(createRng(1), new Map([['rat', 9]]), 7), /aucun mot/);
  assert.throws(() => dailyWord(new Map(), '2026-09-11'), /aucun mot/);
});

test('a length that is not one of the three is refused', () => {
  assert.throws(() => freeWord(createRng(1), FREQUENCES, 9), /longueur/);
});

test('no word comes back until every other has been used', () => {
  // Two seven-letter words in the pool, so two consecutive days must give two
  // different words, and the third day must come back to the first.
  const jours = ['2026-09-11', '2026-09-12', '2026-09-13'];
  const [un, deux, trois] = jours.map((jour) => dailyWord(FREQUENCES, jour));
  assert.notEqual(un, deux);
  assert.equal(trois, un);
});

test('a date before the origin still lands on a word', () => {
  assert.ok(candidates(FREQUENCES, 7).includes(dailyWord(FREQUENCES, '2025-03-04')));
});
