import test from 'node:test';
import assert from 'node:assert/strict';
import { isComplete } from '../../../games/sudoku/grid.js';
import { countSolutions, solve } from '../../../games/sudoku/solver.js';

/** Une grille depuis quatre-vingt-un caractères, le point valant vide. */
function grille(texte) {
  const nettoye = texte.replace(/\s/g, '');
  assert.equal(nettoye.length, 81, 'une grille fait 81 cases');
  return Int8Array.from([...nettoye].map((c) => (c === '.' ? 0 : Number(c))));
}

// Une grille classique à solution unique.
const UNIQUE = grille(`
  53..7.... 6..195... .98....6.
  8...6...3 4..8.3..1 7...2...6
  .6....28. ...419..5 ....8..79
`);

test('an empty grid has many solutions, and we stop counting at two', () => {
  assert.equal(countSolutions(new Int8Array(81), 2), 2);
});

test('a classic puzzle has exactly one solution', () => {
  assert.equal(countSolutions(UNIQUE, 2), 1);
});

test('a solved grid has exactly one solution: itself', () => {
  const resolue = solve(UNIQUE);
  assert.equal(countSolutions(resolue, 2), 1);
});

test('a grid with two answers is reported as two, not as one', () => {
  // La même grille privée de quatre indices : deux chiffres deviennent
  // échangeables. Mesuré : exactement deux solutions, même en comptant jusqu'à
  // neuf — l'assertion dit donc deux, et non « au moins une », qui serait vraie
  // même d'une grille sans ambiguïté.
  const ambigue = Int8Array.from(UNIQUE);
  ambigue[0] = 0;
  ambigue[1] = 0;
  ambigue[9] = 0;
  ambigue[10] = 0;
  assert.equal(countSolutions(ambigue, 2), 2);
});

test('a contradictory grid has no solution at all', () => {
  const impossible = new Int8Array(81);
  impossible[0] = 5;
  impossible[1] = 5; // deux 5 sur la même ligne
  assert.equal(countSolutions(impossible, 2), 0);
  assert.equal(solve(impossible), null);
});

test('solving fills every cell and keeps the clues given', () => {
  const resolue = solve(UNIQUE);
  assert.ok(resolue);
  assert.equal(isComplete(resolue), true);
  for (let cell = 0; cell < 81; cell++) {
    if (UNIQUE[cell]) assert.equal(resolue[cell], UNIQUE[cell], `case ${cell}`);
  }
});

test('solving does not touch the grid it was given', () => {
  const copie = Int8Array.from(UNIQUE);
  solve(UNIQUE);
  assert.deepEqual([...UNIQUE], [...copie]);
});
