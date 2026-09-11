import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createLexicon } from '../../../lexicon/lexicon.js';
import { signature } from '../../../lexicon/signature.js';
import { MARKS } from '../../../games/motus/marking.js';
import { FAILURE_SCORE, MAX_ATTEMPTS, createMotus } from '../../../games/motus/game.js';

const MOTS = ['maison', 'malins', 'panier', 'marion', 'ramons', 'bonjour', 'salut'];

function build() {
  const index = new Map();
  for (const mot of MOTS) {
    const clef = signature(mot);
    if (!index.has(clef)) index.set(clef, []);
    index.get(clef).push(mot);
  }
  return createLexicon(index, { accepted: new Set(), rejected: new Set(), save() {} });
}

function partie(word = 'maison') {
  return createMotus({
    lexicon: build(),
    rng: createRng(1),
    frequencies: new Map([['maison', 10]]),
    length: 6,
    word,
  });
}

test('a game opens on six empty attempts and gives the first letter', () => {
  const jeu = partie();
  assert.equal(MAX_ATTEMPTS, 6);
  assert.equal(jeu.length, 6);
  assert.equal(jeu.firstLetter, 'm');
  assert.equal(jeu.phase, 'recherche');
  assert.equal(jeu.attempts, 0);
  assert.deepEqual(jeu.rows, []);
});

test('a correct guess ends the game and scores the attempts used', () => {
  const jeu = partie();
  const retour = jeu.propose('malins');
  assert.equal(retour.ok, true);
  assert.equal(jeu.phase, 'recherche');
  assert.equal(jeu.propose('maison').ok, true);
  assert.equal(jeu.phase, 'terminée');
  assert.deepEqual(jeu.result, { won: true, attempts: 2, score: 2, word: 'maison' });
});

test('each accepted attempt leaves a marked row behind', () => {
  const jeu = partie();
  jeu.propose('malins');
  assert.equal(jeu.rows.length, 1);
  assert.equal(jeu.rows[0].word, 'malins');
  assert.equal(jeu.rows[0].marks[0], MARKS.placed);
  assert.equal(jeu.rows[0].marks.length, 6);
});

test('a word that is not in the dictionary costs no attempt', () => {
  const jeu = partie();
  const retour = jeu.propose('mzzzzz');
  assert.equal(retour.ok, false);
  assert.equal(retour.reason, 'inconnu');
  assert.equal(jeu.attempts, 0);
  assert.deepEqual(jeu.rows, []);
});

test('a word of the wrong length costs no attempt either', () => {
  const jeu = partie();
  assert.equal(jeu.propose('salut').reason, 'longueur');
  assert.equal(jeu.attempts, 0);
});

test('six wrong attempts end the game, and failure scores seven', () => {
  const jeu = partie();
  for (let i = 0; i < MAX_ATTEMPTS; i++) jeu.propose('malins');
  assert.equal(jeu.phase, 'terminée');
  assert.equal(jeu.attempts, MAX_ATTEMPTS);
  assert.equal(jeu.result.won, false);
  assert.equal(jeu.result.score, FAILURE_SCORE);
  assert.equal(jeu.result.word, 'maison');
});

test('giving up ends the game as a failure and reveals the word', () => {
  const jeu = partie();
  jeu.propose('malins');
  const resultat = jeu.giveUp();
  assert.equal(resultat.won, false);
  assert.equal(resultat.score, FAILURE_SCORE);
  assert.equal(resultat.word, 'maison');
  assert.equal(jeu.phase, 'terminée');
});

test('a finished game refuses any further attempt', () => {
  const jeu = partie();
  jeu.giveUp();
  assert.throws(() => jeu.propose('malins'), /over/);
});

test('the word is not reachable before the end', () => {
  const jeu = partie();
  assert.equal(jeu.word, undefined);
  assert.equal(jeu.result, null);
});

test('nothing handed out can reach back into the game', () => {
  const jeu = partie();
  jeu.propose('malins');
  jeu.rows[0].marks[0] = 'triché';
  jeu.rows.push({ word: 'inventé', marks: [] });
  assert.equal(jeu.rows.length, 1);
  assert.equal(jeu.rows[0].marks[0], MARKS.placed);
});

test('without a word given, one is drawn for the length asked', () => {
  const jeu = createMotus({
    lexicon: build(),
    rng: createRng(1),
    frequencies: new Map([['maison', 10]]),
    length: 6,
  });
  assert.equal(jeu.length, 6);
  assert.equal(jeu.firstLetter, 'm');
});
