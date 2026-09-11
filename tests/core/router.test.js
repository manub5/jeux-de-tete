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

test('a route that throws once can be opened again later if it stops throwing', () => {
  let attempts = 0;
  const errors = [];
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
    onError: (error) => errors.push(error),
  });
  router.start();
  assert.doesNotThrow(() => router.go('jeu'));
  assert.equal(errors.length, 1);
  assert.doesNotThrow(() => router.go('jeu'));
  assert.equal(attempts, 2);
});

test('a mount that throws hands the failure to onError instead of leaving a blank page', () => {
  const seen = [];
  const router = createRouter({
    routes: {
      accueil: () => {},
      jeu: () => { throw new Error('montage raté'); },
    },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '',
    writeHash: () => {},
    onError: (error, container) => seen.push([error.message, container]),
  });
  router.start();
  assert.doesNotThrow(() => router.go('jeu'));
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], 'montage raté');
});

test('a mount that throws does not leave the container holding a half-built screen', () => {
  const children = [];
  const container = {
    replaceChildren(...nodes) { children.length = 0; children.push(...nodes); },
    append(...nodes) { children.push(...nodes); },
  };
  const router = createRouter({
    routes: {
      accueil: () => {},
      jeu: (target) => {
        target.append('un fragment du jeu');
        throw new Error('montage raté');
      },
    },
    container,
    fallback: 'accueil',
    readHash: () => '',
    writeHash: () => {},
    onError: () => {},
  });
  router.start();
  router.go('jeu');
  assert.deepEqual(children, []);
});

test('the router can still open another route after a mount throws', () => {
  const seen = [];
  const router = createRouter({
    routes: {
      accueil: () => { seen.push('accueil'); },
      jeu: () => { throw new Error('montage raté'); },
      anagrammes: () => { seen.push('anagrammes'); },
    },
    container: fakeContainer(),
    fallback: 'accueil',
    readHash: () => '',
    writeHash: () => {},
    onError: () => {},
  });
  router.start();
  router.go('jeu');
  router.go('anagrammes');
  assert.deepEqual(seen, ['accueil', 'anagrammes']);
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

test('a cleanup that throws does not trap the player on a half-torn screen', () => {
  const seen = [];
  const router = createRouter({
    routes: {
      a: () => { seen.push('a'); return () => { throw new Error('nettoyage raté'); }; },
      b: () => { seen.push('b'); },
    },
    container: fakeContainer(),
    fallback: 'a',
    readHash: () => '',
    writeHash: () => {},
  });
  router.start();
  assert.doesNotThrow(() => router.go('b'));
  assert.deepEqual(seen, ['a', 'b']);
});

test('a cleanup that throws does not run again on the next navigation', () => {
  let nettoyages = 0;
  const router = createRouter({
    routes: {
      a: () => () => { nettoyages += 1; throw new Error('nettoyage raté'); },
      b: () => {},
      c: () => {},
    },
    container: fakeContainer(),
    fallback: 'a',
    readHash: () => '',
    writeHash: () => {},
  });
  router.start();
  router.go('b');
  router.go('c');
  assert.equal(nettoyages, 1);
});
