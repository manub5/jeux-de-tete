// games/mot-le-plus-long/screen.js
// The only file of this game that touches the DOM.

import { button, element } from '../../core/ui.js';
import { createRng, seedFromString } from '../../core/rng.js';
import { messageFin, messageRecord } from '../../core/encouragements.js';
import { showPopup } from '../../core/popup.js';
import { createGame } from './game.js';

export function mountLongestWord(container, { solver, lexicon, stats, onQuit }) {
  let game;
  let fermerPopup = null;

  function render() {
    container.replaceChildren(
      element('h1', { text: 'Le mot le plus long' }),
      renderLetters(),
      renderSearch()
    );
  }

  function renderLetters() {
    // The rack is always complete: the program deals it, the player reads it.
    return element(
      'div',
      { class: 'tirage', 'aria-label': 'Vos dix lettres' },
      // `--rang` échelonne la chute : le reste est dans la feuille de style.
      game.letters.map((letter, rang) =>
        element('span', {
          class: 'jeton',
          style: `--rang: ${rang}`,
          text: letter.toUpperCase(),
        })
      )
    );
  }

  function renderSearch() {
    if (game.barren) {
      return element('div', {}, [
        element('p', { text: 'Ces lettres ne donnent rien d’intéressant.' }),
        button('D’autres lettres', newGame),
      ]);
    }

    const field = element('input', {
      type: 'text', class: 'saisie', autocomplete: 'off',
      autocapitalize: 'none', spellcheck: 'false',
      'aria-label': 'Votre mot',
    });
    const feedback = element('p', { class: 'retour', role: 'status' });

    function submit() {
      const attempt = field.value.trim();
      if (!attempt) return;
      const result = game.propose(attempt);
      if (result.ok) {
        feedback.className = 'retour succes';
        feedback.textContent = result.improved
          ? `${result.word} — ${result.length} lettres, votre meilleur mot\u00a0!`
          : `${result.word} — ${result.length} lettres.`;
      } else if (result.reason === 'lettres') {
        feedback.className = 'retour erreur';
        feedback.textContent = 'Ce mot utilise des lettres qui ne sont pas dans le tirage.';
      } else if (result.reason === 'refusé') {
        feedback.className = 'retour erreur';
        feedback.textContent = `«\u00a0${attempt}\u00a0» est dans vos mots refusés.`;
      } else {
        feedback.className = 'retour erreur';
        feedback.textContent = `«\u00a0${attempt}\u00a0» n’est pas dans le dictionnaire.`;
      }
      field.value = '';
      field.focus();
      refreshScore();
      refreshProposals();
    }

    const score = element('p', { class: 'score' });
    function refreshScore() {
      score.textContent = game.score
        ? `Votre meilleur mot\u00a0: ${game.score} lettres`
        : 'Aucun mot trouvé pour l’instant.';
    }
    refreshScore();

    const proposals = element('ul', { class: 'propositions' });
    function refreshProposals() {
      proposals.replaceChildren(
        ...game.proposals.map((entry) =>
          element('li', { text: `${entry.word} (${entry.length})` })
        )
      );
    }
    refreshProposals();

    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });

    return element('div', {}, [
      element('p', {
        class: 'objectif',
        text: `Il existe un mot de ${game.bestLength} lettres.`,
      }),
      field,
      button('Proposer', submit),
      feedback,
      score,
      proposals,
      button('J’ai terminé', finish, { className: 'bouton bouton--discret' }),
    ]);
  }

  function finish() {
    fermerPopup?.();
    const result = game.finish();
    const { isRecord } = stats.record('mot-le-plus-long', result.score);
    // As good as this rack gets, a word found but shorter than the best, or
    // nothing at all — the same three-tier read as every other game.
    const tier = result.score === 0 ? 'encourageant'
      : result.score >= result.bestLength ? 'excellent' : 'bien';
    fermerPopup = showPopup(
      isRecord ? `${messageRecord()} ${messageFin(tier)}` : messageFin(tier)
    );
    container.replaceChildren(
      element('h1', { text: 'Partie terminée' }),
      renderLetters(),
      element('p', {
        class: 'score',
        text: `Votre score\u00a0: ${result.score} lettres`,
      }),
      element('p', {
        text: result.bestWord
          ? `La meilleure solution était «\u00a0${result.bestWord}\u00a0» (${result.bestLength} lettres).`
          : 'Aucun mot n’était trouvable dans ce tirage.',
      }),
      element('details', {}, [
        element('summary', { text: result.found.length === 1
          ? 'Voir le seul mot possible'
          : `Voir les ${result.found.length} mots possibles` }),
        element('p', { text: result.found.join(', ') }),
      ]),
      button('Nouvelle partie', newGame),
      button('Retour', onQuit, { className: 'bouton bouton--discret' })
    );
  }

  function newGame() {
    game = createGame({ solver, lexicon, rng: createRng(seedFromString(String(Date.now()))) });
    render();
  }

  newGame();
  return () => { fermerPopup?.(); };
}
