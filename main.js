// main.js
// Entry point: load the dictionary once, then hand over to the router.

import { createRouter } from './core/router.js';
import { createStorage } from './core/storage.js';
import { createStats } from './core/stats.js';
import { mountStatistiques } from './core/stats-screen.js';
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
  function lire() {
    return store.get('corrections', null) ?? {};
  }
  let accepted = new Set(wordList(lire().accepted));
  let rejected = new Set(wordList(lire().rejected));
  return {
    // Getters, not plain properties: createLexicon() keeps this same object
    // for the whole session, and reads `.accepted`/`.rejected` fresh on
    // every validate()/accept()/reject() call. A restored backup calls
    // reload() below, which only makes sense if those reads can pick up the
    // new sets — a plain property captured at construction time never would.
    get accepted() { return accepted; },
    get rejected() { return rejected; },
    save() {
      store.set('corrections', { accepted: [...accepted], rejected: [...rejected] });
    },
    /**
     * Re-reads storage into fresh sets. Without this, restoring a backup
     * writes `corrections` to storage but leaves the sets createLexicon()
     * already captured untouched — a restored word would stay invisible to
     * validate() until a reload, and the very next accept()/reject() would
     * overwrite the restored storage with the stale in-memory state,
     * silently erasing it for good.
     */
    reload() {
      const donnees = lire();
      accepted = new Set(wordList(donnees.accepted));
      rejected = new Set(wordList(donnees.rejected));
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
  // Both warnings sit right under the title, before the game list: they are
  // not commands, and essai_hauteurs.py already shows the list itself
  // reaching the fold at 360x780 — anything placed after it would be
  // invisible exactly when it matters most (a degraded mode nobody can
  // scroll to see is close to as silent as no warning at all).
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
  if (!storage.available) {
    target.append(
      element('p', {
        class: 'sous-titre',
        text:
          'Le stockage est indisponible\u00a0: tes scores et tes préférences ' +
          'ne seront pas conservés cette fois.',
      })
    );
  }
  for (const game of visibleGames) {
    const record = stats.read(game.id);
    target.append(
      button(game.title, () => router.go(game.id)),
      element('p', {
        // A modifier of its own, not just `.sous-titre`: seven of these plus
        // the "Statistiques" button pushed the last one below the fold at
        // 360x780 (essai_hauteurs.py, task 5) — the ordinary reading spacing
        // is more than a list this long can afford. Scoped here so no other
        // screen's `.sous-titre` (Motus's record line, a game's own counter)
        // loses anything.
        class: 'sous-titre sous-titre--accueil',
        // One played game must read "1 partie", not "1 parties". The average was
        // on his screen before the menu grew to three games, so it stays.
        text: record.played
          ? `${game.subtitle} — ${record.played} partie${record.played > 1 ? 's' : ''}, ` +
            `record ${record.best}, moyenne ${record.average}`
          : game.subtitle,
      })
    );
  }
  target.append(
    button('Statistiques', () => router.go('statistiques'),
      { className: 'bouton bouton--discret' })
  );
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
    const corrections = correctionsFrom(storage);
    const lexicon = createLexicon(index, corrections);
    const tools = {
      solver, lexicon, stats, storage, frequencies,
      onQuit: () => router.go('accueil'),
    };

    frequenciesAvailable = frequencies.size > 0;
    visibleGames = GAMES.filter((game) => !game.needsFrequencies || frequenciesAvailable);

    const routes = { accueil: home };
    // GAMES, not visibleGames: a backup must cover every game that has ever
    // recorded a score, including the three that need the frequency list —
    // they only stop being playable while it is missing, their past stats
    // do not stop existing. Passing the degraded list would silently leave
    // them out of every export made while frequencies are unavailable.
    routes.statistiques = (target) => mountStatistiques(target, {
      stats, storage, games: GAMES, onQuit: () => router.go('accueil'),
      onRestore: () => corrections.reload(),
    });
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
