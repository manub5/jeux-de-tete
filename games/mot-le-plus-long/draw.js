// Two pools, drawn with replacement. Weights follow the French Scrabble tile
// distribution (102 tiles, the 2 blanks left out): a familiar, defensible
// picture of how often each letter turns up in French.

import { pickWeighted } from '../../core/rng.js';

export const DRAW_SIZE = 10;

/** Below this, the draw is barren and the player is offered another one. */
export const MIN_INTERESTING_LENGTH = 4;

export const VOWELS = [
  { value: 'a', weight: 9 },
  { value: 'e', weight: 15 },
  { value: 'i', weight: 8 },
  { value: 'o', weight: 6 },
  { value: 'u', weight: 6 },
  { value: 'y', weight: 1 },
];

export const CONSONANTS = [
  { value: 'b', weight: 2 }, { value: 'c', weight: 2 }, { value: 'd', weight: 3 },
  { value: 'f', weight: 2 }, { value: 'g', weight: 2 }, { value: 'h', weight: 2 },
  { value: 'j', weight: 1 }, { value: 'k', weight: 1 }, { value: 'l', weight: 5 },
  { value: 'm', weight: 3 }, { value: 'n', weight: 6 }, { value: 'p', weight: 2 },
  { value: 'q', weight: 1 }, { value: 'r', weight: 6 }, { value: 's', weight: 6 },
  { value: 't', weight: 6 }, { value: 'v', weight: 2 }, { value: 'w', weight: 1 },
  { value: 'x', weight: 1 }, { value: 'z', weight: 1 },
];

export function drawLetter(rng, kind) {
  if (kind === 'voyelle') return pickWeighted(rng, VOWELS);
  if (kind === 'consonne') return pickWeighted(rng, CONSONANTS);
  throw new Error(`tirage inconnu : ${kind} (attendu voyelle ou consonne)`);
}
