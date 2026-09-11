// main.js
// Entry point: load the dictionary once, then hand over to the router.

import { createRouter } from './core/router.js';
import { createStorage } from './core/storage.js';
import { createStats } from './core/stats.js';
import { element, button } from './core/ui.js';
import { loadIndex, loadFrequencies } from './lexicon/loader.js';
import { createLexicon } from './lexicon/lexicon.js';
import { createSolver } from './lexicon/solver.js';
import { GAMES } from './games/index.js';

const container = document.querySelector('#app');
const storage = createStorage();
const stats = createStats(storage);

/** Same defensive rule as core/stats.js: a stored value that parses but has
 *  the wrong shape must not break the game. */
function wordList(value) {
  return Array.isArray(value) ? value.filter((word) => typeof word === 'string') : [];
}

function correctionsFrom(store) {
  const saved = store.get('corrections', null) ?? {};
  const accepted = new Set(wordList(saved.accepted));
  const rejected = new Set(wordList(saved.rejected));
  return {
    accepted,
    rejected,
    save() {
      store.set('corrections', { accepted: [...accepted], rejected: [...rejected] });
    },
  };
}

/** `file` distinguishes the dictionary load from the frequency load: without
 *  it, both share the same step names and the same messages appear twice on
 *  first launch. */
function showLoading(step, file = 'dictionnaire') {
  const messages = {
    cache: {
      dictionnaire: 'Ouverture du dictionnaire…',
      frequences: 'Ouverture de la liste des mots courants…',
    },
    'téléchargement': {
      dictionnaire: 'Téléchargement du dictionnaire, une seule fois…',
      frequences: 'Téléchargement de la liste des mots courants…',
    },
    lecture: {
      dictionnaire: 'Préparation du dictionnaire…',
      frequences: 'Préparation de la liste des mots courants…',
    },
  };
  container.replaceChildren(
    element('p', { class: 'chargement', text: messages[step]?.[file] ?? 'Chargement…' })
  );
}

function showFailure(error, retry) {
  // The technical detail goes to the console, never to the screen: a failed
  // fetch throws a browser-generated message in the browser's own language,
  // and the player must not be shown English text.
  console.error('dictionnaire indisponible', error);
  container.replaceChildren(
    element('h1', { text: 'Dictionnaire indisponible' }),
    element('p', {
      text:
        'Le dictionnaire n’a pas pu être téléchargé. Vérifie la connexion, ' +
        'puis réessaie.',
    }),
    button('Réessayer', retry)
  );
}

/** Shown when a game's mount throws — router.js has already logged the
 *  technical detail to the console, so this only has to get him back to a
 *  working page, in the same voice as showFailure. It must never mention the
 *  dictionary: that is a different failure, and naming a problem he does not
 *  have would only confuse him further. */
function showGameFailure() {
  container.replaceChildren(
    element('h1', { text: 'Jeu indisponible' }),
    element('p', {
      text: 'Ce jeu n’a pas pu s’ouvrir. Retourne au menu et réessaie.',
    }),
    button('Retour au menu', () => router.go('accueil'))
  );
}

// Set once per start(), from whether the (optional) frequency file could be
// loaded. Read here so home() stays a plain function of `target`, matching
// every other route.
let visibleGames = GAMES;
let frequenciesAvailable = true;

function home(target) {
  target.append(element('h1', { text: 'Jeux de tête' }));
  for (const game of visibleGames) {
    const record = stats.read(game.id);
    target.append(
      button(game.title, () => router.go(game.id)),
      element('p', {
        class: 'sous-titre',
        // One played game must read "1 partie", not "1 parties". The average was
        // on his screen before the menu grew to three games, so it stays.
        text: record.played
          ? `${game.subtitle} — ${record.played} partie${record.played > 1 ? 's' : ''}, ` +
            `record ${record.best}, moyenne ${record.average}`
          : game.subtitle,
      })
    );
  }
  if (!frequenciesAvailable) {
    target.append(
      element('p', {
        class: 'sous-titre',
        text:
          'La liste des mots courants n’a pas pu être ouverte\u00a0: certains ' +
          'jeux sont indisponibles pour l’instant.',
      })
    );
  }
  const streak = stats.streak();
  if (streak > 1) {
    target.append(element('p', { text: `${streak} jours d’affilée.` }));
  }
}

let router;
let hashListenerAttached = false;

async function start() {
  try {
    const index = await loadIndex({ onProgress: (step) => showLoading(step, 'dictionnaire') });

    // The frequency file is optional: anagrams and "tous les mots" need it,
    // but "le mot le plus long" does not, and must not go down with it. Its
    // failure is logged, never shown — showFailure's comment explains why.
    let frequencies;
    try {
      frequencies = await loadFrequencies({ onProgress: (step) => showLoading(step, 'frequences') });
    } catch (error) {
      console.error('liste des mots courants indisponible', error);
      frequencies = new Map();
    }

    const solver = createSolver(index);
    const lexicon = createLexicon(index, correctionsFrom(storage));
    const tools = {
      solver, lexicon, stats, storage, frequencies,
      onQuit: () => router.go('accueil'),
    };

    frequenciesAvailable = frequencies.size > 0;
    visibleGames = GAMES.filter((game) => !game.needsFrequencies || frequenciesAvailable);

    const routes = { accueil: home };
    for (const game of visibleGames) {
      routes[game.id] = (target) => game.mount(target, tools);
    }

    router = createRouter({ routes, container, fallback: 'accueil', onError: showGameFailure });
    router.start();
    if (!hashListenerAttached) {
      globalThis.addEventListener('hashchange', () => router.start());
      hashListenerAttached = true;
    }
  } catch (error) {
    showFailure(error, start);
  }
}

start();

import { registerServiceWorker } from './core/update.js';

function showUpdateBanner(apply) {
  if (document.querySelector('.bandeau')) return; // never stack two
  const banner = element('div', { class: 'bandeau', role: 'status' }, [
    element('span', { text: 'Une nouvelle version est prête.' }),
    button('Recharger', apply),
  ]);
  document.body.prepend(banner);
}

registerServiceWorker(showUpdateBanner);
