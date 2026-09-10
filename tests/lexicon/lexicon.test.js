// tests/lexicon/lexicon.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIndex } from '../../lexicon/loader.js';
import { createLexicon } from '../../lexicon/lexicon.js';

const INDEX_TEXT = 'acht\tchat\neeelv\télève élevé\ncehin\tchien niche\n';

function emptyCorrections() {
  return { accepted: new Set(), rejected: new Set(), save() {} };
}

test('parseIndex reads one line per signature', () => {
  const index = parseIndex(INDEX_TEXT);
  assert.equal(index.size, 3);
  assert.deepEqual(index.get('acht'), ['chat']);
  assert.deepEqual(index.get('eeelv'), ['élève', 'élevé']);
});

test('parseIndex tolerates a missing final newline and blank lines', () => {
  assert.equal(parseIndex('acht\tchat\n\nacht\tchat').size, 1);
});

test('a known word is accepted and comes back spelled correctly', () => {
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), emptyCorrections());
  assert.deepEqual(lexicon.validate('chat'), { ok: true, word: 'chat', reason: null });
});

test('typing without accents still validates', () => {
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), emptyCorrections());
  const result = lexicon.validate('eleve');
  assert.equal(result.ok, true);
  assert.ok(['élève', 'élevé'].includes(result.word));
});

test('case and surrounding spaces are ignored', () => {
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), emptyCorrections());
  assert.equal(lexicon.validate('  CHAT  ').ok, true);
});

test('an unknown word is refused', () => {
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), emptyCorrections());
  assert.deepEqual(lexicon.validate('xyzzyx'), { ok: false, word: null, reason: 'inconnu' });
});

test('an empty entry is refused without throwing', () => {
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), emptyCorrections());
  assert.equal(lexicon.validate('   ').ok, false);
});

test('a personally accepted word is validated', () => {
  const corrections = emptyCorrections();
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), corrections);
  lexicon.accept('kéké');
  assert.deepEqual(lexicon.validate('kéké'), { ok: true, word: 'kéké', reason: null });
});

test('a personally rejected word stops being valid', () => {
  const corrections = emptyCorrections();
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), corrections);
  lexicon.reject('chat');
  assert.deepEqual(lexicon.validate('chat'), { ok: false, word: null, reason: 'refusé' });
});

test('rejecting then accepting again restores the word', () => {
  const corrections = emptyCorrections();
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), corrections);
  lexicon.reject('chat');
  lexicon.accept('chat');
  assert.equal(lexicon.validate('chat').ok, true);
});

test('corrections are saved as soon as they change', () => {
  let saves = 0;
  const corrections = { accepted: new Set(), rejected: new Set(), save() { saves++; } };
  const lexicon = createLexicon(parseIndex(INDEX_TEXT), corrections);
  lexicon.accept('kéké');
  lexicon.reject('chat');
  assert.equal(saves, 2);
});
