// games/motus/pick.js
// The pool of words to guess, and the two ways one is drawn from it.
//
// The word of the day is computed from the date, so every phone lands on the
// same word on the same day without anything being downloaded — the date is the
// only thing two players share, and it is enough.

import { fold } from '../../lexicon/signature.js';
import { createRng, seedFromString } from '../../core/rng.js';

export const LENGTHS = [6, 7, 8];
export const DEFAULT_LENGTH = 7;

/**
 * The daily word is always this long. "The word of the day" has to be one
 * thing: a length he could change would make his word and anyone else's two
 * different puzzles, and the whole point of computing it from the date is that
 * they match.
 */
export const DAILY_LENGTH = 7;

/**
 * The puzzles of a given length, folded, sorted, without duplicates.
 *
 * Folded because the board is played in plain capitals — which also means
 * `apparaitre` and `apparaître` are the same puzzle, not two, and counting both
 * would let one word come up on two different days. Sorted because the day has
 * to land on the same word for ever.
 */
export function candidates(frequencies, length) {
  const found = new Set();
  for (const word of frequencies.keys()) {
    const folded = fold(word);
    if (folded.length === length) found.add(folded);
  }
  return [...found].sort();
}

function drawFrom(pool, rng, what) {
  if (pool.length === 0) {
    throw new Error(`aucun mot disponible pour ${what}`);
  }
  return pool[Math.floor(rng() * pool.length)];
}

/** The day the calendar starts counting from. Any fixed date would do. */
const ORIGIN = Date.UTC(2026, 0, 1);
const DAY_MS = 86400000;

function dayNumber(day) {
  const [year, month, date] = day.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, date) - ORIGIN) / DAY_MS);
}

/**
 * One fixed shuffle of the pool, the order the days walk through. Seeded by a
 * constant, so every device shuffles identically.
 */
function walkOrder(pool) {
  const order = [...pool];
  const rng = createRng(seedFromString('motus:ordre'));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * The same date always gives the same word, on any device, for ever — and no
 * word comes back until every other has been used. Walking a fixed shuffle
 * rather than drawing afresh is what makes that true: a fresh draw each day
 * would repeat about eighteen times a year, measured, on a pool this size.
 */
export function dailyWord(frequencies, day) {
  const pool = candidates(frequencies, DAILY_LENGTH);
  if (pool.length === 0) {
    throw new Error(`aucun mot disponible pour le ${day}`);
  }
  const order = walkOrder(pool);
  // The double modulo keeps a date before the origin on a positive index.
  const index = ((dayNumber(day) % order.length) + order.length) % order.length;
  return order[index];
}

export function freeWord(rng, frequencies, length) {
  if (!LENGTHS.includes(length)) {
    throw new Error(`longueur non proposée : ${length}`);
  }
  return drawFrom(candidates(frequencies, length), rng, `${length} lettres`);
}
