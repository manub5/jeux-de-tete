// games/paires/game.js
// The rules of the memory game. Pure: no DOM, and — deliberately — no timer.
//
// Showing two cards then turning them back is the one place a timer would be
// natural, and a deferred timer produced three critical defects in lot 3. So
// the rules never depend on one: while two unmatched cards are face up, the
// NEXT flip covers them first. resolve() does the same thing and exists only so
// the screen can cover them sooner, for looks. Both are idempotent, so a lost
// timer can never corrupt a game — at worst two cards stay visible until the
// next tap.

import { SYMBOLES } from './symboles.js';

export const NIVEAUX = {
  facile: { colonnes: 6, paires: 15, minimum: 30 },
  moyen: { colonnes: 6, paires: 21, minimum: 42 },
  difficile: { colonnes: 6, paires: 30, minimum: 60 },
};

function shuffled(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createPairsGame({ rng, niveau }) {
  const reglage = NIVEAUX[niveau];
  if (!reglage) throw new Error(`niveau inconnu : ${niveau}`);

  const choisis = shuffled(rng, SYMBOLES).slice(0, reglage.paires);
  const cards = shuffled(rng, choisis.flatMap((s) => [s.id, s.id]))
    .map((symbole) => ({ symbole, montree: false, appariee: false }));

  let flips = 0;
  let phase = 'en cours';

  /** Indices of the face-up cards that are not yet matched. */
  function enAttente() {
    return cards.reduce((liste, carte, i) => {
      if (carte.montree && !carte.appariee) liste.push(i);
      return liste;
    }, []);
  }

  function resolve() {
    const ouvertes = enAttente();
    if (ouvertes.length < 2) return;
    for (const i of ouvertes) cards[i].montree = false;
  }

  function flip(index) {
    if (phase !== 'en cours') return;
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
    // Covering the previous miss is free: it is the same gesture the player
    // would have waited for, not a move of its own.
    resolve();
    const carte = cards[index];
    if (carte.appariee || carte.montree) return;

    carte.montree = true;
    flips += 1;

    const ouvertes = enAttente();
    if (ouvertes.length === 2) {
      const [a, b] = ouvertes;
      if (cards[a].symbole === cards[b].symbole) {
        cards[a].appariee = true;
        cards[b].appariee = true;
      }
    }
    if (cards.every((c) => c.appariee)) phase = 'terminée';
  }

  function snapshot() {
    return {
      niveau,
      flips,
      phase,
      cards: cards.map((c) => ({ ...c })),
    };
  }

  return {
    get cards() { return cards; },
    get flips() { return flips; },
    get phase() { return phase; },
    get niveau() { return niveau; },
    get minimum() { return reglage.minimum; },
    get colonnes() { return reglage.colonnes; },
    flip,
    resolve,
    snapshot,
  };
}
