// The rack is built backwards: a frequent seven-letter word is drawn first, and
// its letters become the rack. A word using all seven therefore always exists —
// the player is never told so, but the objective is always there.

import { fold } from '../../lexicon/signature.js';
import { reachableWords } from '../../lexicon/reachable.js';

export const RACK_SIZE = 7;
export const MIN_WORD_LENGTH = 3;

/**
 * Below this, the rack is thin enough to be dull.
 *
 * Counted on the words he can actually reach, not on everything the solver
 * returns: measured on the shipped data, 75 of the 3 714 possible bases (2 %)
 * clear the raw count and then fall short once the spellings he can never type
 * are dropped — `déterré` looks like 20 words and delivers 12.
 */
export const MIN_SOLUTIONS = 20;

const MAX_TRIES = 40;

/** Sorted, so a given seed always picks the same base. */
export function baseCandidates(frequencies) {
  const found = [];
  for (const word of frequencies.keys()) {
    const letters = fold(word);
    // Seven tiles, repeats allowed: the base has to spell out exactly the
    // rack we deal, and `chances` (c h a n c e s, two c's) deals two c's
    // like any other rack would.
    if (letters.length === RACK_SIZE) found.push(word);
  }
  // A plain code-unit sort, not `localeCompare(a, b, 'fr')`: this order is
  // never shown to the player, only indexed into by seed, and staying off the
  // platform's collation is what keeps a given seed reproducible across
  // devices.
  return found.sort();
}

export function pickRack(rng, frequencies, solver, lexicon) {
  const bases = baseCandidates(frequencies);
  if (bases.length === 0) {
    throw new Error('aucun tirage possible : pas de mot de sept lettres');
  }
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const base = bases[Math.floor(rng() * bases.length)];
    const letters = [...fold(base)];
    const solutions = reachableWords(
      solver.findWords(letters.join(''), { minLength: MIN_WORD_LENGTH }),
      lexicon
    );
    if (solutions.length >= MIN_SOLUTIONS) {
      return { letters, solutions };
    }
  }
  throw new Error('aucun tirage assez riche trouvé');
}
