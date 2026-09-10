// lexicon/solver.js
// Search by signature. Rather than scanning the whole dictionary, we enumerate
// the sub-multisets of the draw — at most 1024 for ten letters — and look each
// one up. Constant work per draw, whatever the dictionary's size.

import { countLetters, fold, signature } from './signature.js';

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
    const counts = countLetters(fold(letters));
    const found = [];
    for (const key of subsetSignatures(counts, minLength)) {
      const words = index.get(key);
      if (words) found.push(...words);
    }
    found.sort((a, b) => b.length - a.length || a.localeCompare(b, 'fr'));
    return found;
  }

  function bestLength(letters) {
    const found = findWords(letters);
    return found.length === 0 ? 0 : found[0].length;
  }

  function canBuildFrom(word, letters) {
    const available = countLetters(fold(letters));
    for (const [letter, needed] of countLetters(fold(word))) {
      if ((available.get(letter) ?? 0) < needed) return false;
    }
    return true;
  }

  function wordsFor(word) {
    return index.get(signature(word)) ?? [];
  }

  return { findWords, bestLength, canBuildFrom, wordsFor };
}
