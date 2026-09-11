import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../core/storage.js';
import { createStats } from '../../core/stats.js';

function backendWith(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function freshStats() {
  return createStats(createStorage(backendWith()));
}

test('a fresh game has no history', () => {
  assert.deepEqual(freshStats().read('mot-le-plus-long'), {
    played: 0, best: 0, average: 0, lastPlayed: null,
  });
});

test('the first game is counted', () => {
  const stats = freshStats();
  stats.record('mot-le-plus-long', 7, { today: '2026-09-10' });
  const read = stats.read('mot-le-plus-long');
  assert.equal(read.played, 1);
  assert.equal(read.best, 7);
  assert.equal(read.lastPlayed, '2026-09-10');
});

test('the best score only goes up', () => {
  const stats = freshStats();
  stats.record('mot-le-plus-long', 8, { today: '2026-09-10' });
  stats.record('mot-le-plus-long', 5, { today: '2026-09-10' });
  assert.equal(stats.read('mot-le-plus-long').best, 8);
});

test('the average covers the last ten games only', () => {
  const stats = freshStats();
  for (let i = 0; i < 12; i++) stats.record('jeu', 10, { today: '2026-09-10' });
  stats.record('jeu', 0, { today: '2026-09-10' });
  // ten kept: nine 10s and one 0
  assert.equal(stats.read('jeu').average, 9);
});

test('games are counted separately', () => {
  const stats = freshStats();
  stats.record('a', 3, { today: '2026-09-10' });
  assert.equal(stats.read('b').played, 0);
});

test('playing on consecutive days lengthens the streak', () => {
  const stats = freshStats();
  stats.record('jeu', 1, { today: '2026-09-10' });
  stats.record('jeu', 1, { today: '2026-09-11' });
  stats.record('jeu', 1, { today: '2026-09-12' });
  assert.equal(stats.streak(), 3);
});

test('playing twice the same day does not lengthen the streak', () => {
  const stats = freshStats();
  stats.record('jeu', 1, { today: '2026-09-10' });
  stats.record('jeu', 1, { today: '2026-09-10' });
  assert.equal(stats.streak(), 1);
});

test('a missed day resets the streak', () => {
  const stats = freshStats();
  stats.record('jeu', 1, { today: '2026-09-10' });
  stats.record('jeu', 1, { today: '2026-09-12' });
  assert.equal(stats.streak(), 1);
});

test('the streak spans every game, not one', () => {
  const stats = freshStats();
  stats.record('a', 1, { today: '2026-09-10' });
  stats.record('b', 1, { today: '2026-09-11' });
  assert.equal(stats.streak(), 2);
});

test('the streak crosses a month boundary', () => {
  const stats = freshStats();
  stats.record('jeu', 1, { today: '2026-09-30' });
  stats.record('jeu', 1, { today: '2026-10-01' });
  assert.equal(stats.streak(), 2);
});

test('the streak crosses a year boundary', () => {
  const stats = freshStats();
  stats.record('jeu', 1, { today: '2026-12-31' });
  stats.record('jeu', 1, { today: '2027-01-01' });
  assert.equal(stats.streak(), 2);
});

test('the average is rounded to one decimal', () => {
  const stats = freshStats();
  stats.record('jeu', 7, { today: '2026-09-10' });
  stats.record('jeu', 7, { today: '2026-09-10' });
  stats.record('jeu', 8, { today: '2026-09-10' });
  assert.equal(stats.read('jeu').average, 7.3); // 22 / 3 = 7.333…
});

// A stored value that parses but has the wrong shape must not break the game.
// Both of these threw before the shapes were normalised.

test('a stored value that is not an object reads as no history', () => {
  const stats = createStats(createStorage(backendWith({ 'jp:stats.jeu': '42' })));
  assert.doesNotThrow(() => stats.record('jeu', 5, { today: '2026-09-10' }));
  assert.equal(stats.read('jeu').played, 1);
});

test('a stored record missing a field does not break the next game', () => {
  const stored = JSON.stringify({ played: 3, best: 9, lastPlayed: '2026-09-01' });
  const stats = createStats(createStorage(backendWith({ 'jp:stats.jeu': stored })));
  assert.doesNotThrow(() => stats.record('jeu', 5, { today: '2026-09-10' }));
  const read = stats.read('jeu');
  assert.equal(read.played, 4);
  assert.equal(read.best, 9);
  assert.equal(read.average, 5);
});

test('a corrupted streak reads as no streak rather than throwing', () => {
  const stats = createStats(createStorage(backendWith({ 'jp:streak': '"pas un objet"' })));
  assert.doesNotThrow(() => stats.record('jeu', 1, { today: '2026-09-10' }));
  assert.equal(stats.streak(), 1);
});

test('a game where fewer is better keeps the lowest score as its record', () => {
  const stats = createStats(createStorage(backendWith()));
  stats.record('motus', 5, { lowerIsBetter: true });
  stats.record('motus', 3, { lowerIsBetter: true });
  stats.record('motus', 6, { lowerIsBetter: true });
  assert.equal(stats.read('motus').best, 3);
});

test('the first game sets the record, whichever way the score runs', () => {
  // The trap: `asHistory` starts `best` at 0, so a plain `Math.min` would pin
  // the record at 0 for ever and never move again.
  const stats = createStats(createStorage(backendWith()));
  stats.record('motus', 4, { lowerIsBetter: true });
  assert.equal(stats.read('motus').best, 4);
});

test('a game where more is better is unchanged', () => {
  const stats = createStats(createStorage(backendWith()));
  stats.record('mot-le-plus-long', 6);
  stats.record('mot-le-plus-long', 9);
  stats.record('mot-le-plus-long', 7);
  assert.equal(stats.read('mot-le-plus-long').best, 9);
});

test('the day is still accepted, and still moves the streak', () => {
  const store = createStorage(backendWith());
  const stats = createStats(store);
  stats.record('motus', 3, { lowerIsBetter: true, today: '2026-09-11' });
  assert.equal(stats.read('motus').lastPlayed, '2026-09-11');
  assert.equal(stats.streak(), 1);
});
