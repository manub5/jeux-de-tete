// The solver that reasons the way a person does, applying techniques in the
// order someone actually reaches for them. It is what defines difficulty: a
// puzzle is "easy" when this solver finishes with nothing but singles.
//
// It never guesses. Where it stops, a person using those techniques stops too.

import {
  ALL,
  BOXES,
  COLUMNS,
  GROUPS,
  ROWS,
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
 * `logicalSolve` builds the table once and carries it through the whole solve
 * (see below), so a placement must clear its own bit from the twenty cells
 * that can see it. Without this, a later group in the same pass still sees the
 * digit as possible there, believes it has only one place left, and writes it
 * a second time — the solver then reports a grid it has corrupted as solved.
 * Refreshing the whole table from scratch would cost eighty times as much —
 * and, once eliminations are in play, would also throw away candidate
 * narrowing that no placed digit accounts for (see `logicalSolve`).
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
 * Two cells of a group holding exactly the same two candidates. Those two
 * digits belong to them, so they leave the rest of the group.
 */
function eliminateNakedPairs(grid, table) {
  let removed = false;
  for (const group of GROUPS) {
    const empty = group.filter((cell) => !grid[cell]);
    for (let i = 0; i < empty.length; i++) {
      for (let j = i + 1; j < empty.length; j++) {
        const mask = table[empty[i]];
        if (countBits(mask) !== 2 || table[empty[j]] !== mask) continue;
        for (const cell of empty) {
          if (cell === empty[i] || cell === empty[j]) continue;
          if (table[cell] & mask) {
            table[cell] &= ~mask;
            removed = true;
          }
        }
      }
    }
  }
  return removed;
}

/**
 * Two digits of a group appearing in the same two cells and nowhere else. Those
 * cells are theirs, so everything else leaves the cells.
 */
function eliminateHiddenPairs(grid, table) {
  let removed = false;
  for (const group of GROUPS) {
    const empty = group.filter((cell) => !grid[cell]);
    for (let first = 1; first <= 9; first++) {
      for (let second = first + 1; second <= 9; second++) {
        const mask = bitOf(first) | bitOf(second);
        const holdingFirst = empty.filter((cell) => table[cell] & bitOf(first));
        const holdingSecond = empty.filter((cell) => table[cell] & bitOf(second));
        if (holdingFirst.length !== 2 || holdingSecond.length !== 2) continue;
        if (holdingFirst[0] !== holdingSecond[0] || holdingFirst[1] !== holdingSecond[1]) continue;
        for (const cell of holdingFirst) {
          if (table[cell] & ~mask & ALL) {
            table[cell] &= mask;
            removed = true;
          }
        }
      }
    }
  }
  return removed;
}

/**
 * A digit confined to one line inside a box must be on that line, so it leaves
 * the rest of the line outside the box. And the mirror case, a digit confined
 * to one box inside a line.
 */
function eliminateIntersections(grid, table) {
  let removed = false;
  for (let box = 0; box < 9; box++) {
    const cells = BOXES[box];
    for (let value = 1; value <= 9; value++) {
      const bit = bitOf(value);
      const holding = cells.filter((cell) => !grid[cell] && table[cell] & bit);
      if (holding.length < 2) continue;

      const row = Math.floor(holding[0] / 9);
      if (holding.every((cell) => Math.floor(cell / 9) === row)) {
        for (const cell of ROWS[row]) {
          if (cells.includes(cell) || grid[cell]) continue;
          if (table[cell] & bit) {
            table[cell] &= ~bit;
            removed = true;
          }
        }
      }

      const column = holding[0] % 9;
      if (holding.every((cell) => cell % 9 === column)) {
        for (const cell of COLUMNS[column]) {
          if (cells.includes(cell) || grid[cell]) continue;
          if (table[cell] & bit) {
            table[cell] &= ~bit;
            removed = true;
          }
        }
      }
    }
  }
  return removed;
}

/**
 * Solve as far as the allowed techniques reach.
 *
 * `hardest` is the most advanced level actually needed, which is what the spec
 * calls difficulty — and the reason it is returned rather than inferred: a grid
 * that *may* use pairs but never has to is an easy grid wearing a hard label.
 *
 * The candidate table is built exactly once, before the loop, and carried
 * through every pass rather than rebuilt from the grid each time. Singles
 * alone would not care either way — `apply` keeps the table exactly in step
 * with the grid, so a fresh rebuild and the carried table always agree. But an
 * elimination narrows the table for a reason no placed digit records: a
 * rebuild from the grid would silently undo it, the same naked pair would be
 * "found" again next pass, and the loop would spin on it forever without ever
 * reaching hidden pairs or intersections. Carrying the table is what lets the
 * three techniques compound across passes instead of relitigating the same
 * one.
 */
export function logicalSolve(grid, maxLevel) {
  const working = Int8Array.from(grid);
  let hardest = 0;
  const table = candidateTable(working);

  for (;;) {
    // A cell with no candidate and no digit: the grid contradicts itself, and
    // no amount of technique will fix that.
    //
    // Removing this leaves all the tests green, and no test will ever kill it:
    // it is an *equivalent mutant*, not an untested guard. Every pass either
    // places a digit or strikes a candidate, so the sum of the candidate bits
    // strictly decreases and the loop ends anyway — on the same
    // `{ solved: false }`, since a cell with no candidate can never be filled.
    // This is an early exit, bought for the cost of one sweep, not a safety
    // net. Do not write a test for it: there is nothing to observe.
    for (let cell = 0; cell < SIZE; cell++) {
      if (!working[cell] && table[cell] === 0) return { solved: false, hardest };
    }

    if (placeNakedSingles(working, table) || placeHiddenSingles(working, table)) {
      hardest = Math.max(hardest, LEVELS.singles);
      continue;
    }

    if (maxLevel < LEVELS.pairs) {
      const solved = working.every((value) => value !== 0);
      // See the note on the other `conflictsIn` net, at the end of the loop.
      return { solved: solved && conflictsIn(working).size === 0, hardest };
    }

    // The three eliminations place nothing by themselves: they remove
    // candidates, after which the singles above start again. That is why the
    // loop continues rather than returning.
    const removed =
      eliminateNakedPairs(working, table) ||
      eliminateHiddenPairs(working, table) ||
      eliminateIntersections(working, table);
    if (removed) {
      hardest = Math.max(hardest, LEVELS.pairs);
      continue;
    }

    const solved = working.every((value) => value !== 0);
    // Completeness is not correctness: a technique that went wrong could fill
    // every cell with a grid that breaks the rules. Cheap to check, and it
    // guards the eliminations above.
    //
    // Taking this net away — here or in the early return above — leaves every
    // test green, and that is expected: `apply` keeps the candidate table
    // exactly in step with the grid, so a digit is only ever placed where it
    // has no peer holding it, and a filled grid is a legal grid. Nothing can
    // reach this net while that invariant holds, so no test can kill it.
    //
    // It stays, and it stays on purpose. This is deliberate redundancy, the
    // same shape as the three guards around the end-of-grid timer in
    // games/sudoku/screen.js: the invariant it leans on is a proof about code
    // that will be edited by someone who has not read that proof, and the
    // whole generator rests on `solved` telling the truth — a false "solved"
    // digs a puzzle that cannot be finished, and hands it to him.
    // Do not delete it on the grounds that no test goes red.
    return { solved: solved && conflictsIn(working).size === 0, hardest };
  }
}
