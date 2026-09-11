// The board and its indexes. No reasoning lives here — every other module of
// the game builds on these tables, so they are computed once and shared.
//
// Candidates are a bit mask: bit 0 is the digit 1, bit 8 is the digit 9. That
// is what makes the logical solver readable — a naked pair is two cells whose
// masks are equal and carry two bits.

export const SIZE = 81;
export const ALL = 0b111111111;

export const ROWS = [];
export const COLUMNS = [];
export const BOXES = [];
for (let i = 0; i < 9; i++) {
  ROWS.push([]);
  COLUMNS.push([]);
  BOXES.push([]);
}
for (let cell = 0; cell < SIZE; cell++) {
  const row = Math.floor(cell / 9);
  const column = cell % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
  ROWS[row].push(cell);
  COLUMNS[column].push(cell);
  BOXES[box].push(cell);
}

export const GROUPS = [...ROWS, ...COLUMNS, ...BOXES];

const PEERS = [];
for (let cell = 0; cell < SIZE; cell++) {
  const row = Math.floor(cell / 9);
  const column = cell % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
  const seen = new Set([...ROWS[row], ...COLUMNS[column], ...BOXES[box]]);
  seen.delete(cell);
  PEERS.push([...seen]);
}

/** The twenty cells that share a row, a column or a box with this one. */
export function peersOf(cell) {
  return PEERS[cell];
}

export function bitOf(value) {
  return 1 << (value - 1);
}

export function countBits(mask) {
  let count = 0;
  let rest = mask;
  while (rest) {
    rest &= rest - 1;
    count++;
  }
  return count;
}

export function valuesOf(mask) {
  const values = [];
  for (let value = 1; value <= 9; value++) {
    if (mask & bitOf(value)) values.push(value);
  }
  return values;
}

/** What this cell could still hold. Zero for a cell already filled. */
export function candidatesOf(grid, cell) {
  if (grid[cell]) return 0;
  let mask = ALL;
  for (const peer of PEERS[cell]) {
    if (grid[peer]) mask &= ~bitOf(grid[peer]);
  }
  return mask;
}

export function isComplete(grid) {
  for (let cell = 0; cell < SIZE; cell++) {
    if (!grid[cell]) return false;
  }
  return true;
}

/**
 * Every cell holding a digit another cell it can see also holds. Both members
 * of a clash are returned: the screen paints them all, and singling out "the
 * wrong one" would be a judgement the rules cannot make.
 */
export function conflictsIn(grid) {
  const clashing = new Set();
  for (let cell = 0; cell < SIZE; cell++) {
    if (!grid[cell]) continue;
    for (const peer of PEERS[cell]) {
      if (grid[peer] === grid[cell]) {
        clashing.add(cell);
        clashing.add(peer);
      }
    }
  }
  return clashing;
}
