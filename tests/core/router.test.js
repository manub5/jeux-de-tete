// tests/core/router.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../../core/router.js';

function fakeContainer() {
  return { replaceChildren() {} };
}

test('start opens the fallback route when the hash is empty', () => {
  const seen = [];
  const router = createRouter({
    routes: { accueil: () => seen.push('accueil') },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '',
    writeHash: () => {},
  });
  router.start();
  assert.deepEqual(seen, ['accueil']);
});

test('start opens the route named in the hash', () => {
  const seen = [];
  const router = createRouter({
    routes: { accueil: () => seen.push('accueil'), jeu: () => seen.push('jeu') },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '#jeu',
    writeHash: () => {},
  });
  router.start();
  assert.deepEqual(seen, ['jeu']);
});

test('an unknown hash falls back rather than showing nothing', () => {
  const seen = [];
  const router = createRouter({
    routes: { accueil: () => seen.push('accueil') },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '#nexistepas',
    writeHash: () => {},
  });
  router.start();
  assert.deepEqual(seen, ['accueil']);
});

test('go writes the hash and opens the route', () => {
  const written = [];
  const seen = [];
  const router = createRouter({
    routes: { accueil: () => seen.push('accueil'), jeu: () => seen.push('jeu') },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '',
    writeHash: (value) => written.push(value),
  });
  router.start();
  router.go('jeu');
  assert.deepEqual(written, ['#jeu']);
  assert.deepEqual(seen, ['accueil', 'jeu']);
});

test('leaving a route runs the cleanup it returned', () => {
  const events = [];
  const router = createRouter({
    routes: {
      accueil: () => { events.push('entrée accueil'); return () => events.push('sortie accueil'); },
      jeu: () => events.push('entrée jeu'),
    },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '',
    writeHash: () => {},
  });
  router.start();
  router.go('jeu');
  assert.deepEqual(events, ['entrée accueil', 'sortie accueil', 'entrée jeu']);
});

test('opening the route already shown does nothing', () => {
  const seen = [];
  const router = createRouter({
    routes: { accueil: () => seen.push('accueil'), jeu: () => seen.push('jeu') },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '#jeu',
    writeHash: () => {},
  });
  router.start();
  router.start(); // what the hashchange listener does right after `go`
  router.go('jeu');
  assert.deepEqual(seen, ['jeu']);
});

test('a route that returns something other than a function is tolerated', () => {
  const router = createRouter({
    routes: { a: () => 42, b: () => 'pas une fonction' },
    container: fakeContainer(),
    fallback: 'a',
    readHash: () => '',
    writeHash: () => {},
  });
  router.start();
  assert.doesNotThrow(() => router.go('b'));
});

test('a route that throws leaves the router able to try again', () => {
  let attempts = 0;
  const router = createRouter({
    routes: {
      accueil: () => {},
      jeu: () => {
        attempts += 1;
        if (attempts === 1) throw new Error('montage raté');
      },
    },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '',
    writeHash: () => {},
  });
  router.start();
  assert.throws(() => router.go('jeu'), /montage raté/);
  assert.doesNotThrow(() => router.go('jeu'));
  assert.equal(attempts, 2);
});

test('a route without cleanup does not break navigation', () => {
  const router = createRouter({
    routes: { a: () => {}, b: () => {} },
    container: fakeContainer(),
    fallback: 'a',
    readHash: () => '',
    writeHash: () => {},
  });
  router.start();
  assert.doesNotThrow(() => router.go('b'));
});
