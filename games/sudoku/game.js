// All the rules, no DOM.

import { SIZE, conflictsIn, isComplete } from './grid.js';

export function createSudoku({ difficulty, puzzle, solution, values, notes, mistakes }) {
  const clues = Int8Array.from(puzzle);
  const board = values ? Int8Array.from(values) : Int8Array.from(puzzle);
  const pencil = notes ? notes.map((set) => new Set(set)) : Array.from({ length: SIZE }, () => new Set());
  const wrongCells = new Set(mistakes ?? []);
  const past = [];
  const future = [];
  let phase = 'en cours';

  function refreshPhase() {
    if (isComplete(board) && board.every((value, cell) => value === solution[cell])) {
      phase = 'terminée';
    }
  }

  function guard() {
    if (phase === 'terminée') {
      throw new Error('la partie est terminée');
    }
  }

  function remember(cell) {
    past.push({ cell, value: board[cell], notes: new Set(pencil[cell]) });
    future.length = 0;
  }

  function restore(step) {
    const undoTo = { cell: step.cell, value: board[step.cell], notes: new Set(pencil[step.cell]) };
    board[step.cell] = step.value;
    pencil[step.cell] = new Set(step.notes);
    return undoTo;
  }

  const game = {
    difficulty,
    get phase() { return phase; },
    get mistakes() { return wrongCells.size; },
    get conflicts() { return new Set(conflictsIn(board)); },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },

    given(cell) { return clues[cell] !== 0; },
    valueAt(cell) { return board[cell]; },
    solutionAt(cell) { return solution[cell]; },
    notesAt(cell) { return [...pencil[cell]].sort((a, b) => a - b); },

    place(cell, value) {
      guard();
      if (clues[cell]) return;
      remember(cell);
      board[cell] = value;
      pencil[cell].clear();
      // A mistake belongs to the cell, not to the keystroke: trying three wrong
      // digits in one square is one mistake, not three.
      if (value !== solution[cell]) wrongCells.add(cell);
      refreshPhase();
    },

    erase(cell) {
      guard();
      if (clues[cell]) return;
      remember(cell);
      board[cell] = 0;
      pencil[cell].clear();
    },

    toggleNote(cell, value) {
      guard();
      if (clues[cell] || board[cell]) return;
      remember(cell);
      if (pencil[cell].has(value)) pencil[cell].delete(value);
      else pencil[cell].add(value);
    },

    /**
     * Undo restores the board, never the history of mistakes: he did make that
     * mistake, and taking the digit back does not unmake it.
     */
    undo() {
      guard();
      if (!past.length) return;
      future.push(restore(past.pop()));
    },

    redo() {
      guard();
      if (!future.length) return;
      past.push(restore(future.pop()));
    },

    finish() {
      phase = 'terminée';
      return {
        difficulty,
        mistakes: wrongCells.size,
        solved: board.every((value, cell) => value === solution[cell]),
      };
    },

    /** Everything the save needs, and nothing the save could contradict. */
    snapshot() {
      return {
        puzzle: [...clues],
        values: [...board],
        notes: pencil.map((set) => [...set].sort((a, b) => a - b)),
        mistakes: [...wrongCells],
      };
    },
  };

  // During play these cannot coexist — placing a digit clears the notes, and a
  // note is refused on a filled cell. The constructor accepts both arrays from
  // a save, though, so it normalises rather than trusting: a stale snapshot
  // must not leave notes hiding under a digit.
  for (let cell = 0; cell < SIZE; cell++) {
    if (board[cell]) pencil[cell].clear();
  }
  // The phase is computed here too, not only after a move: the save is written
  // by the move itself, so an application killed between the last digit and the
  // end screen leaves a complete grid in storage. Without this, it would come
  // back in play with no empty cell to fill — a finished grid he cannot finish.
  refreshPhase();

  return game;
}
