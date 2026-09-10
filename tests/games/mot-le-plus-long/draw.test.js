import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import {
  BAG,
  DRAW_SIZE,
  MIN_INTERESTING_LENGTH,
  VOWELS,
  countVowels,
  drawRack,
  fullBag,
} from '../../../games/mot-le-plus-long/draw.js';

test('the rack is ten letters long', () => {
  assert.equal(DRAW_SIZE, 10);
  assert.equal(MIN_INTERESTING_LENGTH, 4);
});

test('the bag is the French Scrabble distribution without the blanks', () => {
  assert.equal(fullBag().length, 100);
  assert.equal(Object.keys(BAG).length, 26);
  assert.equal(Object.keys(BAG).sort().join(''), 'abcdefghijklmnopqrstuvwxyz');
  assert.equal(BAG.e, 15);
  assert.equal(BAG.z, 1);
});

test('the bag holds 45 vowels, which is what keeps a rack playable', () => {
  assert.equal(countVowels(fullBag()), 45);
});

test('a rack has the requested number of letters', () => {
  assert.equal(drawRack(createRng(1)).length, 10);
  assert.equal(drawRack(createRng(1), 7).length, 7);
});

test('every drawn letter comes from the alphabet', () => {
  const rack = drawRack(createRng(42));
  assert.ok(rack.every((letter) => /^[a-z]$/.test(letter)));
});

test('drawing is without replacement: no letter exceeds its count in the bag', () => {
  for (let seed = 0; seed < 200; seed++) {
    const rack = drawRack(createRng(seed));
    const seen = {};
    for (const letter of rack) {
      seen[letter] = (seen[letter] ?? 0) + 1;
      assert.ok(seen[letter] <= BAG[letter], `${letter} tiré ${seen[letter]} fois`);
    }
  }
});

test('the same seed always draws the same rack', () => {
  assert.deepEqual(drawRack(createRng(7)), drawRack(createRng(7)));
});

test('different seeds draw different racks', () => {
  assert.notDeepEqual(drawRack(createRng(1)), drawRack(createRng(2)));
});

test('a rack almost always has enough vowels to be playable', () => {
  // The point of drawing from the bag rather than at random. Over 300 racks,
  // a rack with fewer than two vowels should be a rarity, not the rule.
  let poor = 0;
  for (let seed = 0; seed < 300; seed++) {
    if (countVowels(drawRack(createRng(seed))) < 2) poor++;
  }
  assert.ok(poor < 15, `${poor} tirages pauvres en voyelles sur 300`);
});

test('countVowels counts y as a vowel, as the tile distribution does', () => {
  assert.ok(VOWELS.includes('y'));
  assert.equal(countVowels('crypte'), 2);
});

test('asking for more tiles than the bag holds is refused', () => {
  assert.throws(() => drawRack(createRng(1), 101), /sac/);
});
