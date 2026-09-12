// games/sequence/game.js
// The rules. Pure: no DOM, no audio, no timer. Speed only governs how the
// sequence is SHOWN, never how long he has to answer — the spec rules out any
// clock running while he plays.

import { ZONES } from './zones.js';

/** How long one zone lights up, in milliseconds. */
export const VITESSES = { lente: 900, normale: 600, rapide: 380 };

export function createSequenceGame({ rng }) {
  const sequence = [];
  let position = 0;
  let longueur = 0;
  let phase = 'montre';

  function allonger() {
    if (phase === 'perdu') return;
    sequence.push(ZONES[Math.floor(rng() * ZONES.length)].id);
    position = 0;
    phase = 'repete';
  }

  function press(zoneId) {
    if (phase === 'perdu') return 'faux';
    if (position >= sequence.length || zoneId !== sequence[position]) {
      phase = 'perdu';
      return 'faux';
    }
    position += 1;
    // Recorded on every correct press, not only on 'fini': the test "une zone
    // fausse perd la partie, et la longueur reste celle atteinte" expects
    // longueur to hold the count of correct presses made before the failing
    // one, even mid-round. Setting it only inside the 'fini' branch (as an
    // earlier draft of this file did) leaves it at 0 in that exact case.
    longueur = position;
    if (position === sequence.length) {
      phase = 'montre';
      return 'fini';
    }
    return 'juste';
  }

  function snapshot() {
    return { sequence: [...sequence], position, longueur, phase };
  }

  return {
    get sequence() { return sequence; },
    get position() { return position; },
    get longueur() { return longueur; },
    get phase() { return phase; },
    allonger,
    press,
    snapshot,
  };
}
