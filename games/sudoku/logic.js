// The solver that reasons the way a person does, applying techniques in the
// order someone actually reaches for them. It is what defines difficulty: a
// puzzle is "easy" when this solver finishes with nothing but singles.
//
// It never guesses. Where it stops, a person using those techniques stops too.

import {
  GROUPS,
  SIZE,
  bitOf,
  candidatesOf,
  conflictsIn,
  countBits,
  peersOf,
  valuesOf,
} from './grid.js';

export const LEVELS = { singles: 1, pairs: 2 };

/** Every cell's candidates, as a mask. Zero for a cell already filled. */
function candidateTable(grid) {
  const table = new Int16Array(SIZE);
  for (let cell = 0; cell < SIZE; cell++) table[cell] = candidatesOf(grid, cell);
  return table;
}

/**
 * Write a digit and keep the candidate table true.
 *
 * The table is built once per pass, so a placement must clear its own bit from
 * the twenty cells that can see it. Without this, a later group in the same pass
 * still sees the digit as possible there, believes it has only one place left,
 * and writes it a second time — the solver then reports a grid it has corrupted
 * as solved. Refreshing the whole table would cost eighty times as much.
 */
function apply(grid, table, cell, value) {
  grid[cell] = value;
  table[cell] = 0;
  for (const peer of peersOf(cell)) table[peer] &= ~bitOf(value);
}

/** A cell with one candidate left. The first thing anyone looks for. */
function placeNakedSingles(grid, table) {
  let placed = false;
  for (let cell = 0; cell < SIZE; cell++) {
    if (!grid[cell] && countBits(table[cell]) === 1) {
      apply(grid, table, cell, valuesOf(table[cell])[0]);
      placed = true;
    }
  }
  return placed;
}

/** A digit with one place left in its row, column or box. */
function placeHiddenSingles(grid, table) {
  let placed = false;
  for (const group of GROUPS) {
    for (let value = 1; value <= 9; value++) {
      const bit = bitOf(value);
      let where = -1;
      let count = 0;
      for (const cell of group) {
        if (!grid[cell] && table[cell] & bit) {
          where = cell;
          count++;
        }
      }
      if (count === 1) {
        apply(grid, table, where, value);
        placed = true;
      }
    }
  }
  return placed;
}

/**
 * Solve as far as the allowed techniques reach.
 *
 * `hardest` is the most advanced level actually needed, which is what the spec
 * calls difficulty — and the reason it is returned rather than inferred: a grid
 * that *may* use pairs but never has to is an easy grid wearing a hard label.
 */
export function logicalSolve(grid, maxLevel) {
  const working = Int8Array.from(grid);
  let hardest = 0;

  for (;;) {
    const table = candidateTable(working);
    // A cell with no candidate and no digit: the grid contradicts itself, and
    // no amount of technique will fix that.
    for (let cell = 0; cell < SIZE; cell++) {
      if (!working[cell] && table[cell] === 0) return { solved: false, hardest };
    }

    if (placeNakedSingles(working, table) || placeHiddenSingles(working, table)) {
      hardest = Math.max(hardest, LEVELS.singles);
      continue;
    }

    const solved = working.every((value) => value !== 0);
    // Completeness is not correctness: a technique that went wrong could fill
    // every cell with a grid that breaks the rules. Cheap to check, and it
    // guards the eliminations a later task adds to this same loop.
    return { solved: solved && conflictsIn(working).size === 0, hardest };
  }
}
