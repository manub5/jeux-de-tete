// games/motus/marking.js
// The marking rule, and the one place a naive implementation is quietly wrong.
//
// Two passes, in this order: the letters in their place are counted first and
// their occurrences removed from the stock, then the misplaced ones are awarded
// from what is left. Do it in one pass and `elles` against `etale` credits both
// L's, though the word holds only one.

import { fold } from '../../lexicon/signature.js';

export const MARKS = { placed: 'placed', present: 'present', absent: 'absent' };

/**
 * One mark per played letter of the guess. Both words are folded first: the
 * board is played in plain capitals, so `ÉTÉ` and `ete` are the same word, and
 * `cœur` occupies five cells.
 */
export function mark(guess, target) {
  const tried = [...fold(guess)];
  const secret = [...fold(target)];
  if (tried.length !== secret.length) {
    throw new Error(`longueur : ${tried.length} lettres jouées contre ${secret.length}`);
  }

  const marks = new Array(tried.length).fill(MARKS.absent);
  const left = new Map();

  // First pass: what is in its place, and what that leaves.
  for (let i = 0; i < tried.length; i++) {
    if (tried[i] === secret[i]) {
      marks[i] = MARKS.placed;
    } else {
      left.set(secret[i], (left.get(secret[i]) ?? 0) + 1);
    }
  }

  // Second pass: the misplaced ones, within what the first pass left.
  for (let i = 0; i < tried.length; i++) {
    if (marks[i] === MARKS.placed) continue;
    const available = left.get(tried[i]) ?? 0;
    if (available > 0) {
      marks[i] = MARKS.present;
      left.set(tried[i], available - 1);
    }
  }

  return marks;
}
