// main.js
// Entry point: load the dictionary once, then hand over to the router.

import { createRouter } from './core/router.js';
import { createStorage } from './core/storage.js';
import { createStats } from './core/stats.js';
import { element, button } from './core/ui.js';
import { loadIndex } from './lexicon/loader.js';
import { createLexicon } from './lexicon/lexicon.js';
import { createSolver } from './lexicon/solver.js';
import { mountLongestWord } from './games/mot-le-plus-long/screen.js';

const container = document.querySelector('#app');
const storage = createStorage();
const stats = createStats(storage);

function correctionsFrom(store) {
  const saved = store.get('corrections', { accepted: [], rejected: [] });
  const accepted = new Set(saved.accepted);
  const rejected = new Set(saved.rejected);
  return {
    accepted,
    rejected,
    save() {
      store.set('corrections', { accepted: [...accepted], rejected: [...rejected] });
    },
  };
}

function showLoading(step) {
  const messages = {
    cache: 'Ouverture du dictionnaire…',
    'téléchargement': 'Téléchargement du dictionnaire, une seule fois…',
    lecture: 'Préparation du dictionnaire…',
  };
  container.replaceChildren(
    element('p', { class: 'chargement', text: messages[step] ?? 'Chargement…' })
  );
}

function showFailure(error, retry) {
  container.replaceChildren(
    element('h1', { text: 'Dictionnaire indisponible' }),
    element('p', {
      text:
        'Le dictionnaire n’a pas pu être téléchargé. Vérifie la connexion, ' +
        'puis réessaie. Les jeux qui n’en ont pas besoin restent jouables.',
    }),
    element('p', { class: 'erreur', text: error.message }),
    button('Réessayer', retry)
  );
}

function home(target, { stats: gameStats }) {
  const record = gameStats.read('mot-le-plus-long');
  target.append(
    element('h1', { text: 'Les jeux de papa' }),
    button('Le mot le plus long', () => router.go('mot-le-plus-long')),
    element('p', {
      text: record.played
        ? `${record.played} parties · record ${record.best} lettres · série ${gameStats.streak()} jours`
        : 'Aucune partie jouée pour l’instant.',
    })
  );
}

let router;

async function start() {
  try {
    const index = await loadIndex({ onProgress: showLoading });
    const solver = createSolver(index);
    const lexicon = createLexicon(index, correctionsFrom(storage));
    router = createRouter({
      routes: {
        accueil: (target) => home(target, { stats }),
        'mot-le-plus-long': (target) =>
          mountLongestWord(target, { solver, lexicon, stats, onQuit: () => router.go('accueil') }),
      },
      container,
      fallback: 'accueil',
    });
    router.start();
    globalThis.addEventListener('hashchange', () => router.start());
  } catch (error) {
    showFailure(error, start);
  }
}

start();
