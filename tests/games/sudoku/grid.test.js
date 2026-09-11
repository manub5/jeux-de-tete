import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL, BOXES, COLUMNS, GROUPS, ROWS, SIZE,
  bitOf, candidatesOf, conflictsIn, countBits, isComplete, peersOf, valuesOf,
} from '../../../games/sudoku/grid.js';

test('a grid is eighty-one cells and nine of everything', () => {
  assert.equal(SIZE, 81);
  assert.equal(ROWS.length, 9);
  assert.equal(COLUMNS.length, 9);
  assert.equal(BOXES.length, 9);
  assert.equal(GROUPS.length, 27);
  for (const group of GROUPS) assert.equal(group.length, 9);
});

test('the first row, column and box hold the cells they should', () => {
  assert.deepEqual(ROWS[0], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(COLUMNS[0], [0, 9, 18, 27, 36, 45, 54, 63, 72]);
  assert.deepEqual(BOXES[0], [0, 1, 2, 9, 10, 11, 18, 19, 20]);
});

test('a cell sees exactly twenty others, itself excluded', () => {
  const peers = peersOf(0);
  assert.equal(peers.length, 20);
  assert.ok(!peers.includes(0));
  assert.ok(peers.includes(1) && peers.includes(9) && peers.includes(10));
  assert.ok(!peers.includes(80));
});

test('the middle cell sees twenty others too', () => {
  assert.equal(peersOf(40).length, 20);
});

test('bits stand for digits, one bit each', () => {
  assert.equal(bitOf(1), 0b000000001);
  assert.equal(bitOf(9), 0b100000000);
  assert.equal(countBits(ALL), 9);
  assert.equal(countBits(0), 0);
  assert.equal(countBits(bitOf(3) | bitOf(7)), 2);
  assert.deepEqual(valuesOf(bitOf(3) | bitOf(7)), [3, 7]);
  assert.deepEqual(valuesOf(0), []);
});

test('the candidates of a cell exclude everything its peers already hold', () => {
  const grid = new Int8Array(81);
  grid[1] = 5;   // même ligne
  grid[9] = 6;   // même colonne
  grid[10] = 7;  // même bloc
  assert.deepEqual(valuesOf(candidatesOf(grid, 0)), [1, 2, 3, 4, 8, 9]);
});

test('a filled cell has no candidates to offer', () => {
  const grid = new Int8Array(81);
  grid[0] = 4;
  assert.equal(candidatesOf(grid, 0), 0);
});

test('a grid is complete only when no cell is empty', () => {
  const grid = new Int8Array(81).fill(1);
  assert.equal(isComplete(grid), true);
  grid[40] = 0;
  assert.equal(isComplete(grid), false);
});

test('two equal digits that see each other are both in conflict', () => {
  const grid = new Int8Array(81);
  grid[0] = 5;
  grid[8] = 5;   // même ligne
  const conflits = conflictsIn(grid);
  assert.deepEqual([...conflits].sort((a, b) => a - b), [0, 8]);
});

test('two equal digits that do not see each other are fine', () => {
  const grid = new Int8Array(81);
  grid[0] = 5;
  grid[80] = 5;  // ni ligne, ni colonne, ni bloc
  assert.equal(conflictsIn(grid).size, 0);
});

test('an empty grid has no conflict', () => {
  assert.equal(conflictsIn(new Int8Array(81)).size, 0);
});
