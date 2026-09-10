import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createSolver } from '../../../lexicon/solver.js';
import { createLexicon } from '../../../lexicon/lexicon.js';
import { signature } from '../../../lexicon/signature.js';
import {
  MIN_SOLUTIONS,
  MIN_WORD_LENGTH,
  RACK_SIZE,
  baseCandidates,
  pickRack,
} from '../../../games/tous-les-mots/draw.js';

// All built from the letters of `cartons`: c a r t o n s.
const MOTS = [
  'cartons', 'carton', 'canots', 'canot', 'ratons', 'raton', 'tronc',
  'crans', 'cran', 'arcs', 'sort', 'tors', 'rats', 'cars', 'cors',
  'ras', 'ton', 'car', 'ans', 'nos', 'ors', 'sac', 'rat', 'sot', 'art', 'cor',
];

// `pickRack` counts the words he can actually reach, so it needs the lexicon
// as well as the solver: a spelling he can never type, or one he has struck
// out, must not make a thin rack look rich.
function build() {
  const index = new Map();
  for (const mot of MOTS) {
    const clef = signature(mot);
    if (!index.has(clef)) index.set(clef, []);
    if (!index.get(clef).includes(mot)) index.get(clef).push(mot);
  }
  return {
    solver: createSolver(index),
    lexicon: createLexicon(index, { accepted: new Set(), rejected: new Set(), save() {} }),
  };
}

function tire(rng, frequencies, { solver, lexicon }) {
  return pickRack(rng, frequencies, solver, lexicon);
}

test('the rack is seven letters and words count from three', () => {
  assert.equal(RACK_SIZE, 7);
  assert.equal(MIN_WORD_LENGTH, 3);
  assert.ok(MIN_SOLUTIONS >= 20);
});

test('only words of seven played letters can be a base', () => {
  const frequencies = new Map([['cartons', 10], ['carton', 10], ['ras', 10]]);
  assert.deepEqual(baseCandidates(frequencies), ['cartons']);
});

test('a ligature counts for its played letters', () => {
  // `cœurs` is five characters but six played letters — still not seven.
  const frequencies = new Map([['cœurs', 10]]);
  assert.deepEqual(baseCandidates(frequencies), []);
});

test('candidates come back sorted, so a seed always picks the same base', () => {
  const frequencies = new Map([['cartons', 10], ['notaire', 10]]);
  const liste = baseCandidates(frequencies);
  assert.deepEqual(liste, [...liste].sort());
});

test('a rack holds exactly the letters of its base word', () => {
  const frequencies = new Map([['cartons', 10]]);
  const { letters } = tire(createRng(1), frequencies, build());
  assert.deepEqual([...letters].sort(), [...'cartons'].sort());
});

test('the rack comes with everything findable in it', () => {
  const frequencies = new Map([['cartons', 10]]);
  const outils = build();
  const { solutions } = tire(createRng(1), frequencies, outils);
  assert.ok(solutions.includes('cartons'));
  assert.ok(solutions.includes('ton'));
  assert.ok(
    solutions.every((mot) => outils.solver.playedLength(mot) >= MIN_WORD_LENGTH)
  );
});

test('a base whose rack is too poor is rejected in favour of another', () => {
  // With a real seed, `cartons` happens to be the very first draw already —
  // this only proves the picker can land on a rich base, not that it can
  // recover from a poor one. Kept because it is still true, but the retry
  // itself is proven below with a scripted rng.
  const frequencies = new Map([['aaaaaaa', 99], ['cartons', 10]]);
  const { letters } = tire(createRng(1), frequencies, build());
  assert.deepEqual([...letters].sort(), [...'cartons'].sort());
});

test('a rejected base forces pickRack to draw again, not settle', () => {
  // `aaaaaaa` yields nothing findable; the picker must retry rather than
  // return it. `baseCandidates` sorts, so with these two bases the order is
  // ['aaaaaaa', 'cartons'] — index 0 and index 1 respectively.
  const frequencies = new Map([['aaaaaaa', 99], ['cartons', 10]]);
  // bases[Math.floor(rng() * 2)]: 0 selects index 0 (aaaaaaa), 0.5 selects
  // index 1 (cartons). A scripted rng makes the sequence — and therefore the
  // retry — explicit, instead of relying on a seed that happens to work.
  const draws = [0, 0.5];
  let calls = 0;
  const rng = () => draws[calls++];
  const { letters } = tire(rng, frequencies, build());
  assert.deepEqual([...letters].sort(), [...'cartons'].sort());
  // Both draws were actually consumed: the first (poor) base was tried and
  // discarded before the second (rich) one was accepted.
  assert.equal(calls, 2);
});

test('the same seed deals the same rack', () => {
  const frequencies = new Map([['cartons', 10]]);
  const outils = build();
  assert.deepEqual(
    tire(createRng(5), frequencies, outils).letters,
    tire(createRng(5), frequencies, outils).letters
  );
});

test('no seven-letter base at all is refused before ever attempting a draw', () => {
  // No word in the frequency table is seven played letters, so
  // baseCandidates comes back empty — this must fail fast, not loop.
  assert.throws(
    () => tire(createRng(1), new Map([['ras', 10]]), build()),
    /^Error: aucun tirage possible : pas de mot de sept lettres$/
  );
});

test('a base that never clears the solutions threshold exhausts the retry budget', () => {
  // `aaaaaaa` is a usable base (baseCandidates is non-empty) but never
  // yields enough solutions, so every one of MAX_TRIES attempts fails.
  assert.throws(
    () => tire(createRng(1), new Map([['aaaaaaa', 99]]), build()),
    /^Error: aucun tirage assez riche trouvé$/
  );
});

test('a word he struck out does not make a thin rack look rich', () => {
  // `cartons` gives 26 words. Strike out seven of them and only 19 remain
  // reachable — under the floor — so this base must be refused, even though the
  // solver still finds all 26 in the index.
  const outils = build();
  for (const mot of ['cartons', 'carton', 'canots', 'canot', 'ratons', 'raton', 'tronc']) {
    outils.lexicon.reject(mot);
  }
  assert.throws(
    () => tire(createRng(1), new Map([['cartons', 10]]), outils),
    /aucun tirage assez riche/
  );
});

test('the rack it deals holds only words he can actually reach', () => {
  const outils = build();
  outils.lexicon.reject('tronc');
  const { solutions } = tire(createRng(1), new Map([['cartons', 10]]), outils);
  assert.ok(!solutions.includes('tronc'), 'un mot écarté ne compte pas');
  assert.ok(solutions.includes('cartons'));
});
