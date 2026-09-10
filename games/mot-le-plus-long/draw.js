// The rack is drawn from the French Scrabble bag: 100 lettered tiles, the two
// blanks left out, taken without replacement. That is exactly what the player
// does at the board, and the bag's own composition — 45 vowels out of 100 —
// hands out three to five vowels on its own. Ten independent draws would not:
// they regularly produce something like ZZWKQXBVFG, which is not a game.

export const DRAW_SIZE = 10;

/** Below this, the rack is barren and the player is offered another one. */
export const MIN_INTERESTING_LENGTH = 4;

/** The French Scrabble distribution, blanks excluded. 100 tiles. */
export const BAG = {
  a: 9, b: 2, c: 2, d: 3, e: 15, f: 2, g: 2, h: 2, i: 8, j: 1,
  k: 1, l: 5, m: 3, n: 6, o: 6, p: 2, q: 1, r: 6, s: 6, t: 6,
  u: 6, v: 2, w: 1, x: 1, y: 1, z: 1,
};

export const VOWELS = 'aeiouy';

/** One entry per tile, ready to be drawn from. */
export function fullBag() {
  const tiles = [];
  for (const [letter, count] of Object.entries(BAG)) {
    for (let i = 0; i < count; i++) tiles.push(letter);
  }
  return tiles;
}

/** Draw tiles without replacement. The same seed always draws the same rack. */
export function drawRack(rng, size = DRAW_SIZE) {
  const tiles = fullBag();
  if (size > tiles.length) {
    throw new Error(`le sac ne contient que ${tiles.length} jetons`);
  }
  const rack = [];
  for (let i = 0; i < size; i++) {
    rack.push(tiles.splice(Math.floor(rng() * tiles.length), 1)[0]);
  }
  return rack;
}

export function countVowels(letters) {
  return [...letters].filter((letter) => VOWELS.includes(letter)).length;
}
