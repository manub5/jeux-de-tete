// games/motus/share.js
// The sendable summary. Its one hard rule: it must never leak a letter.

import { MARKS } from './marking.js';

const SQUARES = {
  [MARKS.placed]: '🟥',
  [MARKS.present]: '🟨',
  [MARKS.absent]: '⬜',
};

/**
 * Red for a letter in its place, yellow for a letter of the word elsewhere,
 * white for a letter that is not in it — the colours of the television show.
 * Only the shape of the grid travels, never its content.
 */
export function summary(rows, { day, won, attempts }) {
  const score = won ? `${attempts}/6` : 'X/6';
  const grid = rows.map((row) => row.marks.map((m) => SQUARES[m] ?? '⬜').join(''));
  return [`Motus ${day} ${score}`, ...grid].join('\n');
}
