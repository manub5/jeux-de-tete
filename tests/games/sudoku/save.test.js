import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createStorage } from '../../../core/storage.js';
import { SAVE_KEY, clearSave, loadOrStart } from '../../../games/sudoku/save.js';

function backendWith(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function premiereVide(jeu) {
  for (let cell = 0; cell < 81; cell++) if (!jeu.given(cell)) return cell;
  throw new Error('grille pleine');
}

test('with nothing saved, a fresh grid is dealt and written down', () => {
  const storage = createStorage(backendWith());
  const jeu = loadOrStart({ storage, rng: createRng(1), difficulty: 'facile' });
  assert.equal(jeu.difficulty, 'facile');
  const sauvegarde = storage.get(SAVE_KEY, null);
  assert.ok(sauvegarde, 'la grille neuve doit être sauvegardée aussitôt');
  assert.equal(sauvegarde.difficulty, 'facile');
});

test('a move is written down as it is played', () => {
  const storage = createStorage(backendWith());
  const jeu = loadOrStart({ storage, rng: createRng(2), difficulty: 'facile' });
  const vide = premiereVide(jeu);
  jeu.place(vide, jeu.solutionAt(vide));
  assert.equal(storage.get(SAVE_KEY, null).values[vide], jeu.valueAt(vide));
});

test('a game in progress comes back exactly as it was left', () => {
  const storage = createStorage(backendWith());
  const premier = loadOrStart({ storage, rng: createRng(3), difficulty: 'moyen' });
  const vides = [...Array(81).keys()].filter((c) => !premier.given(c));
  premier.place(vides[0], premier.solutionAt(vides[0]));
  premier.toggleNote(vides[1], 4);

  const reprise = loadOrStart({ storage, rng: createRng(999), difficulty: 'facile' });
  assert.equal(reprise.difficulty, 'moyen', 'le niveau de la partie prime sur celui demandé');
  assert.equal(reprise.valueAt(vides[0]), premier.valueAt(vides[0]));
  assert.deepEqual(reprise.notesAt(vides[1]), [4], 'les notes reviennent aussi');
});

test('the solution is recomputed, never stored', () => {
  const storage = createStorage(backendWith());
  const jeu = loadOrStart({ storage, rng: createRng(4), difficulty: 'facile' });
  const brut = JSON.stringify(storage.get(SAVE_KEY, null));
  assert.ok(!brut.includes('solution'), 'la sauvegarde ne doit pas porter la réponse');
  const vide = premiereVide(jeu);
  const reprise = loadOrStart({ storage, rng: createRng(5), difficulty: 'facile' });
  assert.equal(reprise.solutionAt(vide), jeu.solutionAt(vide));
});

test('a save of the wrong shape is ignored rather than crashing', () => {
  const storage = createStorage(backendWith({ 'jp:sudoku.partie': '{"values":"pas un tableau"}' }));
  const jeu = loadOrStart({ storage, rng: createRng(6), difficulty: 'facile' });
  assert.equal(jeu.difficulty, 'facile');
  assert.equal(jeu.phase, 'en cours');
});

test('a save whose puzzle has no single answer is refused', () => {
  // Une grille vide admet des milliers de solutions : impossible de reprendre.
  const storage = createStorage(backendWith({
    'jp:sudoku.partie': JSON.stringify({
      difficulty: 'facile', puzzle: new Array(81).fill(0),
      values: new Array(81).fill(0), notes: new Array(81).fill([]),
    }),
  }));
  const jeu = loadOrStart({ storage, rng: createRng(7), difficulty: 'facile' });
  assert.ok(jeu.given(0) || [...Array(81).keys()].some((c) => jeu.given(c)),
    'une grille neuve doit avoir été distribuée');
});

test('clearing the save leaves nothing behind', () => {
  const storage = createStorage(backendWith());
  loadOrStart({ storage, rng: createRng(8), difficulty: 'facile' });
  clearSave(storage);
  assert.equal(storage.get(SAVE_KEY, null), null);
});
