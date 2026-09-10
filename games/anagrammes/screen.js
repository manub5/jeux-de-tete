// games/anagrammes/screen.js
// The only file of this game that touches the DOM.

import { button, element } from '../../core/ui.js';
import { createRng, seedFromString } from '../../core/rng.js';
import { LEVELS } from './pick.js';
import { HINT_COST, createAnagram } from './game.js';

const LABELS = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };

export function mountAnagrammes(container, { solver, lexicon, stats, frequencies, onQuit }) {
  let game = null;

  function render() {
    container.replaceChildren(
      element('h1', { text: 'Anagrammes' }),
      game ? renderGame() : renderLevels()
    );
  }

  function renderLevels() {
    return element('div', {}, [
      element('p', { text: 'Quel niveau ?' }),
      element('div', { class: 'niveaux' },
        Object.keys(LEVELS).map((level) =>
          button(`${LABELS[level]} — ${LEVELS[level][0]} à ${LEVELS[level][1]} lettres`,
            () => start(level))
        )
      ),
      button('Retour', onQuit, { className: 'bouton bouton--discret' }),
    ]);
  }

  function renderGame() {
    const tiles = element('div', { class: 'tirage', 'aria-label': 'Lettres mélangées' },
      game.tiles.map((letter, rang) =>
        element('span', { class: 'jeton', style: `--rang: ${rang}`, text: letter.toUpperCase() })
      )
    );

    const slots = element('div', { class: 'places', 'aria-label': 'Lettres dévoilées' });
    function refreshSlots() {
      slots.replaceChildren(
        ...game.revealed.map((letter) =>
          element('span', {
            class: letter ? 'place place--connue' : 'place',
            text: letter ? letter.toUpperCase() : '·',
          })
        )
      );
    }
    refreshSlots();

    const field = element('input', {
      type: 'text', class: 'saisie', autocomplete: 'off',
      autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Votre mot',
    });
    const feedback = element('p', { class: 'retour', role: 'status' });

    function submit() {
      const attempt = field.value.trim();
      if (!attempt) return;
      const result = game.propose(attempt);
      if (result.ok) {
        finish();
        return;
      }
      feedback.className = 'retour erreur';
      feedback.textContent =
        result.reason === 'lettres'
          ? 'Ce mot n’utilise pas exactement ces lettres.'
          : `« ${attempt} » n’est pas dans le dictionnaire.`;
      field.value = '';
      field.focus();
    }

    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });

    return element('div', {}, [
      tiles,
      slots,
      field,
      button('Proposer', submit),
      feedback,
      button(`Un indice (−${HINT_COST} points)`, () => {
        game.hint();
        refreshSlots();
        if (game.phase === 'terminée') finish();
      }, { className: 'bouton bouton--discret' }),
      button('Je donne ma langue au chat', finish, { className: 'bouton bouton--discret' }),
    ]);
  }

  function finish() {
    const result = game.finish();
    stats.record('anagrammes', result.score);
    container.replaceChildren(
      element('h1', { text: result.found ? 'Trouvé !' : 'Partie terminée' }),
      element('p', { class: 'score', text: `Votre score : ${result.score} points` }),
      element('p', {
        text: result.found
          ? `Le mot était bien « ${result.word} ».`
          : `Le mot était « ${result.word} ».`,
      }),
      button('Nouvelle partie', () => { game = null; render(); }),
      button('Retour', onQuit, { className: 'bouton bouton--discret' })
    );
  }

  function start(level) {
    game = createAnagram({
      solver, lexicon, frequencies, level,
      rng: createRng(seedFromString(String(Date.now()))),
    });
    render();
  }

  render();
  return () => {};
}
