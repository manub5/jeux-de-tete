// core/encouragements.js
// Short, varied lines shown at the end of a game, on top of the score itself
// — never in its place. The score is what tells him how he did; these just
// keep the end screen from reading exactly the same seven times in a row.
//
// Three tiers, the same across every game: `excellent` for as good as this
// game gets, `bien` for a solid game, `encourageant` for one that did not go
// his way — worded so it never reads as a scold, because a game he plays for
// fun should not end on a chiding note.

const EXCELLENT = [
  'Excellent !',
  'Impressionnant !',
  'Du beau travail.',
  'Sans faute, ou presque.',
  'Vous êtes en forme aujourd’hui.',
  'Ça, c’est une belle partie.',
];

const BIEN = [
  'Bien joué !',
  'Belle partie.',
  'Pas mal du tout.',
  'Une bonne partie.',
  'Continuez comme ça.',
  'Solide.',
];

const ENCOURAGEANT = [
  'La prochaine sera la bonne.',
  'Une partie de plus, une leçon de plus.',
  'Ça se joue à peu de choses.',
  'Retentez votre chance.',
  'Il y a pire tirage.',
  'Ce n’est que partie remise.',
];

const POOLS = { excellent: EXCELLENT, bien: BIEN, encourageant: ENCOURAGEANT };

/** A random-ish message for the given tier. Falls back to `bien` for a tier
 * this module does not know, rather than throwing over a typo in a caller. */
export function messageFin(tier, hasard = Math.random) {
  const phrases = POOLS[tier] ?? BIEN;
  return phrases[Math.floor(hasard() * phrases.length)];
}

const RECORD = [
  'Nouveau record !',
  'Jamais fait aussi bien !',
  'Record battu !',
  'Votre meilleur score jusqu’ici.',
];

/** A random-ish way to announce that this game's score just became the
 * player's personal best — see `stats.record()`'s `isRecord`. */
export function messageRecord(hasard = Math.random) {
  return RECORD[Math.floor(hasard() * RECORD.length)];
}
