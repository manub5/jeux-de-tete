import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, seedFromString, todayKey, pickWeighted } from '../../core/rng.js';

test('the same seed always yields the same sequence', () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const first = [a(), a(), a(), a(), a()];
  const second = [b(), b(), b(), b(), b()];
  assert.deepEqual(first, second);
});

test('different seeds yield different sequences', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notEqual(a(), b());
});

test('values stay within [0, 1)', () => {
  const rng = createRng(99);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('seedFromString is stable and case sensitive', () => {
  assert.equal(seedFromString('2026-09-10'), seedFromString('2026-09-10'));
  assert.notEqual(seedFromString('2026-09-10'), seedFromString('2026-09-11'));
});

test('todayKey uses the local date, not UTC', () => {
  // 23:30 local on the 10th must read as the 10th, whatever the timezone.
  const evening = new Date(2026, 8, 10, 23, 30, 0);
  assert.equal(todayKey(evening), '2026-09-10');
});

test('pickWeighted never returns a zero-weight item', () => {
  const rng = createRng(7);
  const items = [
    { value: 'never', weight: 0 },
    { value: 'always', weight: 5 },
  ];
  for (let i = 0; i < 200; i++) {
    assert.equal(pickWeighted(rng, items), 'always');
  }
});

test('pickWeighted respects the weights', () => {
  const rng = createRng(3);
  const items = [
    { value: 'rare', weight: 1 },
    { value: 'common', weight: 9 },
  ];
  let common = 0;
  for (let i = 0; i < 10000; i++) {
    if (pickWeighted(rng, items) === 'common') common++;
  }
  assert.ok(common > 8500 && common < 9500, `unexpected split: ${common}`);
});
