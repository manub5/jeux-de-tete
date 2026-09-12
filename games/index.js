// The declarative list of games. Adding one means adding an entry here: the
// menu, the routes and the statistics screen all read from this.

import { mountLongestWord } from './mot-le-plus-long/screen.js';
import { mountAnagrammes } from './anagrammes/screen.js';
import { mountAllWords } from './tous-les-mots/screen.js';
import { mountMotus } from './motus/screen.js';
import { mountSudoku } from './sudoku/screen.js';
import { mountPairs } from './paires/screen.js';

export const GAMES = [
  {
    id: 'mot-le-plus-long',
    title: 'Le mot le plus long',
    subtitle: 'Dix lettres, le plus long mot possible.',
    mount: mountLongestWord,
  },
  {
    id: 'anagrammes',
    title: 'Anagrammes',
    subtitle: 'Un mot mélangé à remettre dans l’ordre.',
    mount: mountAnagrammes,
    needsFrequencies: true,
  },
  {
    id: 'tous-les-mots',
    title: 'Trouver tous les mots',
    subtitle: 'Sept lettres, autant de mots que possible.',
    mount: mountAllWords,
    needsFrequencies: true,
  },
  {
    id: 'motus',
    title: 'Motus',
    subtitle: 'Un mot à deviner en six essais.',
    mount: mountMotus,
    needsFrequencies: true,
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    subtitle: 'La grille classique, trois niveaux.',
    mount: mountSudoku,
  },
  {
    id: 'paires',
    title: 'Les paires',
    subtitle: 'Retrouver les paires, en retournant le moins de cartes possible.',
    mount: mountPairs,
  },
];
