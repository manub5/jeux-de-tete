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

test('une carte absente ou non-objet dans le tableau est refusée', () => {
  const storage = faussStorage();
  saveGame(storage, createPairsGame({ rng: createRng(3), niveau: 'facile' }));
  for (const carteInvalide of [null, 'carte', 42]) {
    const abime = storage.get('paires.partie');
    abime.cards[0] = carteInvalide;
    storage.set('paires.partie', abime);
    assert.equal(loadGame(storage), null, JSON.stringify(carteInvalide));
    assert.equal(resumableSave(storage), null, JSON.stringify(carteInvalide));
  }
});

test('une phase qui n\'est ni « en cours » ni « terminée » est refusée', () => {
  const storage = faussStorage();
  saveGame(storage, createPairsGame({ rng: createRng(3), niveau: 'facile' }));
  for (const phaseInvalide of ['bug', '', null, undefined]) {
    const abime = storage.get('paires.partie');
    abime.phase = phaseInvalide;
    storage.set('paires.partie', abime);
    assert.equal(loadGame(storage), null, String(phaseInvalide));
  }
});

test('une carte dont un champ a le mauvais type est refusée', () => {
  const gabarits = [
    (c) => ({ ...c, symbole: 42 }),
    (c) => ({ ...c, symbole: '' }),
    (c) => ({ ...c, montree: 'oui' }),
    (c) => ({ ...c, appariee: 1 }),
  ];
  for (const abimer of gabarits) {
    // A fresh save on every try: damage one field at a time, never
    // compounding the previous template's damage onto the same card.
    const storage = faussStorage();
    saveGame(storage, createPairsGame({ rng: createRng(3), niveau: 'facile' }));
    const abime = storage.get('paires.partie');
    abime.cards[0] = abimer(abime.cards[0]);
    storage.set('paires.partie', abime);
    assert.equal(loadGame(storage), null, JSON.stringify(abime.cards[0]));
  }
});

test('un symbole non-string ou vide reste refusé même quand les paires s’équilibrent', () => {
  // The previous test damages a single card: the guard on the pair count
  // (each symbol exactly twice) alone is then enough to refuse the save,
  // without ever going through the guard on `symbole`'s type. Here, both
  // twins are damaged identically: the pair count stays balanced, so only
  // the type guard can still refuse the save.
  for (const remplacement of [42, '']) {
    const storage = faussStorage();
    saveGame(storage, createPairsGame({ rng: createRng(3), niveau: 'facile' }));
    const abime = storage.get('paires.partie');
    const original = abime.cards[0].symbole;
    for (const carte of abime.cards) {
      if (carte.symbole === original) carte.symbole = remplacement;
    }
    storage.set('paires.partie', abime);
    assert.equal(loadGame(storage), null, JSON.stringify(remplacement));
  }
});

test('un symbole qui n’existe plus dans SYMBOLES est refusé, même quand les paires s’équilibrent', () => {
  // This very lot renamed a symbol twice (labyrinthe -> spirale -> crochet):
  // a save written before such a rename, read back after it, would carry an
  // id nothing can draw any more.
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  saveGame(storage, jeu);
  const abime = storage.get('paires.partie');
  const original = abime.cards[0].symbole;
  for (const carte of abime.cards) {
    if (carte.symbole === original) carte.symbole = 'labyrinthe';
  }
  storage.set('paires.partie', abime);
  assert.equal(loadGame(storage), null);
});

test('une paire appariée mais non montrée est refusée, même quand les autres gardes s’y retrouvent', () => {
  // Both twins are damaged identically: both the pair count and the matched-
  // pair count stay balanced (2 each), so only the appariee-implies-montree
  // guard can still refuse the save.
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  saveGame(storage, jeu);
  const abime = storage.get('paires.partie');
  const original = abime.cards[0].symbole;
  for (const carte of abime.cards) {
    if (carte.symbole === original) { carte.appariee = true; carte.montree = false; }
  }
  storage.set('paires.partie', abime);
  assert.equal(loadGame(storage), null);
});

test('toutes les cartes appariées mais phase « en cours » est refusé', () => {
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
  const abime = storage.get('paires.partie');
  abime.phase = 'en cours';
  storage.set('paires.partie', abime);
  assert.equal(loadGame(storage), null,
    'une partie où tout est déjà apparié ne peut pas être « en cours »');
});

test('phase « terminée » avec une carte non appariée est refusée', () => {
  const storage = faussStorage();
  const jeu = createPairsGame({ rng: createRng(3), niveau: 'facile' });
  jeu.flip(0);
  saveGame(storage, jeu);
  const abime = storage.get('paires.partie');
  abime.phase = 'terminée';
  storage.set('paires.partie', abime);
  assert.equal(loadGame(storage), null,
    'une partie « terminée » où une carte reste non appariée est un mensonge');
});
