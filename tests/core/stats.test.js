import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../core/storage.js';
import { createStats } from '../../core/stats.js';

function freshStats() {
  const map = new Map();
  const backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return createStats(createStorage(backend));
}

test('a fresh game has no history', () => {
  assert.deepEqual(freshStats().read('mot-le-plus-long'), {
    played: 0, best: 0, average: 0, lastPlayed: null,
  });
});

test('the first game is counted', () => {
  const stats = freshStats();
  stats.record('mot-le-plus-long', 7, '2026-09-10');
  const read = stats.read('mot-le-plus-long');
  assert.equal(read.played, 1);
  assert.equal(read.best, 7);
  assert.equal(read.lastPlayed, '2026-09-10');
});

test('the best score only goes up', () => {
  const stats = freshStats();
  stats.record('mot-le-plus-long', 8, '2026-09-10');
  stats.record('mot-le-plus-long', 5, '2026-09-10');
  assert.equal(stats.read('mot-le-plus-long').best, 8);
});

test('the average covers the last ten games only', () => {
  const stats = freshStats();
  for (let i = 0; i < 12; i++) stats.record('jeu', 10, '2026-09-10');
  stats.record('jeu', 0, '2026-09-10');
  // ten kept: nine 10s and one 0
  assert.equal(stats.read('jeu').average, 9);
});

test('games are counted separately', () => {
  const stats = freshStats();
  stats.record('a', 3, '2026-09-10');
  assert.equal(stats.read('b').played, 0);
});

test('playing on consecutive days lengthens the streak', () => {
  const stats = freshStats();
  stats.record('jeu', 1, '2026-09-10');
  stats.record('jeu', 1, '2026-09-11');
  stats.record('jeu', 1, '2026-09-12');
  assert.equal(stats.streak(), 3);
});

test('playing twice the same day does not lengthen the streak', () => {
  const stats = freshStats();
  stats.record('jeu', 1, '2026-09-10');
  stats.record('jeu', 1, '2026-09-10');
  assert.equal(stats.streak(), 1);
});

test('a missed day resets the streak', () => {
  const stats = freshStats();
  stats.record('jeu', 1, '2026-09-10');
  stats.record('jeu', 1, '2026-09-12');
  assert.equal(stats.streak(), 1);
});

test('the streak spans every game, not one', () => {
  const stats = freshStats();
  stats.record('a', 1, '2026-09-10');
  stats.record('b', 1, '2026-09-11');
  assert.equal(stats.streak(), 2);
});

test('the streak crosses a month boundary', () => {
  const stats = freshStats();
  stats.record('jeu', 1, '2026-09-30');
  stats.record('jeu', 1, '2026-10-01');
  assert.equal(stats.streak(), 2);
});
