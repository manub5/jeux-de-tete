// lexicon/lexicon.js
// Word validation, with the player's own corrections taking precedence.
// The shipped dictionary is not the ODS, but neither accept() nor reject()
// has a button left anywhere in the games: declaring a string of his own
// choosing a word, or striking a real one out, were both judged too easy to
// lean on for a score no dictionary actually gave or refused him.
//
// Both functions stay, and corrections.accepted/.rejected stay real sets: a
// backup written before this change still restores exactly the words it
// held, through the same reload() main.js already calls, rather than
// silently losing them the moment nothing can be added or struck out again.

import { fold, signature } from './signature.js';

export function createLexicon(index, corrections) {
  function canonicalForm(folded) {
    for (const word of index.get(signature(folded)) ?? []) {
      if (fold(word) === folded) return word;
    }
    return null;
  }

  function validate(input) {
    const folded = fold(input.trim());
    if (!folded) return { ok: false, word: null, reason: 'inconnu' };
    if (corrections.rejected.has(folded)) {
      return { ok: false, word: null, reason: 'refusé' };
    }
    const known = canonicalForm(folded);
    if (known) return { ok: true, word: known, reason: null };
    if (corrections.accepted.has(folded)) {
      return { ok: true, word: input.trim(), reason: null };
    }
    return { ok: false, word: null, reason: 'inconnu' };
  }

  function accept(word) {
    const folded = fold(word.trim());
    corrections.rejected.delete(folded);
    corrections.accepted.add(folded);
    corrections.save();
  }

  function reject(word) {
    const folded = fold(word.trim());
    corrections.accepted.delete(folded);
    corrections.rejected.add(folded);
    corrections.save();
  }

  return { validate, accept, reject, signatureOf: signature };
}
