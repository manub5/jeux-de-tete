// lexicon/solver.js
// Search by signature. Rather than scanning the whole dictionary, we enumerate
// the sub-multisets of the draw — at most 1024 for ten letters — and look each
// one up. Constant work per draw, whatever the dictionary's size.

import { countLetters, fold } from './signature.js';

/**
 * How many letters of the draw a word actually costs. Not `word.length`: the
 * ligature in `œuf` is one character but four tiles, O E U F, and a player who
 * spells it has used four of their ten letters. Every length this module
 * reports is a played length, so the filter, the ordering and the score all
 * agree with what the player physically laid down.
 */
export function playedLength(word) {
  return fold(word).length;
}

/** The letters of a draw, folded and counted. */
function tally(letters) {
  return countLetters(fold(letters));
}

/** Every distinct sub-multiset of the draw, as a sorted signature string. */
function* subsetSignatures(counts, minLength) {
  const letters = [...counts.keys()].sort();
  const chosen = [];

  function* walk(position) {
    if (position === letters.length) {
      if (chosen.length >= minLength) yield chosen.join('');
      return;
    }
    const letter = letters[position];
    const available = counts.get(letter);
    for (let taken = 0; taken <= available; taken++) {
      // `letters` is sorted and we push in order, so `chosen` stays sorted.
      for (let i = 0; i < taken; i++) chosen.push(letter);
      yield* walk(position + 1);
      chosen.length -= taken;
    }
  }

  yield* walk(0);
}

export function createSolver(index) {
  function findWords(letters, { minLength = 2 } = {}) {
    const counts = tally(letters);
    const found = [];
    for (const key of subsetSignatures(counts, minLength)) {
      const words = index.get(key);
      if (words) found.push(...words);
    }
    found.sort(
      (a, b) => playedLength(b) - playedLength(a) || a.localeCompare(b, 'fr')
    );
    return found;
  }

  function bestLength(letters) {
    const found = findWords(letters);
    return found.length === 0 ? 0 : playedLength(found[0]);
  }

  function canBuildFrom(word, letters) {
    const available = tally(letters);
    for (const [letter, needed] of tally(word)) {
      if ((available.get(letter) ?? 0) < needed) return false;
    }
    return true;
  }

  return { findWords, bestLength, canBuildFrom, playedLength };
}
