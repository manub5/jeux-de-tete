import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createSolver } from '../../../lexicon/solver.js';
import { createLexicon } from '../../../lexicon/lexicon.js';
import { signature } from '../../../lexicon/signature.js';
import { createGame } from '../../../games/mot-le-plus-long/game.js';
import { DRAW_SIZE } from '../../../games/mot-le-plus-long/draw.js';

const WORDS = ['as', 'sac', 'cas', 'chat', 'chats', 'chas', 'ta', 'sachet', 'cachets', 'chien', 'œuf'];

function build() {
  const index = new Map();
  for (const word of WORDS) {
    const key = signature(word);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(word);
  }
  const solver = createSolver(index);
  const lexicon = createLexicon(index, { accepted: new Set(), rejected: new Set(), save() {} });
  return { solver, lexicon };
}

/** A game whose rack is forced, so the rules can be tested in isolation. */
function gameWithLetters(letters) {
  const { solver, lexicon } = build();
  return createGame({ solver, lexicon, rng: createRng(1), letters });
}

// The program draws the rack; the player looks for the longest word in it.

test('a new game already holds its rack and is waiting for words', () => {
  const { solver, lexicon } = build();
  const game = createGame({ solver, lexicon, rng: createRng(1) });
  assert.equal(game.phase, 'recherche');
  assert.equal(game.letters.length, DRAW_SIZE);
});

test('the rack is drawn from the bag, never from the player', () => {
  const { solver, lexicon } = build();
  const game = createGame({ solver, lexicon, rng: createRng(1) });
  assert.ok(game.letters.every((letter) => /^[a-z]$/.test(letter)));
  assert.equal(typeof game.drawLetter, 'undefined');
  assert.equal(typeof game.setLetter, 'undefined');
});

test('the same seed deals the same rack', () => {
  const { solver, lexicon } = build();
  const first = createGame({ solver, lexicon, rng: createRng(99) });
  const second = createGame({ solver, lexicon, rng: createRng(99) });
  assert.deepEqual(second.letters, first.letters);
});

test('the best length is announced', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  assert.equal(game.bestLength, 7); // cachets
});

test('the best word itself is never exposed before the end', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  assert.equal(game.bestWord, undefined);
});

test('a barren rack is flagged', () => {
  const game = gameWithLetters('zzzzwwwwkk'.split(''));
  assert.equal(game.barren, true);
  assert.equal(game.bestLength, 0);
});

test('a rich rack is not flagged as barren', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  assert.equal(game.barren, false);
});

test('a valid proposal is accepted and recorded', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  const result = game.propose('chat');
  assert.equal(result.ok, true);
  assert.equal(result.word, 'chat');
  assert.deepEqual(game.proposals.map((p) => p.word), ['chat']);
  assert.equal(game.score, 4);
});

test('a word using a letter that was not dealt is refused', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  // `chien` is in the dictionary but needs an i and an n, neither dealt.
  const result = game.propose('chien');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'lettres');
});

test('an unknown word is refused with the dictionary reason', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  assert.equal(game.propose('cxz').reason, 'inconnu');
});

test('only the longest proposal counts', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  game.propose('sachet');
  game.propose('chat');
  assert.equal(game.score, 6);
});

test('improving on the previous best is reported', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  assert.equal(game.propose('chat').improved, true);
  assert.equal(game.propose('sac').improved, false);
  assert.equal(game.propose('sachet').improved, true);
});

test('the same word proposed twice is recorded once', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  game.propose('chat');
  game.propose('chat');
  assert.equal(game.proposals.length, 1);
});

test('finishing reveals the best word and closes the game', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  game.propose('chat');
  const result = game.finish();
  assert.equal(result.bestWord, 'cachets');
  assert.equal(result.bestLength, 7);
  assert.equal(result.score, 4);
  assert.ok(result.found.includes('sachet'));
  assert.equal(game.phase, 'terminée');
});

test('a finished game refuses further proposals', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  game.finish();
  assert.throws(() => game.propose('chat'), /over/);
});

test('a game with no proposal scores zero', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  assert.equal(game.finish().score, 0);
});

test('a ligature costs the letters it takes from the rack', () => {
  // `œuf` is three characters but four tiles: O E U F. The player used four of
  // their ten letters, so it must score four.
  const game = gameWithLetters('oeufxzqvwk'.split(''));
  const result = game.propose('œuf');
  assert.equal(result.ok, true);
  assert.equal(result.length, 4);
  assert.equal(game.score, 4);
});

test('finishing twice gives the same result', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  const first = game.finish();
  assert.deepEqual(game.finish(), first);
});

test('barren stays consistent once the game is finished', () => {
  const game = gameWithLetters('zzzzwwwwkk'.split(''));
  assert.equal(game.barren, true);
  game.finish();
  assert.equal(game.barren, true);
});

// Nothing handed to the screen may reach back into the game's own state.

test('emptying the revealed list does not corrupt the game', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  const result = game.finish();
  const announced = game.bestLength;
  result.found.length = 0;
  assert.equal(game.bestLength, announced);
});

test('the proposals list cannot be edited from outside', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  game.propose('chat');
  game.proposals[0].length = 99;
  assert.equal(game.proposals[0].length, 4);
});

test('the rack cannot be edited from outside', () => {
  const game = gameWithLetters('cachetsxzq'.split(''));
  game.letters[0] = 'z';
  assert.equal(game.letters[0], 'c');
});
