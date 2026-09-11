// games/motus/game.js
// All the rules, no DOM.

import { fold } from '../../lexicon/signature.js';
import { mark } from './marking.js';
import { DEFAULT_LENGTH, freeWord } from './pick.js';

export const MAX_ATTEMPTS = 6;

/** A game lost costs one more than the worst game won. */
export const FAILURE_SCORE = 7;

export function createMotus({ lexicon, rng, frequencies, length = DEFAULT_LENGTH, word }) {
  const target = fold(word ?? freeWord(rng, frequencies, length));
  const rows = [];
  let phase = 'recherche';
  let result = null;

  function end(won) {
    phase = 'terminée';
    result = {
      won,
      attempts: rows.length,
      score: won ? rows.length : FAILURE_SCORE,
      word: target,
    };
    return result;
  }

  const game = {
    get length() { return target.length; },
    get firstLetter() { return target[0]; },
    get phase() { return phase; },
    get attempts() { return rows.length; },
    // Copies all the way down: a row handed to the screen must not be a handle
    // on the game's own state.
    get rows() { return rows.map((row) => ({ word: row.word, marks: [...row.marks] })); },
    get result() { return result && { ...result }; },

    /**
     * A refused attempt costs nothing. Punishing a typo, or a word he was right
     * to try, would make the six attempts a trap rather than a game.
     */
    propose(input) {
      if (phase === 'terminée') {
        throw new Error('the game is over');
      }
      const tried = fold(input.trim());
      if (tried.length !== target.length) {
        return { ok: false, reason: 'longueur', marks: null };
      }
      const verdict = lexicon.validate(tried);
      if (!verdict.ok) {
        return { ok: false, reason: verdict.reason === 'refusé' ? 'refusé' : 'inconnu', marks: null };
      }
      const marks = mark(tried, target);
      rows.push({ word: tried, marks });
      if (tried === target) {
        end(true);
      } else if (rows.length >= MAX_ATTEMPTS) {
        end(false);
      }
      return { ok: true, reason: null, marks: [...marks] };
    },

    /** Walk away and be told the word. Counts as a loss, like the TV show. */
    giveUp() {
      if (phase === 'terminée') return { ...result };
      return { ...end(false) };
    },
  };

  return game;
}
