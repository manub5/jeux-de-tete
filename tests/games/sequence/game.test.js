import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { ZONES } from '../../../games/sequence/zones.js';
import { VITESSES, createSequenceGame } from '../../../games/sequence/game.js';

const IDS = ZONES.map((z) => z.id);
const partie = (graine = 1) => createSequenceGame({ rng: createRng(graine) });

test('les trois vitesses vont de la plus lente à la plus rapide', () => {
  assert.ok(VITESSES.lente > VITESSES.normale);
  assert.ok(VITESSES.normale > VITESSES.rapide);
});

test('une partie neuve n\'a encore aucune zone a repeter', () => {
  const jeu = partie();
  assert.deepEqual(jeu.sequence, []);
  assert.equal(jeu.longueur, 0);
});

test('allonger ajoute exactement une zone connue', () => {
  const jeu = partie();
  jeu.allonger();
  assert.equal(jeu.sequence.length, 1);
  assert.ok(IDS.includes(jeu.sequence[0]));
  jeu.allonger();
  assert.equal(jeu.sequence.length, 2);
});

test('allonger ne reecrit jamais ce qui a deja ete montree', () => {
  const jeu = partie();
  jeu.allonger();
  jeu.allonger();
  const debut = [...jeu.sequence];
  jeu.allonger();
  assert.deepEqual(jeu.sequence.slice(0, 2), debut);
});

test('repeter la sequence entiere termine le tour', () => {
  const jeu = partie();
  jeu.allonger();
  jeu.allonger();
  assert.equal(jeu.press(jeu.sequence[0]), 'juste');
  assert.equal(jeu.press(jeu.sequence[1]), 'fini');
  assert.equal(jeu.longueur, 2);
  assert.equal(jeu.phase, 'montre');
});

test('une zone fausse perd la partie, et la longueur reste celle atteinte', () => {
  const jeu = partie();
  jeu.allonger();
  jeu.allonger();
  assert.equal(jeu.press(jeu.sequence[0]), 'juste');
  const faux = IDS.find((id) => id !== jeu.sequence[1]);
  assert.equal(jeu.press(faux), 'faux');
  assert.equal(jeu.phase, 'perdu');
  assert.equal(jeu.longueur, 1, 'la longueur atteinte est celle du dernier tour reussi');
});

test('une partie perdue n\'accepte plus aucun appui', () => {
  const jeu = partie();
  jeu.allonger();
  jeu.press(IDS.find((id) => id !== jeu.sequence[0]));
  assert.equal(jeu.phase, 'perdu');
  assert.equal(jeu.press(jeu.sequence[0]), 'faux');
  assert.equal(jeu.longueur, 0);
});

test('une zone inconnue est une faute, pas une exception', () => {
  const jeu = partie();
  jeu.allonger();
  assert.equal(jeu.press('trompette'), 'faux');
  assert.equal(jeu.phase, 'perdu');
});

test('un appui avant qu\'une zone soit montree ne casse rien', () => {
  const jeu = partie();
  assert.equal(jeu.press(IDS[0]), 'faux');
  assert.equal(jeu.phase, 'perdu');
});

test('la meme graine donne exactement la meme suite', () => {
  const a = partie(4);
  const b = partie(4);
  for (let i = 0; i < 20; i++) { a.allonger(); b.allonger(); }
  assert.deepEqual(a.sequence, b.sequence);
});

test('sur cent zones tirees, les quatre sortent toutes', () => {
  const jeu = partie(11);
  for (let i = 0; i < 100; i++) jeu.allonger();
  assert.equal(new Set(jeu.sequence).size, 4,
    'un tirage qui oublie une zone rendrait le jeu bancal');
});

test('un nouveau tour repart de zero apres un tour gagne', () => {
  const jeu = partie();
  jeu.allonger();
  assert.equal(jeu.press(jeu.sequence[0]), 'fini');
  jeu.allonger();
  assert.equal(jeu.position, 0,
    'sans remise a zero, le nouveau tour sauterait ses premieres zones');
  assert.equal(jeu.sequence.length, 2);
  assert.equal(jeu.press(jeu.sequence[0]), 'juste');
  assert.equal(jeu.press(jeu.sequence[1]), 'fini');
});

test('press(undefined) sur une partie neuve est une faute, pas un appui valide', () => {
  const jeu = partie();
  assert.equal(jeu.press(undefined), 'faux',
    'sans la garde sur les bornes, undefined === sequence[position] hors limites');
  assert.equal(jeu.phase, 'perdu');
  assert.equal(jeu.position, 0);
});
