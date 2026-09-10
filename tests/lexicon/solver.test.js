// tests/lexicon/solver.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolver } from '../../lexicon/solver.js';
import { signature } from '../../lexicon/signature.js';

function indexOf(...words) {
  const index = new Map();
  for (const word of words) {
    const key = signature(word);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(word);
  }
  return index;
}

const solver = createSolver(
  indexOf('chat', 'chats', 'chas', 'ta', 'as', 'sac', 'cas', 'élève', 'chien')
);

test('finds every word buildable from the draw', () => {
  const found = solver.findWords('chats');
  assert.ok(found.includes('chat'));
  assert.ok(found.includes('chats'));
  assert.ok(found.includes('sac'));
  assert.ok(found.includes('as'));
});

test('never returns a word needing a letter that was not drawn', () => {
  assert.ok(!solver.findWords('chats').includes('chien'));
});

test('respects how many times a letter was drawn', () => {
  const doubled = createSolver(indexOf('assa'));
  assert.deepEqual(doubled.findWords('asa'), []);
  assert.deepEqual(doubled.findWords('asas'), ['assa']);
});

test('results are sorted by length then alphabetically', () => {
  const found = solver.findWords('chats');
  const lengths = found.map((word) => word.length);
  assert.deepEqual(lengths, [...lengths].sort((a, b) => b - a));
  const fours = found.filter((word) => word.length === 4);
  assert.deepEqual(fours, [...fours].sort());
});

test('minLength filters out the short words', () => {
  const found = solver.findWords('chats', { minLength: 4 });
  assert.ok(found.every((word) => word.length >= 4));
});

test('an accented word is found from plain letters', () => {
  assert.ok(solver.findWords('eleve').includes('élève'));
});

test('bestLength reports the longest word available', () => {
  assert.equal(solver.bestLength('chats'), 5);
});

test('bestLength is zero when nothing can be built', () => {
  assert.equal(solver.bestLength('zzzz'), 0);
});

test('an empty draw finds nothing and does not throw', () => {
  assert.deepEqual(solver.findWords(''), []);
});

test('canBuildFrom accepts a word the draw allows', () => {
  assert.ok(solver.canBuildFrom('chat', 'chats'));
  assert.ok(solver.canBuildFrom('élève', 'eleve'));
});

test('canBuildFrom refuses a word the draw does not allow', () => {
  assert.ok(!solver.canBuildFrom('chats', 'chat'));
  assert.ok(!solver.canBuildFrom('chien', 'chats'));
});
