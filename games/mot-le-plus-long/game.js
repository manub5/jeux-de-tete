// games/mot-le-plus-long/game.js
// All the rules, no DOM. The difficulty lever of this game is announcing the
// best length without the word (spec section 6.1): the player knows something
// is left to find, and is given nothing.

import { DRAW_SIZE, MIN_INTERESTING_LENGTH, drawLetter } from './draw.js';

export function createGame({ solver, lexicon, rng }) {
  const letters = [];
  const proposals = [];
  let phase = 'tirage';
  let solutions = null;
  let best = { word: null, length: 0 };

  function completeDraw() {
    phase = 'recherche';
    solutions = solver.findWords(letters.join(''), { minLength: 2 });
  }

  function addLetter(letter) {
    if (letters.length >= DRAW_SIZE) {
      throw new Error('le tirage est déjà complet');
    }
    letters.push(letter);
    if (letters.length === DRAW_SIZE) completeDraw();
  }

  const game = {
    get phase() { return phase; },
    get letters() { return [...letters]; },
    // Copies, not references: nothing the screen does to what it is handed
    // may reach back into the game's own state.
    get proposals() { return proposals.map((entry) => ({ ...entry })); },
    get score() { return best.length; },

    get bestLength() {
      if (!solutions || solutions.length === 0) return 0;
      // Played length, like every other length the player is shown.
      return solver.playedLength(solutions[0]);
    },

    get barren() {
      return phase !== 'tirage' && game.bestLength < MIN_INTERESTING_LENGTH;
    },

    drawLetter(kind) {
      addLetter(drawLetter(rng, kind));
    },

    /** Only for tests and for replaying a saved draw. */
    setLetter(letter) {
      addLetter(letter);
    },

    propose(input) {
      if (phase === 'tirage') {
        throw new Error('le tirage n’est pas terminé');
      }
      if (phase === 'terminée') {
        throw new Error('la partie est terminée');
      }
      const verdict = lexicon.validate(input);
      if (!verdict.ok) {
        return { ok: false, word: null, length: 0, reason: verdict.reason, improved: false };
      }
      if (!solver.canBuildFrom(verdict.word, letters.join(''))) {
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
      // `propose` guards both its impossible phases; so does this. Finishing a
      // draw that is not complete would skip the search phase altogether.
      if (phase === 'tirage') {
        throw new Error('le tirage n’est pas terminé');
      }
      const found = solutions ?? [];
      const bestLength = game.bestLength;
      phase = 'terminée';
      return {
        score: best.length,
        bestWord: found.length ? found[0] : null,
        bestLength,
        found: [...found],
      };
    },
  };

  return game;
}
