// games/anagrammes/game.js
// All the rules, no DOM.
//
// The target word is drawn, but any real anagram of the same letters wins: if
// the letters of `chien` make him find `niche`, he has solved the problem, and
// refusing his answer because it is not the one the program had in mind would
// be absurd for a Scrabble player.

import { fold, signature } from '../../lexicon/signature.js';
import { pickWord } from './pick.js';
import { scramble } from './scramble.js';

export const POINTS_PER_LETTER = 10;
export const HINT_COST = 3;

export function createAnagram({ solver, lexicon, rng, frequencies, level, word }) {
  const target = word ?? pickWord(rng, frequencies, level);
  const answer = [...fold(target)];
  const tiles = scramble(rng, target);
  const revealed = answer.map(() => null);
  let phase = 'recherche';
  let hints = 0;
  let found = false;

  function points() {
    if (!found) return 0;
    const earned = answer.length * POINTS_PER_LETTER - hints * HINT_COST;
    return Math.max(0, earned);
  }

  const game = {
    level,
    get phase() { return phase; },
    get tiles() { return [...tiles]; },
    get revealed() { return [...revealed]; },
    get hints() { return hints; },
    get score() { return points(); },

    propose(input) {
      if (phase === 'terminée') {
        throw new Error('the game is over');
      }
      const verdict = lexicon.validate(input);
      if (!verdict.ok) {
        return { ok: false, word: null, reason: verdict.reason };
      }
      if (signature(verdict.word) !== signature(target)) {
        return { ok: false, word: verdict.word, reason: 'lettres' };
      }
      found = true;
      phase = 'terminée';
      return { ok: true, word: verdict.word, reason: null };
    },

    /** Reveal the next letter from the left. Returns its position. */
    hint() {
      if (phase === 'terminée') {
        throw new Error('the game is over');
      }
      const position = revealed.indexOf(null);
      revealed[position] = answer[position];
      hints += 1;
      // Every letter shown: there is nothing left to find, so the game is over
      // rather than handed to him for free.
      if (revealed.indexOf(null) === -1) phase = 'terminée';
      return position;
    },

    finish() {
      phase = 'terminée';
      return { score: points(), word: target, found };
    },
  };

  return game;
}
