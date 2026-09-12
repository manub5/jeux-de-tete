// games/paires/save.js
// Saving a game in progress. The board is stored as it stands, because unlike
// the sudoku there is no answer to hide: the symbols are already on screen.
//
// Every field is checked on the way back in, and a save that contradicts itself
// is refused whole rather than patched. A board where one symbol appears once,
// or where a card is matched but its twin is not, cannot be finished — and in
// lot 4 exactly that shape left a grid unwinnable with no message at all.

import { NIVEAUX, createPairsGame } from './game.js';
import { createRng } from '../../core/rng.js';

const CLE = 'paires.partie';

export function saveGame(storage, game) {
  storage.set(CLE, game.snapshot());
}

export function clearSave(storage) {
  storage.remove(CLE);
}

/** The saved state, or null if anything about it is wrong. */
function asSaved(brut) {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const reglage = NIVEAUX[brut.niveau];
  if (!reglage) return null;
  if (!Number.isInteger(brut.flips) || brut.flips < 0) return null;
  if (brut.phase !== 'en cours' && brut.phase !== 'terminée') return null;
  if (!Array.isArray(brut.cards) || brut.cards.length !== reglage.paires * 2) return null;

  const comptes = new Map();
  for (const carte of brut.cards) {
    if (!carte || typeof carte !== 'object') return null;
    if (typeof carte.symbole !== 'string' || !carte.symbole) return null;
    if (typeof carte.montree !== 'boolean' || typeof carte.appariee !== 'boolean') return null;
    if (carte.appariee && !carte.montree) return null;
    comptes.set(carte.symbole, (comptes.get(carte.symbole) ?? 0) + 1);
  }
  if (comptes.size !== reglage.paires) return null;
  for (const combien of comptes.values()) if (combien !== 2) return null;

  // A matched card whose twin is not matched leaves the game unwinnable.
  const apparies = new Map();
  for (const carte of brut.cards) {
    if (!carte.appariee) continue;
    apparies.set(carte.symbole, (apparies.get(carte.symbole) ?? 0) + 1);
  }
  for (const combien of apparies.values()) if (combien !== 2) return null;

  return brut;
}

export function loadGame(storage) {
  const saved = asSaved(storage.get(CLE, null));
  if (!saved) return null;
  // The rng only deals the board, and the board comes from the save: any seed
  // does, and taking one keeps createPairsGame's single way in.
  const game = createPairsGame({ rng: createRng(1), niveau: saved.niveau });
  game.restore(saved);
  return game;
}

export function resumableSave(storage) {
  const saved = asSaved(storage.get(CLE, null));
  if (!saved || saved.phase !== 'en cours') return null;
  return { niveau: saved.niveau, flips: saved.flips };
}
