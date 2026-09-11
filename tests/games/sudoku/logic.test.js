import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, logicalSolve } from '../../../games/sudoku/logic.js';
import { candidatesOf, countBits } from '../../../games/sudoku/grid.js';
import { countSolutions } from '../../../games/sudoku/solver.js';

function grille(texte) {
  const nettoye = texte.replace(/\s/g, '');
  assert.equal(nettoye.length, 81, 'une grille fait 81 cases');
  return Int8Array.from([...nettoye].map((c) => (c === '.' ? 0 : Number(c))));
}

// Résoluble par singletons seuls : la grille classique la plus connue.
const FACILE = grille(`
  53..7.... 6..195... .98....6.
  8...6...3 4..8.3..1 7...2...6
  .6....28. ...419..5 ....8..79
`);

test('the levels are named and ordered', () => {
  assert.equal(LEVELS.singles, 1);
  assert.equal(LEVELS.pairs, 2);
});

test('a grid solvable by singles alone is solved at the first level', () => {
  const resultat = logicalSolve(FACILE, LEVELS.singles);
  assert.equal(resultat.solved, true);
  assert.equal(resultat.hardest, LEVELS.singles);
});

test('a grid with a single missing digit is solved without effort', () => {
  const presque = grille(`
    53467891. 672195348 198342567
    859761423 426853791 713924856
    961537284 287419635 345286179
  `);
  const resultat = logicalSolve(presque, LEVELS.singles);
  assert.equal(resultat.solved, true);
});

test('an empty grid is not solved, and says so rather than looping', () => {
  const resultat = logicalSolve(new Int8Array(81), LEVELS.singles);
  assert.equal(resultat.solved, false);
});

test('a contradictory grid is refused, not solved', () => {
  const impossible = new Int8Array(81);
  impossible[0] = 5;
  impossible[1] = 5;
  assert.equal(logicalSolve(impossible, LEVELS.singles).solved, false);
});

test('solving does not touch the grid it was given', () => {
  const copie = Int8Array.from(FACILE);
  logicalSolve(FACILE, LEVELS.singles);
  assert.deepEqual([...FACILE], [...copie]);
});

test('a hidden single is placed where no naked single could be', () => {
  // Grille à 23 indices, solution unique (vérifiée avec le solveur exhaustif
  // et countSolutions === 1). Dès la toute première passe, la case 44
  // (ligne 4, colonne 8) porte quatre candidats — {1, 5, 6, 8} — donc aucun
  // singleton nu ne peut l'atteindre. Mais dans sa ligne, le 1 n'a qu'elle
  // comme case possible : seul le singleton caché la résout.
  const grid = grille(`
    .3...8... ...1..... ..8..256.
    ...76.... .2...379. .1.......
    ......2.4 ..741.... .452....9
  `);
  const avant = candidatesOf(grid, 44);
  assert.ok(countBits(avant) > 1, 'la case ne doit pas déjà être un singleton nu');
  const resultat = logicalSolve(grid, LEVELS.singles);
  assert.equal(resultat.solved, true);
});

test('a grid with several answers is never reported as solved', () => {
  // Un solveur qui ne devine jamais ne peut pas conclure sur une grille
  // ambiguë. Celle-ci admet quatre solutions (vérifié par countSolutions,
  // pas trois comme un premier brouillon l'avait cru) : la déclarer résolue
  // signifierait qu'un chiffre a été posé sans droit.
  const ambigue = grille(`
    .34..89.2 6.2195348 1.....5.7
    .59.6..23 ..6..3.9. .139..856
    96.53.2.4 28....63. 34.286179
  `);
  assert.equal(countSolutions(ambigue, 4), 4, 'la grille témoin doit rester ambiguë');
  assert.equal(logicalSolve(ambigue, LEVELS.singles).solved, false);
});

test('a grid the solver fills must obey the rules', () => {
  // Grille à solution unique, entièrement résoluble par singletons — vérifié
  // ci-dessous. La déclarer résolue n'a de sens que si le résultat est une
  // vraie solution : l'assertion est donc sans condition, pas seulement
  // « si le solveur dit résolu, alors... ». Avant le correctif de la table
  // de candidats, cette même grille se corrompait (neuf cases en conflit)
  // tout en étant annoncée résolue — le filet de sécurité final la détecte
  // et la fait échouer, ce qu'une vérification conditionnelle n'aurait pas
  // forcément exercé.
  const temoin = grille(`
    5..6789.2 .72.9.3.8 .....256.
    85976..2. .2.8.3.91 .1.9248..
    .6153..84 28....... ..5.86179
  `);
  assert.equal(countSolutions(temoin, 2), 1, 'la grille témoin a une solution unique');
  const resultat = logicalSolve(temoin, LEVELS.singles);
  assert.equal(resultat.solved, true, 'cette grille précise se résout entièrement par singletons');
});
