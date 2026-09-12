import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../core/rng.js';
import { createPairsGame } from '../../../games/paires/game.js';
import { saveGame, loadGame, clearSave, resumableSave } from '../../../games/paires/save.js';

function faussStorage(initial = {}) {
  const donnees = new Map(Object.entries(initial));
  return {
    get: (cle, defaut) => (donnees.has(cle) ? donnees.get(cle) : defaut),
    set: (cle, valeur) => donnees.set(cle, valeur),
    remove: (cle) => donnees.delete(cle),
    brut: donnees,
  };
}

test("une partie relue est identique à celle qu'on a quittée", () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  jeu.flip(0);
  jeu.flip(1);
  jeu.flip(2);
  saveGame(storage, jeu);
  const repris = loadGame(storage);
  assert.deepEqual(repris.snapshot(), jeu.snapshot());
});

test('la reprise garde les cartes déjà appariées', () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(5), niveau: 'facile' });
  const jumeau = jeu.cards.findIndex((c, i) => i !== 0 && c.symbole === jeu.cards[0].symbole);
  jeu.flip(0);
  jeu.flip(jumeau);
  saveGame(storage, jeu);
  const repris = loadGame(storage);
  assert.ok(repris.cards[0].appariee && repris.cards[jumeau].appariee);
  assert.equal(repris.flips, 2);
});

test('rien de sauvegardé : la reprise rend null au lieu de planter', () => {
  assert.equal(loadGame(faussStorage()), null);
  assert.equal(resumableSave(faussStorage()), null);
});

test('une sauvegarde dont un symbole n\'apparaît pas deux fois est refusée', () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  saveGame(storage, jeu);
  const abime = storage.get('paires.partie');
  abime.cards[0].symbole = abime.cards[1].symbole === 'rond' ? 'carre' : 'rond';
  storage.set('paires.partie', abime);
  assert.equal(loadGame(storage), null, 'une partie ingagnable ne doit pas être reprise');
});

test('une carte appariée dont le jumeau ne l\'est pas est refusée', () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  saveGame(storage, jeu);
  const abime = storage.get('paires.partie');
  abime.cards[0].appariee = true;
  storage.set('paires.partie', abime);
  assert.equal(loadGame(storage), null);
});

test('un nombre de cartes qui ne correspond pas au niveau est refusé', () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  saveGame(storage, jeu);
  const abime = storage.get('paires.partie');
  abime.cards.pop();
  storage.set('paires.partie', abime);
  assert.equal(loadGame(storage), null);
});

test('les sauvegardes absurdes sont refusées sans exception', () => {
  for (const valeur of [null, 42, 'bonjour', [], {}, { niveau: 'facile' },
                        { niveau: 'inconnu', flips: 0, cards: [] }]) {
    const storage = faussStorage({ 'paires.partie': valeur });
    assert.equal(loadGame(storage), null, JSON.stringify(valeur));
    assert.equal(resumableSave(storage), null, JSON.stringify(valeur));
  }
});

test('un compte de retournements négatif ou absurde est refusé', () => {
  const storage = faussStorage();
  saveGame(storage, createPairsGame({ rng: createRng(3), niveau: 'facile' }));
  for (const flips of [-1, 1.5, NaN, 'trois', null]) {
    const abime = storage.get('paires.partie');
    abime.flips = flips;
    storage.set('paires.partie', abime);
    assert.equal(loadGame(storage), null, String(flips));
  }
});

test('resumableSave dit oui exactement quand loadGame aboutit', () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(9), niveau: 'moyen' });
  jeu.flip(0);
  saveGame(storage, jeu);
  assert.deepEqual(resumableSave(storage), { niveau: 'moyen', flips: 1 });
  const abime = storage.get('paires.partie');
  abime.cards[0].appariee = true;
  storage.set('paires.partie', abime);
  assert.equal(resumableSave(storage), null,
    'le menu ne doit pas proposer une reprise qui échouera');
});

test('une partie terminée n\'est pas proposée à la reprise', () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  while (jeu.phase === 'en cours') {
    const premier = jeu.cards.findIndex((c) => !c.appariee);
    const jumeau = jeu.cards.findIndex(
      (c, i) => i !== premier && !c.appariee && c.symbole === jeu.cards[premier].symbole);
    jeu.flip(premier);
    jeu.flip(jumeau);
  }
  saveGame(storage, jeu);
  assert.equal(resumableSave(storage), null);
});

test('clearSave efface, et la reprise rend null ensuite', () => {
  const storage = faussStorage();
  saveGame(storage, createPairsGame({ rng: createRng(3), niveau: 'facile' }));
  clearSave(storage);
  assert.equal(loadGame(storage), null);
});
