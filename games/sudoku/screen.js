// games/sudoku/screen.js
// The only file of this game that touches the DOM.

import { button, element } from '../../core/ui.js';
import { createRng, seedFromString } from '../../core/rng.js';
import { DIFFICULTIES } from './generate.js';
import { SAVE_KEY, clearSave, loadOrStart } from './save.js';

const LABELS = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };

export function mountSudoku(container, { stats, storage, onQuit }) {
  let game = null;
  let selected = -1;
  let noting = false;

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
        element('p', { text: `Une grille ${LABELS[enCours.difficulty].toLowerCase()} est en cours.` }),
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
            onClick: () => { selected = cell; refresh(); },
          }, valeur
            ? [element('span', { class: 'chiffre-sudoku', text: String(valeur) })]
            : notes.map((n) => element('span', { class: 'note-sudoku', text: String(n) })));
        })
      );
      compteur.textContent =
        `${LABELS[game.difficulty]} — ${game.mistakes} erreur${game.mistakes > 1 ? 's' : ''}`;
      annuler.disabled = !game.canUndo;
      refaire.disabled = !game.canRedo;
    }

    function poser(valeur) {
      if (selected < 0 || game.phase === 'terminée') return;
      if (noting) game.toggleNote(selected, valeur);
      else game.place(selected, valeur);
      refresh();
      if (game.phase === 'terminée') finish();
    }

    const clavier = element('div', { class: 'clavier-sudoku' },
      [...Array(9).keys()].map((i) =>
        button(String(i + 1), () => poser(i + 1), { className: 'touche-sudoku' })
      ).concat(
        button('Effacer', () => {
          if (selected >= 0) { game.erase(selected); refresh(); }
        }, { className: 'touche-sudoku touche-sudoku--large' })
      )
    );

    const annuler = button('Annuler', () => { game.undo(); refresh(); },
      { className: 'bouton bouton--discret' });
    const refaire = button('Refaire', () => { game.redo(); refresh(); },
      { className: 'bouton bouton--discret' });
    const notes = button('Notes : non', () => {
      noting = !noting;
      notes.textContent = `Notes : ${noting ? 'oui' : 'non'}`;
      notes.setAttribute('aria-pressed', String(noting));
    }, { className: 'bouton bouton--discret', 'aria-pressed': 'false' });

    refresh();

    return element('div', {}, [
      compteur,
      grille,
      clavier,
      element('div', { class: 'actions' }, [annuler, refaire]),
      notes,
      button('Abandonner cette grille', () => {
        clearSave(storage);
        game = null;
        selected = -1;
        render();
      }, { className: 'bouton bouton--discret' }),
      button('Reprendre plus tard', onQuit, { className: 'bouton bouton--discret' }),
    ]);
  }

  function finish() {
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
    render();
  }

  render();
  return () => {};
}
