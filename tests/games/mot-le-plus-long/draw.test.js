import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { CONSONANTS, DRAW_SIZE, VOWELS, drawLetter } from '../../../games/mot-le-plus-long/draw.js';

test('the draw is ten letters long', () => {
  assert.equal(DRAW_SIZE, 10);
});

test('the two pools together cover the whole alphabet exactly once', () => {
  const all = [...VOWELS, ...CONSONANTS].map((entry) => entry.value).sort();
  assert.equal(all.length, 26);
  assert.equal(new Set(all).size, 26);
  assert.equal(all.join(''), 'abcdefghijklmnopqrstuvwxyz');
});

test('y is a vowel here, as in the tile distribution', () => {
  assert.ok(VOWELS.some((entry) => entry.value === 'y'));
});

test('every weight is a positive integer', () => {
  for (const entry of [...VOWELS, ...CONSONANTS]) {
    assert.ok(Number.isInteger(entry.weight) && entry.weight > 0, entry.value);
  }
});

test('e is the most frequent vowel and s among the most frequent consonants', () => {
  const heaviestVowel = VOWELS.reduce((a, b) => (a.weight >= b.weight ? a : b));
  assert.equal(heaviestVowel.value, 'e');
  const s = CONSONANTS.find((entry) => entry.value === 's');
  assert.equal(s.weight, 6);
});

test('drawing a vowel always yields a vowel', () => {
  const rng = createRng(42);
  const vowels = new Set(VOWELS.map((entry) => entry.value));
  for (let i = 0; i < 500; i++) {
    assert.ok(vowels.has(drawLetter(rng, 'voyelle')));
  }
});

test('drawing a consonant always yields a consonant', () => {
  const rng = createRng(42);
  const consonants = new Set(CONSONANTS.map((entry) => entry.value));
  for (let i = 0; i < 500; i++) {
    assert.ok(consonants.has(drawLetter(rng, 'consonne')));
  }
});

test('the same seed replays the same draw', () => {
  const first = createRng(7);
  const second = createRng(7);
  const a = [drawLetter(first, 'voyelle'), drawLetter(first, 'consonne')];
  const b = [drawLetter(second, 'voyelle'), drawLetter(second, 'consonne')];
  assert.deepEqual(a, b);
});

test('an unknown kind is rejected loudly', () => {
  assert.throws(() => drawLetter(createRng(1), 'jeton'), /voyelle|consonne/);
});
