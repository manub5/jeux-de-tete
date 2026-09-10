// All the rules, no DOM.
//
// This is the game played in short bursts: the rack and the words already found
// are written down after every move, so he can put the phone down mid-game and
// pick it up days later.

import { MIN_WORD_LENGTH, RACK_SIZE, pickRack } from './draw.js';
import { reachableWords } from '../../lexicon/reachable.js';

export const SAVE_KEY = 'tous-les-mots.partie';

/**
 * A stored game that parses but has the wrong shape must not break anything —
 * every field read back from storage is normalised on its own, the way
 * `asHistory`/`asStreak` do in core/stats.js. A rack is only usable if it has
 * exactly RACK_SIZE tiles, each a single character: anything else — too few
 * tiles, too many, or a tile like 'ab' that would render as more than one —
 * reads as no saved game at all, and a fresh rack is dealt instead.
 */
function asSaved(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const letters = Array.isArray(raw.letters) ? raw.letters.filter((l) => typeof l === 'string') : [];
  const found = Array.isArray(raw.found) ? raw.found.filter((w) => typeof w === 'string') : [];
  const rackOk = letters.length === RACK_SIZE && letters.every((tile) => tile.length === 1);
  return rackOk ? { letters, found } : null;
}

export function createAllWords({ solver, lexicon, storage, rng, frequencies }) {
  const saved = asSaved(storage.get(SAVE_KEY, null));
  const letters = saved ? saved.letters : pickRack(rng, frequencies, solver, lexicon).letters;
  const solutions = reachableWords(
    solver.findWords(letters.join(''), { minLength: MIN_WORD_LENGTH }),
    lexicon
  );
  // Filtered against `solutions`, not taken as-is: if the shipped dictionary
  // ever changes under a saved game, a word he legitimately found but that is
  // no longer indexed silently drops out of his list and his count falls.
  // That cost is accepted because the filter protects two real invariants —
  // without it, `found` could hold a word absent from `solutions`, sending
  // `indexOf` to -1 in the sort below in `propose`, and `found.length` could
  // exceed `total`.
  const found = saved ? solutions.filter((word) => saved.found.includes(word)) : [];
  let phase = 'recherche';

  function save() {
    storage.set(SAVE_KEY, { letters, found });
  }
  if (!saved) save();

  const game = {
    get phase() { return phase; },
    get letters() { return [...letters]; },
    get found() { return [...found]; },
    get total() { return solutions.length; },

    propose(input) {
      if (phase === 'terminée') {
        throw new Error('the game is over');
      }
      // The minimum length is a rule of the game, not a fact about the
      // dictionary: check it on the raw input, before validating, so a short
      // guess is told it is too short rather than that it is unknown.
      const length = solver.playedLength(input.trim());
      if (length < MIN_WORD_LENGTH) {
        return { ok: false, word: null, length: 0, reason: 'court' };
      }
      const verdict = lexicon.validate(input);
      if (!verdict.ok) {
        return { ok: false, word: null, length: 0, reason: verdict.reason };
      }
      if (!solutions.includes(verdict.word)) {
        return { ok: false, word: verdict.word, length: 0, reason: 'lettres' };
      }
      if (found.includes(verdict.word)) {
        return { ok: false, word: verdict.word, length: 0, reason: 'déjà' };
      }
      found.push(verdict.word);
      // Shown in the solutions' own order — longest first, then alphabetical —
      // not in the order he happened to type them.
      found.sort((a, b) => solutions.indexOf(a) - solutions.indexOf(b));
      save();
      return { ok: true, word: verdict.word, length, reason: null };
    },

    finish() {
      phase = 'terminée';
      storage.remove(SAVE_KEY);
      return {
        found: found.length,
        total: solutions.length,
        missed: solutions.filter((word) => !found.includes(word)),
      };
    },

    /** Walk away without being shown the answers. */
    abandon() {
      phase = 'terminée';
      storage.remove(SAVE_KEY);
    },
  };

  return game;
}
