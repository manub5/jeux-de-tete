// The grid in progress, written down after every move — the spec is explicit
// that he may put the phone down mid-grid and come back three days later.
//
// The save holds the puzzle, the digits placed and the notes. It does *not*
// hold the answer: that is recomputed on load in a few milliseconds. A save
// that does not carry the answer cannot contradict it, which is the lesson of
// games/motus/daily.js, where a save at odds with the rules announced a defeat
// the player never had.

import { SIZE } from './grid.js';
import { countSolutions, solve } from './solver.js';
import { DIFFICULTIES, generate } from './generate.js';
import { createSudoku } from './game.js';

export const SAVE_KEY = 'sudoku.partie';

const isBoard = (value) =>
  Array.isArray(value) && value.length === SIZE &&
  value.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9);

/** A stored grid that parses but has the wrong shape must not break anything. */
function asSaved(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  if (!Object.hasOwn(DIFFICULTIES, raw.difficulty)) return null;
  if (!isBoard(raw.puzzle) || !isBoard(raw.values)) return null;
  const notes = Array.isArray(raw.notes) && raw.notes.length === SIZE
    ? raw.notes.map((list) =>
        Array.isArray(list) ? list.filter((n) => Number.isInteger(n) && n >= 1 && n <= 9) : [])
    : Array.from({ length: SIZE }, () => []);
  // Every placed digit must sit on an empty square of the puzzle, or the save
  // disagrees with its own grid.
  for (let cell = 0; cell < SIZE; cell++) {
    if (raw.puzzle[cell] && raw.values[cell] !== raw.puzzle[cell]) return null;
  }
  return { difficulty: raw.difficulty, puzzle: raw.puzzle, values: raw.values, notes };
}

export function clearSave(storage) {
  storage.remove(SAVE_KEY);
}

function write(storage, game) {
  const shot = game.snapshot();
  storage.set(SAVE_KEY, { difficulty: game.difficulty, ...shot });
}

/** Wrap the moves so every change reaches storage as it happens. */
export function attachSaving(game, storage) {
  for (const name of ['place', 'erase', 'toggleNote', 'undo', 'redo']) {
    const original = game[name];
    game[name] = (...args) => {
      const answer = original(...args);
      write(storage, game);
      return answer;
    };
  }
  return game;
}

export function loadOrStart({ storage, rng, difficulty }) {
  const saved = asSaved(storage.get(SAVE_KEY, null));
  if (saved) {
    const puzzle = Int8Array.from(saved.puzzle);
    // A save whose puzzle is not a real puzzle any more is not a save.
    if (countSolutions(puzzle, 2) === 1) {
      const game = createSudoku({
        difficulty: saved.difficulty,
        puzzle,
        solution: solve(puzzle),
        values: Int8Array.from(saved.values),
        notes: saved.notes,
      });
      return attachSaving(game, storage);
    }
  }
  const { puzzle, solution } = generate(rng, difficulty);
  const game = attachSaving(createSudoku({ difficulty, puzzle, solution }), storage);
  write(storage, game);
  return game;
}
