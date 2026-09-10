import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../core/storage.js';

function fakeBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function hostileBackend() {
  return {
    getItem() { throw new Error('refusé'); },
    setItem() { throw new Error('quota dépassé'); },
    removeItem() { throw new Error('refusé'); },
  };
}

test('a stored value comes back unchanged', () => {
  const storage = createStorage(fakeBackend());
  storage.set('score', { best: 8 });
  assert.deepEqual(storage.get('score', null), { best: 8 });
});

test('an absent key returns the fallback', () => {
  const storage = createStorage(fakeBackend());
  assert.equal(storage.get('absent', 'défaut'), 'défaut');
});

test('corrupted JSON returns the fallback instead of throwing', () => {
  const backend = fakeBackend();
  backend.setItem('jp:cassé', '{ pas du json');
  const storage = createStorage(backend);
  assert.equal(storage.get('cassé', 'défaut'), 'défaut');
});

test('a refused backend never throws and reports itself unavailable', () => {
  const storage = createStorage(hostileBackend());
  assert.equal(storage.available, false);
  assert.doesNotThrow(() => storage.set('x', 1));
  assert.equal(storage.get('x', 'défaut'), 'défaut');
});

test('keys are namespaced so games cannot collide', () => {
  const backend = fakeBackend();
  createStorage(backend).set('score', 1);
  assert.equal(backend.getItem('jp:score'), '1');
});

test('remove deletes the value', () => {
  const storage = createStorage(fakeBackend());
  storage.set('x', 1);
  storage.remove('x');
  assert.equal(storage.get('x', null), null);
});
