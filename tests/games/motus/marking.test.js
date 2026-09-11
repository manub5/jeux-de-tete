import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, mark } from '../../../games/motus/marking.js';

const { placed, present, absent } = MARKS;

test('every letter in its place', () => {
  assert.deepEqual(mark('maison', 'maison'), [placed, placed, placed, placed, placed, placed]);
});

test('a letter of the word, in the wrong place', () => {
  // `arbre` against `barre`: b and a swap, r placed, r and e placed.
  assert.deepEqual(mark('arbre', 'barre'), [present, present, present, placed, placed]);
});

test('a letter that is not in the word at all', () => {
  assert.deepEqual(mark('zzzzz', 'barre'), [absent, absent, absent, absent, absent]);
});

test('a repeated letter is not credited twice', () => {
  // The case a naive implementation gets wrong. `etale` holds one L; `elles`
  // offers two. One is credited, the other must read absent — a one-pass
  // implementation credits both.
  assert.deepEqual(mark('elles', 'etale'), [placed, present, absent, present, absent]);
});

test('a letter repeated in the guess but single in the word', () => {
  // `sasse` against `salut`: the first s is placed, the second s has no second
  // s left to match, so it is absent — and `a` is placed.
  assert.deepEqual(mark('sasse', 'salut'), [placed, placed, absent, absent, absent]);
});

test('a letter repeated in the word is credited twice when the guess has two', () => {
  // `peser` holds two e's and `ecume` offers two, none of them in place: both
  // must be credited. This is the mirror of the case above — the stock has to
  // run out, but not before it has been spent.
  assert.deepEqual(mark('ecume', 'peser'), [present, absent, absent, absent, present]);
});

test('accents and case do not matter: the board is played folded', () => {
  assert.deepEqual(mark('ÉTÉ', 'ete'), [placed, placed, placed]);
  assert.deepEqual(mark('ete', 'ÉTÉ'), [placed, placed, placed]);
});

test('a ligature counts for the letters it is played with', () => {
  // `cœur` is four characters and five played letters, so it marks five cells.
  assert.equal(mark('cœur', 'coeur').length, 5);
  assert.deepEqual(mark('cœur', 'coeur'), [placed, placed, placed, placed, placed]);
});

test('a guess of the wrong length is a programming error, not a player error', () => {
  assert.throws(() => mark('court', 'plus-long'), /longueur/);
});
