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

test('a save whose difficulty is not one of the three is refused', () => {
  // Le niveau est une clé : dans DIFFICULTIES au tirage suivant, et dans les
  // libellés de l'écran. Accepté tel quel, il donne un menu qui propose de
  // reprendre « une grille undefined ».
  const storage = stockageAvec(sauvegarde(16, { difficulty: 'impossible' }));
  const jeu = loadOrStart({ storage, rng: createRng(17), difficulty: 'moyen' });
  assert.equal(jeu.difficulty, 'moyen');
});

test('a save whose board is not a board of 81 digits is refused', () => {
  // Le garde le plus lourd. Un tableau trop court traverse `Int8Array.from`
  // sans broncher, et le solveur reçoit alors une grille plus courte que ses
  // tables d'index : il repart en arrière sans fin — pile débordée, écran
  // blanc à l'ouverture, et rien qu'il puisse faire.
  //
  // Chaque grille abîmée ci-dessous reste par ailleurs d'accord avec ses
  // propres indices : sans cette précaution, c'est le garde indice/valeur qui
  // les refuserait, et celui-ci passerait pour utile sans l'être.
  const { puzzle } = generate(createRng(18), 'facile');
  const vide = [...Array(81).keys()].find((c) => !puzzle[c]);
  const horsBornes = [...puzzle];
  horsBornes[vide] = 42;
  const pasUnEntier = [...puzzle];
  pasUnEntier[vide] = '3';

  const repris = [
    ['un tableau trop court', { puzzle: [...puzzle].slice(0, 80) }],
    ['un tableau trop long', { values: [...puzzle, 0] }],
    ['un chiffre hors bornes', { values: horsBornes }],
    ['un chiffre qui n’en est pas un', { values: pasUnEntier }],
    ['pas un tableau du tout', { puzzle: { longueur: 81 } }],
  ].filter(([, abime]) => loadOrStart({
    storage: stockageAvec(sauvegarde(18, abime)),
    rng: createRng(19),
    difficulty: 'moyen',
  }).difficulty !== 'moyen').map(([quoi]) => quoi);

  assert.deepEqual(repris, [],
    `ces sauvegardes ne doivent pas être reprises : ${repris.join(', ')}`);
});

test('notes read back from a save are digits, or nothing', () => {
  // Ici on ne refuse pas la sauvegarde, on la nettoie : des notes abîmées ne
  // valent pas une grille perdue. Sans le tri, la case afficherait des
  // marques qui ne sont pas des chiffres — et le joueur n'aurait aucun moyen
  // de les faire partir, puisque le clavier ne les propose pas.
  const { puzzle } = generate(createRng(24), 'facile');
  const [vide, autre] = [...Array(81).keys()].filter((c) => !puzzle[c]);
  const notes = Array.from({ length: 81 }, () => []);
  notes[vide] = [0, 10, -3, '4', 5.5, null, 7, 3];
  notes[autre] = 'pas un tableau';
  const storage = stockageAvec(sauvegarde(24, { notes }));

  const jeu = loadOrStart({ storage, rng: createRng(25), difficulty: 'facile' });
  assert.deepEqual(jeu.notesAt(vide), [3, 7], 'seuls les chiffres de 1 à 9 survivent');
  assert.deepEqual(jeu.notesAt(autre), [], 'une liste qui n’en est pas une ne donne rien');
});

test('the mistakes read back from a save are cells of the grid', () => {
  // Même principe, et la conséquence est visible : le compteur de l'écran est
  // la taille de cet ensemble. Sans le tri, une sauvegarde abîmée lui annonce
  // des erreurs qu'il n'a pas commises, et l'écran de fin les lui répète.
  const storage = stockageAvec(sauvegarde(26, { mistakes: [0, 81, -1, 'x', 3.5, 40] }));
  const jeu = loadOrStart({ storage, rng: createRng(27), difficulty: 'facile' });
  assert.equal(jeu.mistakes, 2, 'seules les cases 0 et 40 en sont');

  const pasUneListe = stockageAvec(sauvegarde(26, { mistakes: 'trois' }));
  const autre = loadOrStart({ storage: pasUneListe, rng: createRng(28), difficulty: 'facile' });
  assert.equal(autre.mistakes, 0, 'un compte illisible se lit comme aucune erreur');
});

test('undo and redo are written down like any other move', () => {
  // `attachSaving` enveloppe cinq méthodes. Les trois premières sont tenues
  // ailleurs ; sans les deux dernières, annuler un chiffre puis fermer
  // l'application le ramène à la réouverture.
  const storage = createStorage(backendWith());
  const jeu = loadOrStart({ storage, rng: createRng(22), difficulty: 'facile' });
  const vide = premiereVide(jeu);
  jeu.place(vide, jeu.solutionAt(vide));

  jeu.undo();
  assert.equal(storage.get(SAVE_KEY, null).values[vide], 0,
    'annuler s’écrit tout de suite dans la sauvegarde');
  jeu.redo();
  assert.equal(storage.get(SAVE_KEY, null).values[vide], jeu.valueAt(vide),
    'refaire aussi');
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
