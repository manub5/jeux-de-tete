// games/anagrammes/scramble.js
// The tiles are the played letters, accents folded away: that is what he would
// lay on the board, and what he can type on a phone keyboard.

import { fold } from '../../lexicon/signature.js';

const MAX_TRIES = 100;

function shuffled(rng, letters) {
  const out = [...letters];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function scramble(rng, word) {
  const letters = [...fold(word)];
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const candidate = shuffled(rng, letters);
    if (candidate.join('') !== letters.join('')) return candidate;
  }
  // Every arrangement is the word itself — `aaa`, and nothing else in practice.
  throw new Error(`impossible de mélanger « ${word} » autrement que lui-même`);
}
