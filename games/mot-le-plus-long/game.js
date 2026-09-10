// All the rules, no DOM.
//
// The program draws the rack; the player looks for the longest word in it.
// The difficulty lever is announcing the best length without the word (spec
// section 6.1): the player knows something is left to find, and is given
// nothing.

import { DRAW_SIZE, MIN_INTERESTING_LENGTH, drawRack } from './draw.js';

/**
 * `letters` is only for tests and for replaying a saved rack. Left out, the
 * rack is drawn from the bag straight away — the game starts with its ten
 * tiles already on the table.
 */
export function createGame({ solver, lexicon, rng, letters }) {
  const rack = letters ? [...letters] : drawRack(rng, DRAW_SIZE);
  const solutions = solver.findWords(rack.join(''), { minLength: 2 });
  const proposals = [];
  let phase = 'recherche';
  let best = { word: null, length: 0 };

  const game = {
    get phase() { return phase; },
    get letters() { return [...rack]; },
    // Copies, not references: nothing the screen does to what it is handed
    // may reach back into the game's own state.
    get proposals() { return proposals.map((entry) => ({ ...entry })); },
    get score() { return best.length; },

    get bestLength() {
      if (solutions.length === 0) return 0;
      // Played length, like every other length the player is shown.
      return solver.playedLength(solutions[0]);
    },

    /** Nothing worth finding in this rack: offer another one. */
    get barren() {
      return game.bestLength < MIN_INTERESTING_LENGTH;
    },

    propose(input) {
      if (phase === 'terminée') {
        throw new Error('la partie est terminée');
      }
      const verdict = lexicon.validate(input);
      if (!verdict.ok) {
        return { ok: false, word: null, length: 0, reason: verdict.reason, improved: false };
      }
      if (!solver.canBuildFrom(verdict.word, rack.join(''))) {
        return { ok: false, word: verdict.word, length: 0, reason: 'lettres', improved: false };
      }
      // Played length, never `word.length`: `œuf` costs four of the ten letters.
      const length = solver.playedLength(verdict.word);
      const already = proposals.some((entry) => entry.word === verdict.word);
      if (!already) {
        proposals.push({ word: verdict.word, length });
      }
      const improved = length > best.length;
      if (improved) best = { word: verdict.word, length };
      return { ok: true, word: verdict.word, length, reason: null, improved };
    },

    finish() {
      const bestLength = game.bestLength;
      phase = 'terminée';
      return {
        score: best.length,
        bestWord: solutions.length ? solutions[0] : null,
        bestLength,
        // A copy: `bestLength` and `barren` still read the internal array, and
        // the screen is free to sort or trim what it is handed.
        found: [...solutions],
      };
    },
  };

  return game;
}
