// lexicon/lexicon.js
// Word validation, with the player's own corrections taking precedence.
// The shipped dictionary is not the ODS: reject() lets him strike out a word
// he disagrees with, wherever a game offers that button.
//
// accept() has no button left anywhere in the games — letting him declare any
// string a word of his own choosing was too easy to lean on for a score no
// dictionary actually gave him. It stays here, and corrections.accepted stays
// a real set: a backup written before this change still restores exactly the
// words it held, through the same reload() main.js already calls, rather
// than silently losing them the moment nothing can be added again.

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
