import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { conflictsIn, isComplete } from '../../../games/sudoku/grid.js';
import { countSolutions } from '../../../games/sudoku/solver.js';
import { LEVELS, logicalSolve } from '../../../games/sudoku/logic.js';
import { DIFFICULTIES, completeGrid, generate } from '../../../games/sudoku/generate.js';

test('the three difficulties are named, with their measured figures', () => {
  assert.deepEqual(Object.keys(DIFFICULTIES), ['facile', 'moyen', 'difficile']);
  assert.equal(DIFFICULTIES.facile.clues, 36);
  assert.equal(DIFFICULTIES.facile.level, LEVELS.singles);
  assert.equal(DIFFICULTIES.moyen.level, LEVELS.singles);
  assert.equal(DIFFICULTIES.difficile.level, LEVELS.pairs);
  assert.equal(DIFFICULTIES.difficile.mustRequire, true);
  assert.equal(DIFFICULTIES.facile.mustRequire, false);
});

test('a complete grid is full, legal and different from seed to seed', () => {
  const une = completeGrid(createRng(1));
  assert.equal(isComplete(une), true);
  assert.equal(conflictsIn(une).size, 0);
  const autre = completeGrid(createRng(2));
  assert.notDeepEqual([...une], [...autre]);
});

test('the same seed builds the same complete grid', () => {
  assert.deepEqual([...completeGrid(createRng(7))], [...completeGrid(createRng(7))]);
});

test('an easy puzzle keeps exactly the clues it promises', () => {
  const { puzzle, clues } = generate(createRng(11), 'facile');
  assert.equal(clues, 36);
  assert.equal(puzzle.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0), 36);
});

test('every puzzle has exactly one solution', () => {
  for (const niveau of ['facile', 'moyen', 'difficile']) {
    const { puzzle } = generate(createRng(21), niveau);
    assert.equal(countSolutions(puzzle, 2), 1, `${niveau} doit être unique`);
  }
});

test('the solution handed back really solves the puzzle', () => {
  const { puzzle, solution } = generate(createRng(31), 'moyen');
  assert.equal(isComplete(solution), true);
  assert.equal(conflictsIn(solution).size, 0);
  for (let cell = 0; cell < 81; cell++) {
    if (puzzle[cell]) assert.equal(solution[cell], puzzle[cell], `case ${cell}`);
  }
});

test('every puzzle is solvable by the techniques its level allows', () => {
  for (const niveau of ['facile', 'moyen', 'difficile']) {
    const { puzzle } = generate(createRng(41), niveau);
    const resultat = logicalSolve(puzzle, DIFFICULTIES[niveau].level);
    assert.equal(resultat.solved, true, `${niveau} doit être résoluble logiquement`);
  }
});

test('a hard puzzle genuinely requires its technique, not merely allows it', () => {
  // C'est l'exigence que la mesure a imposée : sans elle les trois niveaux se
  // ressemblent, et « difficile » n'est qu'une étiquette.
  const { puzzle } = generate(createRng(51), 'difficile');
  assert.equal(logicalSolve(puzzle, LEVELS.singles).solved, false,
    'une grille difficile ne doit pas céder aux seuls singletons');
});

test('an easy puzzle is not accidentally hard', () => {
  const { puzzle } = generate(createRng(61), 'facile');
  assert.equal(logicalSolve(puzzle, LEVELS.singles).solved, true);
});

test('generating does not disturb the caller', () => {
  const alea = createRng(71);
  const premier = generate(alea, 'facile');
  assert.notEqual(premier.puzzle, premier.solution);
  const avant = premier.solution[0];
  premier.puzzle[0] = 9;
  assert.equal(premier.solution[0], avant, 'la solution ne partage pas sa mémoire');
});

test('an unknown difficulty is refused rather than silently treated as easy', () => {
  assert.throws(() => generate(createRng(1), 'impossible'), /difficulté/);
});
