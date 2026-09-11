// tests/games/motus/share.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKS } from '../../../games/motus/marking.js';
import { summary } from '../../../games/motus/share.js';

const { placed, present, absent } = MARKS;
const LIGNES = [
  { word: 'bonjour', marks: [placed, absent, absent, present, absent, absent, absent] },
  { word: 'bonjour', marks: [placed, placed, placed, placed, placed, placed, placed] },
];

test('the summary never contains a letter of any attempt, won or lost', () => {
  // Two literals are allowed through: the game's name, and the X that marks a
  // game lost. Everything else must be squares, digits and punctuation — a
  // summary is only safe to send if it carries no letter of the word.
  for (const [won, attempts] of [[true, 2], [false, 6]]) {
    const texte = summary(LIGNES, { day: '2026-09-11', won, attempts });
    const reste = texte.replace('Motus', '').replace('X/6', '');
    assert.ok(!/[a-zA-Zà-ÿ]/.test(reste), `${won ? 'gagnée' : 'perdue'} : ${texte}`);
  }
});

test('one line of squares per attempt', () => {
  const texte = summary(LIGNES, { day: '2026-09-11', won: true, attempts: 2 });
  const lignes = texte.trim().split('\n');
  assert.equal(lignes.length, 3); // l'en-tête, puis les deux essais
});

test('the header carries the day and the score', () => {
  const texte = summary(LIGNES, { day: '2026-09-11', won: true, attempts: 2 });
  assert.ok(texte.includes('2026-09-11'));
  assert.ok(texte.includes('2/6'));
});

test('a lost game is marked as such, not as a score', () => {
  const texte = summary(LIGNES, { day: '2026-09-11', won: false, attempts: 6 });
  assert.ok(texte.includes('X/6'));
});

test('each mark has its own square, and they are all different', () => {
  const texte = summary(
    [{ word: 'abc', marks: [placed, present, absent] }],
    { day: '2026-09-11', won: false, attempts: 1 }
  );
  const carres = [...texte.trim().split('\n')[1]];
  assert.equal(new Set(carres).size, 3);
});

test('no attempt at all still produces something sendable', () => {
  const texte = summary([], { day: '2026-09-11', won: false, attempts: 0 });
  assert.ok(texte.includes('2026-09-11'));
});
