import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, signature, countLetters } from '../../lexicon/signature.js';

// The very words tools/tests/test_text.py checks on the Python side.
test('accents fold to their base letter', () => {
  assert.equal(fold('élève'), 'eleve');
  assert.equal(fold('çà'), 'ca');
  assert.equal(fold('aiguë'), 'aigue');
});

test('ligatures become two letters', () => {
  assert.equal(fold('œuf'), 'oeuf');
  assert.equal(fold('nævus'), 'naevus');
});

test('a plain word is left alone', () => {
  assert.equal(fold('chat'), 'chat');
});

test('a signature is the folded letters sorted', () => {
  assert.equal(signature('chat'), 'acht');
  assert.equal(signature('élève'), 'eeelv');
});

test('anagrams share a signature', () => {
  assert.equal(signature('chien'), signature('niche'));
});

test('a ligature counts as two letters in a signature', () => {
  assert.equal(signature('œuf'), 'efou');
});

test('uppercase input is folded down', () => {
  assert.equal(signature('CHAT'), 'acht');
  assert.equal(fold('École'), 'ecole');
});

test('countLetters tallies repeats', () => {
  const counts = countLetters('aabc');
  assert.equal(counts.get('a'), 2);
  assert.equal(counts.get('b'), 1);
  assert.equal(counts.size, 3);
});

test('countLetters accepts an array as well as a string', () => {
  assert.deepEqual([...countLetters(['a', 'b'])], [...countLetters('ab')]);
});
