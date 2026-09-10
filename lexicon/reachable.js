// lexicon/reachable.js
// Which of the words a search returns the player can actually reach.
//
// Two things stand between "the solver found it" and "he can type it and be
// told yes", and both are invisible to the solver, which only knows the index:
//
//   - The dictionary carries both spellings of the 1990 reform — `apparaitre`
//     and `apparaître` sit under one signature. They fold to the same letters,
//     so the lexicon answers with the same canonical word whichever he types,
//     and the other spelling can never be reached. 30 053 of the dictionary's
//     436 103 words are one half of such a pair.
//   - A word he has personally struck out is still in the index, and the solver
//     still finds it, but the lexicon refuses it every time.
//
// Counting either kind would offer him a target he cannot hit, and in a game
// scored "x out of y" that is not a detail: y has to be a number he can get to.

/**
 * The reachable words, in the order they came in, one entry per answer the
 * lexicon can actually give.
 *
 * Each candidate goes through `validate` rather than being merely folded, so
 * the spelling kept is exactly the one a proposal will be matched against.
 */
export function reachableWords(words, lexicon) {
  const kept = new Set();
  for (const word of words) {
    const verdict = lexicon.validate(word);
    // Refused outright — struck out by him. Not a word he can find.
    if (!verdict.ok) continue;
    kept.add(verdict.word);
  }
  return [...kept];
}
