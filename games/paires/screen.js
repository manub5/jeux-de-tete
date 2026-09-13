// games/paires/screen.js
import { element, button } from '../../core/ui.js';
import { NIVEAUX, createPairsGame } from './game.js';
import { saveGame, loadGame, clearSave, resumableSave } from './save.js';
import { SYMBOLES, svgDuSymbole } from './symboles.js';

const LIBELLES = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };
const PAR_ID = new Map(SYMBOLES.map((s) => [s.id, s]));

/** How long a missed pair stays visible before it turns back. */
const REGARD = 900;

export function mountPairs(container, { stats, storage, onQuit }) {
  let game = null;
  let couvreTimer = null;
  let finTimer = null;
  let abandonConfirm = false;
  /** The current board's abandon button, so resetAbandon() can relabel it
      without rebuilding the screen underneath a tap in progress. */
  let abandonBouton = null;

  const reduit = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  function annulerMinuteries() {
    for (const id of [couvreTimer, finTimer]) if (id !== null) clearTimeout(id);
    couvreTimer = null;
    finTimer = null;
  }

  function resetAbandon() {
    if (!abandonConfirm) return;
    abandonConfirm = false;
    // Relabel, never re-render: render() replaces the whole board, and jouer()
    // would then paint detached nodes — the flip would happen in the rules and
    // nothing would move on screen.
    if (abandonBouton) abandonBouton.textContent = 'Abandonner cette partie';
  }

  function render() {
    abandonBouton = null;
    container.replaceChildren(game ? renderGame() : renderMenu());
  }

  function renderMenu() {
    const reprise = resumableSave(storage);
    const enfants = [
      element('h1', { text: 'Les paires' }),
      element('p', {
        class: 'sous-titre',
        text: 'Retrouvez les paires en retournant le moins de cartes possible.',
      }),
    ];
    if (reprise) {
      enfants.push(element('p', {
        text: `Une partie ${LIBELLES[reprise.niveau].toLowerCase()} est en cours `
          + `(${reprise.flips} retournement${reprise.flips > 1 ? 's' : ''}).`,
      }));
      enfants.push(button('Reprendre', () => {
        game = loadGame(storage);
        if (!game) { clearSave(storage); render(); return; }
        render();
      }));
    }
    for (const nom of Object.keys(NIVEAUX)) {
      enfants.push(button(
        `${LIBELLES[nom]} — ${NIVEAUX[nom].paires} paires`,
        () => start(nom),
        reprise || nom !== 'facile' ? { className: 'bouton bouton--discret' } : {}));
    }
    enfants.push(button('Retour', onQuit, { className: 'bouton bouton--discret' }));
    return element('div', {}, enfants);
  }

  function start(nom) {
    annulerMinuteries();
    abandonConfirm = false;
    clearSave(storage);
    game = createPairsGame({ rng: Math.random, niveau: nom });
    saveGame(storage, game);
    render();
  }

  function renderGame() {
    const pourJeu = game;
    const compteur = element('p', { class: 'sous-titre', role: 'status' });
    const plateau = element('div', { class: 'plateau-paires' });
    plateau.style.setProperty('--colonnes-paires', String(game.colonnes));

    const cartes = game.cards.map((_, index) =>
      button('', () => jouer(index), { className: 'carte-paires' }));
    for (const carte of cartes) plateau.append(carte);

    function peindre() {
      compteur.textContent =
        `${LIBELLES[game.niveau]} — ${game.flips} retournement`
        + `${game.flips > 1 ? 's' : ''}, minimum ${game.minimum}`;
      game.cards.forEach((etat, i) => {
        const bouton = cartes[i];
        const visible = etat.montree || etat.appariee;
        bouton.className = 'carte-paires'
          + (visible ? ' carte-paires--montree' : '')
          + (etat.appariee ? ' carte-paires--appariee' : '');
        bouton.replaceChildren();
        if (visible) {
          bouton.append(svgDuSymbole(PAR_ID.get(etat.symbole)));
          bouton.setAttribute('aria-label',
            etat.appariee
              ? `${PAR_ID.get(etat.symbole).libelle}, trouvée`
              : PAR_ID.get(etat.symbole).libelle);
        } else {
          bouton.setAttribute('aria-label', `Carte ${i + 1}, face cachée`);
        }
        bouton.disabled = etat.appariee || game.phase === 'terminée';
      });
    }

    function jouer(index) {
      resetAbandon();
      if (game !== pourJeu || game.phase === 'terminée') return;
      if (couvreTimer !== null) { clearTimeout(couvreTimer); couvreTimer = null; }
      game.flip(index);
      saveGame(storage, game);
      peindre();
      if (game.phase === 'terminée') { programmerFin(pourJeu); return; }
      const ouvertes = game.cards.filter((c) => c.montree && !c.appariee).length;
      if (ouvertes === 2) {
        couvreTimer = setTimeout(() => {
          couvreTimer = null;
          if (game !== pourJeu) return;
          game.resolve();
          saveGame(storage, game);
          peindre();
        }, reduit ? 0 : REGARD);
      }
    }

    const annuler = button('Abandonner cette partie', () => {
      if (!abandonConfirm) {
        abandonConfirm = true;
        annuler.textContent = 'Confirmer l’abandon';
        return;
      }
      annulerMinuteries();
      clearSave(storage);
      game = null;
      render();
    }, { className: 'bouton bouton--discret' });

    const plusTard = button('Reprendre plus tard', onQuit,
      { className: 'bouton bouton--discret' });

    abandonBouton = annuler;
    peindre();
    return element('div', {}, [
      compteur,
      plateau,
      element('div', { class: 'actions-paires' }, [plusTard, annuler]),
    ]);
  }

  /**
   * Lets the last pair be seen before the end screen replaces the board.
   * `pourJeu` pins which game this timer belongs to: by the time it fires,
   * `game` may already be another one, or none.
   */
  function programmerFin(pourJeu) {
    if (finTimer !== null) clearTimeout(finTimer);
    finTimer = setTimeout(() => {
      finTimer = null;
      if (game !== pourJeu) return;
      finish(pourJeu);
    }, reduit ? 0 : 700);
  }

  function finish(pourJeu) {
    annulerMinuteries();
    const flips = pourJeu.flips;
    const minimum = pourJeu.minimum;
    // Recorded as flips ABOVE the theoretical minimum, not raw flips: a perfect
    // 6x10 costs 60 and a mediocre 6x5 costs 40, so a raw record would freeze on
    // the easiest level for ever and stop meaning anything. Zero above the
    // minimum is a perfect game at any size.
    stats.record('paires', flips - minimum, { lowerIsBetter: true });
    clearSave(storage);
    game = null;
    container.replaceChildren(element('div', {}, [
      element('h1', { text: 'Toutes les paires sont trouvées\u00a0!' }),
      element('p', {
        class: 'score',
        text: flips === minimum
          ? `En ${flips} retournements\u00a0: le minimum possible. Sans une seule erreur.`
          : `En ${flips} retournements, pour un minimum de ${minimum}.`,
      }),
      button('Nouvelle partie', () => start(pourJeu.niveau)),
      button('Retour', onQuit, { className: 'bouton bouton--discret' }),
    ]));
  }

  // If the app was killed in the 700ms window between the winning flip and
  // finish() actually running (programmerFin), the save still holds a
  // 'terminée' board whose score was never recorded. resumableSave()
  // correctly hides a finished game from "Reprendre" — so without this
  // check it would just vanish on the next visit, no message, no stats.
  // Same recovery the sudoku screen makes at mount, for the same reason.
  const sauveTerminee = loadGame(storage);
  if (sauveTerminee && sauveTerminee.phase === 'terminée') {
    finish(sauveTerminee);
  } else {
    render();
  }
  return () => annulerMinuteries();
}
