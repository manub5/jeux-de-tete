// The exhaustive solver. Its only job is to say how many answers a grid admits,
// stopping as soon as it has found two — that is what guarantees a puzzle has
// exactly one. It runs up to eighty-one times per generated grid, so it is
// written to be quick rather than pretty.
//
// The one thing that makes it quick: always descend through the cell with the
// fewest candidates. A cell with a single candidate branches not at all.

import { SIZE, candidatesOf, conflictsIn, countBits, valuesOf } from './grid.js';

function search(grid, limit, onSolution) {
  let bestCell = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let cell = 0; cell < SIZE; cell++) {
    if (grid[cell]) continue;
    const mask = candidatesOf(grid, cell);
    const count = countBits(mask);
    if (count === 0) return 0; // impasse
    if (count < bestCount) {
      bestCount = count;
      bestCell = cell;
      bestMask = mask;
      if (count === 1) break;
    }
  }
  if (bestCell === -1) {
    onSolution(grid);
    return 1;
  }
  let found = 0;
  for (const value of valuesOf(bestMask)) {
    grid[bestCell] = value;
    found += search(grid, limit - found, onSolution);
    grid[bestCell] = 0;
    if (found >= limit) break;
  }
  return found;
}

/** How many answers this grid admits, counting no further than `limit`. */
export function countSolutions(grid, limit = 2) {
  // A grid that already contradicts itself has no answer, and the search below
  // would never find that out: it only notices a dead end on an *empty* cell,
  // so two identical clues are never compared and the tree is explored for
  // nothing. This also guards the save read back from storage in a later task —
  // a corrupt one would otherwise freeze the application on opening.
  if (conflictsIn(grid).size > 0) return 0;
  const working = Int8Array.from(grid);
  return search(working, limit, () => {});
}

/** One answer, or null if the grid contradicts itself. */
export function solve(grid) {
  if (conflictsIn(grid).size > 0) return null;
  const working = Int8Array.from(grid);
  let answer = null;
  search(working, 1, (solved) => {
    answer = Int8Array.from(solved);
  });
  return answer;
}
