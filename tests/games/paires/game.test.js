import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { NIVEAUX, createPairsGame } from '../../../games/paires/game.js';

const partie = (niveau = 'facile', graine = 1) =>
  createPairsGame({ rng: createRng(graine), niveau });

test('chaque niveau distribue deux fois chaque symbole, et pas un de plus', () => {
  for (const [nom, reglage] of Object.entries(NIVEAUX)) {
    const jeu = partie(nom);
    assert.equal(jeu.cards.length, reglage.paires * 2, nom);
    const comptes = new Map();
    for (const carte of jeu.cards) {
      comptes.set(carte.symbole, (comptes.get(carte.symbole) ?? 0) + 1);
    }
    assert.equal(comptes.size, reglage.paires, `${nom} : nombre de symboles`);
    for (const [symbole, combien] of comptes) {
      assert.equal(combien, 2, `${nom} : ${symbole} apparaît ${combien} fois`);
    }
  }
});

test('le minimum théorique vaut deux retournements par paire', () => {
  for (const [nom, reglage] of Object.entries(NIVEAUX)) {
    assert.equal(reglage.minimum, reglage.paires * 2, nom);
  }
});

test('deux cartes identiques restent appariées et visibles', () => {
  const jeu = partie();
  const premier = 0;
  const jumeau = jeu.cards.findIndex((c, i) => i !== premier && c.symbole === jeu.cards[premier].symbole);
  jeu.flip(premier);
  jeu.flip(jumeau);
  assert.ok(jeu.cards[premier].appariee, 'la première est appariée');
  assert.ok(jeu.cards[jumeau].appariee, 'la seconde est appariée');
  assert.equal(jeu.flips, 2);
});

test('deux cartes différentes se recouvrent au retournement suivant, sans minuterie', () => {
  const jeu = partie();
  const a = 0;
  const b = jeu.cards.findIndex((c) => c.symbole !== jeu.cards[a].symbole);
  jeu.flip(a);
  jeu.flip(b);
  assert.ok(jeu.cards[a].montree && jeu.cards[b].montree, 'les deux restent visibles');
  const c = jeu.cards.findIndex((carte, i) => i !== a && i !== b && !carte.appariee);
  jeu.flip(c);
  assert.ok(!jeu.cards[a].montree && !jeu.cards[b].montree,
    'le troisième retournement recouvre les deux précédentes');
  assert.ok(jeu.cards[c].montree);
  assert.equal(jeu.flips, 3);
});

test('resolve() recouvre la paire ratée, et ne coûte aucun retournement', () => {
  const jeu = partie();
  const a = 0;
  const b = jeu.cards.findIndex((c) => c.symbole !== jeu.cards[a].symbole);
  jeu.flip(a);
  jeu.flip(b);
  jeu.resolve();
  assert.ok(!jeu.cards[a].montree && !jeu.cards[b].montree);
  assert.equal(jeu.flips, 2, 'resolve() ne compte pas comme un retournement');
});

test("resolve() est idempotent : l'appeler deux fois ne change rien", () => {
  const jeu = partie();
  const a = 0;
  const b = jeu.cards.findIndex((c) => c.symbole !== jeu.cards[a].symbole);
  jeu.flip(a);
  jeu.flip(b);
  jeu.resolve();
  const avant = JSON.stringify(jeu.snapshot());
  jeu.resolve();
  jeu.resolve();
  assert.equal(JSON.stringify(jeu.snapshot()), avant);
});

test("retourner une carte déjà visible ou déjà appariée ne coûte rien", () => {
  const jeu = partie();
  jeu.flip(0);
  const avant = jeu.flips;
  jeu.flip(0);
  assert.equal(jeu.flips, avant, 'la même carte deux fois de suite ne compte pas');
  const jumeau = jeu.cards.findIndex((c, i) => i !== 0 && c.symbole === jeu.cards[0].symbole);
  jeu.flip(jumeau);
  const apres = jeu.flips;
  jeu.flip(0);
  jeu.flip(jumeau);
  assert.equal(jeu.flips, apres, 'une paire déjà trouvée ne compte plus');
});

test('un index hors du plateau ne casse rien', () => {
  const jeu = partie();
  for (const index of [-1, 999, NaN, undefined, null, '3']) {
    jeu.flip(index);
  }
  assert.equal(jeu.flips, 0);
  assert.equal(jeu.phase, 'en cours');
});

test('la partie se termine quand toutes les paires sont trouvées', () => {
  const jeu = partie();
  while (jeu.phase === 'en cours') {
    const premier = jeu.cards.findIndex((c) => !c.appariee);
    const jumeau = jeu.cards.findIndex(
      (c, i) => i !== premier && !c.appariee && c.symbole === jeu.cards[premier].symbole);
    jeu.flip(premier);
    jeu.flip(jumeau);
  }
  assert.equal(jeu.phase, 'terminée');
  assert.equal(jeu.flips, NIVEAUX.facile.minimum, 'un jeu parfait atteint le minimum');
  assert.ok(jeu.cards.every((c) => c.appariee && c.montree));
});

test("une partie terminée n'accepte plus aucun retournement", () => {
  const jeu = partie();
  while (jeu.phase === 'en cours') {
    const premier = jeu.cards.findIndex((c) => !c.appariee);
    const jumeau = jeu.cards.findIndex(
      (c, i) => i !== premier && !c.appariee && c.symbole === jeu.cards[premier].symbole);
    jeu.flip(premier);
    jeu.flip(jumeau);
  }
  const avant = jeu.flips;
  jeu.flip(0);
  assert.equal(jeu.flips, avant);
});

test('deux graines différentes donnent deux plateaux différents', () => {
  const a = partie('facile', 1).cards.map((c) => c.symbole).join();
  const b = partie('facile', 2).cards.map((c) => c.symbole).join();
  assert.notEqual(a, b);
});

test('la même graine donne exactement le même plateau', () => {
  const a = partie('facile', 7).cards.map((c) => c.symbole).join();
  const b = partie('facile', 7).cards.map((c) => c.symbole).join();
  assert.equal(a, b);
});

test('un niveau inconnu est refusé plutôt que deviné', () => {
  assert.throws(() => createPairsGame({ rng: createRng(1), niveau: 'moyennement' }),
    /niveau inconnu/);
});
