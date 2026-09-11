// games/sudoku/screen.js
// The only file of this game that touches the DOM.

import { button, element } from '../../core/ui.js';
import { createRng, seedFromString } from '../../core/rng.js';
import { DIFFICULTIES } from './generate.js';
import { SAVE_KEY, clearSave, loadOrStart } from './save.js';

const LABELS = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };
// The same three levels as an adjective agreeing with "grille", which is
// feminine: lowercasing the button labels gave "Une grille moyen est en
// cours." Only "moyen" changes form, but the three are spelled out so the
// sentence never has to guess.
const NIVEAUX_FEMININ = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile' };

export function mountSudoku(container, { stats, storage, onQuit }) {
  let game = null;
  let selected = -1;
  let noting = false;
  // The id of the pending "show the end screen" timer, if any — see
  // scheduleFinish() and finish() below. Kept at this scope because both a
  // fresh start() and the router's cleanup need to reach it.
  let finTimer = null;

  /**
   * Defers finish() so the player sees the last digit land before the end
   * screen replaces the grid. `pourJeu` pins down which game this timer
   * belongs to: by the time it fires, `game` may already be a different
   * instance — a new grid started, or the current one abandoned, while the
   * timer was pending. finish() must not act on a game the player never
   * asked to end. Same shape as games/motus/screen.js's scheduleFinish.
   */
  function scheduleFinish(delay, pourJeu) {
    finTimer = setTimeout(() => {
      finTimer = null;
      if (game !== pourJeu) return;
      finish();
    }, delay);
  }

  function render() {
    container.replaceChildren(
      element('h1', { text: 'Sudoku' }),
      game ? renderGame() : renderMenu()
    );
  }

  function renderMenu() {
    const enCours = storage.get(SAVE_KEY, null);
    const children = [];
    if (enCours && Object.hasOwn(LABELS, enCours.difficulty)) {
      children.push(
        element('p', { text: `Une grille ${NIVEAUX_FEMININ[enCours.difficulty]} est en cours.` }),
        button('Reprendre', () => { start(enCours.difficulty); })
      );
    }
    children.push(element('p', { class: 'sous-titre', text: 'Ou une nouvelle grille :' }));
    for (const niveau of Object.keys(DIFFICULTIES)) {
      children.push(
        button(LABELS[niveau], () => { clearSave(storage); start(niveau); },
          niveau === 'facile' ? {} : { className: 'bouton bouton--discret' })
      );
    }
    children.push(button('Retour', onQuit, { className: 'bouton bouton--discret' }));
    return element('div', {}, children);
  }

  function renderGame() {
    const grille = element('div', { class: 'grille-sudoku', role: 'grid', 'aria-label': 'Grille de sudoku' });
    const compteur = element('p', { class: 'sous-titre', role: 'status' });

    // Abandoning a grid is a two-step action, like "Abandonner ces lettres"
    // in games/tous-les-mots/screen.js: a grid can represent days of play, and
    // a stray tap must not destroy it. The first tap only relabels the
    // button; every other control on this screen that stays on screen (a
    // cell, a digit, Effacer, Annuler, Refaire, Notes) puts it back through
    // resetAbandon(). "Reprendre plus tard" and the abandon button itself are
    // the only ones that don't call it — one leaves the screen entirely
    // (tearing the button down with the DOM), the other is the armed action.
    let abandonConfirm = false;
    function resetAbandon() {
      if (!abandonConfirm) return;
      abandonConfirm = false;
      abandonner.textContent = 'Abandonner cette grille';
    }

    function refresh() {
      const conflits = game.conflicts;
      grille.replaceChildren(
        ...Array.from({ length: 81 }, (_, cell) => {
          const valeur = game.valueAt(cell);
          const notes = game.notesAt(cell);
          const classes = ['case-sudoku'];
          if (game.given(cell)) classes.push('case-sudoku--indice');
          if (cell === selected) classes.push('case-sudoku--choisie');
          if (conflits.has(cell)) classes.push('case-sudoku--conflit');
          const etiquette = valeur
            ? `ligne ${Math.floor(cell / 9) + 1}, colonne ${(cell % 9) + 1}, ${valeur}`
            : `ligne ${Math.floor(cell / 9) + 1}, colonne ${(cell % 9) + 1}, vide`;
          return element('button', {
            class: classes.join(' '),
            type: 'button',
            'aria-label': conflits.has(cell) ? `${etiquette}, en conflit` : etiquette,
            onClick: () => { resetAbandon(); selected = cell; refresh(); },
          }, valeur
            ? [element('span', { class: 'chiffre-sudoku', text: String(valeur) })]
            // `data-note` is what places the mark: css/sudoku.css gives each
            // digit a fixed square of the three-by-three inside the cell, so a
            // new mark never shifts the ones already written.
            : notes.map((n) => element('span', {
              class: 'note-sudoku', 'data-note': String(n), text: String(n),
            })));
        })
      );
      compteur.textContent =
        `${LABELS[game.difficulty]} — ${game.mistakes} erreur${game.mistakes > 1 ? 's' : ''}`;
      annuler.disabled = !game.canUndo;
      refaire.disabled = !game.canRedo;
    }

    function poser(valeur) {
      resetAbandon();
      if (selected < 0 || game.phase === 'terminée') return;
      if (noting) game.toggleNote(selected, valeur);
      else game.place(selected, valeur);
      refresh();
      if (game.phase === 'terminée') {
        const reduitMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Not the timer this project forbids: the outcome is already decided,
        // so nothing here pressures the player mid-turn. It only delays
        // finish() so he sees the last digit land before the end screen
        // replaces the grid.
        scheduleFinish(reduitMotion ? 0 : 300, game);
      }
    }

    const clavier = element('div', { class: 'clavier-sudoku' },
      [...Array(9).keys()].map((i) =>
        button(String(i + 1), () => poser(i + 1), { className: 'touche-sudoku' })
      ).concat(
        button('Effacer', () => {
          resetAbandon();
          // A pending scheduleFinish() (the grid was just completed) leaves
          // this button live a moment longer: guard the same way poser()
          // does, or game.erase() throws on a finished game.
          if (selected < 0 || game.phase === 'terminée') return;
          game.erase(selected);
          refresh();
        }, { className: 'touche-sudoku touche-sudoku--large' })
      )
    );

    const annuler = button('Annuler', () => {
      resetAbandon();
      if (game.phase === 'terminée') return;
      game.undo();
      refresh();
    }, { className: 'bouton bouton--discret' });
    const refaire = button('Refaire', () => {
      resetAbandon();
      if (game.phase === 'terminée') return;
      game.redo();
      refresh();
    }, { className: 'bouton bouton--discret' });
    // `\u00a0` rather than a literal no-break space: an invisible character in
    // the source is the kind of thing a later edit silently drops.
    const notes = button('Notes\u00a0: non', () => {
      resetAbandon();
      noting = !noting;
      // A no-break space before the colon: French typography requires it, and
      // it also stops the label from wrapping as « Notes » / « : non ».
      notes.textContent = `Notes\u00a0: ${noting ? 'oui' : 'non'}`;
      notes.setAttribute('aria-pressed', String(noting));
    }, { className: 'bouton bouton--discret', 'aria-pressed': 'false' });

    const abandonner = button('Abandonner cette grille', () => {
      if (!abandonConfirm) {
        abandonConfirm = true;
        abandonner.textContent = 'Confirmer l’abandon';
        return;
      }
      if (finTimer !== null) {
        clearTimeout(finTimer);
        finTimer = null;
      }
      clearSave(storage);
      game = null;
      selected = -1;
      render();
    }, { className: 'bouton bouton--discret' });

    // No resetAbandon() here, and none is needed: leaving the screen unmounts
    // it, and coming back rebuilds this whole closure — a fresh abandonConfirm
    // at false and a fresh button carrying its first label. See the comment on
    // resetAbandon() above.
    const plusTard = button('Reprendre plus tard', onQuit,
      { className: 'bouton bouton--discret' });

    refresh();

    // Two rows of side-by-side buttons rather than five stacked ones. Four
    // full-width buttons pushed "Abandonner cette grille" below the fold of a
    // 360 × 780 screen, and the player this is built for has no way of knowing
    // that a button she cannot see exists. Measured: 821 px of content before,
    // 745 px after, on the same screen.
    return element('div', {}, [
      compteur,
      grille,
      clavier,
      element('div', { class: 'actions-sudoku' }, [annuler, refaire, notes]),
      element('div', { class: 'actions-sudoku' }, [plusTard, abandonner]),
    ]);
  }

  function finish() {
    // Cancel any pending scheduleFinish() first, as its first action, so a
    // second path to finish() — today only start()'s synchronous check on a
    // grid that was already complete on load — can never also fire a stale
    // timer later: on this game (double stats) or on whatever the player has
    // navigated to since. Same shape as games/motus/screen.js's finish().
    if (finTimer !== null) {
      clearTimeout(finTimer);
      finTimer = null;
    }
    const resultat = game.finish();
    clearSave(storage);
    // Fewer mistakes is better, like Motus counts attempts — core/stats.js needs
    // telling, or the menu would show his worst grid as his record.
    stats.record('sudoku', resultat.mistakes, { lowerIsBetter: true });
    container.replaceChildren(
      element('h1', { text: 'Grille terminée' }),
      element('p', {
        class: 'score',
        text: resultat.mistakes === 0
          ? 'Sans une seule erreur.'
          : `Avec ${resultat.mistakes} erreur${resultat.mistakes > 1 ? 's' : ''}.`,
      }),
      button('Une autre grille', () => { game = null; selected = -1; render(); }),
      button('Retour', onQuit, { className: 'bouton bouton--discret' })
    );
  }

  function start(niveau) {
    game = loadOrStart({
      storage, difficulty: niveau,
      rng: createRng(seedFromString(String(Date.now()))),
    });
    selected = -1;
    // renderGame() always builds the notes toggle with the hardcoded label
    // "Notes : non": without this reset, notes left on in a previous grid
    // would silently survive into this one while the button still claimed
    // they were off, turning every digit press into a pencil mark.
    noting = false;
    // A save is written by the move itself, so an app killed between the last
    // digit and the end screen leaves a complete grid in storage: it comes
    // back already finished, and he must see the ending, not a frozen board.
    if (game.phase === 'terminée') finish();
    else render();
  }

  render();
  // A real cleanup, not a no-op: leaving the screen (back button, another
  // route) while a scheduleFinish() timer is pending must not leave that
  // timer alive to overwrite whatever the router mounts next.
  return () => {
    if (finTimer !== null) {
      clearTimeout(finTimer);
      finTimer = null;
    }
  };
}
