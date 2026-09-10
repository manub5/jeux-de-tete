// tests/games/anagrammes/scramble.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { scramble } from '../../../games/anagrammes/scramble.js';

test('the scramble holds exactly the played letters of the word', () => {
  const melange = scramble(createRng(1), 'maison');
  assert.deepEqual([...melange].sort(), [...'maison'].sort());
});

test('accents are folded away: the tiles are what he would lay down', () => {
  assert.deepEqual([...scramble(createRng(1), 'fenêtre')].sort(), [...'fenetre'].sort());
});

test('a ligature becomes its two letters', () => {
  const melange = scramble(createRng(1), 'cœur');
  assert.equal(melange.length, 5);
  assert.deepEqual([...melange].sort(), ['c', 'e', 'o', 'r', 'u']);
});

test('the scramble is never the word itself', () => {
  for (let seed = 0; seed < 200; seed++) {
    assert.notEqual(scramble(createRng(seed), 'chien').join(''), 'chien');
  }
});

test('a shuffle that lands on the word itself is retried', () => {
  // Two letters have exactly two arrangements, so roughly half the shuffles
  // collide with the word and the retry fires for real. On a six-letter word
  // the first shuffle practically never collides, so that test — useful as it
  // is — never exercises this path.
  for (let seed = 0; seed < 100; seed++) {
    assert.equal(scramble(createRng(seed), 'os').join(''), 'so');
  }
});

test('the same seed scrambles the same way', () => {
  assert.deepEqual(scramble(createRng(7), 'maison'), scramble(createRng(7), 'maison'));
});

test('different seeds usually scramble differently', () => {
  const vus = new Set();
  for (let seed = 0; seed < 20; seed++) vus.add(scramble(createRng(seed), 'maison').join(''));
  assert.ok(vus.size > 10, `seulement ${vus.size} mélanges distincts sur 20`);
});

test('a word whose letters are all the same cannot be scrambled, and says so', () => {
  // `aaa` has one arrangement, and it is the word. Better a clear refusal than
  // an infinite loop looking for a different one.
  assert.throws(() => scramble(createRng(1), 'aaa'), /mélang/);
});
