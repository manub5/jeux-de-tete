import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createStorage } from '../../../core/storage.js';
import { createSolver } from '../../../lexicon/solver.js';
import { createLexicon } from '../../../lexicon/lexicon.js';
import { signature } from '../../../lexicon/signature.js';
import { createAllWords } from '../../../games/tous-les-mots/game.js';

const MOTS = [
  'cartons', 'carton', 'canots', 'canot', 'ratons', 'raton', 'tronc',
  'crans', 'cran', 'arcs', 'sort', 'tors', 'rats', 'cars', 'cors',
  'ras', 'ton', 'car', 'ans', 'nos', 'ors', 'sac', 'rat', 'sot', 'art', 'cor',
  // Real word, built from the letters of `cartons`, but below MIN_WORD_LENGTH:
  // it exercises the "too short" path on a real word, not only on noise, and
  // it stays out of `solutions` (filtered by length), so `total` is unaffected.
  'on',
  'chien', // dans le dictionnaire, mais pas dans ces lettres
];

function backend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function build(store = createStorage(backend())) {
  const index = new Map();
  for (const mot of MOTS) {
    const clef = signature(mot);
    if (!index.has(clef)) index.set(clef, []);
    if (!index.get(clef).includes(mot)) index.get(clef).push(mot);
  }
  const solver = createSolver(index);
  const lexicon = createLexicon(index, { accepted: new Set(), rejected: new Set(), save() {} });
  const frequencies = new Map([['cartons', 10]]);
  return { solver, lexicon, frequencies, storage: store };
}

function partie(store) {
  const outils = build(store);
  return {
    jeu: createAllWords({ ...outils, rng: createRng(1) }),
    storage: outils.storage,
    outils,
  };
}

test('a game deals its rack and knows how many words are in it', () => {
  const { jeu } = partie();
  assert.equal(jeu.letters.length, 7);
  assert.equal(jeu.phase, 'recherche');
  assert.ok(jeu.total >= 20);
  assert.deepEqual(jeu.found, []);
});

test('a found word is counted once', () => {
  const { jeu } = partie();
  assert.equal(jeu.propose('carton').ok, true);
  assert.deepEqual(jeu.propose('carton'), { ok: false, word: 'carton', length: 0, reason: 'déjà' });
  assert.equal(jeu.found.length, 1);
});

test('found words come back longest first', () => {
  const { jeu } = partie();
  jeu.propose('ton');
  jeu.propose('cartons');
  jeu.propose('cran');
  assert.deepEqual(jeu.found, ['cartons', 'cran', 'ton']);
});

test('a word shorter than three letters is refused as too short', () => {
  const { jeu } = partie();
  // Noise: not in the dictionary at all, yet still refused for its length.
  assert.equal(jeu.propose('ra').reason, 'court');
  // A real word, in the dictionary, but still too short to count.
  assert.equal(jeu.propose('on').reason, 'court');
});

test('a real word that is not in these letters is refused', () => {
  const { jeu } = partie();
  // `chien` is in the dictionary but needs an i, an h and an e.
  assert.equal(jeu.propose('chien').reason, 'lettres');
});

test('an invented word is refused', () => {
  const { jeu } = partie();
  assert.equal(jeu.propose('cratnos').reason, 'inconnu');
});

test('the total never tells him which words are missing', () => {
  const { jeu } = partie();
  assert.equal(typeof jeu.total, 'number');
  assert.equal(jeu.missed, undefined);
  assert.equal(jeu.solutions, undefined);
});

// The game survives closing the app: that is the whole point of it.

test('a game in progress is saved as it goes', () => {
  const store = createStorage(backend());
  const { jeu } = partie(store);
  jeu.propose('carton');
  const sauvegarde = store.get('tous-les-mots.partie', null);
  assert.ok(sauvegarde);
  assert.deepEqual(sauvegarde.found, ['carton']);
  assert.deepEqual(sauvegarde.letters, jeu.letters);
});

test('a saved game comes back with its rack and its words', () => {
  const store = createStorage(backend());
  const premiere = partie(store);
  premiere.jeu.propose('carton');
  premiere.jeu.propose('ton');

  const reprise = createAllWords({ ...build(store), rng: createRng(999) });
  assert.deepEqual(reprise.letters, premiere.jeu.letters);
  assert.deepEqual(reprise.found, ['carton', 'ton']);
  assert.equal(reprise.total, premiere.jeu.total);
});

test('a saved game of the wrong shape is ignored rather than crashing', () => {
  const back = backend();
  back.setItem('jp:tous-les-mots.partie', '{"found":"pas un tableau"}');
  const store = createStorage(back);
  const jeu = createAllWords({ ...build(store), rng: createRng(1) });
  assert.deepEqual(jeu.found, []);
  assert.equal(jeu.letters.length, 7);
});

test('finishing reveals what he missed and clears the save', () => {
  const store = createStorage(backend());
  const { jeu } = partie(store);
  jeu.propose('carton');
  const resultat = jeu.finish();
  assert.equal(resultat.found, 1);
  assert.equal(resultat.total, jeu.total);
  assert.ok(resultat.missed.includes('cartons'));
  assert.ok(!resultat.missed.includes('carton'));
  assert.equal(store.get('tous-les-mots.partie', null), null);
  assert.equal(jeu.phase, 'terminée');
});

test('abandoning clears the save without revealing anything', () => {
  const store = createStorage(backend());
  const { jeu } = partie(store);
  jeu.propose('carton');
  jeu.abandon();
  assert.equal(store.get('tous-les-mots.partie', null), null);
});

test('a finished game refuses further proposals', () => {
  const { jeu } = partie();
  jeu.finish();
  assert.throws(() => jeu.propose('ton'), /terminée/);
});

test('nothing handed out can reach back into the game', () => {
  const { jeu } = partie();
  jeu.propose('ton');
  jeu.letters[0] = 'z';
  jeu.found[0] = 'zzz';
  assert.notEqual(jeu.letters[0], 'z');
  assert.deepEqual(jeu.found, ['ton']);
});
