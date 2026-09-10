// tests/lexicon/loader.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DICTIONARY_VERSION,
  FREQUENCY_VERSION,
  isCurrent,
  parseFrequencies,
  parseIndex,
} from '../../lexicon/loader.js';

const INDEX_TEXT = 'acht\tchat\neeelv\télève élevé\ncehin\tchien niche\n';

test('parseIndex reads one line per signature', () => {
  const index = parseIndex(INDEX_TEXT);
  assert.equal(index.size, 3);
  assert.deepEqual(index.get('acht'), ['chat']);
  assert.deepEqual(index.get('eeelv'), ['élève', 'élevé']);
});

test('parseIndex tolerates a missing final newline and blank lines', () => {
  assert.equal(parseIndex('acht\tchat\n\nacht\tchat').size, 1);
});

test('parseIndex skips a line with no tab', () => {
  assert.equal(parseIndex('acht\tchat\npas de tabulation\n').size, 1);
});

test('parseFrequencies reads one word per line', () => {
  const frequencies = parseFrequencies('chat\t42.5\nchien\t30\n');
  assert.equal(frequencies.size, 2);
  assert.equal(frequencies.get('chat'), 42.5);
  assert.equal(frequencies.get('chien'), 30);
});

test('parseFrequencies skips a line whose number is unreadable', () => {
  assert.equal(parseFrequencies('chat\tbeaucoup\nchien\t30\n').size, 1);
});

test('parseFrequencies tolerates blank lines and a missing final newline', () => {
  assert.equal(parseFrequencies('chat\t42.5\n\nchien\t30').size, 2);
});

test('a cached record of the current version is usable', () => {
  assert.equal(isCurrent({ version: DICTIONARY_VERSION, text: 'x' }, DICTIONARY_VERSION), true);
});

test('nothing cached is not usable', () => {
  assert.equal(isCurrent(undefined, DICTIONARY_VERSION), false);
  assert.equal(isCurrent(null, DICTIONARY_VERSION), false);
});

test('a record from an older version is not usable', () => {
  assert.equal(isCurrent({ version: DICTIONARY_VERSION - 1, text: 'x' }, DICTIONARY_VERSION), false);
});

test('a bare string, as the very first build stored it, is not usable', () => {
  assert.equal(isCurrent('acht\tchat\n', DICTIONARY_VERSION), false);
});

test('a record with no text is not usable', () => {
  assert.equal(isCurrent({ version: DICTIONARY_VERSION }, DICTIONARY_VERSION), false);
});

test('the two files carry their own version numbers', () => {
  assert.equal(typeof DICTIONARY_VERSION, 'number');
  assert.equal(typeof FREQUENCY_VERSION, 'number');
});
