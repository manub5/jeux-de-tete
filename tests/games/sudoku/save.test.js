import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createStorage } from '../../../core/storage.js';
import { generate } from '../../../games/sudoku/generate.js';
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

/**
 * Une sauvegarde bien formée, tirée d'une vraie grille. Les essais qui suivent
 * n'en abîment qu'un détail à la fois, pour que le refus vienne de ce
 * détail-là et de rien d'autre.
 */
function sauvegarde(graine, changements = {}) {
  const { puzzle } = generate(createRng(graine), 'facile');
  return {
    difficulty: 'facile',
    puzzle: [...puzzle],
    values: [...puzzle],
    notes: Array.from({ length: 81 }, () => []),
    mistakes: [],
    ...changements,
  };
}

function stockageAvec(sauvee) {
  return createStorage(backendWith({ 'jp:sudoku.partie': JSON.stringify(sauvee) }));
}

test('a save in the right shape is taken up, so a refusal means something', () => {
  // L'auto-test de tous les refus qui suivent : la même fabrique, sans rien
  // abîmer, doit être reprise. Sinon un `asSaved` qui refuserait tout les
  // ferait tous passer au vert.
  const storage = stockageAvec(sauvegarde(14));
  const jeu = loadOrStart({ storage, rng: createRng(15), difficulty: 'difficile' });
  assert.equal(jeu.difficulty, 'facile', 'la partie sauvegardée est reprise');
});

test('a save whose placed digit contradicts its own clue is refused', () => {
  // Sans ce garde, la sauvegarde trafiquée est acceptée : les 81 cases sont
  // remplies, mais la case fautive est un indice, donc `place` et `erase` la
  // refusent, et comme le compte ne tombe pas juste la phase reste « en
  // cours ». La grille ne peut plus être finie, et rien ne le lui dit.
  const { puzzle, solution } = generate(createRng(12), 'facile');
  const indice = [...Array(81).keys()].find((c) => puzzle[c] !== 0);
  const values = [...solution];
  values[indice] = solution[indice] === 9 ? 1 : solution[indice] + 1;
  const storage = stockageAvec(sauvegarde(12, { values }));

  const jeu = loadOrStart({ storage, rng: createRng(13), difficulty: 'moyen' });
  assert.equal(jeu.difficulty, 'moyen',
    'la sauvegarde qui se contredit est écartée, une grille neuve est distribuée');
  assert.equal(jeu.phase, 'en cours');
  const jouables = [...Array(81).keys()]
    .filter((c) => !jeu.given(c) && jeu.valueAt(c) === 0);
  assert.ok(jouables.length > 0, 'la grille rendue a des cases à remplir');
});

test('a mistake survives a reload', () => {
  // Le spec est explicite : il pose le téléphone en cours de grille et revient
  // trois jours plus tard. Le compte d'erreurs doit tenir sur deux séances.
  const storage = createStorage(backendWith());
  const premier = loadOrStart({ storage, rng: createRng(9), difficulty: 'facile' });
  const vide = premiereVide(premier);
  const juste = premier.solutionAt(vide);
  premier.place(vide, juste === 9 ? 1 : juste + 1);
  assert.equal(premier.mistakes, 1);
  assert.deepEqual(storage.get(SAVE_KEY, null).mistakes, [vide]);

  const reprise = loadOrStart({ storage, rng: createRng(999), difficulty: 'facile' });
  assert.equal(reprise.mistakes, 1, 'le compte d’erreurs doit survivre à la reprise');
});

test('clearing the save leaves nothing behind', () => {
  const storage = createStorage(backendWith());
  loadOrStart({ storage, rng: createRng(8), difficulty: 'facile' });
  clearSave(storage);
  assert.equal(storage.get(SAVE_KEY, null), null);
});
