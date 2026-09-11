import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { generate } from '../../../games/sudoku/generate.js';
import { createSudoku } from '../../../games/sudoku/game.js';

function partie(niveau = 'facile') {
  const { puzzle, solution } = generate(createRng(101), niveau);
  return createSudoku({ difficulty: niveau, puzzle, solution });
}

/** La première case vide de la grille. */
function premiereVide(jeu) {
  for (let cell = 0; cell < 81; cell++) if (!jeu.given(cell)) return cell;
  throw new Error('grille pleine');
}

test('a game opens on its puzzle, with nothing placed and nothing wrong', () => {
  const jeu = partie();
  assert.equal(jeu.difficulty, 'facile');
  assert.equal(jeu.phase, 'en cours');
  assert.equal(jeu.mistakes, 0);
  assert.equal(jeu.conflicts.size, 0);
  assert.equal(jeu.canUndo, false);
  assert.equal(jeu.canRedo, false);
});

test('a clue cannot be changed', () => {
  const jeu = partie();
  const indice = [...Array(81).keys()].find((c) => jeu.given(c));
  const avant = jeu.valueAt(indice);
  jeu.place(indice, 5);
  assert.equal(jeu.valueAt(indice), avant);
  jeu.erase(indice);
  assert.equal(jeu.valueAt(indice), avant);
});

test('placing a digit shows it, erasing takes it away', () => {
  const jeu = partie();
  const vide = premiereVide(jeu);
  jeu.place(vide, 5);
  assert.equal(jeu.valueAt(vide), 5);
  jeu.erase(vide);
  assert.equal(jeu.valueAt(vide), 0);
});

test('a wrong digit counts one mistake, however many times it is retried', () => {
  const jeu = partie();
  const vide = premiereVide(jeu);
  const juste = jeu.solutionAt(vide);
  const faux = juste === 9 ? 1 : juste + 1;
  jeu.place(vide, faux);
  assert.equal(jeu.mistakes, 1);
  jeu.place(vide, faux === 9 ? 1 : faux + 1);
  assert.equal(jeu.mistakes, 1, 'la même case ne compte qu’une fois');
});

test('two different cells wrong count two mistakes', () => {
  const jeu = partie();
  const vides = [...Array(81).keys()].filter((c) => !jeu.given(c)).slice(0, 2);
  for (const cell of vides) {
    const juste = jeu.solutionAt(cell);
    jeu.place(cell, juste === 9 ? 1 : juste + 1);
  }
  assert.equal(jeu.mistakes, 2);
});

test('a right digit costs nothing', () => {
  const jeu = partie();
  const vide = premiereVide(jeu);
  jeu.place(vide, jeu.solutionAt(vide));
  assert.equal(jeu.mistakes, 0);
});

test('conflicting digits are reported, both of them', () => {
  const jeu = partie();
  const parLigne = new Map();
  for (const c of [...Array(81).keys()].filter((c) => !jeu.given(c))) {
    const ligne = Math.floor(c / 9);
    parLigne.set(ligne, [...(parLigne.get(ligne) ?? []), c]);
  }
  const paire = [...parLigne.values()].find((cases) => cases.length >= 2);
  assert.ok(paire, 'il faut deux cases vides sur une même ligne pour ce test');
  const [a, b] = paire;
  jeu.place(a, 5);
  jeu.place(b, 5);
  assert.ok(jeu.conflicts.has(a) && jeu.conflicts.has(b));
});

test('undo takes back the last move, redo puts it again', () => {
  const jeu = partie();
  const vide = premiereVide(jeu);
  jeu.place(vide, 5);
  assert.equal(jeu.canUndo, true);
  jeu.undo();
  assert.equal(jeu.valueAt(vide), 0);
  assert.equal(jeu.canRedo, true);
  jeu.redo();
  assert.equal(jeu.valueAt(vide), 5);
});

test('undoing does not undo the mistake that was already counted', () => {
  // Il a bien commis l'erreur ; l'annuler corrige la grille, pas l'histoire.
  const jeu = partie();
  const vide = premiereVide(jeu);
  const juste = jeu.solutionAt(vide);
  jeu.place(vide, juste === 9 ? 1 : juste + 1);
  jeu.undo();
  assert.equal(jeu.mistakes, 1);
});

test('a new move throws away what was undone', () => {
  const jeu = partie();
  const [a, b] = [...Array(81).keys()].filter((c) => !jeu.given(c)).slice(0, 2);
  jeu.place(a, 5);
  jeu.undo();
  jeu.place(b, 6);
  assert.equal(jeu.canRedo, false);
});

test('notes go on and off, and a digit clears them', () => {
  const jeu = partie();
  const vide = premiereVide(jeu);
  jeu.toggleNote(vide, 3);
  jeu.toggleNote(vide, 7);
  assert.deepEqual(jeu.notesAt(vide), [3, 7]);
  jeu.toggleNote(vide, 3);
  assert.deepEqual(jeu.notesAt(vide), [7]);
  jeu.place(vide, 5);
  assert.deepEqual(jeu.notesAt(vide), [], 'poser un chiffre efface les notes');
});

test('filling the grid correctly ends the game', () => {
  const jeu = partie();
  for (let cell = 0; cell < 81; cell++) {
    if (jeu.phase === 'terminée') break;
    if (!jeu.given(cell)) jeu.place(cell, jeu.solutionAt(cell));
  }
  assert.equal(jeu.phase, 'terminée');
  const resultat = jeu.finish();
  assert.equal(resultat.solved, true);
  assert.equal(resultat.mistakes, 0);
  assert.equal(resultat.difficulty, 'facile');
});

test('a finished game refuses further moves', () => {
  const jeu = partie();
  for (let cell = 0; cell < 81; cell++) {
    if (jeu.phase === 'terminée') break;
    if (!jeu.given(cell)) jeu.place(cell, jeu.solutionAt(cell));
  }
  assert.throws(() => jeu.place(0, 1), /terminée/);
});

test('a game rebuilt from a completed grid comes back finished', () => {
  const { puzzle, solution } = generate(createRng(101), 'facile');
  const jeu = createSudoku({
    difficulty: 'facile', puzzle, solution,
    values: Int8Array.from(solution),
    notes: Array.from({ length: 81 }, () => []),
  });
  assert.equal(jeu.phase, 'terminée');
});

test('a note under a digit does not survive a reload', () => {
  const { puzzle, solution } = generate(createRng(101), 'facile');
  const vide = [...Array(81).keys()].find((c) => !puzzle[c]);
  const values = Int8Array.from(puzzle);
  values[vide] = solution[vide];
  const notes = Array.from({ length: 81 }, () => []);
  notes[vide] = [3, 7];  // une sauvegarde incohérente : des notes sous un chiffre
  const jeu = createSudoku({ difficulty: 'facile', puzzle, solution, values, notes });
  assert.deepEqual(jeu.notesAt(vide), []);
});

test('a rebuilt game is seeded with the mistakes it is handed', () => {
  const { puzzle, solution } = generate(createRng(101), 'facile');
  const jeu = createSudoku({
    difficulty: 'facile', puzzle, solution,
    values: Int8Array.from(puzzle),
    notes: Array.from({ length: 81 }, () => []),
    mistakes: [3, 40],
  });
  assert.equal(jeu.mistakes, 2);
});

test('nothing handed out can reach back into the game', () => {
  const jeu = partie();
  const vide = premiereVide(jeu);
  jeu.toggleNote(vide, 4);
  jeu.notesAt(vide).push(9);
  assert.deepEqual(jeu.notesAt(vide), [4]);
  jeu.conflicts.add(0);
  assert.equal(jeu.conflicts.has(0), false);
});
