// A complete grid, then cells taken away one at a time. A removal is kept only
// if the grid still has exactly one answer and the logical solver of the target
// level can still finish.
//
// The one thing measurement forced: a hard grid must *require* its technique,
// not merely be allowed it. Digging as deep as the solver permits makes all
// three levels converge on the same puzzle — measured, fifty-five empty cells
// whatever the level asked for.

import { SIZE, candidatesOf, valuesOf } from './grid.js';
import { countSolutions } from './solver.js';
import { LEVELS, logicalSolve } from './logic.js';

/**
 * `clues` is where digging stops, `level` the techniques allowed, and
 * `mustRequire` says the puzzle has to defeat the level below — which is what
 * makes "difficile" mean something. Figures measured, not guessed.
 */
export const DIFFICULTIES = {
  facile: { clues: 36, level: LEVELS.singles, mustRequire: false },
  moyen: { clues: 17, level: LEVELS.singles, mustRequire: false },
  difficile: { clues: 17, level: LEVELS.pairs, mustRequire: true },
};

/** How many times to redraw a grid that does not require its level. */
const MAX_TRIES = 40;

export function completeGrid(rng) {
  const grid = new Int8Array(SIZE);
  function fill(cell) {
    if (cell === SIZE) return true;
    const values = valuesOf(candidatesOf(grid, cell));
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    for (const value of values) {
      grid[cell] = value;
      if (fill(cell + 1)) return true;
      grid[cell] = 0;
    }
    return false;
  }
  fill(0);
  return grid;
}

function dig(solution, { clues, level }, rng) {
  const puzzle = Int8Array.from(solution);
  const order = [...Array(SIZE).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let left = SIZE;
  for (const cell of order) {
    if (left <= clues) break;
    const kept = puzzle[cell];
    puzzle[cell] = 0;
    if (countSolutions(puzzle, 2) !== 1 || !logicalSolve(puzzle, level).solved) {
      puzzle[cell] = kept;
      continue;
    }
    left--;
  }
  return { puzzle, clues: left };
}

export function generate(rng, difficulty) {
  const recipe = DIFFICULTIES[difficulty];
  if (!recipe) {
    throw new Error(`difficulté inconnue : ${difficulty}`);
  }
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const solution = completeGrid(rng);
    const { puzzle, clues } = dig(solution, recipe, rng);
    // Measured: one grid in five requires the pairs level, so a handful of
    // redraws is the whole cost of a hard puzzle.
    if (recipe.mustRequire && logicalSolve(puzzle, recipe.level - 1).solved) continue;
    return { puzzle, solution, clues };
  }
  throw new Error(`aucune grille ${difficulty} trouvée en ${MAX_TRIES} tentatives`);
}
