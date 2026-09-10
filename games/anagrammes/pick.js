// games/anagrammes/pick.js
// The target word has to be one the player recognises: reconstituting a rare
// conjugated form nobody has ever read is not a puzzle, it is a lottery. The
// frequency file decides that; the three levels are set by length alone.

import { fold } from '../../lexicon/signature.js';

/** Played lengths, minimum and maximum, for each level. */
export const LEVELS = {
  facile: [5, 6],
  moyen: [7, 8],
  difficile: [9, 10],
};

/** Sorted, so that a given seed always picks the same word. */
export function candidates(frequencies, level) {
  if (!Object.hasOwn(LEVELS, level)) {
    throw new Error(`niveau inconnu : ${level}`);
  }
  const range = LEVELS[level];
  const [shortest, longest] = range;
  const found = [];
  for (const word of frequencies.keys()) {
    // Played length, as everywhere else: `cœur` is five letters, not four.
    const length = fold(word).length;
    if (length >= shortest && length <= longest) found.push(word);
  }
  return found.sort();
}

export function pickWord(rng, frequencies, level) {
  const found = candidates(frequencies, level);
  if (found.length === 0) {
    throw new Error(`aucun mot disponible pour le niveau ${level}`);
  }
  return found[Math.floor(rng() * found.length)];
}
