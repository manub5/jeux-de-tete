// games/mot-le-plus-long/screen.js
// The only file of this game that touches the DOM.

import { button, element } from '../../core/ui.js';
import { createRng, seedFromString } from '../../core/rng.js';
import { DRAW_SIZE } from './draw.js';
import { createGame } from './game.js';

export function mountLongestWord(container, { solver, lexicon, stats, onQuit }) {
  let game;

  function render() {
    container.replaceChildren(
      element('h1', { text: 'Le mot le plus long' }),
      renderLetters(),
      game.phase === 'tirage' ? renderDraw() : renderSearch()
    );
  }

  function renderLetters() {
    const tiles = game.letters.map((letter) =>
      element('span', { class: 'jeton', text: letter.toUpperCase() })
    );
    const remaining = DRAW_SIZE - game.letters.length;
    for (let i = 0; i < remaining; i++) {
      tiles.push(element('span', { class: 'jeton jeton--vide', text: '·' }));
    }
    return element('div', { class: 'tirage', 'aria-label': 'Lettres tirées' }, tiles);
  }

  function renderDraw() {
    return element('div', { class: 'actions' }, [
      button('Voyelle', () => { game.drawLetter('voyelle'); render(); }),
      button('Consonne', () => { game.drawLetter('consonne'); render(); }),
    ]);
  }

  function renderSearch() {
    if (game.barren) {
      return element('div', {}, [
        element('p', { text: 'Ce tirage ne donne rien d’intéressant.' }),
        button('Refaire un tirage', newGame),
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
          ? `${result.word} — ${result.length} lettres, votre meilleur mot !`
          : `${result.word} — ${result.length} lettres.`;
        feedback.replaceChildren(feedback.textContent, refuseButton(result.word));
      } else if (result.reason === 'lettres') {
        feedback.className = 'retour erreur';
        feedback.textContent = 'Ce mot utilise des lettres qui ne sont pas dans le tirage.';
      } else if (result.reason === 'refusé') {
        // He struck this word out himself; offer him the way back.
        feedback.className = 'retour erreur';
        feedback.textContent = `« ${attempt} » est dans vos mots refusés.`;
        feedback.append(acceptButton(attempt));
      } else {
        feedback.className = 'retour erreur';
        feedback.textContent = `« ${attempt} » n’est pas dans le dictionnaire.`;
        feedback.append(acceptButton(attempt));
      }
      field.value = '';
      field.focus();
      refreshScore();
      refreshProposals();
    }

    /** Spec section 5: the player's own corrections, offered where it hurts. */
    function acceptButton(word) {
      return button('Ce mot existe', () => {
        lexicon.accept(word);
        // Replay it straight away: telling him the word is accepted while his
        // score does not move is worse than refusing it in the first place.
        field.value = word;
        submit();
      }, { className: 'bouton bouton--discret' });
    }

    function refuseButton(word) {
      return button('Ce mot ne devrait pas exister', () => {
        lexicon.reject(word);
        feedback.className = 'retour';
        feedback.textContent =
          `« ${word} » est retiré de votre dictionnaire. Il reste compté pour cette partie.`;
      }, { className: 'bouton bouton--discret' });
    }

    const score = element('p', { class: 'score' });
    function refreshScore() {
      score.textContent = game.score
        ? `Votre meilleur mot : ${game.score} lettres`
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
    const result = game.finish();
    stats.record('mot-le-plus-long', result.score);
    container.replaceChildren(
      element('h1', { text: 'Partie terminée' }),
      renderLetters(),
      element('p', {
        class: 'score',
        text: `Votre score : ${result.score} lettres`,
      }),
      element('p', {
        text: result.bestWord
          ? `La meilleure solution était « ${result.bestWord} » (${result.bestLength} lettres).`
          : 'Aucun mot n’était trouvable dans ce tirage.',
      }),
      element('details', {}, [
        element('summary', { text: `Voir les ${result.found.length} mots possibles` }),
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
  return () => {};
}
