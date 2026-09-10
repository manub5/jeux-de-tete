// lexicon/signature.js
// Twin of tools/dic/text.py. The folding table below MUST stay identical to the
// Python one: a mismatch makes words silently unreachable in the game.

const SINGLE = {
  à: 'a', â: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  î: 'i', ï: 'i',
  ô: 'o', ö: 'o',
  ù: 'u', û: 'u', ü: 'u',
  ç: 'c',
  ÿ: 'y',
};
const DOUBLE = { œ: 'oe', æ: 'ae' };

/** Lowercase, then replace accented letters and ligatures by plain ones. */
export function fold(word) {
  let out = '';
  for (const character of word.toLowerCase()) {
    out += DOUBLE[character] ?? SINGLE[character] ?? character;
  }
  return out;
}

/** The word's letters, folded and sorted. Anagrams share a signature. */
export function signature(word) {
  return [...fold(word)].sort().join('');
}

/** How many times each letter appears. */
export function countLetters(letters) {
  const counts = new Map();
  for (const letter of letters) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}
